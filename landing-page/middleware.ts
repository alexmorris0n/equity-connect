import { NextRequest, NextResponse } from 'next/server'

export function middleware(request: NextRequest) {
  // CRITICAL: Vercel provides geo data via headers, not request.geo!
  // Read the headers directly:
  const rawCity = request.headers.get('x-vercel-ip-city') || ''
  const rawRegion = request.headers.get('x-vercel-ip-country-region') || ''
  const rawCountry = request.headers.get('x-vercel-ip-country') || ''
  
  // Decode URL-encoded values (e.g., "Sherman%20Oaks" -> "Sherman Oaks")
  const city = rawCity ? decodeURIComponent(rawCity) : ''
  const region = rawRegion ? decodeURIComponent(rawRegion) : ''
  const country = rawCountry ? decodeURIComponent(rawCountry) : ''
  
  // Log to Vercel console for debugging
  console.log('Vercel Geo Headers:', {
    city,
    region,
    country,
  })
  
  const response = NextResponse.next()
  
  // Only pass geo data if we have it (no "not set" fallback)
  if (city) {
    response.headers.set('x-user-city', city)
  }
  
  if (region) {
    response.headers.set('x-user-region', region)
  }

  if (country) {
    response.headers.set('x-user-country', country)
  }
  
  return response
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
}
