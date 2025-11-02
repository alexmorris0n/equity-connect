import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
  // Get geolocation data from Vercel Edge
  const city = request.geo?.city
  const region = request.geo?.region
  const country = request.geo?.country

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

  return response
}

