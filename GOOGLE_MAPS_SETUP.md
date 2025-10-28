# Google Maps Integration Setup Guide

## 🗺️ Quick Setup (5 minutes)

### Step 1: Get Google Maps API Key
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing one
3. Go to "APIs & Services" → "Library"
4. Search for "Maps Embed API" and click "Enable"
5. Go to "APIs & Services" → "Credentials"
6. Click "Create Credentials" → "API Key"
7. Copy the API key

### Step 2: Add API Key to Environment
Add this line to your `portal/.env` file:
```
VITE_GOOGLE_MAPS_API_KEY=your_actual_api_key_here
```

### Step 3: Restart Development Server
```bash
cd portal
npm run dev
```

### Step 4: Test
- Navigate to any lead detail page (`/admin/leads/:id`)
- The map should now show the property location
- If you see the placeholder, check the API key is correct

## 🔒 Security Best Practices

### Restrict API Key (Recommended)
1. In Google Cloud Console, click on your API key
2. Under "Application restrictions", select "HTTP referrers"
3. Add your domain: `localhost:3000/*` (for development)
4. Add your production domain: `yourdomain.com/*`

### Monitor Usage
- Check usage in Google Cloud Console
- Free tier: $200/month credit (~28,000 map loads)

## 🐛 Troubleshooting

### Map Not Showing
- Check API key is correct in `.env` file
- Verify "Maps Embed API" is enabled
- Check browser console for errors
- Ensure API key restrictions allow your domain

### API Key Errors
- Make sure "Maps Embed API" is enabled (not just "Maps API")
- Check API key has proper permissions
- Verify domain restrictions if set

## 💰 Cost Information
- **Free tier:** $200/month credit
- **Per embed:** ~$0.007
- **For typical usage:** Likely free for months/years

## 🎯 Features
- ✅ Interactive Google Maps embed
- ✅ Shows exact property location
- ✅ Responsive design
- ✅ Error handling and fallbacks
- ✅ "Open in Google Maps" button
- ✅ "Copy Address" button
- ✅ Two-line address formatting
