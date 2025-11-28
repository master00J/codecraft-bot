import type { ReactNode } from 'react';

export const dynamic = 'force-dynamic';

type SiteLayoutProps = {
  children: ReactNode;
};

export default function SiteLayout({ children }: SiteLayoutProps) {
  return children;
}

