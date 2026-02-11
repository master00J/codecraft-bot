'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, ArrowLeft } from 'lucide-react';

/** Simple formatting: **bold**, paragraphs (double newline), line breaks. Renders as safe React nodes. */
function formatTermsText(text: string): React.ReactNode[] {
  const paragraphs = text.split(/\n\s*\n/).filter((p) => p.trim());
  return paragraphs.map((para, i) => {
    const parts: React.ReactNode[] = [];
    const segments = para.split(/(\*\*.+?\*\*)/g);
    segments.forEach((seg, j) => {
      const bold = /^\*\*(.+)\*\*$/.exec(seg);
      if (bold) {
        parts.push(<strong key={`${i}-${j}`}>{bold[1]}</strong>);
      } else {
        const lines = seg.split(/\n/);
        lines.forEach((line, k) => {
          if (k > 0) parts.push(<br key={`${i}-${j}-${k}`} />);
          parts.push(line);
        });
      }
    });
    return (
      <p key={i} className="mb-4 last:mb-0 text-muted-foreground leading-relaxed break-words">
        {parts}
      </p>
    );
  });
}

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
        if (s?.termsContent) {
          setContent(s.termsContent);
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
        <Card className="p-8 overflow-hidden">
          <h1 className="text-2xl font-bold mb-6">Terms of sale – {storeName}</h1>
          <div className="prose prose-sm dark:prose-invert max-w-none min-w-0 break-words text-[0.95rem]" style={{ overflowWrap: 'break-word' }}>
            {formatTermsText(content)}
          </div>
        </Card>
      </div>
    </div>
  );
}
