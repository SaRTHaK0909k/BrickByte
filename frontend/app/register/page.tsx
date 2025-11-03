'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/auth-context';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import Link from 'next/link';

export default function RegisterPage() {
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
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Connect Wallet</CardTitle>
          <CardDescription>Use your wallet to authenticate and manage your investments</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <Button onClick={handleConnectWallet} className="w-full" disabled={isLoading}>
              {isLoading ? 'Connecting...' : 'Connect Wallet'}
            </Button>
            <div className="mt-4 text-center">
              <p className="text-sm text-gray-600">
                Prefer another method?{' '}
                <Link href="/" className="text-blue-600 hover:underline">
                  Return home
                </Link>
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}