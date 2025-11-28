"use client"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { 
  Bot,
  Globe,
  ShoppingCart,
  Code2,
  Palette,
  Wrench,
  CheckCircle,
  ArrowRight
} from "lucide-react"
import { Link } from '@/navigation'
import Navbar from "@/components/navbar"
import Footer from "@/components/footer"

const services = [
  {
    icon: Bot,
    title: "Discord Bot Development",
    description: "Custom Discord bots for your community with moderation, games, economy systems, and AI integration.",
    features: [
      "Custom commands & slash commands",
      "Moderation & auto-mod tools",
      "Database integration",
      "Economy & leveling systems",
      "Music & entertainment",
      "AI-powered responses",
      "Dashboard interface",
      "24/7 hosting support"
    ],
    pricing: {
      basic: { name: "Basic Bot", price: 25, timeline: "2 days" },
      advanced: { name: "Advanced Bot", price: 50, timeline: "2-3 weeks" },
      premium: { name: "AI-Powered Bot", price: 350, timeline: "2-3 weeks" }
    },
    color: "from-purple-600 to-blue-600"
  },
  {
    icon: ShoppingCart,
    title: "E-Commerce Development",
    description: "Complete online stores with payment integration, inventory management, and admin dashboards.",
    features: [
      "Product catalog management",
      "Shopping cart & checkout",
      "Stripe/PayPal integration",
      "Order management system",
      "Customer accounts",
      "Admin dashboard",
      "Inventory tracking",
      "Email notifications",
      "SEO optimization",
      "Mobile responsive"
    ],
    pricing: {
      basic: { name: "Starter Shop", price: 150, timeline: "1-2 weeks" },
      advanced: { name: "Professional Shop", price: 750, timeline: "3-5 weeks" },
      premium: { name: "Enterprise Shop", price: 1500, timeline: "6-8 weeks" }
    },
    color: "from-green-600 to-emerald-600"
  },
  {
    icon: Globe,
    title: "Website Development",
    description: "Modern, responsive websites built with the latest technologies for optimal performance and SEO.",
    features: [
      "Responsive design",
      "SEO optimization",
      "Contact forms",
      "CMS integration",
      "Analytics integration",
      "Social media integration",
      "Blog functionality",
      "Newsletter signup",
      "Multi-language support",
      "Performance optimization"
    ],
    pricing: {
      basic: { name: "Landing Page", price: 150, timeline: "1-5 days" },
      advanced: { name: "Business Website", price: 300, timeline: "2-3 weeks" },
      premium: { name: "Web Application", price: 650, timeline: "4-6 weeks" }
    },
    color: "from-blue-600 to-cyan-600"
  },
  {
    icon: Code2,
    title: "API Development",
    description: "RESTful APIs and backend services with authentication, database integration, and documentation.",
    features: [
      "RESTful API design",
      "Authentication & authorization",
      "Database integration",
      "Rate limiting",
      "API documentation",
      "Webhooks",
      "Third-party integrations",
      "Data validation",
      "Error handling",
      "Testing suite"
    ],
    pricing: {
      basic: { name: "Basic API", price: 300, timeline: "1-2 weeks" },
      advanced: { name: "Standard API", price: 3500, timeline: "3-4 weeks" },
      premium: { name: "Enterprise API", price: 7500, timeline: "6-8 weeks" }
    },
    color: "from-orange-600 to-red-600"
  },
  {
    icon: Palette,
    title: "UI/UX Design",
    description: "Beautiful, user-friendly interfaces with modern design principles and best practices.",
    features: [
      "Modern interface design",
      "User experience optimization",
      "Responsive layouts",
      "Brand identity",
      "Wireframing & prototyping",
      "Design systems",
      "Interactive prototypes",
      "Accessibility compliance"
    ],
    pricing: {
      basic: { name: "Basic Design", price: 400, timeline: "1 week" },
      advanced: { name: "Professional Design", price: 1000, timeline: "2 weeks" },
      premium: { name: "Full Branding Package", price: 2500, timeline: "3-4 weeks" }
    },
    color: "from-pink-600 to-purple-600"
  },
  {
    icon: Wrench,
    title: "Custom Software",
    description: "Tailored software solutions for your unique business needs and requirements.",
    features: [
      "Requirements analysis",
      "Custom architecture",
      "Scalable solutions",
      "Integration with existing systems",
      "Documentation",
      "Training & support",
      "Maintenance packages",
      "Ongoing development"
    ],
    pricing: {
      basic: { name: "Consultation", price: 100, timeline: "Immediate" },
      advanced: { name: "Small Project", price: 2000, timeline: "2-4 weeks" },
      premium: { name: "Large Project", price: 10000, timeline: "2-6 months" }
    },
    color: "from-yellow-600 to-orange-600"
  }
]

