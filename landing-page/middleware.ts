import { NextRequest, NextResponse } from 'next/server'

// Map neighborhoods/suburbs to their major metro area
function normalizeCity(city: string): string {
  const cityLower = city.toLowerCase()
  
  // Los Angeles metro area
  const laNeighborhoods = [
    'sherman oaks', 'hollywood', 'beverly hills', 'santa monica', 
    'venice', 'culver city', 'pasadena', 'burbank', 'glendale',
    'west hollywood', 'north hollywood', 'studio city', 'encino',
    'van nuys', 'woodland hills', 'calabasas', 'malibu', 'redondo beach',
    'manhattan beach', 'hermosa beach', 'torrance', 'long beach',
    'inglewood', 'el segundo', 'playa vista', 'marina del rey',
    'westwood', 'brentwood', 'pacific palisades', 'century city'
  ]
  
  if (laNeighborhoods.includes(cityLower)) {
    return 'Los Angeles'
  }
  
  // Add more metro area mappings as needed
  // New York metro
  const nyNeighborhoods = ['brooklyn', 'queens', 'bronx', 'staten island', 'manhattan']
  if (nyNeighborhoods.includes(cityLower)) {
    return 'New York'
  }
  
  // Return original city if no mapping found
  return city
}

export function middleware(request: NextRequest) {
  // CRITICAL: Vercel provides geo data via headers, not request.geo!
  // Read the headers directly:
  const rawCity = request.headers.get('x-vercel-ip-city') || ''
  const rawRegion = request.headers.get('x-vercel-ip-country-region') || ''
  const rawCountry = request.headers.get('x-vercel-ip-country') || ''
  
  // Decode URL-encoded values (e.g., "Sherman%20Oaks" -> "Sherman Oaks")
  const decodedCity = rawCity ? decodeURIComponent(rawCity) : ''
  const region = rawRegion ? decodeURIComponent(rawRegion) : ''
  const country = rawCountry ? decodeURIComponent(rawCountry) : ''
  
  // Normalize neighborhoods to major metro areas
  const city = decodedCity ? normalizeCity(decodedCity) : ''
  
  // Log to Vercel console for debugging
  console.log('Vercel Geo Headers:', {
    originalCity: decodedCity,
    normalizedCity: city,
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
