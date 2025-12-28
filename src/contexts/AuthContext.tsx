'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

// Types
export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  fullName: string;
  role: 'super_admin' | 'owner' | 'admin' | 'sales';
  roleLevel: number;
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
          let userData: User = JSON.parse(storedUser);

          // Compute fullName if not present (backward compatibility)
          if (!userData.fullName && userData.firstName && userData.lastName) {
            userData.fullName = `${userData.firstName} ${userData.lastName}`;
          }

          // Compute roleLevel if not present (backward compatibility)
          if (!userData.roleLevel) {
            // Import getRoleLevelFromRole dynamically since this is client-side
            const { getRoleLevelFromRole } = await import('@/lib/auth/middleware');
            userData.roleLevel = getRoleLevelFromRole(userData.role);
            // Update localStorage with the computed roleLevel
            localStorage.setItem('user', JSON.stringify(userData));
          }

          // Validate tenant ID format (must be UUID or null)
          if (userData.tenantId && !isValidUUID(userData.tenantId)) {
            console.warn('Invalid tenant ID format in localStorage, clearing auth data');
            localStorage.removeItem('user');
            localStorage.removeItem('authToken');
            setIsLoading(false);
            return;
          }

          setUser(userData);

          // Fetch tenant data if user has tenantId
          if (userData.tenantId) {
            try {
              const tenantResponse = await fetch(`/api/v1/tenants/${userData.tenantId}`);
              if (tenantResponse.ok) {
                const tenantData = await tenantResponse.json();
                setTenant(tenantData.data);
              } else if (tenantResponse.status === 404) {
                // Tenant not found - clear invalid data
                console.warn('Tenant not found, clearing auth data');
                localStorage.removeItem('user');
                localStorage.removeItem('authToken');
                setUser(null);
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

    const result = await response.json();
    
    // Ensure roleLevel is included (backward compatibility)
    let userData = {
      ...result.data.user,
      fullName: `${result.data.user.firstName} ${result.data.user.lastName}`,
    };
    
    // Compute roleLevel if not present in response
    if (!userData.roleLevel) {
      const { getRoleLevelFromRole } = await import('@/lib/auth/middleware');
      userData.roleLevel = getRoleLevelFromRole(userData.role);
    }
    
    const accessToken = result.data.accessToken;

    setUser(userData);
    localStorage.setItem('user', JSON.stringify(userData));
    localStorage.setItem('authToken', accessToken);

    // Fetch tenant data
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
    } else {
      // Clear tenant if user has no tenantId (super admin)
      setTenant(null);
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
        
        // Ensure roleLevel is included (backward compatibility)
        let userData = data.user;
        if (!userData.roleLevel) {
          const { getRoleLevelFromRole } = await import('@/lib/auth/middleware');
          userData.roleLevel = getRoleLevelFromRole(userData.role);
        }
        
        setUser(userData);
        localStorage.setItem('user', JSON.stringify(userData));

        if (userData.tenantId) {
          const tenantResponse = await fetch(`/api/v1/tenants/${userData.tenantId}`);
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

// Helper function to validate UUID
function isValidUUID(str: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(str);
}

// Hook
export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}
