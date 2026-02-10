'use client';

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CheckCircle, Copy, Loader2 } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';

export default function PayThankYouPage() {
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const sessionId = searchParams.get('session_id');
  const paypalOrderId = searchParams.get('paypal_order_id') || searchParams.get('token');
  const guildId = searchParams.get('guild_id');
  const [codeData, setCodeData] = useState<{ code: string; itemName: string | null } | null>(null);
  const [codeLoading, setCodeLoading] = useState(false);

  useEffect(() => {
    if ((!sessionId && !paypalOrderId) || !guildId) return;
    setCodeLoading(true);
    const params = new URLSearchParams({ guild_id: guildId });
    if (sessionId) params.set('session_id', sessionId);
    if (paypalOrderId) params.set('paypal_order_id', paypalOrderId);
    fetch(`/api/comcraft/code-by-session?${params.toString()}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.code) setCodeData({ code: data.code, itemName: data.itemName ?? null });
      })
      .catch(() => {})
      .finally(() => setCodeLoading(false));
  }, [sessionId, paypalOrderId, guildId]);

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-muted/30">
      <Card className="p-8 max-w-md w-full text-center">
        <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
        <h1 className="text-2xl font-bold mb-2">Thank you!</h1>
        <p className="text-muted-foreground mb-4">
          Your payment was successful. The server owner will receive the funds directly.
        </p>
        {codeLoading && (
          <p className="text-sm text-muted-foreground flex items-center justify-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading your code…
          </p>
        )}
        {!codeLoading && codeData?.code && (
          <div className="mt-4 p-4 rounded-lg bg-muted/50 border text-left">
            <p className="text-sm font-medium mb-1">Your code</p>
            <p className="text-xs text-muted-foreground mb-2">
              Use this code as instructed by the seller (e.g. in Steam or another platform). You can retrieve it again anytime under &quot;Your purchased codes&quot; on the store page.
            </p>
            <div className="flex items-center gap-2">
              <code className="flex-1 font-mono text-lg tracking-wider bg-background px-3 py-2 rounded border">
                {codeData.code}
              </code>
              <Button
                variant="outline"
                size="icon"
                onClick={() => {
                  void navigator.clipboard.writeText(codeData.code).then(() => {
                    toast({ title: 'Copied', description: 'Code copied to clipboard.' });
                  });
                }}
              >
                <Copy className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
