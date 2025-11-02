-- Export leads with calculator links for Instantly upload
-- Run this in Supabase SQL Editor and export as CSV

SELECT 
  l.primary_email as email,
  l.first_name,
  l.last_name,
  CONCAT('https://equityconnect.com/calculator?t=', ct.token) as calculator_link,
  ct.token as calculator_token,
  l.property_address,
  l.property_city,
  l.property_state,
  l.property_zip,
  l.property_value,
  l.estimated_equity
FROM leads l
INNER JOIN calculator_tokens ct ON l.id = ct.lead_id
WHERE l.primary_email IS NOT NULL
  AND l.primary_email != ''
  AND ct.expires_at > NOW()  -- Only non-expired tokens
ORDER BY l.created_at DESC;

-- OUTPUT FORMAT (for Instantly CSV upload):
-- email, first_name, last_name, calculator_link, property_address, property_city, property_state, property_value

