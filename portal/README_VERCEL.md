# Vercel Deployment Guide

## Quick Deploy

1. **Install Vercel CLI** (if not already installed):
   ```bash
   npm i -g vercel
   ```

2. **Navigate to portal directory**:
   ```bash
   cd portal
   ```

3. **Deploy to Vercel**:
   ```bash
   vercel
   ```
   
   Follow the prompts:
   - Link to existing project or create new one
   - Set project name (e.g., "barbara-portal")
   - Confirm settings (auto-detected from vercel.json)

4. **For production deployment**:
   ```bash
   vercel --prod
   ```

## Environment Variables

Make sure to set these in Vercel dashboard (Settings → Environment Variables):

- `VITE_SUPABASE_URL` - Your Supabase project URL
- `VITE_SUPABASE_ANON_KEY` - Your Supabase anonymous key

## Deployment via Vercel Dashboard

1. Go to [vercel.com](https://vercel.com)
2. Import your Git repository
3. **Root Directory**: Set to `portal`
4. **Framework Preset**: Vite
5. **Build Command**: `npm run build`
6. **Output Directory**: `dist`
7. **Install Command**: `npm install`
8. Add environment variables in project settings

## Monorepo Setup

If deploying from the root repository:

1. Set **Root Directory** to `portal` in Vercel project settings
2. Or use the vercel.json configuration that auto-detects portal settings

