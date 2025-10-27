# Test Supabase Authentication

## Quick Test

Open your browser console (F12) on http://localhost:3000 and run:

```javascript
// Test Supabase connection
const { createClient } = window.supabase || {}
const supabase = createClient(
  'https://mxnqfwuhvurajrgoefyg.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im14bnFmd3VodnVyYWpyZ29lZnlnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk4NzU3OTAsImV4cCI6MjA3NTQ1MTc5MH0.QMoZAjIKkB05Vr9nM1FKbC2ke5RTvfv6zrSDU0QMuN4'
)

// Try to sign in
const { data, error } = await supabase.auth.signInWithPassword({
  email: 'alex@amorrison.email',
  password: 'TempPass123!'
})

console.log('Result:', data, error)
```

## Common Issues:

### 1. Page won't load / blank screen?
**Check Vite dev server output:**
- Look for errors in the terminal where you ran `npm run dev`
- Common issue: Missing imports or syntax errors

### 2. "Invalid login credentials" error?
**Try resetting password via Supabase dashboard:**
1. Supabase → Authentication → Users
2. Click on alex@amorrison.email
3. Click "Send password recovery"
4. Check your email

### 3. Network error / Can't connect to Supabase?
**Check .env file:**
```bash
# Should look like this:
VITE_SUPABASE_URL=https://mxnqfwuhvurajrgoefyg.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
VITE_BRIDGE_API_URL=http://localhost:3001
```

### 4. Vue app errors in console?
**Check browser console (F12):**
- Look for red errors
- Common: "Cannot read property of undefined"
- May need to fix import statements

## Alternative: Create a New Test User

If the password reset doesn't work, you can create a fresh test user:

```sql
-- In Supabase SQL Editor
-- This uses Supabase's auth.users insert (may not work depending on setup)
-- Better to use dashboard: Authentication → Add User
```

Better approach:
1. Go to Supabase Dashboard
2. Authentication → Users → Add User
3. Create: test@test.com / TestPass123!
4. Then link to admin:

```sql
INSERT INTO brokers (email, contact_name, company_name, user_role, user_id)
VALUES (
  'test@test.com',
  'Test Admin',
  'Equity Connect',
  'admin',
  (SELECT id FROM auth.users WHERE email = 'test@test.com')
);
```

## What error are you seeing specifically?

