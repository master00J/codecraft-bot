"use client";

import { useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { locales, type Locale } from "@/lib/i18n";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

function buildLocalizedPath(pathname: string, nextLocale: Locale) {
  const segments = pathname.split("/").filter(Boolean);

  if (segments.length === 0) {
    return `/${nextLocale}`;
  }

  const currentLocale = segments[0] as Locale;

  if (locales.includes(currentLocale)) {
    segments[0] = nextLocale;
  } else {
    segments.unshift(nextLocale);
  }

  return `/${segments.join("/")}`;
}

export function LanguageSwitcher() {
  const locale = useLocale() as Locale;
  const router = useRouter();
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();
  const t = useTranslations('language');

  return (
    <Select
      value={locale}
      onValueChange={(nextLocale) => {
        const targetLocale = nextLocale as Locale;

        startTransition(() => {
          document.cookie = `NEXT_LOCALE=${targetLocale}; path=/; max-age=${60 * 60 * 24 * 365}`;
          router.replace(buildLocalizedPath(pathname, targetLocale));
          router.refresh();
        });
      }}
      disabled={isPending}
    >
      <SelectTrigger className="w-[140px]">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {locales.map((availableLocale) => (
          <SelectItem key={availableLocale} value={availableLocale}>
            {t(availableLocale === 'en' ? 'english' : 'dutch')}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

