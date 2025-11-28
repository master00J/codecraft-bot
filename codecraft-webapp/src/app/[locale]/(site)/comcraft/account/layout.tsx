'use client';

import { usePathname } from 'next/navigation';
import { Link } from '@/navigation';
import { cn } from '@/lib/utils';
import { Coins, Gift, User } from 'lucide-react';

const accountNavItems = [
  {
    title: 'Vote Rewards',
    href: '/comcraft/account/vote-rewards',
    icon: Coins,
    description: 'Redeem vote points for tier unlocks'
  }
];

export default function AccountLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Account</h1>
        <p className="text-gray-600 dark:text-gray-400">
          Manage your account settings and rewards
        </p>
      </div>

      <div className="flex flex-col md:flex-row gap-8">
        {/* Sidebar Navigation */}
        <aside className="w-full md:w-64 flex-shrink-0">
          <nav className="space-y-2">
            {accountNavItems.map((item) => {
              const Icon = item.icon;
              const isActive = pathname?.includes(item.href) || pathname === item.href;
              
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    'flex items-center gap-3 px-4 py-3 rounded-lg transition-colors',
                    isActive
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-card hover:bg-accent text-card-foreground'
                  )}
                >
                  <Icon className="h-5 w-5" />
                  <div className="flex-1">
                    <div className="font-medium">{item.title}</div>
                    <div className={cn(
                      'text-xs',
                      isActive ? 'text-primary-foreground/80' : 'text-muted-foreground'
                    )}>
                      {item.description}
                    </div>
                  </div>
                </Link>
              );
            })}
          </nav>
        </aside>

        {/* Main Content */}
        <main className="flex-1 min-w-0">
          {children}
        </main>
      </div>
    </div>
  );
}

