// ==============================================================================
// FINNEST - Authentication Context & Session State
// Digital Property & Land Parcel Management Platform
// ==============================================================================

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { UserProfile, UserRole } from '../../types/database.types';
import { authService } from '../../services/authService';
import { supabase } from '../../lib/supabase';

interface AuthContextType {
  user: UserProfile | null;
  role: UserRole;
  isAdmin: boolean;
  isLoading: boolean;
  signIn: (email: string, password: string) => Promise<{ success: boolean; profile?: UserProfile; error?: string }>;
  signUp: (email: string, password: string, fullName: string, phone?: string) => Promise<{ success: boolean; profile?: UserProfile; error?: string }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const refreshProfile = async () => {
    try {
      const profile = await authService.getCurrentProfile();
      setUser(profile);
    } catch (err) {
      console.warn('Profile refresh notice:', err);
    }
  };

  useEffect(() => {
    let isMounted = true;

    async function initAuth() {
      try {
        const profile = await authService.getCurrentProfile();
        if (isMounted) setUser(profile);
      } catch (err) {
        console.warn('Auth initialization error:', err);
        if (isMounted) setUser(null);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }
    initAuth();

    // Listen to real Supabase Auth session updates
    const { data: authListener } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!isMounted) return;

      if (event === 'SIGNED_OUT' || !session) {
        setUser(null);
        setIsLoading(false);
      } else if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED') {
        const profile = await authService.getCurrentProfile();
        if (isMounted) {
          setUser(profile);
          setIsLoading(false);
        }
      }
    });

    return () => {
      isMounted = false;
      authListener?.subscription?.unsubscribe();
    };
  }, []);

  const signIn = async (email: string, password: string) => {
    setIsLoading(true);
    const { profile, error } = await authService.signIn(email, password);
    setIsLoading(false);
    if (error || !profile) {
      return { success: false, error: error || 'Authentication failed' };
    }
    setUser(profile);
    return { success: true, profile };
  };

  const signUp = async (email: string, password: string, fullName: string, phone?: string) => {
    setIsLoading(true);
    const { profile, error } = await authService.signUp(email, password, fullName, phone);
    setIsLoading(false);
    if (error || !profile) {
      return { success: false, error: error || 'Registration failed' };
    }
    setUser(profile);
    return { success: true, profile };
  };

  const signOut = async () => {
    setIsLoading(true);
    await authService.signOut();
    setUser(null);
    setIsLoading(false);
  };

  const role: UserRole = user?.role || 'user';
  const isAdmin = user?.role === 'admin';

  return (
    <AuthContext.Provider
      value={{
        user,
        role,
        isAdmin,
        isLoading,
        signIn,
        signUp,
        signOut,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
