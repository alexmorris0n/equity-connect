import { NextRequest, NextResponse } from 'next/server'

export function middleware(request: NextRequest) {
  // CRITICAL: Vercel provides geo data via headers, not request.geo!
  // Read the headers directly:
  const city = request.headers.get('x-vercel-ip-city') || ''
  const region = request.headers.get('x-vercel-ip-country-region') || ''
  const country = request.headers.get('x-vercel-ip-country') || ''
  
  // Log to Vercel console for debugging
  console.log('Vercel Geo Headers:', {
    city,
    region,
    country,
  })
  
  const response = NextResponse.next()
  
  // Pass geo data to the page via custom headers
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
