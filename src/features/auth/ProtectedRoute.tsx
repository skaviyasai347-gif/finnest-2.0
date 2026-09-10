// ==============================================================================
// FINNEST - Role-Based Route Guard Component
// Digital Property & Land Parcel Management Platform
// ==============================================================================

import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from './AuthContext';
import { UserRole } from '../../types/database.types';

interface ProtectedRouteProps {
  children: React.ReactElement;
  requiredRole?: UserRole;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children, requiredRole }) => {
  const { user, isAdmin, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-3 border-emerald-600 border-t-transparent rounded-full animate-spin"></div>
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Verifying FinNest Session...</span>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Admin Route Protection: If route requires admin role and user is standard user, redirect to user portal
  if (requiredRole === 'admin' && !isAdmin) {
    return <Navigate to="/portal" replace />;
  }

  return children;
};
