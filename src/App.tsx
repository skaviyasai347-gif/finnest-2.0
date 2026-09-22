// ==============================================================================
// FINNEST - Application Router & Multi-Portal Architecture
// Digital Property & Land Parcel Management Platform
// ==============================================================================

import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './features/auth/AuthContext';
import { ProtectedRoute } from './features/auth/ProtectedRoute';
import { LoginPage } from './pages/auth/LoginPage';

// User Portal
import { UserLayout } from './layouts/UserLayout';
import { UserDashboardPage } from './pages/user/UserDashboardPage';
import { UserPropertiesPage } from './pages/user/UserPropertiesPage';
import { UserPropertyDetailPage } from './pages/user/UserPropertyDetailPage';
import { UserMapPage } from './pages/user/UserMapPage';
import { UserActivityPage } from './pages/user/UserActivityPage';
import { UserProfilePage } from './pages/user/UserProfilePage';
import { UserTaxPage } from './pages/user/UserTaxPage';

// Admin Portal
import { AdminLayout } from './layouts/AdminLayout';
import { AdminOverviewPage } from './pages/admin/AdminOverviewPage';
import { AdminPropertiesPage } from './pages/admin/AdminPropertiesPage';
import { AdminUsersPage } from './pages/admin/AdminUsersPage';
import { AdminOwnershipPage } from './pages/admin/AdminOwnershipPage';
import { AdminMapPage } from './pages/admin/AdminMapPage';
import { AdminHardwarePage } from './pages/admin/AdminHardwarePage';
import { AdminActivityPage } from './pages/admin/AdminActivityPage';
import { AdminTaxPage } from './pages/admin/AdminTaxPage';

// Root redirector based on authenticated role
// Root redirector: In demo mode, immediately route to the admin console (or owner portal)
const RootRedirect: React.FC = () => {
  const { isAdmin } = useAuth();
  return isAdmin ? <Navigate to="/admin" replace /> : <Navigate to="/portal" replace />;
};

export const App: React.FC = () => {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Public Auth Route */}
          <Route path="/login" element={<LoginPage />} />

          {/* Root Redirect */}
          <Route path="/" element={<RootRedirect />} />

          {/* User Portal Routes */}
          <Route
            path="/portal"
            element={
              <ProtectedRoute>
                <UserLayout />
              </ProtectedRoute>
            }
          >
            <Route index element={<UserDashboardPage />} />
            <Route path="properties" element={<UserPropertiesPage />} />
            <Route path="properties/:id" element={<UserPropertyDetailPage />} />
            <Route path="map" element={<UserMapPage />} />
            <Route path="tax" element={<UserTaxPage />} />
            <Route path="activity" element={<UserActivityPage />} />
            <Route path="profile" element={<UserProfilePage />} />
          </Route>

          {/* Admin Portal Routes */}
          <Route
            path="/admin"
            element={
              <ProtectedRoute requiredRole="admin">
                <AdminLayout />
              </ProtectedRoute>
            }
          >
            <Route index element={<AdminOverviewPage />} />
            <Route path="properties" element={<AdminPropertiesPage />} />
            <Route path="properties/:id" element={<UserPropertyDetailPage />} />
            <Route path="users" element={<AdminUsersPage />} />
            <Route path="ownership" element={<AdminOwnershipPage />} />
            <Route path="map" element={<AdminMapPage />} />
            <Route path="tax" element={<AdminTaxPage />} />
            <Route path="hardware" element={<AdminHardwarePage />} />
            <Route path="activity" element={<AdminActivityPage />} />
          </Route>

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
};

export default App;
