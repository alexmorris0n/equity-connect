import { NextRequest, NextResponse } from 'next/server'

export function middleware(request: NextRequest) {
  // CRITICAL: Debug - check what's available on request object
  console.log('Full request object keys:', Object.keys(request))
  console.log('Geo object:', request.geo)
  
  // CRITICAL: Vercel provides geo data on request.geo
  // Access it like this:
  const city = request.geo?.city || ''
  const region = request.geo?.region || ''
  const country = request.geo?.country || ''
  
  // Log to Vercel console for debugging
  console.log('Vercel Geo Data:', {
    city: request.geo?.city,
    region: request.geo?.region,
    country: request.geo?.country,
  })
  
  const response = NextResponse.next()
  
  // Set headers with actual values OR 'not set' as fallback
  response.headers.set('x-user-city', city || 'not set')
  response.headers.set('x-user-region', region || 'not set')
  response.headers.set('x-user-country', country || 'not set')
  
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
