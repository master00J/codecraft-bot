import { Metadata } from 'next';

type Props = { params: Promise<{ guildId: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { guildId } = await params;
  try {
    const base = process.env.NEXTAUTH_URL ?? process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000';
    const res = await fetch(`${base}/api/comcraft/public/shop?guildId=${encodeURIComponent(guildId)}`, { next: { revalidate: 60 } });
    const data = await res.json();
    const settings = data.settings;
    const title = settings?.storeName ? `${settings.storeName} | Store` : 'Server Store';
    const description = settings?.storeDescription ?? 'Support the server and get roles or perks.';
    const image = settings?.storeLogoUrl ?? null;
    return {
      title,
      description,
      openGraph: {
        title,
        description,
        ...(image ? { images: [{ url: image }] } : {}),
      },
    };
  } catch {
    return { title: 'Store' };
  }
}

export default function StoreLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
