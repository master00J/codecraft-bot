'use client';

import { Card } from '@/components/ui/card';
import { CheckCircle } from 'lucide-react';

export default function PayThankYouPage() {
  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-muted/30">
      <Card className="p-8 max-w-md w-full text-center">
        <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
        <h1 className="text-2xl font-bold mb-2">Thank you!</h1>
        <p className="text-muted-foreground">
          Your payment was successful. The server owner will receive the funds directly.
        </p>
      </Card>
    </div>
  );
}
