import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const token = searchParams.get('token')

  if (!token) {
    return NextResponse.json(
      { error: 'Token is required' },
      { status: 400 }
    )
  }

  try {
    // 1. Validate token and get lead_id
    const { data: tokenData, error: tokenError } = await supabase
      .from('calculator_tokens')
      .select('*')
      .eq('token', token)
      .single()

    if (tokenError || !tokenData) {
      return NextResponse.json(
        { error: 'Invalid or expired token' },
        { status: 404 }
      )
    }

    // Check if token is expired
    if (tokenData.expires_at && new Date(tokenData.expires_at) < new Date()) {
      return NextResponse.json(
        { error: 'Token has expired' },
        { status: 410 }
      )
    }

    // 2. Get lead data
    const { data: leadData, error: leadError } = await supabase
      .from('leads')
      .select('*')
      .eq('id', tokenData.lead_id)
      .single()

    if (leadError || !leadData) {
      return NextResponse.json(
        { error: 'Lead not found' },
        { status: 404 }
      )
    }

    // 3. Update used_at if this is the first time
    if (!tokenData.used_at) {
      await supabase
        .from('calculator_tokens')
        .update({ 
          used_at: new Date().toISOString(),
          metadata: {
            ...tokenData.metadata,
            first_access_ip: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip'),
            user_agent: request.headers.get('user-agent')
          }
        })
        .eq('id', tokenData.id)
    }

    // 4. Return sanitized lead data for calculator
    return NextResponse.json({
      success: true,
      data: {
        first_name: leadData.first_name,
        last_name: leadData.last_name,
        property_address: leadData.property_address,
        property_city: leadData.property_city,
        property_state: leadData.property_state,
        property_zip: leadData.property_zip,
        property_value: leadData.property_value,
        estimated_equity: leadData.estimated_equity,
        token: token
      }
    })
  } catch (error) {
    console.error('Calculator API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

