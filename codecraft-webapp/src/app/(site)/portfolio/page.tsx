"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ExternalLink, Briefcase } from "lucide-react"
import { Link } from '@/navigation'
import Image from "next/image"
import Navbar from "@/components/navbar"
import Footer from "@/components/footer"

interface PortfolioItem {
  id: string
  title: string
  category: string
  client?: string
  description?: string
  technologies?: string[]
  features?: string[]
  results?: string
  timeline?: string
  budget?: string
  image_url?: string
  is_featured: boolean
  display_order: number
}

export default function PortfolioPage() {
  const [portfolioItems, setPortfolioItems] = useState<PortfolioItem[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    fetchPortfolio()
  }, [])

  const fetchPortfolio = async () => {
    setIsLoading(true)
    try {
      const response = await fetch('/api/portfolio')
      const data = await response.json()
      if (response.ok) {
        setPortfolioItems(data.items || [])
      }
    } catch (error) {
      console.error('Error fetching portfolio:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const featuredProjects = portfolioItems.filter(p => p.is_featured)
  const otherProjects = portfolioItems.filter(p => !p.is_featured)

  return (
    <>
      <Navbar />
      <main className="min-h-screen">
        {/* Hero */}
        <section className="px-6 lg:px-8 py-24 bg-muted/50">
          <div className="mx-auto max-w-7xl text-center">
            <Badge className="mb-4">💼 Our Work</Badge>
            <h1 className="text-4xl font-bold tracking-tight sm:text-5xl mb-4">
              Portfolio
            </h1>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Check out our recent projects and see what we can build for you
            </p>
          </div>
        </section>

        {/* Loading State */}
        {isLoading && (
          <section className="py-16 px-6 lg:px-8">
            <div className="mx-auto max-w-7xl text-center">
              <p className="text-muted-foreground">Loading portfolio...</p>
            </div>
          </section>
        )}

        {/* Empty State */}
        {!isLoading && portfolioItems.length === 0 && (
          <section className="py-16 px-6 lg:px-8">
            <div className="mx-auto max-w-7xl text-center">
              <Briefcase className="h-16 w-16 mx-auto mb-4 text-muted-foreground opacity-50" />
              <h3 className="text-xl font-semibold mb-2">No Portfolio Items Yet</h3>
              <p className="text-muted-foreground">Check back soon for our latest projects!</p>
            </div>
          </section>
        )}

        {/* Featured Projects */}
        {!isLoading && featuredProjects.length > 0 && (
          <section className="py-16 px-6 lg:px-8">
            <div className="mx-auto max-w-7xl">
              <h2 className="text-2xl font-bold mb-8">Featured Projects</h2>
              <div className="grid gap-8">
                {featuredProjects.map((project) => (
                  <Card key={project.id} className="overflow-hidden">
                    <div className="grid md:grid-cols-2 gap-6">
                      <div className="relative h-64 md:h-auto">
                        {project.image_url ? (
                          <Image
                            src={project.image_url}
                            alt={project.title}
                            fill
                            className="object-cover"
                          />
                        ) : (
                          <div className="w-full h-full bg-muted flex items-center justify-center">
                            <Briefcase className="h-16 w-16 text-muted-foreground" />
                          </div>
                        )}
                      </div>
                      <div className="p-6 space-y-4">
                        <div>
                          <Badge variant="secondary" className="mb-2">
                            {project.category}
                          </Badge>
                          <h3 className="text-2xl font-bold">{project.title}</h3>
                          <p className="text-sm text-muted-foreground">{project.client}</p>
                        </div>
                        <p className="text-muted-foreground">{project.description}</p>
                        {project.technologies && project.technologies.length > 0 && (
                          <div>
                            <h4 className="font-semibold mb-2">Technologies:</h4>
                            <div className="flex flex-wrap gap-2">
                              {project.technologies.map((tech) => (
                                <Badge key={tech} variant="outline">{tech}</Badge>
                              ))}
                            </div>
                          </div>
                        )}
                        {project.features && project.features.length > 0 && (
                          <div>
                            <h4 className="font-semibold mb-2">Key Features:</h4>
                            <ul className="grid grid-cols-2 gap-2 text-sm text-muted-foreground">
                              {project.features.slice(0, 4).map((feature, i) => (
                                <li key={i} className="flex items-start gap-1">
                                  <span className="text-primary mt-0.5">•</span>
                                  <span>{feature}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                        <div className="flex items-center justify-between pt-4 border-t">
                          <div>
                            {project.timeline && <p className="text-sm font-medium">Timeline: {project.timeline}</p>}
                            {project.budget && <p className="text-sm text-muted-foreground">Budget: {project.budget}</p>}
                            {project.results && <p className="text-sm text-green-600 font-medium mt-1">✓ {project.results}</p>}
                          </div>
                        </div>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* All Projects Grid */}
        {!isLoading && portfolioItems.length > 0 && (
          <section className="py-16 px-6 lg:px-8 bg-muted/30">
            <div className="mx-auto max-w-7xl">
              <h2 className="text-2xl font-bold mb-8">All Projects</h2>
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                {portfolioItems.map((project) => (
                  <Card key={project.id} className="overflow-hidden flex flex-col">
                    <div className="relative h-48">
                      {project.image_url ? (
                        <Image
                          src={project.image_url}
                          alt={project.title}
                          fill
                          className="object-cover"
                        />
                      ) : (
                        <div className="w-full h-full bg-muted flex items-center justify-center">
                          <Briefcase className="h-12 w-12 text-muted-foreground" />
                        </div>
                      )}
                    </div>
                  <CardHeader>
                    <Badge variant="secondary" className="w-fit mb-2">
                      {project.category}
                    </Badge>
                    <CardTitle className="line-clamp-2">{project.title}</CardTitle>
                    <CardDescription>{project.client}</CardDescription>
                  </CardHeader>
                  <CardContent className="flex-1 flex flex-col">
                    <p className="text-sm text-muted-foreground line-clamp-3 mb-4">
                      {project.description}
                    </p>
                    <div className="mt-auto space-y-4">
                      {project.technologies && project.technologies.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {project.technologies.slice(0, 3).map((tech) => (
                            <Badge key={tech} variant="outline" className="text-xs">
                              {tech}
                            </Badge>
                          ))}
                          {project.technologies.length > 3 && (
                            <Badge variant="outline" className="text-xs">
                              +{project.technologies.length - 3}
                            </Badge>
                          )}
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* CTA */}
        <section className="py-24 px-6 lg:px-8">
          <div className="mx-auto max-w-3xl text-center">
            <h2 className="text-3xl font-bold mb-4">
              Ready to Start Your Project?
            </h2>
            <p className="text-lg text-muted-foreground mb-8">
              Let's build something amazing together. Get in touch to discuss your project.
            </p>
            <div className="flex flex-wrap gap-4 justify-center">
              <Link href="/login">
                <Button size="lg">
                  Get Started
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
    </>
  )
}
