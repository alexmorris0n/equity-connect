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
    'westwood', 'brentwood', 'pacific palisades', 'century city',
    'downey', 'norwalk', 'whittier', 'alhambra', 'arcadia', 'monrovia',
    'pomona', 'claremont', 'northridge', 'reseda', 'granada hills',
    'porter ranch', 'tarzana', 'valley village', 'canoga park', 'chatsworth'
  ]
  
  // Ventura County
  const venturaCountyNeighborhoods = [
    'ventura', 'oxnard', 'thousand oaks', 'simi valley', 'camarillo',
    'moorpark', 'port hueneme', 'santa paula', 'fillmore', 'ojai'
  ]
  
  // Inland Empire (Riverside & San Bernardino Counties)
  const inlandEmpireNeighborhoods = [
    'riverside', 'corona', 'moreno valley', 'temecula', 'murrieta',
    'san bernardino', 'fontana', 'rialto', 'rancho cucamonga', 'ontario',
    'chino', 'chino hills', 'upland', 'redlands', 'yucaipa', 'beaumont',
    'hemet', 'perris', 'lake elsinore', 'menifee', 'eastvale', 'jurupa valley'
  ]
  
  // Orange County
  const orangeCountyNeighborhoods = [
    'irvine', 'anaheim', 'fullerton', 'orange', 'garden grove',
    'huntington beach', 'newport beach', 'costa mesa', 'laguna beach',
    'santa ana', 'mission viejo', 'lake forest', 'tustin', 'yorba linda',
    'laguna niguel', 'san clemente', 'dana point', 'laguna hills',
    'aliso viejo', 'seal beach', 'brea', 'placentia', 'la habra'
  ]
  
  // New York metro area
  const nyNeighborhoods = [
    'brooklyn', 'queens', 'bronx', 'staten island', 'manhattan',
    'yonkers', 'new rochelle', 'white plains', 'mount vernon',
    'jersey city', 'hoboken', 'newark', 'elizabeth', 'paterson',
    'stamford', 'norwalk', 'bridgeport', 'new haven'
  ]
  
  // San Francisco / Bay Area
  const sfNeighborhoods = [
    'san francisco', 'oakland', 'berkeley', 'san jose', 'palo alto',
    'mountain view', 'sunnyvale', 'santa clara', 'cupertino',
    'fremont', 'hayward', 'san mateo', 'redwood city', 'daly city',
    'south san francisco', 'san leandro', 'alameda', 'richmond',
    'vallejo', 'walnut creek', 'concord', 'pleasanton', 'livermore'
  ]
  
  // Chicago metro area
  const chicagoNeighborhoods = [
    'evanston', 'skokie', 'cicero', 'oak park', 'berwyn',
    'naperville', 'aurora', 'joliet', 'elgin', 'waukegan',
    'schaumburg', 'palatine', 'arlington heights', 'des plaines'
  ]
  
  // Miami metro area
  const miamiNeighborhoods = [
    'miami beach', 'coral gables', 'hialeah', 'homestead',
    'fort lauderdale', 'hollywood', 'pompano beach', 'boca raton',
    'delray beach', 'west palm beach', 'boynton beach'
  ]
  
  // Phoenix metro area
  const phoenixNeighborhoods = [
    'scottsdale', 'tempe', 'mesa', 'glendale', 'peoria',
    'chandler', 'gilbert', 'surprise', 'avondale', 'goodyear'
  ]
  
  // Dallas-Fort Worth metro area
  const dallasNeighborhoods = [
    'fort worth', 'arlington', 'plano', 'irving', 'garland',
    'frisco', 'mckinney', 'carrollton', 'richardson', 'denton',
    'allen', 'flower mound', 'lewisville', 'mesquite'
  ]
  
  // Houston metro area
  const houstonNeighborhoods = [
    'sugar land', 'pearland', 'pasadena', 'league city',
    'baytown', 'conroe', 'galveston', 'texas city', 'friendswood'
  ]
  
  // Seattle metro area
  const seattleNeighborhoods = [
    'bellevue', 'tacoma', 'everett', 'kent', 'renton',
    'spokane', 'federal way', 'kirkland', 'redmond', 'sammamish'
  ]
  
  // Boston metro area
  const bostonNeighborhoods = [
    'cambridge', 'quincy', 'newton', 'somerville', 'brookline',
    'waltham', 'malden', 'medford', 'framingham', 'woburn'
  ]
  
  // Philadelphia metro area
  const philadelphiaNeighborhoods = [
    'chester', 'norristown', 'camden', 'trenton', 'wilmington'
  ]
  
  // Atlanta metro area
  const atlantaNeighborhoods = [
    'marietta', 'roswell', 'sandy springs', 'johns creek',
    'alpharetta', 'smyrna', 'dunwoody', 'decatur'
  ]
  
  // San Diego metro area
  const sanDiegoNeighborhoods = [
    'chula vista', 'oceanside', 'escondido', 'carlsbad',
    'el cajon', 'vista', 'san marcos', 'encinitas', 'la mesa'
  ]
  
  // Denver metro area
  const denverNeighborhoods = [
    'aurora', 'lakewood', 'thornton', 'arvada', 'westminster',
    'centennial', 'boulder', 'fort collins', 'colorado springs'
  ]
  
  // Portland metro area
  const portlandNeighborhoods = [
    'gresham', 'hillsboro', 'beaverton', 'lake oswego', 'tigard'
  ]
  
  // Las Vegas metro area
  const lasVegasNeighborhoods = [
    'henderson', 'north las vegas', 'paradise', 'spring valley', 'summerlin'
  ]
  
  // Apply mappings
  if (laNeighborhoods.includes(cityLower)) return 'Los Angeles'
  if (venturaCountyNeighborhoods.includes(cityLower)) return 'Ventura County'
  if (inlandEmpireNeighborhoods.includes(cityLower)) return 'Inland Empire'
  if (orangeCountyNeighborhoods.includes(cityLower)) return 'Orange County'
  if (nyNeighborhoods.includes(cityLower)) return 'New York'
  if (sfNeighborhoods.includes(cityLower)) return 'Bay Area'
  if (chicagoNeighborhoods.includes(cityLower)) return 'Chicago'
  if (miamiNeighborhoods.includes(cityLower)) return 'Miami'
  if (phoenixNeighborhoods.includes(cityLower)) return 'Phoenix'
  if (dallasNeighborhoods.includes(cityLower)) return 'Dallas'
  if (houstonNeighborhoods.includes(cityLower)) return 'Houston'
  if (seattleNeighborhoods.includes(cityLower)) return 'Seattle'
  if (bostonNeighborhoods.includes(cityLower)) return 'Boston'
  if (philadelphiaNeighborhoods.includes(cityLower)) return 'Philadelphia'
  if (atlantaNeighborhoods.includes(cityLower)) return 'Atlanta'
  if (sanDiegoNeighborhoods.includes(cityLower)) return 'San Diego'
  if (denverNeighborhoods.includes(cityLower)) return 'Denver'
  if (portlandNeighborhoods.includes(cityLower)) return 'Portland'
  if (lasVegasNeighborhoods.includes(cityLower)) return 'Las Vegas'
  
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