export default function ServicesPage() {
  return (
    <div>
      <Navbar />
      <main className="min-h-screen">
        {/* Hero */}
        <section className="px-6 lg:px-8 py-24 bg-muted/50">
          <div className="mx-auto max-w-7xl text-center">
            <Badge className="mb-4">🛍️ What We Offer</Badge>
            <h1 className="text-4xl font-bold tracking-tight sm:text-5xl mb-4">
              Our Services
            </h1>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Professional development services with transparent pricing and fast delivery
            </p>
          </div>
        </section>

        {/* Services Grid */}
        <section className="py-16 px-6 lg:px-8">
          <div className="mx-auto max-w-7xl space-y-16">
            {services.map((service, index) => {
              const Icon = service.icon
              return (
                <div key={index} className="grid md:grid-cols-2 gap-8 items-start">
                  <div className={index % 2 === 0 ? 'order-1' : 'order-1 md:order-2'}>
                    <Card className="h-full">
                      <CardHeader>
                        <div className={`inline-flex p-3 rounded-lg bg-gradient-to-br ${service.color} mb-4`}>
                          <Icon className="h-8 w-8 text-white" />
                        </div>
                        <CardTitle className="text-2xl">{service.title}</CardTitle>
                        <CardDescription className="text-base">
                          {service.description}
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <h4 className="font-semibold mb-3">Key Features:</h4>
                        <div className="grid grid-cols-2 gap-2">
                          {service.features.map((feature, i) => (
                            <div key={i} className="flex items-start gap-2">
                              <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                              <span className="text-sm text-muted-foreground">{feature}</span>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  </div>

                  <div className={index % 2 === 0 ? 'order-2' : 'order-2 md:order-1'}>
                    <div className="sticky top-8 space-y-4">
                      <h3 className="text-xl font-bold">Pricing Tiers</h3>
                      
                      <Card className="border-2 hover:border-primary transition-colors">
                        <CardHeader>
                          <Badge variant="outline" className="w-fit">
                            {service.pricing.basic.name}
                          </Badge>
                          <div className="mt-4">
                            <span className="text-3xl font-bold">${service.pricing.basic.price}</span>
                          </div>
                        </CardHeader>
                        <CardContent>
                          <p className="text-sm text-muted-foreground mb-4">
                            Timeline: {service.pricing.basic.timeline}
                          </p>
                          <Link href="/login">
                            <Button variant="outline" className="w-full">
                              Get Started
                            </Button>
                          </Link>
                        </CardContent>
                      </Card>

                      <Card className="border-2 border-primary">
                        <CardHeader>
                          <Badge className="w-fit">
                            {service.pricing.advanced.name}
                          </Badge>
                          <div className="mt-4">
                            <span className="text-3xl font-bold">${service.pricing.advanced.price}</span>
                          </div>
                        </CardHeader>
                        <CardContent>
                          <p className="text-sm text-muted-foreground mb-4">
                            Timeline: {service.pricing.advanced.timeline}
                          </p>
                          <Link href="/login">
                            <Button className="w-full">
                              Get Started
                            </Button>
                          </Link>
                        </CardContent>
                      </Card>

                      <Card className="border-2 hover:border-primary transition-colors">
                        <CardHeader>
                          <Badge variant="secondary" className="w-fit">
                            {service.pricing.premium.name}
                          </Badge>
                          <div className="mt-4">
                            <span className="text-3xl font-bold">${service.pricing.premium.price}</span>
                          </div>
                        </CardHeader>
                        <CardContent>
                          <p className="text-sm text-muted-foreground mb-4">
                            Timeline: {service.pricing.premium.timeline}
                          </p>
                          <Link href="/login">
                            <Button variant="outline" className="w-full">
                              Get Started
                            </Button>
                          </Link>
                        </CardContent>
                      </Card>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </section>

        {/* CTA Section */}
        <section className="py-24 bg-primary/10">
          <div className="mx-auto max-w-3xl px-6 lg:px-8 text-center">
            <h2 className="text-3xl font-bold mb-4">
              Ready to Get Started?
            </h2>
            <p className="text-lg text-muted-foreground mb-8">
              Choose your service and let&apos;s build something amazing together.
            </p>
            <div className="flex flex-wrap gap-4 justify-center">
              <Link href="/login">
                <Button size="lg" className="gap-2">
                  Order Now <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
              <Link href="/portfolio">
                <Button variant="outline" size="lg">
                  View Our Work
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

