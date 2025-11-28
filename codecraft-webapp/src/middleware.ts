import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getToken } from 'next-auth/jwt'
import createIntlMiddleware from 'next-intl/middleware'
import { locales, defaultLocale, type Locale } from '@/lib/i18n'

const intlMiddleware = createIntlMiddleware({
  locales,
  defaultLocale,
  localeDetection: true,
})

export async function middleware(request: NextRequest) {
  const intlResponse = intlMiddleware(request)
  if (intlResponse) return intlResponse

  return await handleAuth(request)
}

async function handleAuth(request: NextRequest) {
  const pathname = request.nextUrl.pathname
  const segments = pathname.split('/').filter(Boolean)

  const maybeLocale = segments[0] as Locale | undefined
  const hasLocale = maybeLocale && locales.includes(maybeLocale)
  const locale = hasLocale ? maybeLocale! : defaultLocale
  const restSegments = hasLocale ? segments.slice(1) : segments
  const normalizedPath = '/' + restSegments.join('/')

  const isProtectedRoute =
    normalizedPath.startsWith('/dashboard') ||
    normalizedPath.startsWith('/admin')

  if (!isProtectedRoute) {
    return NextResponse.next()
  }

  const token = await getToken({
    req: request,
    secret: process.env.NEXTAUTH_SECRET,
  })

  if (!token) {
    const loginUrl = new URL(`/${locale}/login`, request.url)
    loginUrl.searchParams.set('callbackUrl', request.url)
    return NextResponse.redirect(loginUrl)
  }

  if (normalizedPath.startsWith('/admin') && !token.isAdmin) {
    return NextResponse.redirect(new URL(`/${locale}/dashboard`, request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    '/((?!api|_next|_vercel|.*\\..*).*)',
  ],
}
