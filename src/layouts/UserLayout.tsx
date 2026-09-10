// ==============================================================================
// FINNEST - User Portal Layout
// Digital Property & Land Parcel Management Platform
// ==============================================================================

import React, { useState, useEffect } from 'react';
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../features/auth/AuthContext';
import { hardwareService } from '../services/hardwareService';
import { HardwareDevice, HardwareEvent } from '../types/database.types';
import { useRealtime } from '../hooks/useRealtime';
import {
  Building2,
  LayoutDashboard,
  Layers,
  Map as MapIcon,
  Clock,
  User,
  LogOut,
  Radio,
  ChevronDown,
  Shield,
  Receipt,
} from 'lucide-react';

export const UserLayout: React.FC = () => {
  const { user, signOut, isAdmin } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [devices, setDevices] = useState<HardwareDevice[]>([]);
  const [onlineCount, setOnlineCount] = useState<number>(0);
  const [showUserMenu, setShowUserMenu] = useState<boolean>(false);
  const [liveToast, setLiveToast] = useState<{ title: string; message: string } | null>(null);

  useEffect(() => {
    async function loadDevices() {
      const { data } = await hardwareService.getDevices();
      if (data) {
        setDevices(data);
        setOnlineCount(data.filter(d => d.status === 'online').length);
      }
    }
    loadDevices();
  }, []);

  // Listen to realtime hardware events
  useRealtime({
    onHardwareEvent: (event: HardwareEvent) => {
      setLiveToast({
        title: 'Hardware Scan Detected',
        message: `Node ${event.device_id} verified RFID: ${event.rfid_uid || 'N/A'}`,
      });
      setTimeout(() => setLiveToast(null), 6000);
    },
  });

  const handleLogout = async () => {
    await signOut();
    navigate('/login');
  };

  const navItems = [
    { label: 'Dashboard', path: '/portal', icon: LayoutDashboard, exact: true },
    { label: 'My Properties', path: '/portal/properties', icon: Layers },
    { label: 'Cadastral Map', path: '/portal/map', icon: MapIcon },
    { label: 'Property Tax', path: '/portal/tax', icon: Receipt },
    { label: 'Activity Log', path: '/portal/activity', icon: Clock },
    { label: 'Profile', path: '/portal/profile', icon: User },
  ];

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans text-slate-800 antialiased selection:bg-emerald-500 selection:text-white">
      {/* Top Header */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200/80 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Left: Brand & Nav */}
            <div className="flex items-center gap-8">
              <NavLink to="/portal" className="flex items-center gap-2.5 group">
                <div className="w-9 h-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-md shadow-emerald-600/20 group-hover:bg-emerald-500 transition-colors">
                  <Building2 className="w-5 h-5" />
                </div>
                <div>
                  <span className="text-base font-bold tracking-tight text-slate-900 block leading-none">
                    FinNest
                  </span>
                  <span className="text-[10px] text-slate-400 font-medium tracking-wide">
                    Owner Portal
                  </span>
                </div>
              </NavLink>

              {/* Desktop Nav Links */}
              <nav className="hidden md:flex items-center space-x-1">
                {navItems.map((item) => {
                  const Icon = item.icon;
                  const isActive = item.exact
                    ? location.pathname === item.path
                    : location.pathname.startsWith(item.path);

                  return (
                    <NavLink
                      key={item.path}
                      to={item.path}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                        isActive
                          ? 'bg-slate-900 text-white shadow-xs'
                          : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                      }`}
                    >
                      <Icon className="w-3.5 h-3.5" />
                      <span>{item.label}</span>
                    </NavLink>
                  );
                })}
              </nav>
            </div>

            {/* Right: Hardware Node Status & User Profile */}
            <div className="flex items-center gap-3">
              {/* Hardware Node Status */}
              <div className="hidden sm:flex items-center gap-2 px-2.5 py-1 rounded-full bg-slate-100 border border-slate-200/70 text-[11px] font-medium text-slate-600">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
                <span>{onlineCount} Nodes Active</span>
              </div>

              {/* Admin Portal Jump (if user is admin) */}
              {isAdmin && (
                <button
                  onClick={() => navigate('/admin')}
                  className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-indigo-50 border border-indigo-200 text-indigo-700 text-xs font-bold hover:bg-indigo-100 transition-colors"
                >
                  <Shield className="w-3.5 h-3.5 text-indigo-600" />
                  <span>Admin Portal</span>
                </button>
              )}

              {/* User Dropdown */}
              <div className="relative">
                <button
                  onClick={() => setShowUserMenu(!showUserMenu)}
                  className="flex items-center gap-2 p-1.5 rounded-xl hover:bg-slate-100 border border-transparent hover:border-slate-200 transition-all text-left"
                >
                  <img
                    src={user?.avatar_url || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80'}
                    alt={user?.full_name}
                    className="w-7 h-7 rounded-lg object-cover border border-slate-200"
                  />
                  <div className="hidden md:block">
                    <div className="text-xs font-bold text-slate-800 leading-tight">
                      {user?.full_name || 'Property Owner'}
                    </div>
                    <div className="text-[10px] text-slate-400 capitalize">
                      {user?.role || 'user'}
                    </div>
                  </div>
                  <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                </button>

                {/* Dropdown Menu */}
                {showUserMenu && (
                  <div className="absolute right-0 mt-2 w-56 bg-white rounded-2xl shadow-xl border border-slate-100 py-2 z-50 animate-in fade-in slide-in-from-top-2 duration-150">
                    <div className="px-4 py-2 border-b border-slate-100">
                      <p className="text-xs font-bold text-slate-900">{user?.full_name}</p>
                      <p className="text-[11px] text-slate-500 truncate">{user?.email}</p>
                    </div>

                    <div className="pt-1 mt-1 px-2">
                      <button
                        onClick={handleLogout}
                        className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-red-600 hover:bg-red-50 transition-colors"
                      >
                        <LogOut className="w-3.5 h-3.5" />
                        <span>Sign Out</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Mobile Navigation Bar */}
        <div className="md:hidden flex items-center justify-around border-t border-slate-100 px-2 py-1 bg-white">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = item.exact
              ? location.pathname === item.path
              : location.pathname.startsWith(item.path);

            return (
              <NavLink
                key={item.path}
                to={item.path}
                className={`flex flex-col items-center py-1 px-2 text-[10px] font-semibold transition-colors ${
                  isActive ? 'text-emerald-600' : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                <Icon className="w-4 h-4 mb-0.5" />
                <span>{item.label}</span>
              </NavLink>
            );
          })}
        </div>
      </header>

      {/* Live Toast Notification */}
      {liveToast && (
        <div className="fixed bottom-5 right-5 z-50 bg-slate-900 text-white px-4 py-3 rounded-2xl shadow-2xl border border-slate-800 flex items-center gap-3 animate-in fade-in slide-in-from-bottom-3 duration-200">
          <div className="w-8 h-8 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center flex-shrink-0">
            <Radio className="w-4 h-4" />
          </div>
          <div>
            <div className="text-xs font-bold text-white">{liveToast.title}</div>
            <div className="text-[11px] text-slate-300">{liveToast.message}</div>
          </div>
        </div>
      )}

      {/* Main Page Body */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <Outlet />
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-slate-200/80 py-4 mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-slate-400">
          <div>
            <span className="font-bold text-slate-600">FinNest</span> &bull; Digital property management, connected.
          </div>
          <div>
            Cadastral Survey & Realtime Land Registry
          </div>
        </div>
      </footer>
    </div>
  );
};
