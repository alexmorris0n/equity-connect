import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { token, phone } = body

    if (!token || !phone) {
      return NextResponse.json(
        { error: 'Token and phone are required' },
        { status: 400 }
      )
    }

    // Validate token exists
    const { data: tokenData, error: tokenError } = await supabase
      .from('calculator_tokens')
      .select('*')
      .eq('token', token)
      .single()

    if (tokenError || !tokenData) {
      return NextResponse.json(
        { error: 'Invalid token' },
        { status: 404 }
      )
    }

    // Update token with submitted phone
    const { error: updateError } = await supabase
      .from('calculator_tokens')
      .update({ 
        phone_submitted: phone,
        metadata: {
          ...tokenData.metadata,
          submitted_at: new Date().toISOString(),
          submit_ip: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip')
        }
      })
      .eq('id', tokenData.id)

    if (updateError) {
      throw updateError
    }

    // Optionally update the lead's phone if it's empty
    if (tokenData.lead_id) {
      const { data: leadData } = await supabase
        .from('leads')
        .select('phone, primary_phone')
        .eq('id', tokenData.lead_id)
        .single()

      // Only update if lead doesn't have a phone number
      if (leadData && !leadData.phone && !leadData.primary_phone) {
        await supabase
          .from('leads')
          .update({ 
            phone: phone,
            primary_phone: phone,
            updated_at: new Date().toISOString()
          })
          .eq('id', tokenData.lead_id)
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Phone number submitted successfully'
    })
  } catch (error) {
    console.error('Submit phone error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

