import {createNavigation} from 'next-intl/navigation';
import {defaultLocale, locales} from '@/lib/i18n';

export const localePrefix = 'always';

const {Link, redirect, usePathname, useRouter} = createNavigation({
  locales,
  defaultLocale,
  localePrefix,
});

export {Link, redirect, usePathname, useRouter};

