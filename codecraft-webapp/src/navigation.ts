import { createNavigation } from 'next-intl/navigation';
import { defineRouting } from 'next-intl/routing';

// Define routing configuration matching your [locale] folder structure
export const routing = defineRouting({
  // A list of all locales that are supported
  locales: ['en', 'nl'],

  // Used when no locale matches
  defaultLocale: 'en',
  
  // Always show locale prefix in URL
  localePrefix: 'always'
});

// Lightweight wrappers around Next.js' navigation APIs
// that will consider the routing configuration
export const { Link, redirect, usePathname, useRouter, getPathname } =
  createNavigation(routing);

