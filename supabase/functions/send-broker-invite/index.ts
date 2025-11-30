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
    const brevoApiKey = Deno.env.get('BREVO_API_KEY') ?? '';

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
    // The redirectTo should point to your portal's login/reset page
    const portalUrl = Deno.env.get('PORTAL_URL') || 'https://app.barbarapro.com';
    
    const { data: resetData, error: resetError } = await adminClient.auth.admin.generateLink({
      type: 'recovery',
      email: broker.email.toLowerCase(),
      options: {
        redirectTo: `${portalUrl}/login`
      }
    });

    if (resetError) {
      console.error('Failed to generate reset link:', resetError);
    }

    const resetLink = resetData?.properties?.action_link || null;

    // Send invite email via Brevo
    let emailSent = false;
    if (brevoApiKey && resetLink) {
      // Logo URL - host your Barbara logo PNG somewhere accessible
      const logoUrl = 'https://app.barbarapro.com/barbara-logo-light.png';
      
      const emailHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Welcome to Barbara</title>
</head>
<body style="margin: 0; padding: 0; background-color: #0f0f23; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #0f0f23;">
    <tr>
      <td align="center" style="padding: 48px 24px;">
        
        <!-- Logo -->
        <table role="presentation" width="560" cellspacing="0" cellpadding="0" style="max-width: 560px;">
          <tr>
            <td align="center" style="padding-bottom: 32px;">
              <img src="${logoUrl}" alt="Barbara" width="180" style="display: block; max-width: 180px; height: auto;" />
            </td>
          </tr>
        </table>
        
        <!-- Main Card -->
        <table role="presentation" width="560" cellspacing="0" cellpadding="0" style="max-width: 560px; background: linear-gradient(180deg, #1a1a2e 0%, #16162a 100%); border-radius: 24px; border: 1px solid rgba(139, 92, 246, 0.2); overflow: hidden;">
          
          <!-- Header accent -->
          <tr>
            <td style="height: 4px; background: linear-gradient(90deg, #8b5cf6 0%, #a78bfa 50%, #c4b5fd 100%);"></td>
          </tr>
          
          <!-- Content -->
          <tr>
            <td style="padding: 48px 40px;">
              
              <!-- Welcome Badge -->
              <table role="presentation" cellspacing="0" cellpadding="0" style="margin-bottom: 24px;">
                <tr>
                  <td style="background: rgba(139, 92, 246, 0.15); border: 1px solid rgba(139, 92, 246, 0.3); border-radius: 20px; padding: 6px 16px;">
                    <span style="color: #a78bfa; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 1px;">Welcome to the Team</span>
                  </td>
                </tr>
              </table>
              
              <!-- Greeting -->
              <h1 style="margin: 0 0 16px 0; color: #ffffff; font-size: 28px; font-weight: 700; line-height: 1.3;">
                Hi ${broker.contact_name},
              </h1>
              
              <p style="margin: 0 0 32px 0; color: #a1a1aa; font-size: 16px; line-height: 1.7;">
                Your broker account at <span style="color: #ffffff; font-weight: 500;">${broker.company_name}</span> is ready. Access your personalized dashboard to manage leads, track appointments, and grow your business.
              </p>
              
              <!-- CTA Button -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                <tr>
                  <td align="center" style="padding: 8px 0 40px 0;">
                    <a href="${resetLink}" style="display: inline-block; background: linear-gradient(135deg, #8b5cf6 0%, #a78bfa 100%); color: #ffffff; text-decoration: none; padding: 18px 48px; border-radius: 12px; font-size: 16px; font-weight: 600; letter-spacing: 0.3px; box-shadow: 0 8px 24px rgba(139, 92, 246, 0.4), inset 0 1px 0 rgba(255,255,255,0.2);">
                      Get Started →
                    </a>
                  </td>
                </tr>
              </table>
              
              <!-- Divider -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-bottom: 32px;">
                <tr>
                  <td style="height: 1px; background: linear-gradient(90deg, transparent 0%, rgba(139, 92, 246, 0.3) 50%, transparent 100%);"></td>
                </tr>
              </table>
              
              <!-- Steps -->
              <p style="margin: 0 0 20px 0; color: #71717a; font-size: 13px; font-weight: 600; text-transform: uppercase; letter-spacing: 1px;">What's Next</p>
              
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                <tr>
                  <td style="padding: 12px 0;">
                    <table role="presentation" cellspacing="0" cellpadding="0">
                      <tr>
                        <td style="width: 32px; height: 32px; background: rgba(139, 92, 246, 0.15); border-radius: 8px; text-align: center; vertical-align: middle;">
                          <span style="color: #a78bfa; font-size: 14px; font-weight: 700;">1</span>
                        </td>
                        <td style="padding-left: 16px; color: #d4d4d8; font-size: 15px;">Set your secure password</td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 12px 0;">
                    <table role="presentation" cellspacing="0" cellpadding="0">
                      <tr>
                        <td style="width: 32px; height: 32px; background: rgba(139, 92, 246, 0.15); border-radius: 8px; text-align: center; vertical-align: middle;">
                          <span style="color: #a78bfa; font-size: 14px; font-weight: 700;">2</span>
                        </td>
                        <td style="padding-left: 16px; color: #d4d4d8; font-size: 15px;">Connect your calendar</td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 12px 0;">
                    <table role="presentation" cellspacing="0" cellpadding="0">
                      <tr>
                        <td style="width: 32px; height: 32px; background: rgba(139, 92, 246, 0.15); border-radius: 8px; text-align: center; vertical-align: middle;">
                          <span style="color: #a78bfa; font-size: 14px; font-weight: 700;">3</span>
                        </td>
                        <td style="padding-left: 16px; color: #d4d4d8; font-size: 15px;">Start receiving qualified leads</td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
              
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="background: rgba(0,0,0,0.2); padding: 24px 40px; border-top: 1px solid rgba(139, 92, 246, 0.1);">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                <tr>
                  <td style="color: #71717a; font-size: 13px; line-height: 1.5;">
                    This link expires in 24 hours.<br>
                    <span style="color: #52525b;">If you didn't request this, ignore this email.</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          
        </table>
        
        <!-- Bottom text -->
        <table role="presentation" width="560" cellspacing="0" cellpadding="0" style="max-width: 560px;">
          <tr>
            <td align="center" style="padding: 32px 0 0 0;">
              <p style="margin: 0 0 8px 0; color: #52525b; font-size: 13px;">
                Questions? <a href="mailto:support@barbarapro.com" style="color: #8b5cf6; text-decoration: none;">support@barbarapro.com</a>
              </p>
              <p style="margin: 0; color: #3f3f46; font-size: 12px;">
                © ${new Date().getFullYear()} Barbara
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

      const emailResponse = await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'api-key': brevoApiKey
        },
        body: JSON.stringify({
          sender: { name: 'Barbara by Equity Connect', email: 'noreply@barbarapro.com' },
          to: [{ email: broker.email, name: broker.contact_name }],
          subject: `Welcome to Equity Connect, ${broker.contact_name}! 🎉`,
          htmlContent: emailHtml
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

