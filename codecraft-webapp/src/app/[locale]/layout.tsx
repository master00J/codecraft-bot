import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import { notFound } from 'next/navigation'
import { NextIntlClientProvider } from 'next-intl'
import { setRequestLocale } from 'next-intl/server'
import { Suspense } from 'react'
import { ThemeProvider } from '@/components/theme-provider'
import { Toaster } from '@/components/ui/toaster'
import { SessionProvider } from '@/components/session-provider'
import { ChatWidget } from '@/components/chat-widget'
import { ReferralTracker } from '@/components/ReferralTracker'
import { ReferralWelcomeBanner } from '@/components/ReferralWelcomeBanner'
import { getMessages, locales, type Locale } from '@/lib/i18n'

const inter = Inter({ subsets: ['latin'], display: 'swap' })

export const metadata: Metadata = {
  title: 'CodeCraft Solutions - Modern Web Development',
  description: 'Professional web development services including web apps, Discord bots, and custom software solutions.',
}

export const dynamic = 'force-dynamic'

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }))
}

type LocaleLayoutProps = {
  children: React.ReactNode
  params: { locale: string }
}

export default async function LocaleLayout({ children, params }: LocaleLayoutProps) {
  const { locale } = params

  if (!locales.includes(locale as Locale)) {
    notFound()
  }

  const typedLocale = locale as Locale

  const messages = await getMessages(typedLocale)

  setRequestLocale(typedLocale)

  return (
    <html lang={typedLocale} suppressHydrationWarning>
      <body className={inter.className}>
        <SessionProvider>
          <ThemeProvider attribute="class" defaultTheme="dark" enableSystem disableTransitionOnChange>
            <NextIntlClientProvider locale={typedLocale} messages={messages}>
              <Suspense fallback={null}>
                <ReferralTracker />
              </Suspense>
              <ReferralWelcomeBanner />
              {children}
              <ChatWidget />
              <Toaster />
            </NextIntlClientProvider>
          </ThemeProvider>
        </SessionProvider>
      </body>
    </html>
  )
}

