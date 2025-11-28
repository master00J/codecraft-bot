"use client"

import { Link } from '@/navigation'
import NextLink from 'next/link'
import { Button } from "@/components/ui/button"
import { Code2, Menu, X, User } from "lucide-react"
import { useState } from "react"
import { useSession, signOut } from "next-auth/react"
import { useTranslations } from "next-intl"
import { LanguageSwitcher } from "@/components/language-switcher"

export default function Navbar() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const { data: session, status } = useSession()
  const t = useTranslations("navigation")

  const isLoggedIn = !!session
  const isLoading = status === 'loading'

  return (
    <nav className="border-b">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          {/* Logo */}
          <div className="flex items-center">
            <Link href="/" className="flex items-center space-x-2">
              <Code2 className="h-8 w-8 text-primary" />
              <span className="text-xl font-bold">CodeCraft</span>
            </Link>
          </div>

          {/* Desktop Navigation */}
          <div className="hidden md:flex md:items-center md:space-x-6">
            <Link href="/products" className="text-sm font-medium hover:text-primary">
              {t('products') || 'Products'}
            </Link>
            <Link href="/services" className="text-sm font-medium hover:text-primary">
              {t('services')}
            </Link>
            <Link href="/portfolio" className="text-sm font-medium hover:text-primary">
              {t('portfolio')}
            </Link>
            <Link href="/updates" className="text-sm font-medium hover:text-primary">
              Updates
            </Link>
            <Link href="/pricing" className="text-sm font-medium hover:text-primary">
              {t('pricing')}
            </Link>
            <Link href="/contact" className="text-sm font-medium hover:text-primary">
              {t('contact')}
            </Link>
            <LanguageSwitcher />
          </div>

          {/* Desktop Actions */}
          <div className="hidden md:flex md:items-center md:space-x-4">
            {!isLoading && (
              isLoggedIn ? (
                <>
                  <Link href="/dashboard">
                    <Button variant="outline" className="gap-2">
                      <User className="h-4 w-4" />
                      {t('dashboard')}
                    </Button>
                  </Link>
                  <Button variant="ghost" onClick={() => signOut({ callbackUrl: '/' })}>
                    {t('logout')}
                  </Button>
                </>
              ) : (
                <NextLink href="/api/auth/signin">
                  <Button>{t('login')}</Button>
                </NextLink>
              )
            )}
          </div>

          {/* Mobile menu button */}
          <div className="flex md:hidden">
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="inline-flex items-center justify-center rounded-md p-2 hover:bg-accent"
            >
              {mobileMenuOpen ? (
                <X className="h-6 w-6" />
              ) : (
                <Menu className="h-6 w-6" />
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile menu */}
      {mobileMenuOpen && (
        <div className="md:hidden">
          <div className="space-y-1 px-2 pb-3 pt-2">
            <LanguageSwitcher />
            <Link
              href="/products"
              className="block rounded-md px-3 py-2 text-base font-medium hover:bg-accent"
            >
              {t('products') || 'Products'}
            </Link>
            <Link
              href="/services"
              className="block rounded-md px-3 py-2 text-base font-medium hover:bg-accent"
            >
              {t('services')}
            </Link>
            <Link
              href="/portfolio"
              className="block rounded-md px-3 py-2 text-base font-medium hover:bg-accent"
            >
              {t('portfolio')}
            </Link>
            <Link
              href="/updates"
              className="block rounded-md px-3 py-2 text-base font-medium hover:bg-accent"
            >
              Updates
            </Link>
            <Link
              href="/pricing"
              className="block rounded-md px-3 py-2 text-base font-medium hover:bg-accent"
            >
              {t('pricing')}
            </Link>
            <Link
              href="/contact"
              className="block rounded-md px-3 py-2 text-base font-medium hover:bg-accent"
            >
              {t('contact')}
            </Link>
            <div className="mt-4 space-y-2 px-3">
              {!isLoading && (
                isLoggedIn ? (
                  <>
                    <Link href="/dashboard" className="block">
                      <Button variant="outline" className="w-full gap-2">
                        <User className="h-4 w-4" />
                        {t('dashboard')}
                      </Button>
                    </Link>
                    <Button 
                      variant="ghost" 
                      className="w-full" 
                      onClick={() => signOut({ callbackUrl: '/' })}
                    >
                      {t('logout')}
                    </Button>
                  </>
                ) : (
                  <NextLink href="/api/auth/signin" className="block">
                    <Button className="w-full">{t('login')}</Button>
                  </NextLink>
                )
              )}
            </div>
          </div>
        </div>
      )}
    </nav>
  )
}
