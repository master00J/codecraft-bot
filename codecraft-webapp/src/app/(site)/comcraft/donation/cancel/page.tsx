'use client';

import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { XCircle } from 'lucide-react';
import Link from 'next/link';

export default function DonationCancelPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-purple-50 dark:from-gray-900 dark:to-gray-800 p-4">
      <Card className="w-full max-w-md p-8 text-center">
        <div className="mb-6 flex justify-center">
          <div className="w-16 h-16 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center">
            <XCircle className="h-10 w-10 text-gray-400" />
          </div>
        </div>

        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
          Donation Cancelled
        </h1>
        
        <p className="text-gray-600 dark:text-gray-400 mb-6">
          Your donation was cancelled. No charges were made. Feel free to try again anytime!
        </p>

        <Button asChild className="w-full">
          <Link href="/comcraft/dashboard">
            Back to Dashboard
          </Link>
        </Button>
      </Card>
    </div>
  );
}

