"use client"

import { useEffect, useState } from "react"
import { useSession } from "next-auth/react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { MessageCircle, Clock, MapPin, ExternalLink } from "lucide-react"
import { Link } from '@/navigation'
import Navbar from "@/components/navbar"
import Footer from "@/components/footer"

export default function ContactPage() {
  const { data: session, status } = useSession()
  const isLoggedIn = status === "authenticated"
  return (
    <div>
      <Navbar />
      <main className="min-h-screen">
        {/* Hero */}
        <section className="px-6 lg:px-8 py-24 bg-muted/50">
          <div className="mx-auto max-w-7xl text-center">
            <Badge className="mb-4">📞 Get in Touch</Badge>
            <h1 className="text-4xl font-bold tracking-tight sm:text-5xl mb-4">
              Contact Us
            </h1>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Have questions? We&apos;re here to help. Reach out and let&apos;s discuss your project.
            </p>
          </div>
        </section>

        {/* Contact Methods */}
        <section className="py-16 px-6 lg:px-8">
          <div className="mx-auto max-w-4xl">
            <div className="mb-12">
              <Card>
                <CardHeader>
                  <MessageCircle className="h-10 w-10 text-primary mb-4" />
                  <CardTitle>Discord Support</CardTitle>
                  <CardDescription>
                    {isLoggedIn 
                      ? "Join our Discord server for instant support and updates"
                      : "Login with Discord to access support and create tickets"
                    }
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground mb-4">
                    Response time: &lt; 2 hours • Available 24/7
                  </p>
                  {isLoggedIn ? (
                    <div className="space-y-3">
                      <a 
                        href={process.env.NEXT_PUBLIC_DISCORD_INVITE_URL || "https://discord.gg/vywm9GDNwc"} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="w-full block"
                      >
                        <Button className="w-full gap-2">
                          <MessageCircle className="h-4 w-4" />
                          Join Discord Server
                          <ExternalLink className="h-4 w-4" />
                        </Button>
                      </a>
                      <Link href="/dashboard" className="w-full block">
                        <Button variant="outline" className="w-full">
                          Go to Dashboard
                        </Button>
                      </Link>
                    </div>
                  ) : (
                    <Link href="/login" className="w-full block">
                      <Button className="w-full">
                        Login with Discord
                      </Button>
                    </Link>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Info Cards */}
            <div className="grid md:grid-cols-2 gap-6">
              <Card>
                <CardHeader className="text-center">
                  <Clock className="h-8 w-8 text-primary mx-auto mb-2" />
                  <CardTitle className="text-lg">Response Time</CardTitle>
                </CardHeader>
                <CardContent className="text-center">
                  <p className="text-2xl font-bold">&lt; 2 hours</p>
                  <p className="text-sm text-muted-foreground">Average response on Discord</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="text-center">
                  <MessageCircle className="h-8 w-8 text-primary mx-auto mb-2" />
                  <CardTitle className="text-lg">24/7 Availability</CardTitle>
                </CardHeader>
                <CardContent className="text-center">
                  <p className="text-2xl font-bold">Always On</p>
                  <p className="text-sm text-muted-foreground">AI assistant + Discord support</p>
                </CardContent>
              </Card>
            </div>

            {/* FAQ */}
            <div className="mt-16">
              <h2 className="text-2xl font-bold text-center mb-8">Frequently Asked Questions</h2>
              <div className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">How do I get started?</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground">
                      Simply login with Discord and create an order. We&apos;ll review your requirements and send you a detailed quote within 24 hours.
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">What payment methods do you accept?</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground">
                      We accept Credit/Debit cards (Stripe), PayPal, Cryptocurrency (BTC, ETH, USDT), and bank transfers. Payment plans available for projects over $2,000.
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Do you provide ongoing support?</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground">
                      Yes! All projects include 30 days of free support. We also offer maintenance packages starting at $99/month or hourly support at $75/hour.
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Can I see examples of your work?</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground">
                      Absolutely! Check out our portfolio page to see detailed case studies of recent projects.
                    </p>
                    <Link href="/portfolio">
                      <Button variant="outline" className="mt-4">
                        View Portfolio
                      </Button>
                    </Link>
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  )
}

