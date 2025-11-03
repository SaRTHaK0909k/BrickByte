'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/auth-context';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function LoginPage() {
  const router = useRouter();
  const { connectWallet } = useAuth();
  const [isLoading, setIsLoading] = useState(false);

  const handleConnectWallet = async () => {
    try {
      setIsLoading(true);
      await connectWallet();
      router.push('/dashboard');
    } catch (err) {
      console.error('Failed to connect wallet:', err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-900 transition-colors duration-300">
      <Card className="w-full max-w-md bg-white dark:bg-gray-900 text-slate-900 dark:text-gray-100">
        <CardHeader>
          <CardTitle>Connect Wallet</CardTitle>
          <CardDescription className="text-gray-500 dark:text-gray-400">
            Use your wallet to authenticate and manage your investments
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <Button onClick={handleConnectWallet} className="w-full" disabled={isLoading}>
              {isLoading ? 'Connecting...' : 'Connect Wallet'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
