'use client';

import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Ban } from 'lucide-react';

export default function ComcraftCheckoutCancelled() {
  const router = useRouter();

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30 px-4">
      <Card className="max-w-lg w-full">
        <CardHeader className="text-center space-y-4">
          <Ban className="h-12 w-12 text-muted-foreground mx-auto" />
          <CardTitle className="text-2xl font-bold">Payment Cancelled</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6 text-center">
          <p className="text-muted-foreground">
            Your payment was cancelled. You can restart the checkout process at any time from the Comcraft product page.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Button onClick={() => router.push('/products/comcraft')} className="w-full sm:w-auto">
              Back to Product Page
            </Button>
            <Button variant="outline" onClick={() => router.push('/comcraft/dashboard')} className="w-full sm:w-auto">
              Open Dashboard
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
