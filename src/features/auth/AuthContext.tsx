// ==============================================================================
// FINNEST - Authentication Context & Session State (Interactive Demo Enabled)
// Digital Property & Land Parcel Management Platform
// ==============================================================================

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { UserProfile, UserRole } from '../../types/database.types';
import { authService } from '../../services/authService';
import { supabase } from '../../lib/supabase';

// Designated Demo Personas for frictionless submission & evaluation
export const DEMO_ADMIN_PROFILE: UserProfile = {
  id: '00000000-0000-0000-0000-000000000001',
  full_name: 'FinNest Administrator',
  email: 'admin@finnest.io',
  phone: '+91 98400 11001',
  role: 'admin',
  avatar_url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
  is_verified: true,
  verified_at: '2026-09-10T17:11:20.227Z',
  created_at: '2026-09-10T17:11:20.227Z',
  updated_at: '2026-09-10T17:11:20.227Z',
};

export const DEMO_OWNER_PROFILE: UserProfile = {
  id: '00000000-0000-0000-0000-000000000002',
  full_name: 'Aarav Sundaram',
  email: 'aarav.sundaram@finnest.io',
  phone: '+91 98401 22002',
  role: 'user',
  avatar_url: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
  is_verified: true,
  verified_at: '2026-09-10T17:11:20.227Z',
  created_at: '2026-09-10T17:11:20.227Z',
  updated_at: '2026-09-10T17:11:20.227Z',
};

interface AuthContextType {
  user: UserProfile | null;
  role: UserRole;
  isAdmin: boolean;
  isLoading: boolean;
  isDemoMode: boolean;
  switchDemoPersona: (persona: 'admin' | 'owner') => void;
  signIn: (email: string, password: string) => Promise<{ success: boolean; profile?: UserProfile; error?: string }>;
  signUp: (email: string, password: string, fullName: string, phone?: string) => Promise<{ success: boolean; profile?: UserProfile; error?: string }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  // Determine initial persona from storage or default to Admin
  const getInitialUser = (): UserProfile => {
    try {
      const savedPersona = localStorage.getItem('finnest_demo_persona');
      if (savedPersona === 'owner') return DEMO_OWNER_PROFILE;
      const cached = localStorage.getItem('finnest_session_user');
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed?.id && parsed?.email) return parsed;
      }
    } catch (e) {}
    return DEMO_ADMIN_PROFILE;
  };

  const [user, setUser] = useState<UserProfile | null>(getInitialUser);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const isDemoMode = true;

  const switchDemoPersona = (persona: 'admin' | 'owner') => {
    const selected = persona === 'admin' ? DEMO_ADMIN_PROFILE : DEMO_OWNER_PROFILE;
    setUser(selected);
    localStorage.setItem('finnest_demo_persona', persona);
    localStorage.setItem('finnest_session_user', JSON.stringify(selected));
  };

  const refreshProfile = async () => {
    try {
      const profile = await authService.getCurrentProfile();
      if (profile) {
        setUser(profile);
      }
    } catch (err) {
      console.warn('Profile refresh notice:', err);
    }
  };

  useEffect(() => {
    let isMounted = true;

    async function initAuth() {
      try {
        const profile = await authService.getCurrentProfile();
        if (isMounted && profile) {
          setUser(profile);
        }
      } catch (err) {
        console.warn('Auth initialization notice:', err);
      }
    }
    initAuth();

    // Listen to real Supabase Auth session updates if custom sign in is performed
    const { data: authListener } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!isMounted) return;

      if (event === 'SIGNED_OUT' || !session) {
        // In demo mode, reset to active demo administrator instead of stranding user
        const savedPersona = localStorage.getItem('finnest_demo_persona');
        setUser(savedPersona === 'owner' ? DEMO_OWNER_PROFILE : DEMO_ADMIN_PROFILE);
      } else if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED') {
        const profile = await authService.getCurrentProfile();
        if (isMounted && profile) {
          setUser(profile);
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
    // In demo mode, smoothly return to default demo administrator
    setUser(DEMO_ADMIN_PROFILE);
    localStorage.removeItem('finnest_demo_persona');
    setIsLoading(false);
  };

  const role: UserRole = user?.role || 'admin';
  const isAdmin = user?.role === 'admin';

  return (
    <AuthContext.Provider
      value={{
        user,
        role,
        isAdmin,
        isLoading,
        isDemoMode,
        switchDemoPersona,
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
