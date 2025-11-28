'use client';

/**
 * Products Overview Page
 * Showcase all CodeCraft Solutions products
 */

import { useState, useEffect } from 'react';
import { Link } from '@/navigation';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  ArrowRight, 
  Bot, 
  Globe, 
  ShoppingCart,
  Code,
  Database,
  Sparkles
} from 'lucide-react';
import Navbar from '@/components/navbar';
import Footer from '@/components/footer';

interface ComcraftStats {
  activeServers: number;
  totalMembers: number;
  uptimePercentage: number;
}

export default function ProductsPage() {
  const [stats, setStats] = useState<ComcraftStats>({
    activeServers: 0,
    totalMembers: 0,
    uptimePercentage: 99.9
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchStats() {
      try {
        const response = await fetch('/api/comcraft/public-stats');
        const data = await response.json();
        
        if (data.success && data.stats) {
          setStats({
            activeServers: data.stats.activeServers || 0,
            totalMembers: data.stats.totalMembers || 0,
            uptimePercentage: data.stats.uptimePercentage || 99.9
          });
        }
      } catch (error) {
        console.error('Error fetching stats:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchStats();
  }, []);

  return (
    <div className="min-h-screen">
      <Navbar />

      {/* Hero Section */}
      <section className="relative overflow-hidden pt-20 pb-16 bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 dark:from-gray-900 dark:via-purple-900/20 dark:to-gray-900">
        <div className="container mx-auto px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto">
            <Badge className="mb-4" variant="secondary">
              Our Products
            </Badge>
            <h1 className="text-5xl lg:text-6xl font-bold mb-6 bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 bg-clip-text text-transparent">
              Powerful Solutions for Your Business
            </h1>
            <p className="text-xl text-gray-600 dark:text-gray-300 mb-8">
              Discover our suite of professional tools and services designed to help you grow your online presence and community.
            </p>
          </div>
        </div>
      </section>

      {/* Products Grid */}
      <section className="py-24">
        <div className="container mx-auto px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-12">
            
            {/* Comcraft Bot - Featured */}
            <Card className="relative overflow-hidden border-2 border-purple-500 shadow-2xl hover:shadow-3xl transition-all group">
              <div className="absolute top-4 right-4">
                <Badge className="bg-gradient-to-r from-purple-600 to-pink-600 text-white border-0">
                  <Sparkles className="h-3 w-3 mr-1" />
                  Featured
                </Badge>
              </div>
              
              <div className="p-8 lg:p-12">
                <div className="bg-gradient-to-br from-blue-100 to-purple-100 dark:from-blue-900/30 dark:to-purple-900/30 p-4 rounded-2xl w-fit mb-6">
                  <Bot className="h-12 w-12 text-purple-600 dark:text-purple-400" />
                </div>
                
                <h2 className="text-3xl font-bold mb-4 group-hover:bg-gradient-to-r group-hover:from-blue-600 group-hover:via-purple-600 group-hover:to-pink-600 group-hover:bg-clip-text group-hover:text-transparent transition-all">
                  Comcraft Discord Bot
                </h2>
                
                <p className="text-lg text-gray-600 dark:text-gray-300 mb-6">
                  The ultimate Discord bot for content creators. Advanced leveling, smart moderation, stream notifications, and a beautiful web dashboard.
                </p>

                {loading ? (
                  <div className="grid grid-cols-2 gap-4 mb-8 animate-pulse">
                    <div className="bg-gray-200 dark:bg-gray-700 p-4 rounded-lg h-20"></div>
                    <div className="bg-gray-200 dark:bg-gray-700 p-4 rounded-lg h-20"></div>
                    <div className="bg-gray-200 dark:bg-gray-700 p-4 rounded-lg h-20"></div>
                    <div className="bg-gray-200 dark:bg-gray-700 p-4 rounded-lg h-20"></div>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-4 mb-8">
                    <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
                      <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                        {stats.activeServers > 0 ? `${stats.activeServers}+` : 'Growing'}
                      </div>
                      <div className="text-sm text-gray-600 dark:text-gray-400">Active Servers</div>
                    </div>
                    <div className="bg-purple-50 dark:bg-purple-900/20 p-4 rounded-lg">
                      <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                        {stats.totalMembers > 0 ? `${stats.totalMembers.toLocaleString()}+` : 'Many'}
                      </div>
                      <div className="text-sm text-gray-600 dark:text-gray-400">Members</div>
                    </div>
                    <div className="bg-pink-50 dark:bg-pink-900/20 p-4 rounded-lg">
                      <div className="text-2xl font-bold text-pink-600 dark:text-pink-400">{stats.uptimePercentage}%</div>
                      <div className="text-sm text-gray-600 dark:text-gray-400">Uptime</div>
                    </div>
                    <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg">
                      <div className="text-2xl font-bold text-green-600 dark:text-green-400">Free</div>
                      <div className="text-sm text-gray-600 dark:text-gray-400">To Start</div>
                    </div>
                  </div>
                )}

                <div className="space-y-3 mb-8">
                  <div className="flex items-center gap-2 text-sm">
                    <div className="h-2 w-2 bg-green-500 rounded-full"></div>
                    <span>Advanced Leveling System</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <div className="h-2 w-2 bg-green-500 rounded-full"></div>
                    <span>Smart Moderation Tools</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <div className="h-2 w-2 bg-green-500 rounded-full"></div>
                    <span>Twitch & YouTube Integration</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <div className="h-2 w-2 bg-green-500 rounded-full"></div>
                    <span>Web Dashboard Included</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <div className="h-2 w-2 bg-green-500 rounded-full"></div>
                    <span>Support Ticket System</span>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-3">
                  <Button size="lg" className="flex-1 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700" asChild>
                    <Link href="/products/comcraft">
                      Learn More <ArrowRight className="ml-2 h-4 w-4" />
                    </Link>
                  </Button>
                  <Button size="lg" variant="outline" className="flex-1" asChild>
                    <Link href="/comcraft/dashboard">
                      Dashboard
                    </Link>
                  </Button>
                </div>
              </div>
            </Card>

            {/* Custom Discord Bots */}
            <Card className="p-8 lg:p-12 border-2 hover:border-blue-500 hover:shadow-xl transition-all">
              <div className="bg-gradient-to-br from-blue-100 to-cyan-100 dark:from-blue-900/30 dark:to-cyan-900/30 p-4 rounded-2xl w-fit mb-6">
                <Code className="h-12 w-12 text-blue-600 dark:text-blue-400" />
              </div>
              
              <h2 className="text-3xl font-bold mb-4">Custom Discord Bots</h2>
              
              <p className="text-lg text-gray-600 dark:text-gray-300 mb-6">
                Need something specific? We build custom Discord bots tailored to your exact requirements with advanced features and integrations.
              </p>

              <div className="space-y-3 mb-8">
                <div className="flex items-center gap-2 text-sm">
                  <div className="h-2 w-2 bg-blue-500 rounded-full"></div>
                  <span>Fully customized features</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <div className="h-2 w-2 bg-blue-500 rounded-full"></div>
                  <span>API integrations</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <div className="h-2 w-2 bg-blue-500 rounded-full"></div>
                  <span>Database setup included</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <div className="h-2 w-2 bg-blue-500 rounded-full"></div>
                  <span>24/7 support & maintenance</span>
                </div>
              </div>

              <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg mb-6">
                <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">Pricing</div>
                <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">Custom Quote</div>
                <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">Based on your requirements</div>
              </div>

              <Button size="lg" className="w-full" variant="outline" asChild>
                <Link href="/contact">
                  Request Quote <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </Card>

            {/* E-Commerce Solutions */}
            <Card className="p-8 lg:p-12 border-2 hover:border-purple-500 hover:shadow-xl transition-all">
              <div className="bg-gradient-to-br from-purple-100 to-pink-100 dark:from-purple-900/30 dark:to-pink-900/30 p-4 rounded-2xl w-fit mb-6">
                <ShoppingCart className="h-12 w-12 text-purple-600 dark:text-purple-400" />
              </div>
              
              <h2 className="text-3xl font-bold mb-4">E-Commerce Websites</h2>
              
              <p className="text-lg text-gray-600 dark:text-gray-300 mb-6">
                Professional online stores with payment processing, inventory management, and a modern shopping experience.
              </p>

              <div className="space-y-3 mb-8">
                <div className="flex items-center gap-2 text-sm">
                  <div className="h-2 w-2 bg-purple-500 rounded-full"></div>
                  <span>Stripe & PayPal integration</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <div className="h-2 w-2 bg-purple-500 rounded-full"></div>
                  <span>Product management system</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <div className="h-2 w-2 bg-purple-500 rounded-full"></div>
                  <span>Order tracking & notifications</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <div className="h-2 w-2 bg-purple-500 rounded-full"></div>
                  <span>Mobile responsive design</span>
                </div>
              </div>

              <div className="bg-purple-50 dark:bg-purple-900/20 p-4 rounded-lg mb-6">
                <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">Pricing</div>
                <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">Custom Quote</div>
                <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">Tailored to your business</div>
              </div>

              <Button size="lg" className="w-full" variant="outline" asChild>
                <Link href="/contact">
                  Get Quote <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </Card>

            {/* Web Applications */}
            <Card className="p-8 lg:p-12 border-2 hover:border-pink-500 hover:shadow-xl transition-all">
              <div className="bg-gradient-to-br from-pink-100 to-rose-100 dark:from-pink-900/30 dark:to-rose-900/30 p-4 rounded-2xl w-fit mb-6">
                <Globe className="h-12 w-12 text-pink-600 dark:text-pink-400" />
              </div>
              
              <h2 className="text-3xl font-bold mb-4">Custom Web Applications</h2>
              
              <p className="text-lg text-gray-600 dark:text-gray-300 mb-6">
                Full-stack web applications built with modern technologies. From dashboards to SaaS platforms.
              </p>

              <div className="space-y-3 mb-8">
                <div className="flex items-center gap-2 text-sm">
                  <div className="h-2 w-2 bg-pink-500 rounded-full"></div>
                  <span>Next.js & React development</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <div className="h-2 w-2 bg-pink-500 rounded-full"></div>
                  <span>Database design & setup</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <div className="h-2 w-2 bg-pink-500 rounded-full"></div>
                  <span>Authentication & authorization</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <div className="h-2 w-2 bg-pink-500 rounded-full"></div>
                  <span>API development</span>
                </div>
              </div>

              <div className="bg-pink-50 dark:bg-pink-900/20 p-4 rounded-lg mb-6">
                <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">Pricing</div>
                <div className="text-2xl font-bold text-pink-600 dark:text-pink-400">Custom Quote</div>
                <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">Based on project scope</div>
              </div>

              <Button size="lg" className="w-full" variant="outline" asChild>
                <Link href="/contact">
                  Discuss Project <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </Card>

          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24 bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600">
        <div className="container mx-auto px-6 lg:px-8 text-center text-white">
          <h2 className="text-4xl font-bold mb-6">Ready to Start Your Project?</h2>
          <p className="text-xl mb-8 opacity-90 max-w-2xl mx-auto">
            Let's discuss how we can help bring your ideas to life with our professional solutions.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button size="lg" variant="secondary" asChild>
              <Link href="/contact">
                Contact Us
              </Link>
            </Button>
            <Button size="lg" variant="outline" className="bg-white/10 hover:bg-white/20 text-white border-white/30" asChild>
              <Link href="/pricing">
                View Pricing
              </Link>
            </Button>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}

