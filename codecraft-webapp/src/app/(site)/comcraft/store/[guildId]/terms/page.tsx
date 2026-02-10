'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, ArrowLeft } from 'lucide-react';

export default function StoreTermsPage() {
  const params = useParams();
  const guildId = params.guildId as string;
  const [content, setContent] = useState<string | null>(null);
  const [storeName, setStoreName] = useState<string>('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!guildId) return;
    fetch(`/api/comcraft/public/shop?guildId=${encodeURIComponent(guildId)}`)
      .then((res) => res.json())
      .then((data) => {
        const s = data.settings ?? null;
        if (s?.terms_content) {
          setContent(s.terms_content);
        }
        setStoreName(s?.storeName ?? 'Store');
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [guildId]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!content) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-background to-muted/30">
        <div className="container max-w-2xl mx-auto px-4 py-8">
          <Link href={`/comcraft/store/${guildId}`}>
            <Button variant="ghost" size="sm" className="mb-4">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to store
            </Button>
          </Link>
          <Card className="p-8 text-center">
            <p className="text-muted-foreground">No terms of sale have been set for this store.</p>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/30">
      <div className="container max-w-2xl mx-auto px-4 py-8">
        <Link href={`/comcraft/store/${guildId}`}>
          <Button variant="ghost" size="sm" className="mb-6">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to store
          </Button>
        </Link>
        <Card className="p-8">
          <h1 className="text-2xl font-bold mb-6">Terms of sale – {storeName}</h1>
          <div className="prose prose-sm dark:prose-invert max-w-none whitespace-pre-wrap text-muted-foreground">
            {content}
          </div>
        </Card>
      </div>
    </div>
  );
}
