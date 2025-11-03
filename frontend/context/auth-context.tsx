'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import api from '@/lib/api';
import { useToast } from '@/components/ui/use-toast';
import { useRouter } from 'next/navigation';
import Cookies from 'js-cookie';

interface User {
  id: string;
  email: string;
  walletAddress: string | null;
}

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, walletAddress: string) => Promise<void>;
  logout: () => void;
  connectWallet: () => Promise<string>;
  disconnectWallet: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();
  const router = useRouter();

  useEffect(() => {
    const wallet = Cookies.get('walletAddress');
    if (wallet) {
      verifyWallet(wallet);
    } else {
      setIsLoading(false);
    }
  }, []);

  const verifyToken = async () => {
    // This function is deprecated in wallet-only flow
    setIsLoading(false);
  };

  const verifyWallet = async (walletAddress: string) => {
    try {
      const response = await api.post('/api/auth/wallet-connect', { walletAddress });
      setUser(response.data.user);
    } catch (error) {
      Cookies.remove('walletAddress');
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  };

  const login = async (_email: string, _password: string) => {
    // no-op in wallet-only flow
    return Promise.resolve();
  };

  const register = async (_email: string, _password: string, _walletAddress: string) => {
    // no-op in wallet-only flow
    return Promise.resolve();
  };

  const logout = () => {
    Cookies.remove('token');
    setUser(null);
    toast({
      title: 'Success',
      description: 'Logged out successfully',
    });
    router.push('/login');
  };

  const connectWallet = async () => {
    try {
      if (typeof window.ethereum === 'undefined') {
        throw new Error('MetaMask is not installed');
      }

      const accounts = await window.ethereum.request({
        method: 'eth_requestAccounts',
      });

      const walletAddress = accounts[0];
      
      // Persist wallet in cookie
      Cookies.set('walletAddress', walletAddress, { expires: 30 });

      // Find or create profile on backend
      const response = await api.post('/api/auth/wallet-connect', { walletAddress });
      const userObj = response.data.user;
      setUser(userObj);

      toast({
        title: 'Success',
        description: 'Wallet connected successfully',
      });

      return walletAddress;
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to connect wallet',
        variant: 'destructive',
      });
      throw error;
    }
  };

  const disconnectWallet = async () => {
    try {
      if (user) {
        await api.put(`/api/profiles/${user.id}`, {
          wallet_address: null,
        });
        setUser({ ...user, walletAddress: null });
      }
      toast({
        title: 'Success',
        description: 'Wallet disconnected successfully',
      });
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.response?.data?.message || 'Failed to disconnect wallet',
        variant: 'destructive',
      });
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        isLoading,
        login,
        register,
        logout,
        connectWallet,
        disconnectWallet,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}; 