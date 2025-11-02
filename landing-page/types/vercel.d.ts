import type { NextRequest } from 'next/server'

declare module 'next/server' {
  interface NextRequest {
    geo?: {
      city?: string
      region?: string
      country?: string
    }
  }
}

