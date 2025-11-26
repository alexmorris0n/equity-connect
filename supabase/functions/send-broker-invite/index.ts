// Supabase Edge Function: Send Broker Invite
// For existing brokers who don't have portal access yet
// Endpoint: /functions/v1/send-broker-invite

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // NOTE: JWT verification is disabled for this function at the platform level.
    // We therefore do NOT depend on an Authorization header here to avoid
    // header-size / CORS issues from huge access tokens.

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const resendApiKey = Deno.env.get('RESEND_API_KEY') ?? '';

    // Get broker_id from request
    const { broker_id } = await req.json();
    
    if (!broker_id) {
      return new Response(
        JSON.stringify({ error: 'broker_id is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const adminClient = createClient(supabaseUrl, supabaseServiceKey);

    // Get broker details
    const { data: broker, error: brokerError } = await adminClient
      .from('brokers')
      .select('*')
      .eq('id', broker_id)
      .single();

    if (brokerError || !broker) {
      return new Response(
        JSON.stringify({ error: 'Broker not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if broker already has portal access
    const { data: existingProfile } = await adminClient
      .from('user_profiles')
      .select('id')
      .eq('broker_id', broker_id)
      .single();

    if (existingProfile) {
      return new Response(
        JSON.stringify({ error: 'Broker already has portal access' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if auth user already exists with this email
    const { data: existingUsers } = await adminClient.auth.admin.listUsers();
    const existingAuthUser = existingUsers?.users?.find(
      u => u.email?.toLowerCase() === broker.email.toLowerCase()
    );

    let authUserId: string;

    if (existingAuthUser) {
      // User exists but no profile - just need to create profile and send reset
      authUserId = existingAuthUser.id;
      console.log('Auth user already exists:', authUserId);
    } else {
      // Create new auth user
      const tempPassword = crypto.randomUUID() + 'Aa1!';
      
      const { data: authUser, error: authError } = await adminClient.auth.admin.createUser({
        email: broker.email.toLowerCase(),
        password: tempPassword,
        email_confirm: true,
        user_metadata: {
          full_name: broker.contact_name,
          company: broker.company_name
        }
      });

      if (authError) {
        console.error('Failed to create auth user:', authError);
        return new Response(
          JSON.stringify({ error: `Failed to create auth user: ${authError.message}` }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      authUserId = authUser.user.id;
      console.log('Auth user created:', authUserId);
    }

    // Wait for trigger to create user_profiles (if it doesn't exist yet)
    await new Promise(resolve => setTimeout(resolve, 500));

    // Generate password reset link

    if (resetError) {
      console.error('Failed to generate reset link:', resetError);
    }

    const resetLink = resetData?.properties?.action_link || null;

    // Send invite email via Resend
    let emailSent = false;
    if (resendApiKey && resetLink) {
      const emailHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; background-color: #f8fafc; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #f8fafc;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table role="presentation" width="600" cellspacing="0" cellpadding="0" style="max-width: 600px; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05);">
          
          <tr>
            <td style="background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 50%, #a855f7 100%); padding: 40px 40px 30px 40px; text-align: center;">
              <h1 style="margin: 0; color: #ffffff; font-size: 32px; font-weight: 700; letter-spacing: -0.5px;">Barbara</h1>
              <p style="margin: 8px 0 0 0; color: rgba(255,255,255,0.85); font-size: 14px; font-weight: 500;">by Equity Connect</p>
            </td>
          </tr>
          
          <tr>
            <td style="padding: 40px;">
              <h2 style="margin: 0 0 20px 0; color: #1e293b; font-size: 24px; font-weight: 600;">Welcome to the team! 🎉</h2>
              
              <p style="margin: 0 0 16px 0; color: #475569; font-size: 16px; line-height: 1.6;">
                Hi <strong>${broker.contact_name}</strong>,
              </p>
              
              <p style="margin: 0 0 24px 0; color: #475569; font-size: 16px; line-height: 1.6;">
                Your broker account at <strong>${broker.company_name}</strong> has been created. You're just one click away from accessing your personalized dashboard where you can manage leads, track appointments, and grow your business.
              </p>
              
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                <tr>
                  <td align="center" style="padding: 10px 0 30px 0;">
                    <a href="${resetLink}" style="display: inline-block; background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%); color: #ffffff; text-decoration: none; padding: 16px 40px; border-radius: 8px; font-size: 16px; font-weight: 600; box-shadow: 0 4px 14px rgba(99, 102, 241, 0.4);">
                      Set Your Password →
                    </a>
                  </td>
                </tr>
              </table>
              
              <div style="background-color: #f8fafc; border-radius: 12px; padding: 24px; margin-bottom: 24px;">
                <h3 style="margin: 0 0 16px 0; color: #1e293b; font-size: 16px; font-weight: 600;">What's next?</h3>
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                  <tr>
                    <td style="padding: 8px 0; color: #475569; font-size: 14px;">
                      <span style="color: #6366f1; font-weight: bold; margin-right: 8px;">1.</span> Set your secure password
                    </td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0; color: #475569; font-size: 14px;">
                      <span style="color: #6366f1; font-weight: bold; margin-right: 8px;">2.</span> Connect your calendar for appointments
                    </td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0; color: #475569; font-size: 14px;">
                      <span style="color: #6366f1; font-weight: bold; margin-right: 8px;">3.</span> Start receiving qualified leads
                    </td>
                  </tr>
                </table>
              </div>
              
              <p style="margin: 0; color: #94a3b8; font-size: 13px; line-height: 1.5;">
                This link expires in 24 hours. If you didn't expect this email, you can safely ignore it.
              </p>
            </td>
          </tr>
          
          <tr>
            <td style="background-color: #f8fafc; padding: 24px 40px; border-top: 1px solid #e2e8f0;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                <tr>
                  <td style="color: #64748b; font-size: 13px;">
                    <strong style="color: #475569;">Equity Connect</strong><br>
                    Helping homeowners unlock their equity
                  </td>
                  <td align="right" style="color: #94a3b8; font-size: 12px;">
                    © ${new Date().getFullYear()} Equity Connect
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          
        </table>
        
        <p style="margin: 24px 0 0 0; color: #94a3b8; font-size: 12px; text-align: center;">
          Questions? Reply to this email or contact support@equityconnectguide.com
        </p>
      </td>
    </tr>
  </table>
</body>
</html>
      `;

      const emailResponse = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${resendApiKey}`
        },
        body: JSON.stringify({
          from: 'Barbara by Equity Connect <noreply@equityconnect.com>',
          to: [broker.email],
          subject: `Welcome to Equity Connect, ${broker.contact_name}! 🎉`,
          html: emailHtml
        })
      });

      if (!emailResponse.ok) {
        const emailError = await emailResponse.text();
        console.error('Failed to send email:', emailError);
      } else {
        emailSent = true;
        console.log('Invite email sent successfully');
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        user_id: authUserId,
        email_sent: emailSent,
        message: emailSent ? 'Invite sent!' : 'User created but email not configured'
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Send invite error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

