import type React from "react"
import type { Metadata } from "next"
import { Geist, Crimson_Text } from "next/font/google"
import { Analytics } from "@vercel/analytics/next"
import "./globals.css"

const _geist = Geist({ subsets: ["latin"] })
const _crimsonText = Crimson_Text({
  subsets: ["latin"],
  weight: ["400", "600"],
  variable: "--font-serif",
})

export const metadata: Metadata = {
  title: "Equity Connect - Connecting Homeowners with Trusted Specialists",
  description: "We connect qualified homeowners 62+ with trusted reverse mortgage specialists in their area",
  generator: "v0.app",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <body className={`${_geist.className} font-sans antialiased ${_crimsonText.variable}`}>
        {children}
        <Analytics />
      </body>
    </html>
  )
}
