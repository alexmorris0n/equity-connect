"use client"

import { Button } from "@/components/ui/button"
import { ArrowLeft } from "lucide-react"
import Link from "next/link"

export default function PrivacyPolicyPage() {
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
            Privacy Policy
          </h1>
          <p className="mt-4 text-muted-foreground">Last Updated: {new Date().toLocaleDateString()}</p>

          <div className="mt-12 space-y-8 text-muted-foreground">
            <section>
              <h2 className="mb-4 font-serif text-2xl font-medium text-foreground">1. Introduction</h2>
              <p className="leading-relaxed">
                Equity Connect, operated by Barbara LLC ("we," "us," or "our"), is committed to protecting your privacy.
                This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you
                interact with our services, including our website and communications.
              </p>
            </section>

            <section>
              <h2 className="mb-4 font-serif text-2xl font-medium text-foreground">2. Information We Collect</h2>
              <h3 className="mb-2 text-lg font-semibold text-foreground">2.1 Information You Provide</h3>
              <p className="mb-4 leading-relaxed">
                We collect information you voluntarily provide when you contact us, including:
              </p>
              <ul className="mb-4 ml-6 list-disc space-y-2 leading-relaxed">
                <li>Name and contact information (phone number, email address, mailing address)</li>
                <li>Property information (address, estimated value, mortgage status)</li>
                <li>Age and homeownership status</li>
                <li>Any other information you choose to provide during our pre-qualification process</li>
              </ul>

              <h3 className="mb-2 text-lg font-semibold text-foreground">2.2 Information from Public Records</h3>
              <p className="mb-4 leading-relaxed">
                We obtain certain information from publicly available sources, including:
              </p>
              <ul className="ml-6 list-disc space-y-2 leading-relaxed">
                <li>Property ownership records</li>
                <li>Property characteristics and estimated values</li>
                <li>Mailing addresses</li>
              </ul>

              <h3 className="mb-2 text-lg font-semibold text-foreground">2.3 Automatically Collected Information</h3>
              <p className="mb-4 leading-relaxed">When you visit our website, we may automatically collect:</p>
              <ul className="ml-6 list-disc space-y-2 leading-relaxed">
                <li>IP address and device information</li>
                <li>Browser type and operating system</li>
                <li>Pages visited and time spent on our site</li>
                <li>Referring website addresses</li>
              </ul>
            </section>

            <section>
              <h2 className="mb-4 font-serif text-2xl font-medium text-foreground">3. How We Use Your Information</h2>
              <p className="mb-4 leading-relaxed">We use your information to:</p>
              <ul className="ml-6 list-disc space-y-2 leading-relaxed">
                <li>Pre-qualify you for reverse mortgage services</li>
                <li>Connect you with licensed reverse mortgage specialists</li>
                <li>Communicate with you about our services via phone, email, or SMS</li>
                <li>Respond to your inquiries and provide customer support</li>
                <li>Improve our services and website functionality</li>
                <li>Comply with legal obligations and protect our rights</li>
              </ul>
            </section>

            <section>
              <h2 className="mb-4 font-serif text-2xl font-medium text-foreground">
                4. SMS/Text Messaging (10DLC Compliance)
              </h2>
              <h3 className="mb-2 text-lg font-semibold text-foreground">4.1 Consent to Receive Text Messages</h3>
              <p className="mb-4 leading-relaxed">
                By providing your phone number and opting in to receive text messages, you consent to receive SMS
                messages from Equity Connect regarding our services, including pre-qualification information and
                appointment reminders. Message and data rates may apply.
              </p>

              <h3 className="mb-2 text-lg font-semibold text-foreground">4.2 Message Frequency</h3>
              <p className="mb-4 leading-relaxed">
                Message frequency varies based on your interaction with our services. You may receive up to 5 messages
                per month.
              </p>

              <h3 className="mb-2 text-lg font-semibold text-foreground">4.3 Opt-Out Instructions</h3>
              <p className="mb-4 leading-relaxed">
                You can opt out of receiving text messages at any time by replying STOP to any message. You may also
                reply HELP for assistance or contact us directly at the information provided below.
              </p>

              <h3 className="mb-2 text-lg font-semibold text-foreground">4.4 Carrier Liability</h3>
              <p className="leading-relaxed">
                Carriers are not liable for delayed or undelivered messages. We are not responsible for any charges or
                fees imposed by your wireless carrier.
              </p>
            </section>

            <section>
              <h2 className="mb-4 font-serif text-2xl font-medium text-foreground">
                5. Information Sharing and Disclosure
              </h2>
              <h3 className="mb-2 text-lg font-semibold text-foreground">5.1 With Reverse Mortgage Specialists</h3>
              <p className="mb-4 leading-relaxed">
                When you pre-qualify and agree to be connected, we share your information with a licensed reverse
                mortgage specialist who can assist you. We only share information necessary for them to provide their
                services.
              </p>

              <h3 className="mb-2 text-lg font-semibold text-foreground">5.2 Service Providers</h3>
              <p className="mb-4 leading-relaxed">
                We may share information with third-party service providers who perform services on our behalf, such as
                website hosting, data analysis, and customer service. These providers are contractually obligated to
                protect your information.
              </p>

              <h3 className="mb-2 text-lg font-semibold text-foreground">5.3 Legal Requirements</h3>
              <p className="mb-4 leading-relaxed">
                We may disclose your information when required by law, court order, or government regulation, or when we
                believe disclosure is necessary to protect our rights or comply with legal processes.
              </p>

              <h3 className="mb-2 text-lg font-semibold text-foreground">5.4 Business Transfers</h3>
              <p className="leading-relaxed">
                In the event of a merger, acquisition, or sale of assets, your information may be transferred to the
                acquiring entity.
              </p>
            </section>

            <section>
              <h2 className="mb-4 font-serif text-2xl font-medium text-foreground">
                6. We Do Not Sell Your Information
              </h2>
              <p className="leading-relaxed">
                We do not sell, rent, or trade your personal information to third parties for their marketing purposes.
                Your information is only shared with reverse mortgage specialists for the purpose of connecting you with
                their services.
              </p>
            </section>

            <section>
              <h2 className="mb-4 font-serif text-2xl font-medium text-foreground">7. Data Security</h2>
              <p className="leading-relaxed">
                We implement reasonable security measures to protect your information from unauthorized access,
                disclosure, alteration, or destruction. However, no method of transmission over the internet or
                electronic storage is 100% secure, and we cannot guarantee absolute security.
              </p>
            </section>

            <section>
              <h2 className="mb-4 font-serif text-2xl font-medium text-foreground">8. Your Rights and Choices</h2>
              <p className="mb-4 leading-relaxed">You have the right to:</p>
              <ul className="ml-6 list-disc space-y-2 leading-relaxed">
                <li>Access the personal information we hold about you</li>
                <li>Request correction of inaccurate information</li>
                <li>Request deletion of your information (subject to legal obligations)</li>
                <li>Opt out of marketing communications at any time</li>
                <li>Withdraw consent for SMS messages by replying STOP</li>
              </ul>
              <p className="mt-4 leading-relaxed">
                To exercise these rights, please contact us using the information provided below.
              </p>
            </section>

            <section>
              <h2 className="mb-4 font-serif text-2xl font-medium text-foreground">9. Email Unsubscribe</h2>
              <p className="leading-relaxed">
                Every marketing email we send includes an unsubscribe link. You can opt out of receiving marketing
                emails at any time by clicking the unsubscribe link or contacting us directly. Please note that even if
                you unsubscribe from marketing emails, we may still send you transactional or service-related messages.
              </p>
            </section>

            <section>
              <h2 className="mb-4 font-serif text-2xl font-medium text-foreground">
                10. Telephone Consumer Protection Act (TCPA) Compliance
              </h2>
              <p className="leading-relaxed">
                We comply with the Telephone Consumer Protection Act (TCPA) and FCC regulations. We will not contact you
                via phone or text message without your prior express written consent. You may revoke your consent at any
                time by contacting us or replying STOP to text messages.
              </p>
            </section>

            <section>
              <h2 className="mb-4 font-serif text-2xl font-medium text-foreground">11. Children's Privacy</h2>
              <p className="leading-relaxed">
                Our services are not directed to individuals under the age of 18. We do not knowingly collect personal
                information from children. If we become aware that we have collected information from a child, we will
                take steps to delete it promptly.
              </p>
            </section>

            <section>
              <h2 className="mb-4 font-serif text-2xl font-medium text-foreground">12. California Privacy Rights</h2>
              <p className="mb-4 leading-relaxed">
                If you are a California resident, you have additional rights under the California Consumer Privacy Act
                (CCPA), including:
              </p>
              <ul className="ml-6 list-disc space-y-2 leading-relaxed">
                <li>The right to know what personal information we collect, use, and disclose</li>
                <li>The right to request deletion of your personal information</li>
                <li>The right to opt out of the sale of personal information (we do not sell your information)</li>
                <li>The right to non-discrimination for exercising your privacy rights</li>
              </ul>
              <p className="mt-4 leading-relaxed">
                To exercise these rights, please contact us using the information below.
              </p>
            </section>

            <section>
              <h2 className="mb-4 font-serif text-2xl font-medium text-foreground">
                13. Changes to This Privacy Policy
              </h2>
              <p className="leading-relaxed">
                We may update this Privacy Policy from time to time. We will notify you of any material changes by
                posting the updated policy on our website with a new "Last Updated" date. Your continued use of our
                services after changes are posted constitutes your acceptance of the updated policy.
              </p>
            </section>

            <section>
              <h2 className="mb-4 font-serif text-2xl font-medium text-foreground">14. Contact Us</h2>
              <p className="mb-4 leading-relaxed">
                If you have questions about this Privacy Policy or wish to exercise your privacy rights, please contact
                us:
              </p>
              <div className="rounded-lg bg-muted/50 p-6">
                <p className="font-semibold text-foreground">Barbara LLC (Equity Connect)</p>
                <p className="mt-2">6210 Wilshire Blvd, Ste 200 PMB</p>
                <p>Los Angeles, CA 90048</p>
                <p className="mt-4">
                  Email:{" "}
                  <a href="mailto:privacy@equityconnect.com" className="text-primary hover:underline">
                    privacy@equityconnect.com
                  </a>
                </p>
              </div>
            </section>

            <section className="border-t pt-8">
              <p className="text-sm leading-relaxed">
                By using our services, you acknowledge that you have read and understood this Privacy Policy and agree
                to its terms.
              </p>
            </section>
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
