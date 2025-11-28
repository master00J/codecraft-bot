"use client"

import { Link } from '@/navigation'
import { Button } from "@/components/ui/button"
import { 
  LayoutDashboard, 
  ShoppingBag, 
  MessageSquare, 
  Settings,
  LogOut,
  Menu,
  Home,
  Gift
} from "lucide-react"
import { useTranslations } from "next-intl"
import { LanguageSwitcher } from "@/components/language-switcher"

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const t = useTranslations('dashboard.layout')

  return (
    <div className="min-h-screen flex">
      {/* Sidebar */}
      <aside className="hidden md:flex md:w-64 md:flex-col border-r">
        <div className="flex h-16 items-center border-b px-6">
          <Link href="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
            <h2 className="text-lg font-semibold">CodeCraft</h2>
          </Link>
        </div>
        <nav className="flex-1 space-y-1 px-3 py-4">
          <Link href="/">
            <Button variant="ghost" className="w-full justify-start gap-2">
              <Home className="h-4 w-4" />
              {t('links.home')}
            </Button>
          </Link>
          <Link href="/dashboard">
            <Button variant="ghost" className="w-full justify-start gap-2">
              <LayoutDashboard className="h-4 w-4" />
              {t('links.overview')}
            </Button>
          </Link>
          <Link href="/dashboard/orders">
            <Button variant="ghost" className="w-full justify-start gap-2">
              <ShoppingBag className="h-4 w-4" />
              {t('links.orders')}
            </Button>
          </Link>
          <Link href="/dashboard/referrals">
            <Button variant="ghost" className="w-full justify-start gap-2">
              <Gift className="h-4 w-4" />
              {t('links.referrals')}
            </Button>
          </Link>
          {/* Coming soon
          <Link href="/dashboard/tickets">
            <Button variant="ghost" className="w-full justify-start gap-2">
              <MessageSquare className="h-4 w-4" />
              Tickets
            </Button>
          </Link>
          <Link href="/dashboard/settings">
            <Button variant="ghost" className="w-full justify-start gap-2">
              <Settings className="h-4 w-4" />
              Settings
            </Button>
          </Link>
          */}
        </nav>
        <div className="border-t p-3">
          <Link href="/api/auth/logout">
            <Button variant="ghost" className="w-full justify-start gap-2 text-destructive">
              <LogOut className="h-4 w-4" />
              {t('links.logout')}
            </Button>
          </Link>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col">
        {/* Top bar */}
        <header className="h-16 border-b flex items-center px-6">
          <Button variant="ghost" size="icon" className="md:hidden mr-2">
            <Menu className="h-5 w-5" />
          </Button>
          <Link href="/" className="md:hidden flex items-center">
            <h2 className="text-lg font-semibold">CodeCraft</h2>
          </Link>
          <div className="flex-1" />
          <div className="flex items-center gap-4">
            <Link href="/" className="hidden md:block">
              <Button variant="ghost" size="sm" className="gap-2">
                <Home className="h-4 w-4" />
                {t('links.home')}
              </Button>
            </Link>
            <LanguageSwitcher />
            {/* Coming soon
            <Link href="/dashboard/settings">
              <Button variant="outline" size="sm">
                Settings
              </Button>
            </Link>
            */}
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto p-6">
          {children}
        </main>
      </div>
    </div>
  )
}
