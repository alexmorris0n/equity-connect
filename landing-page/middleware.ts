import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  // Get geolocation data from Vercel Edge
  const geo = request.geo
  const city = geo?.city
  const region = geo?.region
  const country = geo?.country

  // Debug: Log full request info to see what Vercel provides
  console.log('Request URL:', request.url)
  console.log('Request headers:', Object.fromEntries(request.headers.entries()))
  console.log('Geo data:', { city, region, country, fullGeo: geo })
  console.log('Has geo property:', 'geo' in request)

  // Create response with custom headers
  const response = NextResponse.next()

  // Pass geo data via headers
  if (city) {
    response.headers.set('x-user-city', city)
  }
  
  if (region) {
    response.headers.set('x-user-region', region)
  }

  if (country) {
    response.headers.set('x-user-country', country)
  }

  // Also log what headers we're setting
  console.log('Setting headers:', {
    'x-user-city': city || 'not set',
    'x-user-region': region || 'not set',
    'x-user-country': country || 'not set',
  })

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
