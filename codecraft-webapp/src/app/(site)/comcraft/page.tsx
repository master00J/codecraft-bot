'use client';

/**
 * Comcraft Landing Page
 * Main page voor de bot
 */

import { useState, useEffect } from 'react';
import { Link } from '@/navigation';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

export default function ComcraftLanding() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 dark:from-gray-900 dark:via-purple-900 dark:to-gray-900">
      {/* Hero Section */}
      <section className="container mx-auto px-4 py-20">
        <div className="text-center max-w-4xl mx-auto">
          <h1 className="text-6xl font-bold mb-6 bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 bg-clip-text text-transparent">
            Comcraft
          </h1>
          <p className="text-2xl text-gray-600 dark:text-gray-300 mb-4">
            De ultieme Discord bot voor Content Creators
          </p>
          <p className="text-lg text-gray-500 dark:text-gray-400 mb-8">
            Leveling, moderatie, Twitch/YouTube integratie en veel meer!
          </p>
          
          <div className="flex gap-4 justify-center">
            <Button size="lg" asChild className="text-lg px-8 py-6">
              <Link href="/comcraft/dashboard">
                🌐 Open Dashboard
              </Link>
            </Button>
            <Button size="lg" variant="outline" asChild className="text-lg px-8 py-6">
              <a href={`https://discord.com/oauth2/authorize?client_id=${process.env.NEXT_PUBLIC_COMCRAFT_CLIENT_ID || ''}&permissions=8&scope=bot%20applications.commands`} target="_blank" rel="noopener noreferrer">
                ➕ Voeg Bot Toe
              </a>
            </Button>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="container mx-auto px-4 py-16">
        <h2 className="text-4xl font-bold text-center mb-12">Features</h2>
        
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          <Card className="p-6 hover:shadow-lg transition-shadow">
            <div className="text-4xl mb-4">📊</div>
            <h3 className="text-xl font-bold mb-2">Leveling Systeem</h3>
            <p className="text-gray-600 dark:text-gray-400">
              Volledig aanpasbaar XP systeem met level rewards en leaderboards
            </p>
          </Card>

          <Card className="p-6 hover:shadow-lg transition-shadow">
            <div className="text-4xl mb-4">🛡️</div>
            <h3 className="text-xl font-bold mb-2">Moderation</h3>
            <p className="text-gray-600 dark:text-gray-400">
              Auto-mod, warns, mutes, kicks, bans en uitgebreide logging
            </p>
          </Card>

          <Card className="p-6 hover:shadow-lg transition-shadow">
            <div className="text-4xl mb-4">📝</div>
            <h3 className="text-xl font-bold mb-2">Custom Commands</h3>
            <p className="text-gray-600 dark:text-gray-400">
              Maak onbeperkt custom commands met embeds en variabelen
            </p>
          </Card>

          <Card className="p-6 hover:shadow-lg transition-shadow">
            <div className="text-4xl mb-4">🎮</div>
            <h3 className="text-xl font-bold mb-2">Twitch Integratie</h3>
            <p className="text-gray-600 dark:text-gray-400">
              Live stream notificaties met mooie embeds
            </p>
          </Card>

          <Card className="p-6 hover:shadow-lg transition-shadow">
            <div className="text-4xl mb-4">📺</div>
            <h3 className="text-xl font-bold mb-2">YouTube Integratie</h3>
            <p className="text-gray-600 dark:text-gray-400">
              Notificaties voor nieuwe videos en livestreams
            </p>
          </Card>

          <Card className="p-6 hover:shadow-lg transition-shadow">
            <div className="text-4xl mb-4">👋</div>
            <h3 className="text-xl font-bold mb-2">Welcome Systeem</h3>
            <p className="text-gray-600 dark:text-gray-400">
              Verwelkom nieuwe members met custom messages en auto-roles
            </p>
          </Card>

          <Card className="p-6 hover:shadow-lg transition-shadow">
            <div className="text-4xl mb-4">📈</div>
            <h3 className="text-xl font-bold mb-2">Analytics</h3>
            <p className="text-gray-600 dark:text-gray-400">
              Gedetailleerde statistieken en activity tracking
            </p>
          </Card>

          <Card className="p-6 hover:shadow-lg transition-shadow">
            <div className="text-4xl mb-4">🌐</div>
            <h3 className="text-xl font-bold mb-2">Web Dashboard</h3>
            <p className="text-gray-600 dark:text-gray-400">
              Configureer alles via een intuïtieve web interface
            </p>
          </Card>

          <Card className="p-6 hover:shadow-lg transition-shadow">
            <div className="text-4xl mb-4">⚡</div>
            <h3 className="text-xl font-bold mb-2">Real-time Updates</h3>
            <p className="text-gray-600 dark:text-gray-400">
              Directe synchronisatie tussen bot en dashboard
            </p>
          </Card>
        </div>
      </section>

      {/* Pricing Section */}
      <section className="container mx-auto px-4 py-16">
        <h2 className="text-4xl font-bold text-center mb-12">Pricing</h2>
        
        <div className="grid md:grid-cols-4 gap-6 max-w-6xl mx-auto">
          {/* Free */}
          <Card className="p-6 border-2">
            <h3 className="text-2xl font-bold mb-2">Free</h3>
            <div className="text-3xl font-bold mb-4">€0<span className="text-sm text-gray-500">/maand</span></div>
            <ul className="space-y-2 mb-6 text-sm">
              <li>✓ Leveling systeem</li>
              <li>✓ 5 Custom commands</li>
              <li>✓ Basic moderatie</li>
              <li>✓ 1 Stream notificatie</li>
              <li>✓ Community support</li>
            </ul>
            <Button className="w-full" variant="outline" asChild>
              <Link href="/comcraft/dashboard">Start Gratis</Link>
            </Button>
          </Card>

          {/* Basic */}
          <Card className="p-6 border-2 border-blue-500">
            <h3 className="text-2xl font-bold mb-2">Basic</h3>
            <div className="text-3xl font-bold mb-4">€4.99<span className="text-sm text-gray-500">/maand</span></div>
            <ul className="space-y-2 mb-6 text-sm">
              <li>✓ Alles van Free</li>
              <li>✓ 25 Custom commands</li>
              <li>✓ Advanced moderatie</li>
              <li>✓ 5 Stream notificaties</li>
              <li>✓ Analytics</li>
              <li>✓ Email support</li>
            </ul>
            <Button className="w-full" asChild>
              <Link href="/comcraft/dashboard">Kies Basic</Link>
            </Button>
          </Card>

          {/* Premium */}
          <Card className="p-6 border-2 border-purple-500 shadow-lg scale-105">
            <div className="bg-purple-500 text-white text-xs font-bold px-2 py-1 rounded mb-2 inline-block">
              POPULAIR
            </div>
            <h3 className="text-2xl font-bold mb-2">Premium</h3>
            <div className="text-3xl font-bold mb-4">€9.99<span className="text-sm text-gray-500">/maand</span></div>
            <ul className="space-y-2 mb-6 text-sm">
              <li>✓ Alles van Basic</li>
              <li>✓ Unlimited commands</li>
              <li>✓ Unlimited streams</li>
              <li>✓ 1.5x XP boost</li>
              <li>✓ Custom branding</li>
              <li>✓ Priority support</li>
            </ul>
            <Button className="w-full bg-purple-600 hover:bg-purple-700" asChild>
              <Link href="/comcraft/dashboard">Kies Premium</Link>
            </Button>
          </Card>

          {/* Enterprise */}
          <Card className="p-6 border-2">
            <h3 className="text-2xl font-bold mb-2">Enterprise</h3>
            <div className="text-3xl font-bold mb-4">€29.99<span className="text-sm text-gray-500">/maand</span></div>
            <ul className="space-y-2 mb-6 text-sm">
              <li>✓ Alles van Premium</li>
              <li>✓ 5 Servers</li>
              <li>✓ 2x XP boost</li>
              <li>✓ API access</li>
              <li>✓ Custom features</li>
              <li>✓ Dedicated support</li>
            </ul>
            <Button className="w-full" variant="outline" asChild>
              <Link href="/comcraft/dashboard">Kies Enterprise</Link>
            </Button>
          </Card>
        </div>
      </section>

      {/* CTA Section */}
      <section className="container mx-auto px-4 py-20">
        <div className="text-center max-w-2xl mx-auto bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 rounded-2xl p-12 text-white">
          <h2 className="text-4xl font-bold mb-4">Klaar om te beginnen?</h2>
          <p className="text-lg mb-8 opacity-90">
            Voeg Comcraft toe aan je server en configureer alles via het dashboard
          </p>
          <div className="flex gap-4 justify-center">
            <Button size="lg" variant="secondary" asChild>
              <Link href="/comcraft/dashboard">
                Open Dashboard
              </Link>
            </Button>
            <Button size="lg" variant="outline" className="bg-white/10 hover:bg-white/20 text-white border-white/30" asChild>
              <a href="https://discord.gg/vywm9GDNwc" target="_blank" rel="noopener noreferrer">
                Join Discord
              </a>
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}

