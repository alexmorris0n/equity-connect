import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { UserCircle2, ArrowRight, Mail, CheckCircle2, Handshake, CheckCircle } from "lucide-react"
import { headers } from "next/headers"

async function getLocationText() {
  const headersList = await headers()
  const city = headersList.get('x-user-city')
  const region = headersList.get('x-user-region')
  
  // Debug: Log all headers to see what we're receiving
  const allHeaders: Record<string, string> = {}
  headersList.forEach((value, key) => {
    allHeaders[key] = value
  })
  console.log('Page received headers:', allHeaders)
  console.log('Geo headers:', {
    'x-user-city': city,
    'x-user-region': region,
  })

  // Fallback logic
  if (city) {
    return city
  } else if (region) {
    return region
  } else {
    return null // Will show generic message
  }
}

export const dynamic = 'force-dynamic'

export default async function HomePage() {
  const locationText = await getLocationText()

  return (
    <div className="min-h-screen bg-background scroll-smooth">
      {/* Hero Section */}
      <section className="relative overflow-hidden px-4 pt-4 pb-20 md:pt-6 md:pb-32 lg:pt-8 lg:pb-40">
        {/* Gradient Background */}
        <div className="absolute inset-0 bg-gradient-to-b from-[#8b87d5]/60 via-[#8b87d5]/25 to-transparent" />
        
        {/* Logo - Top Left */}
        <div className="relative z-10 mb-18 md:mb-24 lg:mb-30">
          <h2 className="text-2xl font-semibold text-foreground md:text-3xl" style={{ letterSpacing: '-0.02em' }}>
            Equity<span className="text-primary ml-0.5">Connect</span>
          </h2>
        </div>

        <div className="relative z-10 mx-auto max-w-5xl text-center">
          <h1 className="text-balance font-heading text-4xl font-bold tracking-tight text-foreground md:text-5xl lg:text-6xl">
            Helping {locationText ? <span className="text-primary">{locationText}</span> : ""} homeowners access their home equity
          </h1>
          <p className="mx-auto mt-8 max-w-2xl text-pretty text-xl text-muted-foreground md:text-xl md:mt-10">
            We connect qualified homeowners with trusted reverse mortgage specialists in their area
          </p>
          <div className="cta-button-wrapper mt-10 md:mt-12">
            <Button size="lg" className="text-lg md:text-base" asChild>
              <a href="#how-it-works">
                Learn How It Works
                <ArrowRight className="ml-2 h-5 w-5" />
              </a>
            </Button>
          </div>
        </div>
      </section>

      {/* Testimonials Section */}
      <section className="px-4 py-10 md:py-14">
        <div className="mx-auto max-w-6xl">
          <h2 className="text-balance text-center font-heading text-3xl font-medium tracking-tight text-foreground md:text-4xl mb-8">
            What Homeowners Are Saying
          </h2>
          <div className="mx-auto grid gap-4 grid-cols-2 md:grid-cols-4 max-w-5xl overflow-visible">
            <div className="card-hover-wrapper h-full">
              <Card className="border h-full">
                <CardContent className="pt-4 pb-4 px-4 flex flex-col h-full">
                  <div className="mb-2 flex gap-0.5">
                    {[...Array(5)].map((_, i) => (
                      <span key={i} className="text-yellow-500 text-sm">★</span>
                    ))}
                  </div>
                  <p className="text-xs leading-relaxed text-muted-foreground mb-3 flex-grow">
                    "Quick process, no pressure. One specialist who really listened."
                  </p>
                  <div className="flex items-center gap-1">
                    <p className="text-xs font-medium text-foreground">Mary S. 67</p>
                    <CheckCircle className="h-3 w-3 text-green-500 flex-shrink-0" />
                  </div>
                  <p className="text-xs text-muted-foreground">Beverly Hills</p>
                </CardContent>
              </Card>
            </div>

            <div className="card-hover-wrapper h-full">
              <Card className="border h-full">
                <CardContent className="pt-4 pb-4 px-4 flex flex-col h-full">
                  <div className="mb-2 flex gap-0.5">
                    {[...Array(5)].map((_, i) => (
                      <span key={i} className="text-yellow-500 text-sm">★</span>
                    ))}
                  </div>
                  <p className="text-xs leading-relaxed text-muted-foreground mb-3 flex-grow">
                    "No spam calls like other services. Just one trusted person."
                  </p>
                  <div className="flex items-center gap-1">
                    <p className="text-xs font-medium text-foreground">Robert J. 71</p>
                    <CheckCircle className="h-3 w-3 text-green-500 flex-shrink-0" />
                  </div>
                  <p className="text-xs text-muted-foreground">Pasadena</p>
                </CardContent>
              </Card>
            </div>

            <div className="card-hover-wrapper h-full">
              <Card className="border h-full">
                <CardContent className="pt-4 pb-4 px-4 flex flex-col h-full">
                  <div className="mb-2 flex gap-0.5">
                    {[...Array(5)].map((_, i) => (
                      <span key={i} className="text-yellow-500 text-sm">★</span>
                    ))}
                  </div>
                  <p className="text-xs leading-relaxed text-muted-foreground mb-3 flex-grow">
                    "Straightforward and honest. No run-around."
                  </p>
                  <div className="flex items-center gap-1">
                    <p className="text-xs font-medium text-foreground">Linda M. 69</p>
                    <CheckCircle className="h-3 w-3 text-green-500 flex-shrink-0" />
                  </div>
                  <p className="text-xs text-muted-foreground">Santa Monica</p>
                </CardContent>
              </Card>
            </div>

            <div className="card-hover-wrapper h-full">
              <Card className="border h-full">
                <CardContent className="pt-4 pb-4 px-4 flex flex-col h-full">
                  <div className="mb-2 flex gap-0.5">
                    {[...Array(5)].map((_, i) => (
                      <span key={i} className="text-yellow-500 text-sm">★</span>
                    ))}
                  </div>
                  <p className="text-xs leading-relaxed text-muted-foreground mb-3 flex-grow">
                    "They pre-qualified me first. No wasted time."
                  </p>
                  <div className="flex items-center gap-1">
                    <p className="text-xs font-medium text-foreground">James K. 73</p>
                    <CheckCircle className="h-3 w-3 text-green-500 flex-shrink-0" />
                  </div>
                  <p className="text-xs text-muted-foreground">Burbank</p>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </section>

            {/* What We Do Section */}
            <section className="px-4 py-8 md:py-12">
              <div className="mx-auto max-w-4xl">
                <h2 className="text-balance text-center font-heading text-4xl font-medium tracking-tight text-foreground md:text-4xl">
                  Who is Equity Connect?
                </h2>
                <div className="mt-8 space-y-4 text-left text-xl leading-relaxed text-muted-foreground max-w-[650px] mx-auto">
                  <p>
                    We're a connection service that helps homeowners 62+ access their home equity.
                  </p>
                  <p>
                    <strong className="text-foreground">Here's what makes us different:</strong> We connect one homeowner with one specialist. Your phone won't ring off the hook with calls and texts from 50 different lenders. We never sell your information. No bidding wars, no spam. Just one trusted introduction.
                  </p>
                  <p>
                    <strong className="text-foreground">How we work:</strong> We pre-qualify you first to make sure reverse mortgages are a good fit for your situation. Then we introduce you to a licensed specialist in your area.
                  </p>
                  <p>
                    Every specialist we work with is carefully selected. We verify their licensing, review their track record, and ensure they meet our standards for experience and customer service. We only recommend professionals we'd trust with our own family.
                  </p>
                  <p>
                    <strong className="text-foreground">What we're NOT:</strong> We're not lenders. We don't originate loans. We're connectors—the bridge between homeowners and trusted reverse mortgage professionals.
                  </p>
                </div>
              </div>
            </section>

      {/* How It Works Section */}
      <section id="how-it-works" className="bg-muted/30 px-4 py-16 md:py-24">
        <div className="mx-auto max-w-6xl">
          <h2 className="text-balance text-center font-heading text-4xl font-medium tracking-tight text-foreground md:text-4xl">
            How It Works
          </h2>
          <div className="mt-12 mx-auto grid gap-8 sm:grid-cols-2 md:grid-cols-3 overflow-visible">
            <div className="card-hover-wrapper mx-auto">
              <Card className="border-2 h-full min-h-[280px] w-[300px] sm:w-[250px]">
                <CardContent className="pt-4 text-center">
                  <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-primary text-primary-foreground mx-auto">
                    <Mail className="h-6 w-6" />
                  </div>
                  <h3 className="mb-3 text-xl font-semibold text-foreground">Contact</h3>
                  <p className="leading-relaxed text-muted-foreground text-left text-base">
                    You reply to our email or reach out directly through our website
                  </p>
                </CardContent>
              </Card>
            </div>

            <div className="card-hover-wrapper mx-auto">
              <Card className="border-2 h-full min-h-[280px] w-[300px] sm:w-[250px]">
                <CardContent className="pt-4 text-center">
                  <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-primary text-primary-foreground mx-auto">
                    <CheckCircle2 className="h-6 w-6" />
                  </div>
                  <h3 className="mb-3 text-xl font-semibold text-foreground">Pre-Qualify</h3>
                  <p className="leading-relaxed text-muted-foreground text-left text-base">
                    We verify your eligibility and answer any questions you have about the process
                  </p>
                </CardContent>
              </Card>
            </div>

            <div className="card-hover-wrapper mx-auto">
              <Card className="border-2 h-full min-h-[280px] w-[300px] sm:w-[250px]">
                <CardContent className="pt-4 text-center">
                  <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-primary text-primary-foreground mx-auto">
                    <Handshake className="h-6 w-6" />
                  </div>
                  <h3 className="mb-3 text-xl font-semibold text-foreground">Connect</h3>
                  <p className="leading-relaxed text-muted-foreground text-left text-base">
                    We introduce you to a trusted specialist in your area who can help
                  </p>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </section>

      {/* Meet the Coordinators Section */}
      <section className="px-4 py-16 md:py-24">
        <div className="mx-auto max-w-6xl">
          <h2 className="text-balance text-center font-heading text-4xl font-medium tracking-tight text-foreground md:text-4xl">
            Meet Your Pre-Qualification Coordinators
          </h2>
          <div className="mt-12 mx-auto grid gap-6 sm:grid-cols-2 md:grid-cols-3">
            {/* Row 1 */}
            <Card className="w-[300px] sm:w-[250px] mx-auto h-full min-h-[200px]">
              <CardContent className="pt-6 text-center">
                <div className="mx-auto mb-3 h-24 w-24 overflow-hidden rounded-full">
                  <img 
                    src="/LaToYa-Washington-getequityconnectcom-1759965026031.jpg" 
                    alt="LaToYa"
                    className="h-full w-full object-cover"
                  />
                </div>
                <h3 className="mb-1 text-lg font-semibold text-foreground">LaToYa</h3>
                <p className="mb-2 text-xs font-medium text-primary">Pre-Qualification Coordinator</p>
                <p className="text-xs text-muted-foreground">Helping homeowners find the right equity solutions for 6+ years</p>
              </CardContent>
            </Card>

            <Card className="w-[300px] sm:w-[250px] mx-auto h-full min-h-[200px]">
              <CardContent className="pt-6 text-center">
                <div className="mx-auto mb-3 h-24 w-24 overflow-hidden rounded-full">
                  <img 
                    src="/Carlos-Rodriguez-getequityconnectcom-1759964928812.jpg" 
                    alt="Carlos"
                    className="h-full w-full object-cover"
                  />
                </div>
                <h3 className="mb-1 text-lg font-semibold text-foreground">Carlos</h3>
                <p className="mb-2 text-xs font-medium text-primary">Pre-Qualification Coordinator</p>
                <p className="text-xs text-muted-foreground">Specializes in guiding seniors through the qualification process</p>
              </CardContent>
            </Card>

            <Card className="w-[300px] sm:w-[250px] mx-auto h-full min-h-[200px]">
              <CardContent className="pt-6 text-center">
                <div className="mx-auto mb-3 h-24 w-24 overflow-hidden rounded-full">
                  <img 
                    src="/Maria-Rodriguez-goequityconnectcom-1759965269908.jpg" 
                    alt="Maria"
                    className="h-full w-full object-cover"
                  />
                </div>
                <h3 className="mb-1 text-lg font-semibold text-foreground">Maria</h3>
                <p className="mb-2 text-xs font-medium text-primary">Pre-Qualification Coordinator</p>
                <p className="text-xs text-muted-foreground">Passionate about helping families access their home equity</p>
              </CardContent>
            </Card>

            {/* Row 2 */}
            <Card className="w-[300px] sm:w-[250px] mx-auto h-full min-h-[200px]">
              <CardContent className="pt-6 text-center">
                <div className="mx-auto mb-3 h-24 w-24 overflow-hidden rounded-full">
                  <img 
                    src="/Rahul-Patel-goequityconnectcom-1759965395332.jpg" 
                    alt="Rahul"
                    className="h-full w-full object-cover"
                  />
                </div>
                <h3 className="mb-1 text-lg font-semibold text-foreground">Rahul</h3>
                <p className="mb-2 text-xs font-medium text-primary">Pre-Qualification Coordinator</p>
                <p className="text-xs text-muted-foreground">Dedicated to providing clear, honest guidance to homeowners</p>
              </CardContent>
            </Card>

            <Card className="w-[300px] sm:w-[250px] mx-auto h-full min-h-[200px]">
              <CardContent className="pt-6 text-center">
                <div className="mx-auto mb-3 h-24 w-24 overflow-hidden rounded-full">
                  <img 
                    src="/Marcus-Washington-yourequityconnectcom-1760313239600.jpg" 
                    alt="Marcus"
                    className="h-full w-full object-cover"
                  />
                </div>
                <h3 className="mb-1 text-lg font-semibold text-foreground">Marcus</h3>
                <p className="mb-2 text-xs font-medium text-primary">Pre-Qualification Coordinator</p>
                <p className="text-xs text-muted-foreground">Expert at matching homeowners with trusted specialists</p>
              </CardContent>
            </Card>

            <Card className="w-[300px] sm:w-[250px] mx-auto h-full min-h-[200px]">
              <CardContent className="pt-6 text-center">
                <div className="mx-auto mb-3 h-24 w-24 overflow-hidden rounded-full">
                  <img 
                    src="/Priya-Patel-yourequityconnectcom-1759965343156.jpg" 
                    alt="Priya"
                    className="h-full w-full object-cover"
                  />
                </div>
                <h3 className="mb-1 text-lg font-semibold text-foreground">Priya</h3>
                <p className="mb-2 text-xs font-medium text-primary">Pre-Qualification Coordinator</p>
                <p className="text-xs text-muted-foreground">Known for her patient, supportive approach with clients</p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="bg-muted/30 px-4 py-16 md:py-24">
        <div className="mx-auto max-w-3xl">
          <h2 className="text-balance text-center font-heading text-3xl font-medium tracking-tight text-foreground md:text-4xl">
            Frequently Asked Questions
          </h2>
          <Accordion type="single" collapsible className="mt-12">
            <AccordionItem value="item-1">
              <AccordionTrigger className="text-left text-lg font-medium">What is Equity Connect?</AccordionTrigger>
              <AccordionContent className="leading-relaxed text-muted-foreground">
                We're a pre-qualification service that connects homeowners 62+ with licensed reverse mortgage
                specialists. We verify your eligibility first, then introduce you to a trusted professional in your
                area. We're NOT a lender - we're a connector.
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="item-2">
              <AccordionTrigger className="text-left text-lg font-medium">
                Is this a reverse mortgage company?
              </AccordionTrigger>
              <AccordionContent className="leading-relaxed text-muted-foreground">
                No. We don't originate loans. We work with licensed specialists who do. Think of us as the bridge - we
                handle the initial questions and pre-qualification, then connect you with the right professional for
                your situation.
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="item-3">
              <AccordionTrigger className="text-left text-lg font-medium">How much does this cost?</AccordionTrigger>
              <AccordionContent className="leading-relaxed text-muted-foreground">
                Pre-qualification is completely free. There's no cost to speak with us or get connected with a
                specialist. If you eventually work with a specialist, they'll explain all costs clearly upfront
                (typically rolled into the loan, not out-of-pocket).
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="item-4">
              <AccordionTrigger className="text-left text-lg font-medium">
                Who are the specialists you work with?
              </AccordionTrigger>
              <AccordionContent className="leading-relaxed text-muted-foreground">
                We partner with licensed reverse mortgage professionals who are vetted for experience, compliance, and
                customer service. Each specialist has their NMLS license number, which you can verify at
                nmlsconsumeraccess.org.
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="item-5">
              <AccordionTrigger className="text-left text-lg font-medium">
                How did you get my information?
              </AccordionTrigger>
              <AccordionContent className="leading-relaxed text-muted-foreground">
                We use public property records to identify homeowners who may benefit from accessing their home equity.
                All data comes from publicly available sources. Your information is kept secure and never sold to third
                parties.
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="item-6">
              <AccordionTrigger className="text-left text-lg font-medium">What happens after I reply?</AccordionTrigger>
              <AccordionContent className="leading-relaxed text-muted-foreground">
                We'll call you to verify basic eligibility (age, home equity, property type). This takes 5-10 minutes.
                If you pre-qualify, we'll introduce you to a specialist in your area who can explain your specific
                options. No pressure, no obligations.
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="item-7">
              <AccordionTrigger className="text-left text-lg font-medium">Is my information secure?</AccordionTrigger>
              <AccordionContent className="leading-relaxed text-muted-foreground">
                Yes. We follow strict data privacy standards. Your information is only shared with the specialist we
                connect you with - never sold or shared with anyone else. See our Privacy Policy for details.
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="item-8">
              <AccordionTrigger className="text-left text-lg font-medium">
                Can I unsubscribe from your emails?
              </AccordionTrigger>
              <AccordionContent className="leading-relaxed text-muted-foreground">
                Absolutely. Every email includes an unsubscribe link at the bottom. You can opt out anytime, and we'll
                remove you from our list immediately.
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="item-9">
              <AccordionTrigger className="text-left text-lg font-medium">What if I don't qualify?</AccordionTrigger>
              <AccordionContent className="leading-relaxed text-muted-foreground">
                We'll let you know right away and explain why. Sometimes it's equity level, property type, or age. We
                won't waste your time if it's not a fit.
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="item-10">
              <AccordionTrigger className="text-left text-lg font-medium">
                Do I have to work with the specialist you recommend?
              </AccordionTrigger>
              <AccordionContent className="leading-relaxed text-muted-foreground">
                No. We introduce you to a specialist in your area, but you're free to work with anyone you choose. Our
                job is just to make the connection.
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t bg-background px-4 py-12">
        <div className="mx-auto max-w-6xl">
          <div className="text-center">
            <h3 className="text-2xl font-semibold text-foreground">Equity Connect</h3>
            <p className="mt-2 text-muted-foreground">Connecting homeowners with trusted specialists</p>

            <div className="mt-6 flex flex-wrap justify-center gap-6 text-sm">
              <a href="/privacy" className="text-muted-foreground hover:text-foreground">
                Privacy Policy
              </a>
              <span className="text-muted-foreground">|</span>
              <a href="/terms" className="text-muted-foreground hover:text-foreground">
                Terms & Conditions
              </a>
            </div>

            <div className="mt-6 text-sm text-muted-foreground">
              <p>6210 Wilshire Blvd, Ste 200 PMB, Los Angeles, CA 90048</p>
            </div>

            <div className="mt-6 text-sm text-muted-foreground">
              <p>&copy; {new Date().getFullYear()} Equity Connect. All rights reserved.</p>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}
