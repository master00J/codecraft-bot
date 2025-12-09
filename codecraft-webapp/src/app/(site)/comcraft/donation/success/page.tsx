'use client';

import { useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CheckCircle2 } from 'lucide-react';
import Link from 'next/link';

export default function DonationSuccessPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const sessionId = searchParams.get('session_id');

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-purple-50 dark:from-gray-900 dark:to-gray-800 p-4">
      <Card className="w-full max-w-md p-8 text-center">
        <div className="mb-6 flex justify-center">
          <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center">
            <CheckCircle2 className="h-10 w-10 text-green-600 dark:text-green-400" />
          </div>
        </div>

        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
          Thank You! 🎉
        </h1>
        
        <p className="text-gray-600 dark:text-gray-400 mb-6">
          Your donation has been received. We truly appreciate your support for ComCraft!
        </p>

        <div className="space-y-3">
          <Button asChild className="w-full">
            <Link href="/comcraft/dashboard">
              Back to Dashboard
            </Link>
          </Button>
          
          {sessionId && (
            <p className="text-xs text-gray-500 dark:text-gray-500">
              Session ID: {sessionId.substring(0, 20)}...
            </p>
          )}
        </div>
      </Card>
    </div>
  );
}

