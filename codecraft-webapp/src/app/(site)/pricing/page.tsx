"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { CheckCircle, ArrowRight, Loader2, DollarSign } from "lucide-react"
import { Link } from '@/navigation'
import Navbar from "@/components/navbar"
import Footer from "@/components/footer"

interface PricingTier {
  id: string
  name: string
  price: number
  timeline: string
  features: string[]
  is_popular: boolean
}

interface Addon {
  id: string
  name: string
  description?: string
  price: number
  billing_type: 'monthly' | 'yearly' | 'one_time'
  icon?: string
}

interface ServiceCategory {
  id: string
  name: string
  description?: string
  icon?: string
  pricing_tiers: PricingTier[]
}

export default function PricingPage() {
  const [categories, setCategories] = useState<ServiceCategory[]>([])
  const [addons, setAddons] = useState<Addon[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    fetchPricing()
  }, [])

  const fetchPricing = async () => {
    setIsLoading(true)
    try {
      const response = await fetch('/api/pricing')
      const data = await response.json()
      if (response.ok) {
        setCategories(data.categories || [])
        setAddons(data.addons || [])
      }
    } catch (error) {
      console.error('Error fetching pricing:', error)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div>
      <Navbar />
      <main className="min-h-screen">
        {/* Hero */}
        <section className="px-6 lg:px-8 py-24 bg-muted/50">
          <div className="mx-auto max-w-7xl text-center">
            <Badge className="mb-4">💰 Transparent Pricing</Badge>
            <h1 className="text-4xl font-bold tracking-tight sm:text-5xl mb-4">
              Simple, Fair Pricing
            </h1>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              No hidden fees. No surprises. Just quality development at competitive prices.
            </p>
          </div>
        </section>

        {isLoading && (
          <section className="py-16 px-6 lg:px-8">
            <div className="mx-auto max-w-7xl text-center">
              <Loader2 className="h-12 w-12 animate-spin mx-auto text-muted-foreground" />
              <p className="text-muted-foreground mt-4">Loading pricing...</p>
            </div>
          </section>
        )}

        {!isLoading && categories.length === 0 && (
          <section className="py-16 px-6 lg:px-8">
            <div className="mx-auto max-w-7xl text-center">
              <DollarSign className="h-16 w-16 mx-auto mb-4 text-muted-foreground opacity-50" />
              <h3 className="text-xl font-semibold mb-2">No Pricing Available</h3>
              <p className="text-muted-foreground">Check back soon for pricing information!</p>
            </div>
          </section>
        )}

        {/* Pricing Tables */}
        {!isLoading && categories.map((category, catIndex) => (
          <section key={category.id} className="py-16 px-6 lg:px-8">
            <div className="mx-auto max-w-7xl">
              <h2 className="text-3xl font-bold text-center mb-12">
                {category.icon && <span className="mr-2">{category.icon}</span>}
                {category.name}
              </h2>
              
              <div className="grid md:grid-cols-3 gap-8">
                {category.pricing_tiers.map((tier) => (
                  <Card 
                    key={tier.id} 
                    className={tier.is_popular ? 'border-primary border-2 shadow-lg' : ''}
                  >
                    <CardHeader>
                      {tier.is_popular && (
                        <Badge className="w-fit mb-2">Most Popular</Badge>
                      )}
                      <CardTitle>{tier.name}</CardTitle>
                      <div className="mt-4">
                        <span className="text-4xl font-bold">${tier.price}</span>
                      </div>
                      <CardDescription className="mt-2">
                        Timeline: {tier.timeline}
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <ul className="space-y-3 mb-6">
                        {tier.features.map((feature, i) => (
                          <li key={i} className="flex items-start gap-2">
                            <CheckCircle className="h-5 w-5 text-green-500 flex-shrink-0 mt-0.5" />
                            <span className="text-sm">{feature}</span>
                          </li>
                        ))}
                      </ul>
                      <Link 
                        href={`/order?service=${encodeURIComponent(category.name)}&name=${encodeURIComponent(tier.name)}&price=${tier.price}&timeline=${encodeURIComponent(tier.timeline)}&tier_id=${tier.id}`}
                      >
                        <Button 
                          className="w-full" 
                          variant={tier.is_popular ? 'default' : 'outline'}
                        >
                          Get Started
                        </Button>
                      </Link>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          </section>
        ))}

        {/* Add-ons Section */}
        {!isLoading && addons.length > 0 && (
          <section className="py-16 px-6 lg:px-8 border-t">
            <div className="mx-auto max-w-7xl">
              <div className="text-center mb-12">
                <Badge className="mb-4">➕ Optional Add-ons</Badge>
                <h2 className="text-3xl font-bold mb-4">Enhance Your Service</h2>
                <p className="text-muted-foreground max-w-2xl mx-auto">
                  Upgrade your experience with these optional add-ons (max 5 total)
                </p>
              </div>

              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-5xl mx-auto">
                {addons.map((addon) => (
                  <Card key={addon.id}>
                    <CardHeader>
                      {addon.icon && (
                        <div className="text-4xl mb-2">{addon.icon}</div>
                      )}
                      <CardTitle className="text-lg">{addon.name}</CardTitle>
                      {addon.description && (
                        <CardDescription>{addon.description}</CardDescription>
                      )}
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold mb-4">
                        €{addon.price}
                        {addon.billing_type !== 'one_time' && (
                          <span className="text-sm font-normal text-muted-foreground">
                            /{addon.billing_type === 'yearly' ? 'year' : 'month'}
                          </span>
                        )}
                      </div>
                      <Badge variant="outline">
                        {addon.billing_type === 'one_time' ? 'One-time Purchase' : 
                         addon.billing_type === 'yearly' ? 'Billed Yearly' : 'Billed Monthly'}
                      </Badge>
                    </CardContent>
                  </Card>
                ))}
              </div>

              <div className="text-center mt-8">
                <p className="text-sm text-muted-foreground">
                  Add-ons can be selected during checkout or added to existing subscriptions
                </p>
              </div>
            </div>
          </section>
        )}

        {/* Additional Info */}
        <section className="py-16 px-6 lg:px-8 bg-muted/30">
          <div className="mx-auto max-w-7xl">
            <div className="grid md:grid-cols-2 gap-8">
              <Card>
                <CardHeader>
                  <CardTitle>💰 Payment Terms</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm text-muted-foreground">
                  <p>• 50% upfront payment for projects under $2,000</p>
                  <p>• Milestone-based payments for larger projects</p>
                  <p>• Payment plans available</p>
                  <p>• All major payment methods accepted</p>
                  <p>• Secure payment processing</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>🎁 Special Offers</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm text-muted-foreground">
                  <p>• 15% discount for first-time customers</p>
                  <p>• 20% bundle discount on multiple services</p>
                  <p>• 10% referral commission</p>
                  <p>• Free consultation for all projects</p>
                  <p>• 30 days free support included</p>
                </CardContent>
              </Card>
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="py-24 px-6 lg:px-8">
          <div className="mx-auto max-w-3xl text-center">
            <h2 className="text-3xl font-bold mb-4">
              Need a Custom Quote?
            </h2>
            <p className="text-lg text-muted-foreground mb-8">
              Every project is unique. Contact us for a personalized quote tailored to your needs.
            </p>
            <div className="flex flex-wrap gap-4 justify-center">
              <Link href="/order?service=Custom&name=Custom Quote">
                <Button size="lg" className="gap-2">
                  Request Quote <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
              <Link href="/contact">
                <Button variant="outline" size="lg">
                  Contact Us
                </Button>
              </Link>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  )
}
