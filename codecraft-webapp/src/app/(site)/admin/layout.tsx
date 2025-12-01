"use client"

import { Link } from '@/navigation'
import { Button } from "@/components/ui/button"
import { 
  LayoutDashboard, 
  ShoppingBag, 
  Users, 
  BarChart3,
  Settings,
  Shield,
  Menu,
  Home,
  LogOut,
  Briefcase,
  DollarSign,
  MessageCircle,
  Server,
  Ticket,
  Key,
  CreditCard,
  Layers,
  Lightbulb,
  Brain,
  Sparkles
} from "lucide-react"
import { useTranslations } from "next-intl"
import { LanguageSwitcher } from "@/components/language-switcher"

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const t = useTranslations('admin.layout')

  return (
    <div className="min-h-screen flex">
      {/* Admin Sidebar */}
      <aside className="hidden md:flex md:w-64 md:flex-col border-r bg-muted/30">
        <div className="flex h-16 items-center border-b px-6 bg-primary text-primary-foreground">
          <Shield className="h-5 w-5 mr-2" />
          <h2 className="text-lg font-semibold">{t('title')}</h2>
        </div>
        <nav className="flex-1 space-y-1 px-3 py-4">
          <Link href="/">
            <Button variant="ghost" className="w-full justify-start gap-2">
              <Home className="h-4 w-4" />
              {t('links.home')}
            </Button>
          </Link>
          <Link href="/admin">
            <Button variant="ghost" className="w-full justify-start gap-2">
              <LayoutDashboard className="h-4 w-4" />
              {t('links.overview')}
            </Button>
          </Link>
          <Link href="/admin/orders">
            <Button variant="ghost" className="w-full justify-start gap-2">
              <ShoppingBag className="h-4 w-4" />
              {t('links.orders')}
            </Button>
          </Link>
          <Link href="/admin/users">
            <Button variant="ghost" className="w-full justify-start gap-2">
              <Users className="h-4 w-4" />
              {t('links.customers')}
            </Button>
          </Link>
          <Link href="/admin/analytics">
            <Button variant="ghost" className="w-full justify-start gap-2">
              <BarChart3 className="h-4 w-4" />
              {t('links.analytics')}
            </Button>
          </Link>
          <Link href="/admin/ai-usage">
            <Button variant="ghost" className="w-full justify-start gap-2">
              <Brain className="h-4 w-4" />
              AI Usage
            </Button>
          </Link>
          <Link href="/admin/portfolio">
            <Button variant="ghost" className="w-full justify-start gap-2">
              <Briefcase className="h-4 w-4" />
              {t('links.portfolio')}
            </Button>
          </Link>
          <Link href="/admin/pricing">
            <Button variant="ghost" className="w-full justify-start gap-2">
              <DollarSign className="h-4 w-4" />
              {t('links.pricing')}
            </Button>
          </Link>
          <Link href="/admin/payments">
            <Button variant="ghost" className="w-full justify-start gap-2">
              <CreditCard className="h-4 w-4" />
              {t('links.payments')}
            </Button>
          </Link>
          <Link href="/admin/subscriptions">
            <Button variant="ghost" className="w-full justify-start gap-2">
              <Key className="h-4 w-4" />
              {t('links.subscriptions')}
            </Button>
          </Link>
          <Link href="/admin/subscription-tiers">
            <Button variant="ghost" className="w-full justify-start gap-2">
              <Layers className="h-4 w-4" />
              {t('links.subscriptionTiers')}
            </Button>
          </Link>
          <Link href="/admin/discount-codes">
            <Button variant="ghost" className="w-full justify-start gap-2">
              <Ticket className="h-4 w-4" />
              {t('links.discounts')}
            </Button>
          </Link>
          <Link href="/admin/deployments">
            <Button variant="ghost" className="w-full justify-start gap-2">
              <Server className="h-4 w-4" />
              {t('links.deployments')}
            </Button>
          </Link>
          <Link href="/admin/custom-bots">
            <Button variant="ghost" className="w-full justify-start gap-2">
              <Server className="h-4 w-4" />
              Custom Bots
            </Button>
          </Link>
          <Link href="/admin/chat">
            <Button variant="ghost" className="w-full justify-start gap-2">
              <MessageCircle className="h-4 w-4" />
              {t('links.chat')}
            </Button>
          </Link>
          <Link href="/admin/suggestions">
            <Button variant="ghost" className="w-full justify-start gap-2">
              <Lightbulb className="h-4 w-4" />
              Suggestions
            </Button>
          </Link>
          <Link href="/admin/updates">
            <Button variant="ghost" className="w-full justify-start gap-2">
              <Sparkles className="h-4 w-4" />
              Updates
            </Button>
          </Link>
          <Link href="/admin/settings">
            <Button variant="ghost" className="w-full justify-start gap-2">
              <Settings className="h-4 w-4" />
              {t('links.settings')}
            </Button>
          </Link>
        </nav>
        <div className="border-t p-3 space-y-2">
          <Link href="/dashboard">
            <Button variant="outline" className="w-full gap-2">
              <Users className="h-4 w-4" />
              {t('links.userDashboard')}
            </Button>
          </Link>
          <Link href="/api/auth/logout">
            <Button variant="ghost" className="w-full gap-2 text-destructive">
              <LogOut className="h-4 w-4" />
              {t('links.logout')}
            </Button>
          </Link>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col">
        {/* Top bar */}
        <header className="h-16 border-b flex items-center px-6 bg-background">
          <Button variant="ghost" size="icon" className="md:hidden mr-2">
            <Menu className="h-5 w-5" />
          </Button>
          <div className="flex items-center gap-2 text-muted-foreground">
            <Shield className="h-4 w-4" />
            <span className="text-sm font-medium">{t('access')}</span>
          </div>
          <div className="flex-1" />
          <LanguageSwitcher />
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto p-6 bg-muted/10">
          {children}
        </main>
      </div>
    </div>
  )
}
