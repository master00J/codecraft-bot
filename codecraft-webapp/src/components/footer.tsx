import { Link } from '@/navigation'
import { useTranslations } from "next-intl"
import { Code2, Github, Twitter, MessageCircle } from "lucide-react"

export default function Footer() {
  const t = useTranslations('footer')
  const currentYear = new Date().getFullYear()

  return (
    <footer className="border-t bg-muted/50">
      <div className="mx-auto max-w-7xl px-6 py-12 md:py-16 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-8">
          {/* Brand */}
          <div className="space-y-4">
            <div className="flex items-center space-x-2">
              <Code2 className="h-6 w-6 text-primary" />
              <span className="text-lg font-bold">CodeCraft</span>
            </div>
            <p className="text-sm text-muted-foreground">
              {t('tagline')}
            </p>
            <div className="flex space-x-4">
              <Link href="#" className="text-muted-foreground hover:text-primary">
                <Github className="h-5 w-5" />
              </Link>
              <Link href="#" className="text-muted-foreground hover:text-primary">
                <Twitter className="h-5 w-5" />
              </Link>
              <Link href="#" className="text-muted-foreground hover:text-primary">
                <MessageCircle className="h-5 w-5" />
              </Link>
            </div>
          </div>

          {/* Services */}
          <div>
            <h3 className="text-sm font-semibold mb-4">{t('sections.services.title')}</h3>
            <ul className="space-y-2">
              <li>
                <Link href="/services" className="text-sm text-muted-foreground hover:text-primary">
                  {t('sections.services.all')}
                </Link>
              </li>
              <li>
                <Link href="/pricing" className="text-sm text-muted-foreground hover:text-primary">
                  {t('sections.services.pricing')}
                </Link>
              </li>
              <li>
                <Link href="/portfolio" className="text-sm text-muted-foreground hover:text-primary">
                  {t('sections.services.portfolio')}
                </Link>
              </li>
              <li>
                <Link href="/order" className="text-sm text-muted-foreground hover:text-primary">
                  {t('sections.services.order')}
                </Link>
              </li>
            </ul>
          </div>

          {/* Company */}
          <div>
            <h3 className="text-sm font-semibold mb-4">{t('sections.company.title')}</h3>
            <ul className="space-y-2">
              <li>
                <Link href="/" className="text-sm text-muted-foreground hover:text-primary">
                  {t('sections.company.home')}
                </Link>
              </li>
              <li>
                <Link href="/portfolio" className="text-sm text-muted-foreground hover:text-primary">
                  {t('sections.services.portfolio')}
                </Link>
              </li>
              <li>
                <Link href="/pricing" className="text-sm text-muted-foreground hover:text-primary">
                  {t('sections.services.pricing')}
                </Link>
              </li>
              <li>
                <Link href="/updates" className="text-sm text-muted-foreground hover:text-primary">
                  Updates
                </Link>
              </li>
              <li>
                <Link href="/contact" className="text-sm text-muted-foreground hover:text-primary">
                  {t('sections.company.contact')}
                </Link>
              </li>
            </ul>
          </div>

          {/* Support */}
          <div>
            <h3 className="text-sm font-semibold mb-4">{t('sections.support.title')}</h3>
            <ul className="space-y-2">
              <li>
                <Link href="/dashboard" className="text-sm text-muted-foreground hover:text-primary">
                  {t('sections.support.dashboard')}
                </Link>
              </li>
              <li>
                <Link href="/login" className="text-sm text-muted-foreground hover:text-primary">
                  {t('sections.support.login')}
                </Link>
              </li>
              <li>
                <Link href="/contact" className="text-sm text-muted-foreground hover:text-primary">
                  {t('sections.support.help')}
                </Link>
              </li>
              <li>
                <span className="text-sm text-muted-foreground cursor-default">
                  {t('sections.support.copyright', { year: currentYear })}
                </span>
              </li>
            </ul>
          </div>

          {/* Legal */}
          <div>
            <h3 className="text-sm font-semibold mb-4">Legal</h3>
            <ul className="space-y-2">
              <li>
                <Link href="/terms" className="text-sm text-muted-foreground hover:text-primary">
                  Terms of Service
                </Link>
              </li>
              <li>
                <Link href="/comcraft/terms" className="text-sm text-muted-foreground hover:text-primary">
                  ComCraft Terms
                </Link>
              </li>
              <li>
                <Link href="/comcraft/privacy" className="text-sm text-muted-foreground hover:text-primary">
                  Privacy Policy
                </Link>
              </li>
              <li>
                <Link href="/referrals" className="text-sm text-muted-foreground hover:text-primary">
                  Referral Program
                </Link>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-8 border-t pt-8">
          <p className="text-center text-sm text-muted-foreground">
            {t('bottom', { year: currentYear })}
          </p>
        </div>
      </div>
    </footer>
  )
}
