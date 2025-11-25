'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

// Types
export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  fullName: string;
  role: 'super_admin' | 'admin' | 'manager' | 'staff';
  tenantId: string | null;
  phoneNumber?: string;
  createdAt: string;
}

export interface Tenant {
  id: string;
  name: string;
  slug: string;
  logo?: string;
  address?: string;
  phoneNumber?: string;
  email?: string;
}

export interface AuthContextType {
  user: User | null;
  tenant: Tenant | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  refreshUser: () => Promise<void>;
}

// Context
const AuthContext = createContext<AuthContextType | null>(null);

// Provider
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Load user from localStorage on mount
  useEffect(() => {
    const loadUser = async () => {
      try {
        const storedUser = localStorage.getItem('user');
        const storedToken = localStorage.getItem('authToken');

        if (storedUser && storedToken) {
          const userData: User = JSON.parse(storedUser);
          setUser(userData);

          // Fetch tenant data if user has tenantId
          if (userData.tenantId) {
            try {
              const tenantResponse = await fetch(`/api/v1/tenants/${userData.tenantId}`);
              if (tenantResponse.ok) {
                const tenantData = await tenantResponse.json();
                setTenant(tenantData.data);
              }
            } catch (error) {
              console.error('Failed to load tenant:', error);
            }
          }
        }
      } catch (error) {
        console.error('Failed to load user:', error);
        localStorage.removeItem('user');
        localStorage.removeItem('authToken');
      } finally {
        setIsLoading(false);
      }
    };

    loadUser();
  }, []);

  const login = async (email: string, password: string) => {
    const response = await fetch('/api/v1/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });

    if (!response.ok) {
      throw new Error('Login failed');
    }

    const data = await response.json();
    setUser(data.user);
    localStorage.setItem('user', JSON.stringify(data.user));
    localStorage.setItem('authToken', data.token);

    // Fetch tenant data
    if (data.user.tenantId) {
      try {
        const tenantResponse = await fetch(`/api/v1/tenants/${data.user.tenantId}`);
        if (tenantResponse.ok) {
          const tenantData = await tenantResponse.json();
          setTenant(tenantData.data);
        }
      } catch (error) {
        console.error('Failed to load tenant:', error);
      }
    }
  };

  const logout = () => {
    setUser(null);
    setTenant(null);
    localStorage.removeItem('user');
    localStorage.removeItem('authToken');
  };

  const refreshUser = async () => {
    try {
      const response = await fetch('/api/v1/auth/me');
      if (response.ok) {
        const data = await response.json();
        setUser(data.user);
        localStorage.setItem('user', JSON.stringify(data.user));

        if (data.user.tenantId) {
          const tenantResponse = await fetch(`/api/v1/tenants/${data.user.tenantId}`);
          if (tenantResponse.ok) {
            const tenantData = await tenantResponse.json();
            setTenant(tenantData.data);
          }
        }
      }
    } catch (error) {
      console.error('Failed to refresh user:', error);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        tenant,
        isAuthenticated: !!user,
        isLoading,
        login,
        logout,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

// Hook
export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}
