'use client'

import { useEffect, useState, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { DollarSign, Home, Calendar, CreditCard, Phone, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react'

type LeadData = {
  first_name: string
  last_name: string
  property_address: string
  property_city: string
  property_state: string
  property_zip: string
  property_value: number
  estimated_equity: number
  token: string
}

type CalculationResults = {
  propertyValue: number
  estimatedEquity: number
  monthlyPayment: number
  lumpSum: number
  lineOfCredit: number
}

const BARBARA_NUMBER = '(650) 530-0051'

function CalculatorContent() {
  const searchParams = useSearchParams()
  const token = searchParams?.get('t') || searchParams?.get('token')
  
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [leadData, setLeadData] = useState<LeadData | null>(null)
  const [calculations, setCalculations] = useState<CalculationResults | null>(null)
  
  const [phone, setPhone] = useState('')
  const [consent, setConsent] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  useEffect(() => {
    if (!token) {
      setError('No token provided. Please use the link from your email.')
      setLoading(false)
      return
    }

    fetchLeadData()
  }, [token])

  const fetchLeadData = async () => {
    try {
      const response = await fetch(`/api/calculator?token=${token}`)
      const result = await response.json()

      if (!response.ok || !result.success) {
        setError(result.error || 'Invalid or expired link')
        setLoading(false)
        return
      }

      const data = result.data
      setLeadData(data)

      // Calculate equity options
      const propertyValue = Number(data.property_value) || 0
      const estimatedEquity = Number(data.estimated_equity) || 0
      
      // Simplified calculations (62+ years old assumed)
      const principalLimit = estimatedEquity * 0.6 // Typically 50-60% of equity
      
      setCalculations({
        propertyValue,
        estimatedEquity,
        monthlyPayment: Math.round(principalLimit / 180), // ~15 years of payments
        lumpSum: Math.round(principalLimit),
        lineOfCredit: Math.round(principalLimit * 1.1) // Line of credit can grow
      })

      setLoading(false)
    } catch (err) {
      console.error('Error fetching lead data:', err)
      setError('Unable to load calculator. Please try again later.')
      setLoading(false)
    }
  }

  const handleSubmitPhone = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)

    try {
      const response = await fetch('/api/calculator/submit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ token, phone }),
      })

      const result = await response.json()

      if (!response.ok) {
        alert(result.error || 'Failed to submit. Please try again.')
        setSubmitting(false)
        return
      }

      setSubmitted(true)
      setSubmitting(false)
    } catch (err) {
      console.error('Error submitting phone:', err)
      alert('Failed to submit. Please try again.')
      setSubmitting(false)
    }
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 0,
    }).format(amount)
  }

  const formatPhone = (value: string) => {
    const cleaned = value.replace(/\D/g, '')
    const match = cleaned.match(/^(\d{0,3})(\d{0,3})(\d{0,4})$/)
    if (match) {
      return !match[2] ? match[1] : `(${match[1]}) ${match[2]}${match[3] ? `-${match[3]}` : ''}`
    }
    return value
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4">
        <div className="text-center">
          <Loader2 className="h-10 w-10 md:h-12 md:w-12 animate-spin text-primary mx-auto mb-4" />
          <p className="text-base md:text-lg text-muted-foreground">Loading your personalized calculator...</p>
        </div>
      </div>
    )
  }

  if (error || !leadData || !calculations) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 px-4 md:px-6">
            <AlertCircle className="h-10 w-10 md:h-12 md:w-12 text-destructive mx-auto mb-4" />
            <h2 className="text-xl md:text-2xl font-bold text-center mb-4">Unable to Load Calculator</h2>
            <p className="text-base md:text-lg text-muted-foreground text-center mb-6">
              {error || 'This link may be invalid or expired.'}
            </p>
            <Button asChild className="w-full py-3 md:py-2 text-base font-semibold">
              <a href="/">Return to Home</a>
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-background px-4 py-4">
        <div className="mx-auto max-w-4xl">
          <h2 className="text-2xl font-semibold text-foreground">
            Equity<span className="text-primary ml-0.5">Connect</span>
          </h2>
        </div>
      </header>

      {/* Main Content */}
      <main className="px-4 py-8 md:py-12">
        <div className="mx-auto max-w-4xl">
          {/* Personalized Greeting */}
          <div className="mb-6 md:mb-8">
            <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-2">
              Hello {leadData.first_name}!
            </h1>
            <p className="text-lg md:text-xl text-muted-foreground">
              Here's your personalized home equity calculator for {leadData.property_address}
            </p>
          </div>

          {/* Property Overview */}
          <Card className="mb-6 md:mb-8">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg md:text-xl">
                <Home className="h-5 w-5" />
                Your Property
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-6 sm:grid-cols-2 md:grid-cols-3">
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Address</p>
                  <p className="font-semibold text-base">{leadData.property_address}</p>
                  <p className="text-sm text-muted-foreground">
                    {leadData.property_city}, {leadData.property_state} {leadData.property_zip}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Estimated Value</p>
                  <p className="text-xl md:text-2xl font-bold text-foreground">
                    {formatCurrency(calculations.propertyValue)}
                  </p>
                </div>
                <div className="sm:col-span-2 md:col-span-1">
                  <p className="text-sm text-muted-foreground mb-1">Estimated Equity</p>
                  <p className="text-xl md:text-2xl font-bold text-primary">
                    {formatCurrency(calculations.estimatedEquity)}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Equity Access Options */}
          <div className="mb-6 md:mb-8">
            <h2 className="text-xl md:text-2xl font-bold text-foreground mb-3 md:mb-4">
              Your Potential Equity Access Options
            </h2>
            <p className="text-base md:text-lg text-muted-foreground mb-4 md:mb-6">
              Based on your home's value and equity, here are estimated amounts you may be able to access:
            </p>

            <div className="grid gap-4 md:grid-cols-3">
              {/* Monthly Payment */}
              <Card>
                <CardContent className="pt-6 pb-6 px-4 md:px-6">
                  <Calendar className="h-8 w-8 md:h-10 md:w-10 text-primary mb-3" />
                  <h3 className="text-base md:text-lg font-semibold mb-2">Monthly Payment</h3>
                  <p className="text-2xl md:text-3xl font-bold text-primary mb-3">
                    {formatCurrency(calculations.monthlyPayment)}
                  </p>
                  <p className="text-sm md:text-base text-muted-foreground">
                    Receive regular monthly payments to supplement your income
                  </p>
                </CardContent>
              </Card>

              {/* Lump Sum */}
              <Card>
                <CardContent className="pt-6 pb-6 px-4 md:px-6">
                  <DollarSign className="h-8 w-8 md:h-10 md:w-10 text-primary mb-3" />
                  <h3 className="text-base md:text-lg font-semibold mb-2">Lump Sum</h3>
                  <p className="text-2xl md:text-3xl font-bold text-primary mb-3">
                    {formatCurrency(calculations.lumpSum)}
                  </p>
                  <p className="text-sm md:text-base text-muted-foreground">
                    Get a single payment for large expenses or investments
                  </p>
                </CardContent>
              </Card>

              {/* Line of Credit */}
              <Card>
                <CardContent className="pt-6 pb-6 px-4 md:px-6">
                  <CreditCard className="h-8 w-8 md:h-10 md:w-10 text-primary mb-3" />
                  <h3 className="text-base md:text-lg font-semibold mb-2">Line of Credit</h3>
                  <p className="text-2xl md:text-3xl font-bold text-primary mb-3">
                    {formatCurrency(calculations.lineOfCredit)}
                  </p>
                  <p className="text-sm md:text-base text-muted-foreground">
                    Access funds as needed, with potential for growth
                  </p>
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Phone Submission Form */}
          {!submitted ? (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg md:text-xl">
                  <Phone className="h-5 w-5" />
                  Speak with a Specialist
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-base md:text-lg text-muted-foreground mb-4 md:mb-6">
                  Want to learn more about these options? Enter your phone number below and our scheduling assistant Barbara will call you to pre-qualify you and get you scheduled with a licensed specialist to discuss your personalized plan.
                </p>
                <form onSubmit={handleSubmitPhone} className="space-y-4">
                  <div className="flex flex-col sm:flex-row gap-3">
                    <input
                      type="tel"
                      placeholder="(555) 123-4567"
                      value={phone}
                      onChange={(e) => setPhone(formatPhone(e.target.value))}
                      className="flex-1 px-4 py-3 md:py-2 text-base border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                      required
                      maxLength={14}
                    />
                    <Button 
                      type="submit" 
                      disabled={submitting || !consent} 
                      className="py-3 md:py-2 text-base font-semibold w-full sm:w-auto disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {submitting ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Submitting...
                        </>
                      ) : (
                        'Submit'
                      )}
                    </Button>
                  </div>
                  
                  {/* Consent Checkbox */}
                  <div className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      id="consent"
                      checked={consent}
                      onChange={(e) => setConsent(e.target.checked)}
                      className="mt-1 h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary cursor-pointer"
                      required
                    />
                    <label htmlFor="consent" className="text-xs md:text-sm text-muted-foreground cursor-pointer">
                      I consent to receive calls and text messages from Equity Connect at the number provided above. 
                      I understand that consent is not a condition of purchase and that message and data rates may apply. 
                      Message frequency varies. Reply STOP to opt-out. See our{' '}
                      <a href="/privacy" className="text-primary hover:underline" target="_blank">
                        Privacy Policy
                      </a>
                      {' '}and{' '}
                      <a href="/terms" className="text-primary hover:underline" target="_blank">
                        Terms of Service
                      </a>.
                    </label>
                  </div>
                </form>
              </CardContent>
            </Card>
          ) : (
            <Card className="bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800">
              <CardContent className="pt-6 pb-6 px-4 md:px-6">
                <div className="flex items-center gap-3 mb-3">
                  <CheckCircle2 className="h-8 w-8 text-green-600 dark:text-green-400" />
                  <h3 className="text-lg md:text-xl font-bold text-green-900 dark:text-green-100">
                    Thank You!
                  </h3>
                </div>
                <p className="text-base md:text-lg text-green-800 dark:text-green-200 mb-3">
                  We've received your phone number. Barbara, our scheduling assistant, is calling you right away to confirm your details and get you booked with a licensed specialist.
                </p>
                <p className="text-sm md:text-base text-green-700 dark:text-green-300">
                  Watch for a call from {BARBARA_NUMBER}
                </p>
              </CardContent>
            </Card>
          )}

          {/* Disclaimer */}
          <div className="mt-6 md:mt-8 text-center text-xs md:text-sm text-muted-foreground px-2">
            <p className="mb-2">
              *These are estimated amounts based on your property information. Actual amounts may vary based on age, property type, current mortgage balance, and lender requirements.
            </p>
            <p>
              Equity Connect is a connection service. We are not a lender and do not originate loans. All loan terms and conditions are determined by the specialist you work with.
            </p>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t bg-background px-4 py-8 mt-12">
        <div className="mx-auto max-w-4xl text-center text-sm text-muted-foreground">
          <p>&copy; {new Date().getFullYear()} Equity Connect. All rights reserved.</p>
          <div className="mt-2 flex justify-center gap-4">
            <a href="/privacy" className="hover:text-foreground">Privacy Policy</a>
            <span>|</span>
            <a href="/terms" className="hover:text-foreground">Terms & Conditions</a>
          </div>
        </div>
      </footer>
    </div>
  )
}

export default function CalculatorPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-background flex items-center justify-center px-4">
        <div className="text-center">
          <Loader2 className="h-10 w-10 md:h-12 md:w-12 animate-spin text-primary mx-auto mb-4" />
          <p className="text-base md:text-lg text-muted-foreground">Loading...</p>
        </div>
      </div>
    }>
      <CalculatorContent />
    </Suspense>
  )
}

