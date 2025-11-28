"use client"

import * as React from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  ArrowRight,
  CheckCircle,
  Bot,
  Globe,
  ShoppingCart,
  Shield,
  BarChart3
} from "lucide-react"
import { Link } from '@/navigation'
import { useTranslations } from "next-intl"
import Navbar from "@/components/navbar"
import Footer from "@/components/footer"

export default function HomePage() {
  const t = useTranslations('home')
  const [comcraftStats, setComcraftStats] = React.useState({
    activeServers: 0,
    totalMembers: 0,
    uptimePercentage: 99.9
  });

  const [heroStats, setHeroStats] = React.useState({
    totalClients: 100,
    totalProjects: 250,
    averageRating: 4.9,
    responseTime: '< 2h'
  });

  React.useEffect(() => {
    async function fetchComcraftStats() {
      try {
        const response = await fetch('/api/comcraft/public-stats');
        const data = await response.json();
        
        if (data.success && data.stats) {
          setComcraftStats({
            activeServers: data.stats.activeServers || 0,
            totalMembers: data.stats.totalMembers || 0,
            uptimePercentage: data.stats.uptimePercentage || 99.9
          });
        }
      } catch (error) {
        console.error('Error fetching Comcraft stats:', error);
      }
    }

    async function fetchHeroStats() {
      try {
        const response = await fetch('/api/stats');
        const data = await response.json();
        
        if (data.success && data.stats) {
          setHeroStats({
            totalClients: data.stats.totalClients || 100,
            totalProjects: data.stats.totalProjects || 250,
            averageRating: data.stats.averageRating || 4.9,
            responseTime: data.stats.responseTime || '< 2h'
          });
        }
      } catch (error) {
        console.error('Error fetching hero stats:', error);
      }
    }

    fetchComcraftStats();
    fetchHeroStats();
  }, []);

  return (
    <div>
      <Navbar />
      <main className="min-h-screen">
        {/* Hero Section - Modern Studio Design */}
        <section className="relative px-6 lg:px-8 py-20 lg:py-32">
          {/* Subtle dot pattern background */}
          <div className="absolute inset-0 opacity-[0.03]" style={{
            backgroundImage: `radial-gradient(circle, currentColor 1px, transparent 1px)`,
            backgroundSize: '24px 24px'
          }} />
          
          <div className="mx-auto max-w-7xl relative">
            {/* Asymmetric layout */}
            <div className="grid lg:grid-cols-12 gap-12 lg:gap-16 items-center">
              {/* Left: Content (spans 7 columns) */}
              <div className="lg:col-span-7 space-y-8">
                <div className="space-y-6">
                  <Badge 
                    variant="outline" 
                    className="border-accent text-accent bg-accent/5 px-3 py-1.5 rounded-md font-medium"
                  >
                    {t('hero.badge')}
                  </Badge>
                  
                  <h1 className="text-5xl lg:text-7xl font-bold tracking-tight text-primary leading-[1.1]">
                    {t('hero.titleLine1')}
                    <br />
                    <span className="text-accent">{t('hero.titleLine2')}</span>
                  </h1>
                  
                  <p className="text-lg lg:text-xl leading-relaxed text-muted-foreground max-w-2xl">
                    {t('hero.description')}
                  </p>
                </div>

                <div className="flex flex-col sm:flex-row gap-4">
                  <Link href="/dashboard">
                    <Button 
                      size="lg" 
                      className="px-8 h-12 rounded-lg font-medium shadow-sm hover:shadow-md transition-all"
                    >
                      {t('hero.ctaPrimary')} <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                  </Link>
                  <Link href="/portfolio">
                    <Button 
                      variant="outline" 
                      size="lg"
                      className="border-2 hover:bg-muted px-8 h-12 rounded-lg font-medium transition-all"
                    >
                      {t('hero.ctaSecondary')}
                    </Button>
                  </Link>
                </div>

                {/* Inline stats */}
                <div className="flex items-center gap-8 pt-6 flex-wrap">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-accent/10 flex items-center justify-center">
                      <CheckCircle className="h-5 w-5 text-accent" />
                    </div>
                    <div>
                      <p className="text-xl font-bold text-primary">{heroStats.totalClients}+</p>
                      <p className="text-sm text-muted-foreground">Clients</p>
                    </div>
                  </div>
                  <div className="h-12 w-px bg-border hidden sm:block" />
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-accent/10 flex items-center justify-center">
                      <CheckCircle className="h-5 w-5 text-accent" />
                    </div>
                    <div>
                      <p className="text-xl font-bold text-primary">{heroStats.averageRating}/5</p>
                      <p className="text-sm text-muted-foreground">Rating</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Right: Visual (spans 5 columns) */}
              <div className="lg:col-span-5 relative">
                <div className="relative rounded-xl border-2 border-border bg-card p-8 shadow-sm hover:shadow-md transition-shadow">
                  {/* Dashboard preview mockup */}
                  <div className="space-y-4">
                    <div className="flex items-center gap-3">
                      <div className="h-12 w-12 rounded-lg bg-accent flex items-center justify-center">
                        <Bot className="h-6 w-6 text-white" />
                      </div>
                      <div className="flex-1">
                        <div className="h-3 w-32 bg-muted rounded" />
                        <div className="h-2 w-24 bg-muted/60 rounded mt-2" />
                      </div>
                    </div>
                    
                    <div className="space-y-2 pt-2">
                      <div className="h-2 w-full bg-muted rounded" />
                      <div className="h-2 w-5/6 bg-muted/80 rounded" />
                      <div className="h-2 w-4/6 bg-muted/60 rounded" />
                    </div>

                    <div className="grid grid-cols-2 gap-3 pt-4">
                      <div className="h-20 rounded-lg bg-muted/40 border border-border" />
                      <div className="h-20 rounded-lg bg-muted/40 border border-border" />
                    </div>
                  </div>
                  
                  {/* Accent decoration */}
                  <div className="absolute -top-3 -right-3 h-6 w-6 rounded-full bg-accent" />
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Services Section */}
        <section className="py-24 bg-muted/30">
          <div className="mx-auto max-w-7xl px-6 lg:px-8">
            <div className="mb-16">
              <h2 className="text-3xl lg:text-4xl font-bold tracking-tight mb-3">{t('services.heading')}</h2>
              <p className="text-lg text-muted-foreground max-w-2xl">
                {t('services.subheading')}
              </p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <Card className="border-2 hover:border-accent transition-all group">
                <CardHeader>
                  <div className="h-12 w-12 rounded-lg bg-accent/10 flex items-center justify-center mb-4 group-hover:bg-accent/20 transition-colors">
                    <Bot className="h-6 w-6 text-accent" />
                  </div>
                  <CardTitle className="text-xl">{t('services.cards.discordBots.title')}</CardTitle>
                  <CardDescription className="text-base">
                    {t('services.cards.discordBots.description')}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold text-primary mb-4">{t('services.cards.discordBots.price')}</p>
                  <ul className="space-y-2">
                    <li className="flex items-center gap-2 text-sm">
                      <CheckCircle className="h-4 w-4 text-accent flex-shrink-0" />
                      <span>{t('services.cards.discordBots.features.customCommands')}</span>
                    </li>
                    <li className="flex items-center gap-2 text-sm">
                      <CheckCircle className="h-4 w-4 text-accent flex-shrink-0" />
                      <span>{t('services.cards.discordBots.features.database')}</span>
                    </li>
                    <li className="flex items-center gap-2 text-sm">
                      <CheckCircle className="h-4 w-4 text-accent flex-shrink-0" />
                      <span>{t('services.cards.discordBots.features.support')}</span>
                    </li>
                  </ul>
                </CardContent>
              </Card>

              <Card className="border-2 hover:border-accent transition-all group">
                <CardHeader>
                  <div className="h-12 w-12 rounded-lg bg-accent/10 flex items-center justify-center mb-4 group-hover:bg-accent/20 transition-colors">
                    <ShoppingCart className="h-6 w-6 text-accent" />
                  </div>
                  <CardTitle className="text-xl">{t('services.cards.ecommerce.title')}</CardTitle>
                  <CardDescription className="text-base">
                    {t('services.cards.ecommerce.description')}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold text-primary mb-4">{t('services.cards.ecommerce.price')}</p>
                  <ul className="space-y-2">
                    <li className="flex items-center gap-2 text-sm">
                      <CheckCircle className="h-4 w-4 text-accent flex-shrink-0" />
                      <span>{t('services.cards.ecommerce.features.payments')}</span>
                    </li>
                    <li className="flex items-center gap-2 text-sm">
                      <CheckCircle className="h-4 w-4 text-accent flex-shrink-0" />
                      <span>{t('services.cards.ecommerce.features.dashboard')}</span>
                    </li>
                    <li className="flex items-center gap-2 text-sm">
                      <CheckCircle className="h-4 w-4 text-accent flex-shrink-0" />
                      <span>{t('services.cards.ecommerce.features.inventory')}</span>
                    </li>
                  </ul>
                </CardContent>
              </Card>

              <Card className="border-2 hover:border-accent transition-all group">
                <CardHeader>
                  <div className="h-12 w-12 rounded-lg bg-accent/10 flex items-center justify-center mb-4 group-hover:bg-accent/20 transition-colors">
                    <Globe className="h-6 w-6 text-accent" />
                  </div>
                  <CardTitle className="text-xl">{t('services.cards.webApps.title')}</CardTitle>
                  <CardDescription className="text-base">
                    {t('services.cards.webApps.description')}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold text-primary mb-4">{t('services.cards.webApps.price')}</p>
                  <ul className="space-y-2">
                    <li className="flex items-center gap-2 text-sm">
                      <CheckCircle className="h-4 w-4 text-accent flex-shrink-0" />
                      <span>{t('services.cards.webApps.features.responsive')}</span>
                    </li>
                    <li className="flex items-center gap-2 text-sm">
                      <CheckCircle className="h-4 w-4 text-accent flex-shrink-0" />
                      <span>{t('services.cards.webApps.features.seo')}</span>
                    </li>
                    <li className="flex items-center gap-2 text-sm">
                      <CheckCircle className="h-4 w-4 text-accent flex-shrink-0" />
                      <span>{t('services.cards.webApps.features.cms')}</span>
                    </li>
                  </ul>
                </CardContent>
              </Card>
            </div>
          </div>
        </section>

        {/* Stats Section */}
        <section className="py-24">
          <div className="mx-auto max-w-7xl px-6 lg:px-8">
            <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-4">
              <div className="text-center">
                <p className="text-4xl font-bold text-primary">{heroStats.totalClients}+</p>
                <p className="mt-2 text-sm text-muted-foreground">{t('stats.clients')}</p>
              </div>
              <div className="text-center">
                <p className="text-4xl font-bold text-primary">{heroStats.totalProjects}+</p>
                <p className="mt-2 text-sm text-muted-foreground">{t('stats.projects')}</p>
              </div>
              <div className="text-center">
                <p className="text-4xl font-bold text-primary">{heroStats.averageRating}/5</p>
                <p className="mt-2 text-sm text-muted-foreground">{t('stats.rating')}</p>
              </div>
              <div className="text-center">
                <p className="text-4xl font-bold text-primary">{heroStats.responseTime}</p>
                <p className="mt-2 text-sm text-muted-foreground">{t('stats.response')}</p>
              </div>
            </div>
          </div>
        </section>

        {/* Featured Product - Comcraft Bot */}
        <section className="py-24 bg-card border-y-2 border-border">
          <div className="mx-auto max-w-7xl px-6 lg:px-8">
            <div className="grid lg:grid-cols-2 gap-12 items-center">
              <div>
                <Badge className="mb-4 bg-accent text-white border-0 px-3 py-1.5">
                  <Bot className="h-3 w-3 mr-1" />
                  Featured Product
                </Badge>
                <h2 className="text-4xl font-bold tracking-tight mb-4">
                  <span className="text-primary">Comcraft</span> <span className="text-accent">Discord Bot</span>
                </h2>
                <p className="text-lg text-muted-foreground mb-6 max-w-xl">
                  The ultimate Discord bot for content creators. Advanced leveling, moderation, stream notifications, 
                  and a beautiful web dashboard. Everything you need to grow your community.
                </p>
                <div className="grid grid-cols-2 gap-4 mb-8">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="h-5 w-5 text-accent" />
                    <span className="text-sm font-medium">{comcraftStats.activeServers > 0 ? `${comcraftStats.activeServers.toLocaleString()}+` : 'Many'} Active Servers</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle className="h-5 w-5 text-accent" />
                    <span className="text-sm font-medium">{comcraftStats.totalMembers > 0 ? `${comcraftStats.totalMembers.toLocaleString()}+` : 'Thousands of'} Members</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle className="h-5 w-5 text-accent" />
                    <span className="text-sm font-medium">{comcraftStats.uptimePercentage}% Uptime</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle className="h-5 w-5 text-accent" />
                    <span className="text-sm font-medium">Free to Start</span>
                  </div>
                </div>
                <div className="flex flex-col sm:flex-row gap-4">
                  <Link href="/products/comcraft">
                    <Button size="lg" className="gap-2 px-8 h-12 rounded-lg shadow-sm hover:shadow-md transition-all">
                      Learn More <ArrowRight className="h-4 w-4" />
                    </Button>
                  </Link>
                  <Link href="/comcraft/dashboard">
                    <Button variant="outline" size="lg" className="border-2 px-8 h-12 rounded-lg">
                      Open Dashboard
                    </Button>
                  </Link>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <Card className="p-6 border-2 hover:border-accent transition-all group">
                  <div className="bg-accent/10 p-3 rounded-lg w-fit mb-3 group-hover:bg-accent/20 transition-colors">
                    <Bot className="h-6 w-6 text-accent" />
                  </div>
                  <h3 className="font-bold mb-1">Advanced Leveling</h3>
                  <p className="text-sm text-muted-foreground">Custom XP system with rewards</p>
                </Card>
                <Card className="p-6 border-2 hover:border-accent transition-all group">
                  <div className="bg-accent/10 p-3 rounded-lg w-fit mb-3 group-hover:bg-accent/20 transition-colors">
                    <Shield className="h-6 w-6 text-accent" />
                  </div>
                  <h3 className="font-bold mb-1">Smart Moderation</h3>
                  <p className="text-sm text-muted-foreground">Auto-mod & comprehensive logs</p>
                </Card>
                <Card className="p-6 border-2 hover:border-accent transition-all group">
                  <div className="bg-accent/10 p-3 rounded-lg w-fit mb-3 group-hover:bg-accent/20 transition-colors">
                    <Globe className="h-6 w-6 text-accent" />
                  </div>
                  <h3 className="font-bold mb-1">Stream Alerts</h3>
                  <p className="text-sm text-muted-foreground">Twitch & YouTube integration</p>
                </Card>
                <Card className="p-6 border-2 hover:border-accent transition-all group">
                  <div className="bg-accent/10 p-3 rounded-lg w-fit mb-3 group-hover:bg-accent/20 transition-colors">
                    <BarChart3 className="h-6 w-6 text-accent" />
                  </div>
                  <h3 className="font-bold mb-1">Analytics</h3>
                  <p className="text-sm text-muted-foreground">Detailed insights & metrics</p>
                </Card>
              </div>
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="py-24">
          <div className="mx-auto max-w-7xl px-6 lg:px-8">
            <div className="relative rounded-2xl border-2 border-border bg-card p-12 lg:p-16 text-center overflow-hidden">
              {/* Subtle decoration */}
              <div className="absolute top-0 right-0 w-64 h-64 bg-accent/5 rounded-full -translate-y-1/2 translate-x-1/2" />
              <div className="absolute bottom-0 left-0 w-48 h-48 bg-primary/5 rounded-full translate-y-1/2 -translate-x-1/2" />
              
              <div className="relative z-10">
                <h2 className="text-3xl lg:text-4xl font-bold tracking-tight mb-4">
                  {t('cta.heading')}
                </h2>
                <p className="text-lg text-muted-foreground max-w-2xl mx-auto mb-8">
                  {t('cta.description')}
                </p>
                <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                  <Link href="/login">
                    <Button size="lg" className="px-8 h-12 rounded-lg shadow-sm hover:shadow-md transition-all">
                      {t('cta.primaryButton')} <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                  </Link>
                  <Link href="/contact">
                    <Button variant="outline" size="lg" className="border-2 px-8 h-12 rounded-lg">
                      {t('cta.secondaryButton')}
                    </Button>
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  )
}

