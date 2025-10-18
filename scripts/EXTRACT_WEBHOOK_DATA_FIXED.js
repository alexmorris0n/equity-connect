// Extract Webhook Data - Updated with First Name Extraction
// This goes in the "📦 Extract Webhook Data" Code Node

const webhookBody = $input.item.json.body;

// Extract sender name from email account display name or default to team
const emailAccount = webhookBody.email_account || '';
const fromName = webhookBody.from_name || 'Our Team';

// Use the display name from the email account (set in Instantly)
const personaSenderName = fromName || 'Equity Connect Team';

// Extract first name for personalized replies
const personaFirstName = personaSenderName.split(' ')[0];

// Extract all webhook data
const extractedData = {
  lead_email: webhookBody.lead_email || webhookBody.email,
  reply_text: webhookBody.reply_text,
  subject: webhookBody.reply_subject,
  reply_to_uuid: webhookBody.email_id,
  sender_account: webhookBody.email_account,
  campaign_id: webhookBody.campaign_id,
  instantly_lead_id: webhookBody.lead_id || null,
  
  // Persona information
  persona_sender_name: personaSenderName,      // Full name from inbox
  persona_first_name: personaFirstName,        // First name only
  persona_email_account: webhookBody.email_account,
  
  // Metadata
  replied_at: webhookBody.timestamp,
  event_type: webhookBody.event_type,
  workspace: webhookBody.workspace,
  campaign_name: webhookBody.campaign_name,
  unibox_url: webhookBody.unibox_url,
  
  // Store full webhook for debugging
  raw_webhook: $input.item.json
};

return extractedData;

