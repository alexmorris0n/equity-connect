import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { UserCircle2, ArrowRight } from "lucide-react"
import { headers } from "next/headers"

async function getLocationText() {
  const headersList = await headers()
  const city = headersList.get('x-user-city')
  const region = headersList.get('x-user-region')

  // Fallback logic
  if (city) {
    return city
  } else if (region) {
    return region
  } else {
    return null // Will show generic message
  }
}

export default async function HomePage() {
  const locationText = await getLocationText()

  return (
    <div className="min-h-screen bg-background scroll-smooth">
      {/* Hero Section */}
      <section className="relative overflow-hidden px-4 py-20 md:py-32 lg:py-40">
        {/* Gradient Background */}
        <div className="absolute inset-0 bg-gradient-to-b from-[#c5c5c1]/30 via-[#c5c5c1]/10 to-transparent" />
        <div className="relative z-10 mx-auto max-w-5xl text-center">
          <h1 className="text-balance font-serif text-4xl font-medium tracking-tight text-foreground md:text-5xl lg:text-6xl">
            Helping {locationText ? <span className="text-primary">{locationText}</span> : ""} homeowners access their home equity
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-pretty text-lg text-muted-foreground md:text-xl">
            We connect qualified homeowners with trusted reverse mortgage specialists in their area
          </p>
          <Button size="lg" className="mt-8 text-base" asChild>
            <a href="#how-it-works">
              Learn How It Works
              <ArrowRight className="ml-2 h-4 w-4" />
            </a>
          </Button>
        </div>
      </section>

      {/* What We Do Section */}
      <section className="px-4 py-8 md:py-12">
        <div className="mx-auto max-w-4xl">
          <h2 className="text-balance text-center font-serif text-3xl font-medium tracking-tight text-foreground md:text-4xl">
            What is Equity Connect?
          </h2>
          <div className="mt-8 space-y-4 text-center text-lg leading-relaxed text-muted-foreground">
            <p>
              We're a curated marketplace that connects one homeowner with one specialist — no bidding wars, no spam. We
              pre-qualify homeowners before making any connections to ensure you're a good fit.
            </p>
            <p>
              We're transparent about our role: we're not lenders, we're connectors. We work exclusively with licensed,
              vetted reverse mortgage specialists who have proven track records in helping homeowners like you.
            </p>
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section id="how-it-works" className="bg-muted/30 px-4 py-16 md:py-24">
        <div className="mx-auto max-w-6xl">
          <h2 className="text-balance text-center font-serif text-3xl font-medium tracking-tight text-foreground md:text-4xl">
            How It Works
          </h2>
          <div className="mt-12 grid gap-8 md:grid-cols-3">
            <Card className="border-2">
              <CardContent className="pt-8">
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary text-2xl font-bold text-primary-foreground">
                  1
                </div>
                <h3 className="mb-3 text-xl font-semibold text-foreground">Contact</h3>
                <p className="leading-relaxed text-muted-foreground">
                  You reply to our email or reach out directly through our website
                </p>
              </CardContent>
            </Card>

            <Card className="border-2">
              <CardContent className="pt-8">
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary text-2xl font-bold text-primary-foreground">
                  2
                </div>
                <h3 className="mb-3 text-xl font-semibold text-foreground">Pre-Qualify</h3>
                <p className="leading-relaxed text-muted-foreground">
                  We verify your eligibility and answer any questions you have about the process
                </p>
              </CardContent>
            </Card>

            <Card className="border-2">
              <CardContent className="pt-8">
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary text-2xl font-bold text-primary-foreground">
                  3
                </div>
                <h3 className="mb-3 text-xl font-semibold text-foreground">Connect</h3>
                <p className="leading-relaxed text-muted-foreground">
                  We introduce you to a trusted specialist in your area who can help
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Meet the Coordinators Section */}
      <section className="px-4 py-16 md:py-24">
        <div className="mx-auto max-w-6xl">
          <h2 className="text-balance text-center font-serif text-3xl font-medium tracking-tight text-foreground md:text-4xl">
            Meet Your Pre-Qualification Coordinators
          </h2>
          <div className="mt-12 grid gap-8 md:grid-cols-3">
            <Card>
              <CardContent className="pt-8 text-center">
                <div className="mx-auto mb-4 flex h-32 w-32 items-center justify-center overflow-hidden rounded-full bg-muted">
                  <UserCircle2 className="h-24 w-24 text-muted-foreground" />
                </div>
                <h3 className="mb-1 text-xl font-semibold text-foreground">Sarah Mitchell</h3>
                <p className="mb-3 text-sm font-medium text-primary">Pre-Qualification Coordinator</p>
                <p className="leading-relaxed text-muted-foreground">
                  Sarah has helped over 200 homeowners understand their home equity options and find the right
                  specialist for their needs.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-8 text-center">
                <div className="mx-auto mb-4 flex h-32 w-32 items-center justify-center overflow-hidden rounded-full bg-muted">
                  <UserCircle2 className="h-24 w-24 text-muted-foreground" />
                </div>
                <h3 className="mb-1 text-xl font-semibold text-foreground">Michael Chen</h3>
                <p className="mb-3 text-sm font-medium text-primary">Pre-Qualification Coordinator</p>
                <p className="leading-relaxed text-muted-foreground">
                  With 8 years of experience, Michael specializes in helping homeowners navigate the pre-qualification
                  process with clarity and care.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-8 text-center">
                <div className="mx-auto mb-4 flex h-32 w-32 items-center justify-center overflow-hidden rounded-full bg-muted">
                  <UserCircle2 className="h-24 w-24 text-muted-foreground" />
                </div>
                <h3 className="mb-1 text-xl font-semibold text-foreground">Jennifer Rodriguez</h3>
                <p className="mb-3 text-sm font-medium text-primary">Pre-Qualification Coordinator</p>
                <p className="leading-relaxed text-muted-foreground">
                  Jennifer's patient approach has made her a trusted advisor for homeowners exploring their financial
                  options.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="bg-muted/30 px-4 py-16 md:py-24">
        <div className="mx-auto max-w-3xl">
          <h2 className="text-balance text-center font-serif text-3xl font-medium tracking-tight text-foreground md:text-4xl">
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
              <p>Barbara LLC</p>
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
