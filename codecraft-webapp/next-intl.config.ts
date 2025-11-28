import {getRequestConfig} from 'next-intl/server';
import {locales, defaultLocale} from './src/lib/i18n';

const messageLoaders: Record<string, () => Promise<Record<string, unknown>>> = {
  en: () => import('./src/locales/en/common.json').then((mod) => mod.default),
  nl: () => import('./src/locales/nl/common.json').then((mod) => mod.default)
};

export default getRequestConfig(async ({locale}) => {
  const resolvedLocale = locales.includes(locale as (typeof locales)[number])
    ? (locale as (typeof locales)[number])
    : defaultLocale;

  const loadMessages =
    messageLoaders[resolvedLocale] ?? messageLoaders[defaultLocale];

  return {
    locale: resolvedLocale,
    messages: await loadMessages()
  };
});
