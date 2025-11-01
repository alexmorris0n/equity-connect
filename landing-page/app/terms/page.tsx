import { Button } from "@/components/ui/button"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-background px-4 py-6">
        <div className="mx-auto max-w-4xl">
          <Link href="/">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Home
            </Button>
          </Link>
        </div>
      </header>

      {/* Content */}
      <main className="px-4 py-12 md:py-16">
        <div className="mx-auto max-w-4xl">
          <h1 className="text-balance font-serif text-4xl font-medium tracking-tight text-foreground md:text-5xl">
            Terms & Conditions
          </h1>
          <p className="mt-4 text-lg text-muted-foreground">
            Last Updated: {new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
          </p>

          <div className="mt-12 space-y-12 text-muted-foreground">
            {/* Section 1 */}
            <section>
              <h2 className="mb-4 font-serif text-2xl font-medium text-foreground">1. Acceptance of Terms</h2>
              <div className="space-y-4 leading-relaxed">
                <p>
                  By accessing or using Equity Connect's services, including our website, email communications, SMS
                  messages, and phone consultations, you agree to be bound by these Terms & Conditions. If you do not
                  agree to these terms, please do not use our services.
                </p>
                <p>
                  These terms constitute a legally binding agreement between you and Barbara LLC (doing business as
                  Equity Connect). We reserve the right to modify these terms at any time, and your continued use of our
                  services constitutes acceptance of any changes.
                </p>
              </div>
            </section>

            {/* Section 2 */}
            <section>
              <h2 className="mb-4 font-serif text-2xl font-medium text-foreground">2. Service Description</h2>
              <div className="space-y-4 leading-relaxed">
                <p>
                  Equity Connect is a pre-qualification and connection service. We are NOT a lender, mortgage broker, or
                  financial institution. Our services include:
                </p>
                <ul className="ml-6 list-disc space-y-2">
                  <li>Pre-qualifying homeowners for potential reverse mortgage eligibility</li>
                  <li>Connecting qualified homeowners with licensed reverse mortgage specialists</li>
                  <li>Providing educational information about home equity access options</li>
                  <li>Facilitating introductions between homeowners and vetted professionals</li>
                </ul>
                <p>
                  We do not originate loans, provide financial advice, or guarantee any specific outcomes. All lending
                  decisions are made by the licensed specialists we connect you with.
                </p>
              </div>
            </section>

            {/* Section 3 */}
            <section>
              <h2 className="mb-4 font-serif text-2xl font-medium text-foreground">3. Eligibility Requirements</h2>
              <div className="space-y-4 leading-relaxed">
                <p>To use our services, you must:</p>
                <ul className="ml-6 list-disc space-y-2">
                  <li>Be at least 62 years of age</li>
                  <li>Own a home in the United States</li>
                  <li>Have sufficient home equity</li>
                  <li>Provide accurate and truthful information during pre-qualification</li>
                  <li>Have the legal capacity to enter into agreements</li>
                </ul>
                <p>
                  Pre-qualification through Equity Connect does not guarantee approval for a reverse mortgage or any
                  financial product. Final eligibility is determined by the licensed specialist you work with.
                </p>
              </div>
            </section>

            {/* Section 4 */}
            <section>
              <h2 className="mb-4 font-serif text-2xl font-medium text-foreground">
                4. SMS/Text Messaging Terms (TCPA Compliance)
              </h2>
              <div className="space-y-4 leading-relaxed">
                <p>
                  By providing your phone number and consenting to receive text messages, you agree to the following:
                </p>
                <ul className="ml-6 list-disc space-y-2">
                  <li>
                    You expressly consent to receive informational and promotional text messages from Equity Connect and
                    our partner specialists
                  </li>
                  <li>
                    Messages may be sent using an automatic telephone dialing system or prerecorded/artificial voice
                  </li>
                  <li>Consent is not required as a condition of purchasing any goods or services</li>
                  <li>Message frequency varies; you may receive up to 10 messages per month</li>
                  <li>Message and data rates may apply based on your mobile carrier's plan</li>
                  <li>Carriers are not liable for delayed or undelivered messages</li>
                </ul>
                <p className="font-medium text-foreground">Opt-Out Instructions:</p>
                <ul className="ml-6 list-disc space-y-2">
                  <li>Reply STOP to any text message to unsubscribe from future messages</li>
                  <li>Reply HELP for assistance or contact information</li>
                  <li>You may also email us at privacy@equityconnect.com to opt out</li>
                </ul>
                <p>
                  We comply with the Telephone Consumer Protection Act (TCPA), FCC regulations, and 10DLC (10-Digit Long
                  Code) messaging standards. For questions about our SMS program, contact us at (555) 123-4567.
                </p>
              </div>
            </section>

            {/* Section 5 */}
            <section>
              <h2 className="mb-4 font-serif text-2xl font-medium text-foreground">5. Email Communications</h2>
              <div className="space-y-4 leading-relaxed">
                <p>
                  By providing your email address, you consent to receive email communications from Equity Connect,
                  including:
                </p>
                <ul className="ml-6 list-disc space-y-2">
                  <li>Pre-qualification information and updates</li>
                  <li>Educational content about reverse mortgages and home equity</li>
                  <li>Introductions to licensed specialists</li>
                  <li>Service updates and announcements</li>
                </ul>
                <p>
                  You may unsubscribe from email communications at any time by clicking the "unsubscribe" link at the
                  bottom of any email or by contacting us directly.
                </p>
              </div>
            </section>

            {/* Section 6 */}
            <section>
              <h2 className="mb-4 font-serif text-2xl font-medium text-foreground">6. User Responsibilities</h2>
              <div className="space-y-4 leading-relaxed">
                <p>You agree to:</p>
                <ul className="ml-6 list-disc space-y-2">
                  <li>Provide accurate, current, and complete information during pre-qualification</li>
                  <li>Maintain the confidentiality of any account credentials</li>
                  <li>Notify us immediately of any unauthorized use of your information</li>
                  <li>Use our services only for lawful purposes</li>
                  <li>Not misrepresent your identity or provide false information</li>
                  <li>Conduct your own due diligence when working with specialists we connect you with</li>
                </ul>
              </div>
            </section>

            {/* Section 7 */}
            <section>
              <h2 className="mb-4 font-serif text-2xl font-medium text-foreground">7. Third-Party Specialists</h2>
              <div className="space-y-4 leading-relaxed">
                <p>
                  Equity Connect connects you with independent, licensed reverse mortgage specialists. These specialists
                  are third-party service providers, not employees or agents of Equity Connect.
                </p>
                <p>
                  While we vet specialists for licensing and experience, we do not control their actions, advice, or
                  services. Any agreements you enter into with a specialist are between you and that specialist. Equity
                  Connect is not responsible for the actions, advice, or services provided by third-party specialists.
                </p>
                <p>
                  We encourage you to verify any specialist's credentials through the NMLS Consumer Access website
                  (nmlsconsumeraccess.org) and to ask questions before proceeding with any financial transaction.
                </p>
              </div>
            </section>

            {/* Section 8 */}
            <section>
              <h2 className="mb-4 font-serif text-2xl font-medium text-foreground">8. Fees and Compensation</h2>
              <div className="space-y-4 leading-relaxed">
                <p>
                  Pre-qualification services provided by Equity Connect are free to homeowners. We do not charge you any
                  fees for our connection services.
                </p>
                <p>
                  Equity Connect receives compensation from specialists when we successfully connect them with qualified
                  homeowners. This compensation does not affect the cost of services you receive from specialists and
                  does not influence our pre-qualification process.
                </p>
                <p>
                  Any fees associated with reverse mortgage products or services are determined by the specialist you
                  work with and will be disclosed to you directly by them.
                </p>
              </div>
            </section>

            {/* Section 9 */}
            <section>
              <h2 className="mb-4 font-serif text-2xl font-medium text-foreground">
                9. Disclaimers and Limitations of Liability
              </h2>
              <div className="space-y-4 leading-relaxed">
                <p className="font-medium text-foreground">No Financial Advice:</p>
                <p>
                  Equity Connect does not provide financial, legal, or tax advice. Information provided through our
                  services is for educational purposes only. You should consult with qualified professionals before
                  making any financial decisions.
                </p>
                <p className="font-medium text-foreground">No Guarantees:</p>
                <p>
                  We do not guarantee that you will qualify for a reverse mortgage or any specific financial product. We
                  do not guarantee the availability, quality, or outcomes of services provided by third-party
                  specialists.
                </p>
                <p className="font-medium text-foreground">Limitation of Liability:</p>
                <p>
                  To the fullest extent permitted by law, Equity Connect and Barbara LLC shall not be liable for any
                  indirect, incidental, special, consequential, or punitive damages arising from your use of our
                  services or your interactions with third-party specialists.
                </p>
              </div>
            </section>

            {/* Section 10 */}
            <section>
              <h2 className="mb-4 font-serif text-2xl font-medium text-foreground">10. Intellectual Property</h2>
              <div className="space-y-4 leading-relaxed">
                <p>
                  All content on the Equity Connect website, including text, graphics, logos, images, and software, is
                  the property of Barbara LLC and is protected by copyright, trademark, and other intellectual property
                  laws.
                </p>
                <p>
                  You may not reproduce, distribute, modify, or create derivative works from our content without express
                  written permission.
                </p>
              </div>
            </section>

            {/* Section 11 */}
            <section>
              <h2 className="mb-4 font-serif text-2xl font-medium text-foreground">11. Termination</h2>
              <div className="space-y-4 leading-relaxed">
                <p>
                  We reserve the right to terminate or suspend your access to our services at any time, without notice,
                  for conduct that we believe violates these Terms & Conditions or is harmful to other users, us, or
                  third parties.
                </p>
                <p>
                  You may terminate your relationship with Equity Connect at any time by opting out of communications
                  and ceasing to use our services.
                </p>
              </div>
            </section>

            {/* Section 12 */}
            <section>
              <h2 className="mb-4 font-serif text-2xl font-medium text-foreground">12. Governing Law and Disputes</h2>
              <div className="space-y-4 leading-relaxed">
                <p>
                  These Terms & Conditions are governed by the laws of the State of California, without regard to its
                  conflict of law provisions.
                </p>
                <p>
                  Any disputes arising from these terms or your use of our services shall be resolved through binding
                  arbitration in Los Angeles County, California, in accordance with the rules of the American
                  Arbitration Association.
                </p>
              </div>
            </section>

            {/* Section 13 */}
            <section>
              <h2 className="mb-4 font-serif text-2xl font-medium text-foreground">13. Severability</h2>
              <div className="space-y-4 leading-relaxed">
                <p>
                  If any provision of these Terms & Conditions is found to be invalid or unenforceable, the remaining
                  provisions shall continue in full force and effect.
                </p>
              </div>
            </section>

            {/* Section 14 */}
            <section>
              <h2 className="mb-4 font-serif text-2xl font-medium text-foreground">14. Contact Information</h2>
              <div className="space-y-4 leading-relaxed">
                <p>If you have questions about these Terms & Conditions, please contact us:</p>
                <div className="mt-4 rounded-lg bg-muted/50 p-6">
                  <p className="font-medium text-foreground">Barbara LLC (dba Equity Connect)</p>
                  <p className="mt-2">6210 Wilshire Blvd, Ste 200 PMB</p>
                  <p>Los Angeles, CA 90048</p>
                  <p className="mt-2">Email: legal@equityconnect.com</p>
                  <p>Phone: (555) 123-4567</p>
                </div>
              </div>
            </section>

            {/* Section 15 */}
            <section>
              <h2 className="mb-4 font-serif text-2xl font-medium text-foreground">15. Entire Agreement</h2>
              <div className="space-y-4 leading-relaxed">
                <p>
                  These Terms & Conditions, together with our Privacy Policy, constitute the entire agreement between
                  you and Equity Connect regarding your use of our services and supersede all prior agreements and
                  understandings.
                </p>
              </div>
            </section>
          </div>

          {/* Back to Top */}
          <div className="mt-12 text-center">
            <Link href="/">
              <Button size="lg">Return to Home</Button>
            </Link>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t bg-background px-4 py-8">
        <div className="mx-auto max-w-4xl text-center text-sm text-muted-foreground">
          <p>&copy; {new Date().getFullYear()} Equity Connect. All rights reserved.</p>
        </div>
      </footer>
    </div>
  )
}
