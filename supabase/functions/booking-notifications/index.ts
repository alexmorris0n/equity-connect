// Supabase Edge Function: Send branded booking confirmation emails with ICS attachment
// Receives Nylas webhook, looks up broker/lead, sends via Brevo

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { encode as base64Encode } from 'https://deno.land/std@0.168.0/encoding/base64.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
};

// Format phone number as (XXX) XXX-XXXX
function formatPhoneNumber(phone: string | null): string {
  if (!phone) return 'our office';
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  }
  if (digits.length === 11 && digits.startsWith('1')) {
    return `(${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
  }
  return phone;
}

// Format date in specific timezone
function formatDateInTimezone(timestamp: number, timezone: string) {
  const date = new Date(timestamp * 1000);
  const full = date.toLocaleString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZone: timezone,
    timeZoneName: 'short'
  });
  const short = date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    timeZone: timezone
  });
  return { full, short };
}

// Generate ICS calendar file content
function generateICS(event: {
  title: string;
  startTime: number;
  endTime: number;
  location?: string;
  description?: string;
  organizerName: string;
  organizerEmail: string;
  attendeeName?: string;
  attendeeEmail: string;
}) {
  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp * 1000);
    return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  };

  const uid = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}@equityconnectguide.com`;
  const now = formatDate(Math.floor(Date.now() / 1000));
  const start = formatDate(event.startTime);
  const end = formatDate(event.endTime);

  const escapeICS = (str: string) => str.replace(/[\\;,\n]/g, (match) => {
    if (match === '\n') return '\\n';
    return '\\' + match;
  });

  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Equity Connect Guide//Booking Notifications//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:REQUEST',
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTAMP:${now}`,
    `DTSTART:${start}`,
    `DTEND:${end}`,
    `SUMMARY:${escapeICS(event.title)}`,
    `ORGANIZER;CN=${escapeICS(event.organizerName)}:mailto:${event.organizerEmail}`,
    `ATTENDEE;PARTSTAT=NEEDS-ACTION;RSVP=TRUE;CN=${escapeICS(event.attendeeName || event.attendeeEmail)}:mailto:${event.attendeeEmail}`
  ];

  if (event.location) {
    lines.push(`LOCATION:${escapeICS(event.location)}`);
  }
  if (event.description) {
    lines.push(`DESCRIPTION:${escapeICS(event.description)}`);
  }

  lines.push(
    'STATUS:CONFIRMED',
    'SEQUENCE:0',
    'BEGIN:VALARM',
    'TRIGGER:-PT30M',
    'ACTION:DISPLAY',
    'DESCRIPTION:Reminder: Your appointment is in 30 minutes',
    'END:VALARM',
    'BEGIN:VALARM',
    'TRIGGER:-P1D',
    'ACTION:DISPLAY',
    'DESCRIPTION:Reminder: Your appointment is tomorrow',
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR'
  );

  return lines.join('\r\n');
}

serve(async (req) => {
  const url = new URL(req.url);

  // Handle Nylas webhook verification (GET with challenge param)
  if (req.method === 'GET') {
    const challenge = url.searchParams.get('challenge');
    if (challenge) {
      console.log('Nylas webhook verification, returning challenge:', challenge);
      return new Response(challenge, {
        status: 200,
        headers: { 'Content-Type': 'text/plain' }
      });
    }
  }

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Parse Nylas webhook payload
    const payload = await req.json();
    console.log('Received webhook payload:', JSON.stringify(payload, null, 2));

    // Nylas v3 webhook structure
    const eventType = payload.type;
    const eventData = payload.data?.object;

    if (!eventData) {
      console.log('No event data in payload, skipping');
      return new Response(JSON.stringify({ status: 'skipped', reason: 'no event data' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Extract event details
    const grantId = payload.data?.grant_id;
    const eventTitle = eventData.title || 'Consultation Appointment';
    const eventWhen = eventData.when;
    const participants = eventData.participants || [];
    const location = eventData.location || '';
    const description = eventData.description || '';

    console.log('Event details:', { grantId, eventTitle, eventWhen, participants });

    // Initialize Supabase client
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Look up broker by Nylas grant_id (include timezone)
    const { data: broker, error: brokerError } = await supabaseClient
      .from('brokers')
      .select('id, contact_name, company_name, email, phone, timezone')
      .eq('nylas_grant_id', grantId)
      .single();

    if (brokerError || !broker) {
      console.error('Broker not found for grant_id:', grantId, brokerError);
      return new Response(JSON.stringify({ status: 'error', reason: 'broker not found' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log('Found broker:', broker.contact_name, broker.company_name, 'TZ:', broker.timezone);

    // Find attendee email (not the broker)
    const attendee = participants.find((p: { email: string }) => p.email !== broker.email);

    if (!attendee) {
      console.log('No external attendee found, skipping email');
      return new Response(JSON.stringify({ status: 'skipped', reason: 'no attendee' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Get start and end times
    const startTime = eventWhen?.start_time || Math.floor(Date.now() / 1000);
    const endTime = eventWhen?.end_time || startTime + 3600;

    // Use broker's timezone (default to America/Los_Angeles)
    const timezone = broker.timezone || 'America/Los_Angeles';

    // Format appointment time in broker's timezone
    const { full: appointmentTime, short: appointmentDate } = formatDateInTimezone(startTime, timezone);

    // Format broker's phone number
    const formattedPhone = formatPhoneNumber(broker.phone);

    // Generate ICS file
    const icsContent = generateICS({
      title: `Consultation with ${broker.contact_name} - ${broker.company_name}`,
      startTime,
      endTime,
      location,
      description: `Your reverse mortgage consultation with ${broker.contact_name} at ${broker.company_name}.\n\nQuestions? Reply to this email or call ${formattedPhone}.`,
      organizerName: broker.contact_name,
      organizerEmail: broker.email,
      attendeeName: attendee.name,
      attendeeEmail: attendee.email
    });

    // Base64 encode the ICS content for attachment
    const icsBase64 = base64Encode(new TextEncoder().encode(icsContent));

    // Build premium branded email HTML (dark theme)
    const emailHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Appointment Confirmed</title>
</head>
<body style="margin: 0; padding: 0; background-color: #0f0f23; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #0f0f23;">
    <tr>
      <td align="center" style="padding: 48px 24px;">
        
        <!-- Main Card -->
        <table role="presentation" width="560" cellspacing="0" cellpadding="0" style="max-width: 560px; background: linear-gradient(180deg, #1a1a2e 0%, #16162a 100%); border-radius: 24px; border: 1px solid rgba(16, 185, 129, 0.2); overflow: hidden;">
          
          <!-- Success Header -->
          <tr>
            <td style="padding: 48px 40px 32px 40px; text-align: center;">
              <!-- Animated checkmark circle -->
              <div style="width: 72px; height: 72px; background: linear-gradient(135deg, rgba(16, 185, 129, 0.2) 0%, rgba(16, 185, 129, 0.1) 100%); border-radius: 50%; margin: 0 auto 24px; border: 2px solid rgba(16, 185, 129, 0.4); display: flex; align-items: center; justify-content: center;">
                <span style="font-size: 36px; line-height: 72px;">✓</span>
              </div>
              <h1 style="margin: 0 0 8px 0; color: #10b981; font-size: 28px; font-weight: 700; letter-spacing: -0.5px;">You're All Set!</h1>
              <p style="margin: 0; color: #a1a1aa; font-size: 16px;">Your consultation has been confirmed</p>
            </td>
          </tr>
          
          <!-- Appointment Details Card -->
          <tr>
            <td style="padding: 0 40px 40px 40px;">
              <div style="background: rgba(0, 0, 0, 0.3); border-radius: 16px; border: 1px solid rgba(255, 255, 255, 0.08); overflow: hidden;">
                
                <!-- Date/Time Row -->
                <div style="padding: 20px 24px; border-bottom: 1px solid rgba(255, 255, 255, 0.06);">
                  <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                    <tr>
                      <td style="width: 44px; vertical-align: top;">
                        <div style="width: 40px; height: 40px; background: rgba(16, 185, 129, 0.15); border-radius: 10px; text-align: center; line-height: 40px;">
                          <span style="font-size: 18px;">📅</span>
                        </div>
                      </td>
                      <td style="vertical-align: top; padding-left: 12px;">
                        <p style="margin: 0 0 4px 0; color: #71717a; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 1px;">Date & Time</p>
                        <p style="margin: 0; color: #ffffff; font-size: 16px; font-weight: 500;">${appointmentTime}</p>
                      </td>
                    </tr>
                  </table>
                </div>
                
                ${location ? `
                <!-- Location Row -->
                <div style="padding: 20px 24px; border-bottom: 1px solid rgba(255, 255, 255, 0.06);">
                  <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                    <tr>
                      <td style="width: 44px; vertical-align: top;">
                        <div style="width: 40px; height: 40px; background: rgba(139, 92, 246, 0.15); border-radius: 10px; text-align: center; line-height: 40px;">
                          <span style="font-size: 18px;">📍</span>
                        </div>
                      </td>
                      <td style="vertical-align: top; padding-left: 12px;">
                        <p style="margin: 0 0 4px 0; color: #71717a; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 1px;">Location</p>
                        <p style="margin: 0; color: #ffffff; font-size: 16px; font-weight: 500;">${location}</p>
                      </td>
                    </tr>
                  </table>
                </div>
                ` : ''}
                
                <!-- Advisor Row -->
                <div style="padding: 20px 24px;">
                  <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                    <tr>
                      <td style="width: 44px; vertical-align: top;">
                        <div style="width: 40px; height: 40px; background: rgba(59, 130, 246, 0.15); border-radius: 10px; text-align: center; line-height: 40px;">
                          <span style="font-size: 18px;">👤</span>
                        </div>
                      </td>
                      <td style="vertical-align: top; padding-left: 12px;">
                        <p style="margin: 0 0 4px 0; color: #71717a; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 1px;">Your Advisor</p>
                        <p style="margin: 0 0 2px 0; color: #ffffff; font-size: 16px; font-weight: 500;">${broker.contact_name}</p>
                        <p style="margin: 0; color: #a1a1aa; font-size: 14px;">${broker.company_name}</p>
                      </td>
                    </tr>
                  </table>
                </div>
                
              </div>
            </td>
          </tr>
          
          <!-- Calendar Attachment Notice -->
          <tr>
            <td style="padding: 0 40px 32px 40px;">
              <div style="background: rgba(59, 130, 246, 0.1); border: 1px solid rgba(59, 130, 246, 0.2); border-radius: 12px; padding: 16px 20px;">
                <table role="presentation" cellspacing="0" cellpadding="0">
                  <tr>
                    <td style="width: 28px; vertical-align: top;">
                      <span style="font-size: 18px;">📎</span>
                    </td>
                    <td style="padding-left: 8px;">
                      <p style="margin: 0; color: #60a5fa; font-size: 14px; font-weight: 500;">Calendar invite attached</p>
                      <p style="margin: 4px 0 0 0; color: #71717a; font-size: 13px;">Open the .ics file to add to your calendar with reminders</p>
                    </td>
                  </tr>
                </table>
              </div>
            </td>
          </tr>
          
          <!-- Message -->
          <tr>
            <td style="padding: 0 40px 32px 40px;">
              <p style="margin: 0 0 24px 0; color: #d4d4d8; font-size: 15px; line-height: 1.7;">
                Hi ${attendee.name || 'there'}, during your consultation, <span style="color: #ffffff; font-weight: 500;">${broker.contact_name}</span> will review your options and answer any questions about accessing your home equity.
              </p>
            </td>
          </tr>
          
          <!-- Divider -->
          <tr>
            <td style="padding: 0 40px;">
              <div style="height: 1px; background: linear-gradient(90deg, transparent 0%, rgba(255, 255, 255, 0.1) 50%, transparent 100%);"></div>
            </td>
          </tr>
          
          <!-- Reschedule Section -->
          <tr>
            <td style="padding: 32px 40px;">
              <p style="margin: 0 0 8px 0; color: #71717a; font-size: 13px; font-weight: 600; text-transform: uppercase; letter-spacing: 1px;">Need to Reschedule?</p>
              <p style="margin: 0; color: #a1a1aa; font-size: 15px;">
                Reply to this email or call <a href="tel:${broker.phone?.replace(/\D/g, '')}" style="color: #10b981; text-decoration: none; font-weight: 500;">${formattedPhone}</a>
              </p>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="background: rgba(0,0,0,0.3); padding: 24px 40px; border-top: 1px solid rgba(255, 255, 255, 0.05);">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                <tr>
                  <td>
                    <p style="margin: 0 0 4px 0; color: #a1a1aa; font-size: 14px; font-weight: 500;">${broker.contact_name}</p>
                    <p style="margin: 0; color: #71717a; font-size: 13px;">${broker.company_name}</p>
                  </td>
                  <td align="right" style="vertical-align: bottom;">
                    <p style="margin: 0; color: #52525b; font-size: 12px;">© ${new Date().getFullYear()}</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          
        </table>
        
        <!-- Bottom text -->
        <table role="presentation" width="560" cellspacing="0" cellpadding="0" style="max-width: 560px;">
          <tr>
            <td align="center" style="padding: 24px 0 0 0;">
              <p style="margin: 0; color: #52525b; font-size: 12px;">
                Powered by <span style="color: #71717a;">Equity Connect Guide</span>
              </p>
            </td>
          </tr>
        </table>
        
      </td>
    </tr>
  </table>
</body>
</html>
    `;

    // Send via Brevo with ICS attachment
    const brevoApiKey = Deno.env.get('BREVO_API_KEY');
    if (!brevoApiKey) {
      throw new Error('BREVO_API_KEY not configured');
    }

    const brevoResponse = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'api-key': brevoApiKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        sender: { name: broker.contact_name, email: 'bookings@equityconnectguide.com' },
        to: [{ email: attendee.email, name: attendee.name || '' }],
        replyTo: { email: broker.email, name: broker.contact_name },
        subject: `✓ Appointment Confirmed - ${appointmentDate} with ${broker.contact_name}`,
        htmlContent: emailHtml,
        attachment: [
          {
            name: 'appointment.ics',
            content: icsBase64
          }
        ]
      })
    });

    if (!brevoResponse.ok) {
      const errorText = await brevoResponse.text();
      console.error('Brevo API error:', errorText);
      throw new Error(`Brevo failed: ${errorText}`);
    }

    const brevoData = await brevoResponse.json();
    console.log('Email sent successfully with ICS:', brevoData.messageId);

    // Log to email_events table
    await supabaseClient.from('email_events').insert({
      broker_id: broker.id,
      event_type: 'sent',
      email_subject: `Appointment Confirmed - ${appointmentDate} with ${broker.contact_name}`,
      email_from_address: 'bookings@equityconnectguide.com',
      metadata: {
        brevo_message_id: brevoData.messageId,
        attendee_email: attendee.email,
        appointment_time: appointmentTime,
        timezone: timezone,
        has_ics_attachment: true,
        source: 'nylas_webhook'
      }
    });

    return new Response(JSON.stringify({
      status: 'success',
      message_id: brevoData.messageId,
      sent_to: attendee.email,
      timezone: timezone,
      has_ics: true
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Booking notification error:', error);
    return new Response(JSON.stringify({
      status: 'error',
      message: error.message
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});

