"use client"

import { useState, useEffect } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { useSession } from "next-auth/react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ArrowLeft, Send, CheckCircle, Tag, Check, X, Loader2 } from "lucide-react"
import { Link } from '@/navigation'
import Navbar from "@/components/navbar"
import Footer from "@/components/footer"
import { useToast } from "@/components/ui/use-toast"

export default function OrderPage() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const { toast } = useToast()
  const { data: session, status } = useSession()
  
  const isAuthenticated = !!session
  const isCheckingAuth = status === 'loading'
  
  // Redirect to login if not authenticated
  useEffect(() => {
    if (status === 'unauthenticated') {
      toast({
        title: "Login Required",
        description: "Please login to place an order.",
        variant: "destructive"
      })
      setTimeout(() => {
        router.push('/login')
      }, 2000)
    }
  }, [status, router, toast])
  
  const [formData, setFormData] = useState({
    serviceType: searchParams.get('service') || '',
    serviceName: searchParams.get('name') || '',
    price: searchParams.get('price') || '',
    projectName: '',
    description: '',
    discordGuildId: '',
    timeline: searchParams.get('timeline') || '',
    budget: searchParams.get('price') || '',
    additionalInfo: '',
    contactMethod: 'discord',
  })

  const [addons, setAddons] = useState<any[]>([])
  const [selectedAddons, setSelectedAddons] = useState<string[]>([])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isSubmitted, setIsSubmitted] = useState(false)

  // Discount code state
  const [discountCode, setDiscountCode] = useState('')
  const [appliedDiscount, setAppliedDiscount] = useState<any>(null)
  const [discountError, setDiscountError] = useState('')
  const [validatingDiscount, setValidatingDiscount] = useState(false)

  useEffect(() => {
    fetchAddons()
  }, [searchParams.get('tier_id')])

  const fetchAddons = async () => {
    try {
      const tierId = searchParams.get('tier_id')
      const url = tierId 
        ? `/api/pricing/addons?tier_id=${tierId}`
        : '/api/pricing/addons'
      
      const response = await fetch(url)
      const data = await response.json()
      if (response.ok) {
        setAddons(data.addons || [])
      }
    } catch (error) {
      console.error('Error fetching addons:', error)
    }
  }

  const toggleAddon = (addonId: string) => {
    setSelectedAddons(prev =>
      prev.includes(addonId)
        ? prev.filter(id => id !== addonId)
        : [...prev, addonId]
    )
  }

  const calculateSubtotal = () => {
    const basePrice = parseFloat(formData.price) || 0
    const addonsTotal = addons
      .filter(a => selectedAddons.includes(a.id))
      .reduce((sum, addon) => sum + parseFloat(addon.price), 0)
    return basePrice + addonsTotal
  }

  const calculateTotal = () => {
    const subtotal = calculateSubtotal()
    if (appliedDiscount) {
      return subtotal - (appliedDiscount.amount || 0)
    }
    return subtotal
  }

  const validateDiscountCode = async () => {
    if (!discountCode.trim()) {
      setDiscountError('Please enter a discount code')
      return
    }

    setValidatingDiscount(true)
    setDiscountError('')

    try {
      const response = await fetch('/api/discount-codes/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: discountCode,
          orderValue: calculateSubtotal(),
          tier: searchParams.get('tier')
        })
      })

      const data = await response.json()

      if (data.valid) {
        setAppliedDiscount(data.discount)
        toast({
          title: "Discount Applied! 🎉",
          description: `You saved €${data.discount.amount.toFixed(2)}`
        })
      } else {
        setDiscountError(data.error || 'Invalid discount code')
        setAppliedDiscount(null)
      }
    } catch (error) {
      setDiscountError('Failed to validate discount code')
      setAppliedDiscount(null)
    } finally {
      setValidatingDiscount(false)
    }
  }

  const removeDiscount = () => {
    setDiscountCode('')
    setAppliedDiscount(null)
    setDiscountError('')
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)

    try {
      // Prepare selected add-ons data
      const selectedAddonsData = addons
        .filter(a => selectedAddons.includes(a.id))
        .map(a => ({
          id: a.id,
          name: a.name,
          price: a.price,
          billing_type: a.billing_type
        }))

      const response = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          selected_addons: selectedAddonsData,
          discount_code: appliedDiscount ? {
            id: appliedDiscount.id,
            code: appliedDiscount.code,
            amount: appliedDiscount.amount,
            original_price: calculateSubtotal(),
            final_price: calculateTotal()
          } : null
        })
      })

      const data = await response.json()

      if (!response.ok) {
        // If unauthorized, redirect to login
        if (response.status === 401) {
          toast({
            title: "Login Required",
            description: "Please login to submit an order.",
            variant: "destructive"
          })
          setTimeout(() => {
            router.push('/login')
          }, 1500)
          return
        }
        throw new Error(data.error || 'Failed to submit order')
      }

      console.log('Order submitted successfully:', data)
      
      setIsSubmitted(true)
      toast({
        title: "Order submitted successfully!",
        description: `Order #${data.order_number} - We'll contact you soon!`,
      })
    } catch (error) {
      console.error('Error submitting order:', error)
      toast({
        title: "Error submitting order",
        description: error instanceof Error ? error.message : "Please try again or contact support.",
        variant: "destructive"
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  // Show loading while checking authentication
  if (isCheckingAuth) {
    return (
      <div>
        <Navbar />
        <main className="min-h-screen flex items-center justify-center px-6 py-24">
          <Card className="max-w-md w-full">
            <CardContent className="py-10 text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
              <p className="text-muted-foreground">Checking authentication...</p>
            </CardContent>
          </Card>
        </main>
        <Footer />
      </div>
    )
  }

  // Redirect to login if not authenticated
  if (!isAuthenticated) {
    return (
      <div>
        <Navbar />
        <main className="min-h-screen flex items-center justify-center px-6 py-24">
          <Card className="max-w-md w-full border-destructive">
            <CardContent className="py-10 text-center">
              <p className="text-destructive font-semibold mb-2">Login Required</p>
              <p className="text-muted-foreground mb-4">You must be logged in to place an order.</p>
              <p className="text-sm text-muted-foreground">Redirecting to login...</p>
            </CardContent>
          </Card>
        </main>
        <Footer />
      </div>
    )
  }

  if (isSubmitted) {
    return (
      <div>
        <Navbar />
        <main className="min-h-screen flex items-center justify-center px-6 py-24">
          <Card className="max-w-2xl w-full">
            <CardHeader className="text-center">
              <div className="mx-auto w-16 h-16 bg-green-100 dark:bg-green-900 rounded-full flex items-center justify-center mb-4">
                <CheckCircle className="h-8 w-8 text-green-600 dark:text-green-400" />
              </div>
              <CardTitle className="text-2xl">Order Submitted Successfully!</CardTitle>
              <CardDescription className="text-base mt-2">
                Thank you for choosing CodeCraft! We've received your order request.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="bg-muted p-4 rounded-lg space-y-2">
                <p className="text-sm"><strong>Service:</strong> {formData.serviceName}</p>
                <p className="text-sm"><strong>Project:</strong> {formData.projectName}</p>
                <p className="text-sm"><strong>Budget:</strong> ${formData.budget}</p>
              </div>
              
              <div className="space-y-2">
                <h3 className="font-semibold">What's Next?</h3>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li>✓ We'll review your order within 24 hours</li>
                  <li>✓ You'll receive a confirmation via Discord</li>
                  <li>✓ We'll schedule a consultation call</li>
                  <li>✓ Project kickoff after payment confirmation</li>
                </ul>
              </div>

              <div className="flex gap-4">
                <Link href="/dashboard" className="flex-1">
                  <Button className="w-full">Go to Dashboard</Button>
                </Link>
                <Link href="/pricing" className="flex-1">
                  <Button variant="outline" className="w-full">Order More</Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        </main>
        <Footer />
      </div>
    )
  }

  return (
    <div>
      <Navbar />
      <main className="min-h-screen px-6 py-24">
        <div className="mx-auto max-w-3xl">
          <div className="mb-8">
            <Link href="/pricing">
              <Button variant="ghost" className="gap-2 mb-4">
                <ArrowLeft className="h-4 w-4" />
                Back to Pricing
              </Button>
            </Link>
            <Badge className="mb-4">🚀 Start Your Project</Badge>
            <h1 className="text-4xl font-bold mb-2">Order Form</h1>
            <p className="text-muted-foreground">
              Fill out the details below and we'll get started on your project
            </p>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Project Details</CardTitle>
              <CardDescription>
                Tell us about your project so we can provide the best service
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-6">
                {/* Selected Service */}
                {formData.serviceName && (
                  <div className="bg-primary/10 p-4 rounded-lg">
                    <p className="text-sm text-muted-foreground">Selected Service</p>
                    <p className="font-semibold text-lg">{formData.serviceName}</p>
                    <p className="text-sm text-muted-foreground">
                      {formData.serviceType} • ${formData.price}
                    </p>
                  </div>
                )}

                {/* Service Type (if not pre-selected) */}
                {!formData.serviceName && (
                  <div>
                    <label className="block text-sm font-medium mb-2">
                      Service Type *
                    </label>
                    <select
                      name="serviceType"
                      value={formData.serviceType}
                      onChange={handleChange}
                      required
                      className="w-full p-2 rounded-md border bg-background"
                    >
                      <option value="">Select a service</option>
                      <option value="Discord Bot">Discord Bot</option>
                      <option value="Website">Website</option>
                      <option value="E-Commerce">E-Commerce</option>
                      <option value="Web Application">Web Application</option>
                      <option value="Custom">Custom Project</option>
                    </select>
                  </div>
                )}

                {/* Project Name */}
                <div>
                  <label className="block text-sm font-medium mb-2">
                    Project Name *
                  </label>
                  <input
                    type="text"
                    name="projectName"
                    value={formData.projectName}
                    onChange={handleChange}
                    required
                    placeholder="My Awesome Project"
                    className="w-full p-2 rounded-md border bg-background"
                  />
                </div>

                {/* Discord Guild ID */}
                <div>
                  <label className="block text-sm font-medium mb-2">
                    Discord Server ID (Guild ID) *
                  </label>
                  <input
                    type="text"
                    name="discordGuildId"
                    value={formData.discordGuildId}
                    onChange={handleChange}
                    required
                    placeholder="e.g., 1234567890123456789"
                    className="w-full p-2 rounded-md border bg-background"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Enable Developer Mode in Discord → Right-click your server → Copy Server ID
                  </p>
                </div>

                {/* Description */}
                <div>
                  <label className="block text-sm font-medium mb-2">
                    Project Description *
                  </label>
                  <textarea
                    name="description"
                    value={formData.description}
                    onChange={handleChange}
                    required
                    rows={5}
                    placeholder="Describe your project, features you need, target audience, etc."
                    className="w-full p-2 rounded-md border bg-background resize-none"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Be as detailed as possible to help us understand your needs
                  </p>
                </div>

                {/* Timeline */}
                <div>
                  <label className="block text-sm font-medium mb-2">
                    Desired Timeline
                  </label>
                  <input
                    type="text"
                    name="timeline"
                    value={formData.timeline}
                    onChange={handleChange}
                    placeholder="e.g., 2 weeks, ASAP, Flexible"
                    className="w-full p-2 rounded-md border bg-background"
                  />
                </div>

                {/* Budget */}
                <div>
                  <label className="block text-sm font-medium mb-2">
                    Budget (USD) *
                  </label>
                  <input
                    type="number"
                    name="budget"
                    value={formData.budget}
                    onChange={handleChange}
                    required
                    min="0"
                    placeholder="500"
                    className="w-full p-2 rounded-md border bg-background"
                  />
                </div>

                {/* Add-ons Selection */}
                {addons.length > 0 && (
                  <div className="border-t pt-6">
                    <label className="block text-sm font-medium mb-3">
                      ➕ Optional Add-ons
                    </label>
                    <p className="text-sm text-muted-foreground mb-4">
                      Enhance your service with these optional add-ons
                    </p>
                    <div className="space-y-3">
                      {addons.map((addon) => (
                        <div
                          key={addon.id}
                          onClick={() => toggleAddon(addon.id)}
                          className={`border rounded-lg p-4 cursor-pointer transition-all ${
                            selectedAddons.includes(addon.id)
                              ? 'border-primary bg-primary/5'
                              : 'hover:border-primary/50'
                          }`}
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex items-start gap-3 flex-1">
                              <input
                                type="checkbox"
                                checked={selectedAddons.includes(addon.id)}
                                onChange={() => {}} // Handled by parent div
                                className="mt-1 h-4 w-4"
                                onClick={(e) => e.stopPropagation()}
                              />
                              <div>
                                <div className="flex items-center gap-2 mb-1">
                                  {addon.icon && <span>{addon.icon}</span>}
                                  <h4 className="font-semibold">{addon.name}</h4>
                                </div>
                                {addon.description && (
                                  <p className="text-sm text-muted-foreground">{addon.description}</p>
                                )}
                              </div>
                            </div>
                            <div className="text-right">
                              <p className="font-bold">
                                €{addon.price}
                                {addon.billing_type !== 'one_time' && (
                                  <span className="text-sm font-normal text-muted-foreground">
                                    /{addon.billing_type === 'yearly' ? 'yr' : 'mo'}
                                  </span>
                                )}
                              </p>
                              <Badge variant="outline" className="text-xs mt-1">
                                {addon.billing_type === 'one_time' ? 'One-time' : addon.billing_type}
                              </Badge>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Price Summary */}
                    {selectedAddons.length > 0 && (
                      <div className="mt-4 p-4 bg-muted rounded-lg">
                        <div className="space-y-2">
                          <div className="flex justify-between text-sm">
                            <span>Base Price:</span>
                            <span>${formData.price || 0}</span>
                          </div>
                          {addons
                            .filter(a => selectedAddons.includes(a.id))
                            .map(addon => (
                              <div key={addon.id} className="flex justify-between text-sm">
                                <span>+ {addon.name}:</span>
                                <span>
                                  €{addon.price}
                                  {addon.billing_type !== 'one_time' && ` /${addon.billing_type === 'yearly' ? 'year' : 'month'}`}
                                </span>
                              </div>
                            ))}
                          <div className="border-t pt-2 flex justify-between font-bold">
                            <span>Total:</span>
                            <span>${calculateTotal()}</span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Discount Code */}
                <div className="border rounded-lg p-4 bg-muted/30">
                  <div className="flex items-center gap-2 mb-3">
                    <Tag className="h-5 w-5" />
                    <label className="text-sm font-medium">Have a Discount Code?</label>
                  </div>
                  
                  {!appliedDiscount ? (
                    <div className="flex gap-2">
                      <div className="flex-1">
                        <input
                          type="text"
                          value={discountCode}
                          onChange={(e) => setDiscountCode(e.target.value.toUpperCase())}
                          placeholder="Enter code (e.g., WELCOME10)"
                          className="w-full p-2 rounded-md border bg-background uppercase font-mono"
                          onKeyPress={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault()
                              validateDiscountCode()
                            }
                          }}
                        />
                        {discountError && (
                          <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
                            <X className="h-3 w-3" />
                            {discountError}
                          </p>
                        )}
                      </div>
                      <Button
                        type="button"
                        onClick={validateDiscountCode}
                        disabled={validatingDiscount || !discountCode.trim()}
                        className="gap-2"
                      >
                        {validatingDiscount ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <>
                            Apply
                          </>
                        )}
                      </Button>
                    </div>
                  ) : (
                    <div className="bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded-lg p-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Check className="h-5 w-5 text-green-600" />
                          <div>
                            <p className="font-mono font-bold">{appliedDiscount.code}</p>
                            <p className="text-xs text-green-700 dark:text-green-300">
                              {appliedDiscount.type === 'percentage' 
                                ? `${appliedDiscount.value}% discount applied`
                                : `€${appliedDiscount.value} discount applied`
                              }
                            </p>
                          </div>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={removeDiscount}
                          className="h-8 w-8 p-0"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Price Summary */}
                {(formData.price || selectedAddons.length > 0 || appliedDiscount) && (
                  <div className="border rounded-lg p-4 bg-muted/20">
                    <h3 className="font-semibold mb-3">Price Summary</h3>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Base Price:</span>
                        <span>€{parseFloat(formData.price || '0').toFixed(2)}</span>
                      </div>
                      {selectedAddons.length > 0 && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Add-ons ({selectedAddons.length}):</span>
                          <span>
                            €{addons
                              .filter(a => selectedAddons.includes(a.id))
                              .reduce((sum, addon) => sum + parseFloat(addon.price), 0)
                              .toFixed(2)
                            }
                          </span>
                        </div>
                      )}
                      {appliedDiscount && (
                        <div className="flex justify-between text-green-600 dark:text-green-400">
                          <span className="flex items-center gap-1">
                            <Tag className="h-3 w-3" />
                            Discount ({appliedDiscount.code}):
                          </span>
                          <span>-€{appliedDiscount.amount.toFixed(2)}</span>
                        </div>
                      )}
                      <div className="border-t pt-2 flex justify-between font-bold text-base">
                        <span>Total:</span>
                        <span className="text-primary">€{calculateTotal().toFixed(2)}</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Additional Info */}
                <div>
                  <label className="block text-sm font-medium mb-2">
                    Additional Information
                  </label>
                  <textarea
                    name="additionalInfo"
                    value={formData.additionalInfo}
                    onChange={handleChange}
                    rows={3}
                    placeholder="Any special requirements, references, or questions?"
                    className="w-full p-2 rounded-md border bg-background resize-none"
                  />
                </div>

                {/* Contact Method */}
                <div>
                  <label className="block text-sm font-medium mb-2">
                    Preferred Contact Method *
                  </label>
                  <select
                    name="contactMethod"
                    value={formData.contactMethod}
                    onChange={handleChange}
                    required
                    className="w-full p-2 rounded-md border bg-background"
                  >
                    <option value="discord">Discord</option>
                    <option value="email">Email</option>
                    <option value="both">Both</option>
                  </select>
                </div>

                {/* Submit Button */}
                <div className="pt-4">
                  <Button
                    type="submit"
                    className="w-full gap-2"
                    size="lg"
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? (
                      <>Submitting...</>
                    ) : (
                      <>
                        Submit Order <Send className="h-4 w-4" />
                      </>
                    )}
                  </Button>
                  <p className="text-xs text-muted-foreground text-center mt-2">
                    By submitting, you agree to our Terms of Service
                  </p>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      </main>
      <Footer />
    </div>
  )
}

