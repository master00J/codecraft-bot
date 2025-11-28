import { notFound } from 'next/navigation'

export const locales = ['en', 'nl'] as const

export type Locale = (typeof locales)[number]

export const defaultLocale: Locale = 'en'

export function getLocale(locale: string | undefined): Locale {
  if (!locale) {
    return defaultLocale
  }

  const normalized = locale.split('-')[0] as Locale

  if (locales.includes(normalized)) {
    return normalized
  }

  return defaultLocale
}

export async function getMessages(locale: Locale) {
  switch (locale) {
    case 'nl':
      return (await import('@/locales/nl/common.json')).default
    case 'en':
      return (await import('@/locales/en/common.json')).default
    default:
      notFound()
  }
}

