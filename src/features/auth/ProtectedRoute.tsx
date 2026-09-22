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

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
  // Demo Mode: All routes are unlocked and immediately accessible without login walls
  return children;
};
