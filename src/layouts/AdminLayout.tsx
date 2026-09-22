// ==============================================================================
// FINNEST - Admin Portal Layout
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
  Users,
  ArrowLeftRight,
  Map as MapIcon,
  Cpu,
  Clock,
  Receipt,
  LogOut,
  Radio,
  ExternalLink,
  Menu,
  X,
  ArrowRightLeft,
} from 'lucide-react';

export const AdminLayout: React.FC = () => {
  const { user, signOut, switchDemoPersona } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [devices, setDevices] = useState<HardwareDevice[]>([]);
  const [onlineCount, setOnlineCount] = useState<number>(0);
  const [sidebarOpen, setSidebarOpen] = useState<boolean>(false);
  const [adminToast, setAdminToast] = useState<{ title: string; message: string } | null>(null);

  useEffect(() => {
    async function fetchDevices() {
      const { data } = await hardwareService.getDevices();
      if (data) {
        setDevices(data);
        setOnlineCount(data.filter(d => d.status === 'online').length);
      }
    }
    fetchDevices();
  }, []);

  useRealtime({
    onHardwareEvent: (ev: HardwareEvent) => {
      setAdminToast({
        title: 'Hardware Telemetry Ingested',
        message: `Node ${ev.device_id} scanned RFID ${ev.rfid_uid || 'N/A'}. Event logged.`,
      });
      setTimeout(() => setAdminToast(null), 6000);
    },
  });

  const handleLogout = async () => {
    await signOut();
    navigate('/login');
  };

  const navItems = [
    { label: 'Overview', path: '/admin', icon: LayoutDashboard, exact: true },
    { label: 'Properties', path: '/admin/properties', icon: Layers },
    { label: 'Users / Owners', path: '/admin/users', icon: Users },
    { label: 'Ownership Transfers', path: '/admin/ownership', icon: ArrowLeftRight },
    { label: 'Cadastral Map', path: '/admin/map', icon: MapIcon },
    { label: 'Property Tax', path: '/admin/tax', icon: Receipt },
    { label: 'Hardware & Verification', path: '/admin/hardware', icon: Cpu },
    { label: 'Activity Logs', path: '/admin/activity', icon: Clock },
  ];

  return (
    <div className="min-h-screen bg-slate-900 flex font-sans text-slate-100 antialiased selection:bg-emerald-500 selection:text-white">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex lg:flex-col lg:w-64 bg-slate-950 border-r border-slate-800/80 flex-shrink-0 justify-between">
        <div>
          {/* Logo */}
          <div className="h-16 flex items-center px-6 border-b border-slate-800/80">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-emerald-500 text-slate-950 flex items-center justify-center font-bold shadow-md shadow-emerald-500/20">
                <Building2 className="w-5 h-5" />
              </div>
              <div>
                <span className="text-base font-bold tracking-tight text-white block leading-none">
                  FinNest
                </span>
                <span className="text-[10px] font-mono text-emerald-400 font-bold uppercase tracking-wider">
                  Admin Console
                </span>
              </div>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="p-3 space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = item.exact
                ? location.pathname === item.path
                : location.pathname.startsWith(item.path);

              return (
                <NavLink
                  key={item.path}
                  to={item.path}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition-colors ${
                    isActive
                      ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-bold'
                      : 'text-slate-400 hover:text-white hover:bg-slate-900'
                  }`}
                >
                  <Icon className="w-4 h-4 flex-shrink-0" />
                  <span>{item.label}</span>
                </NavLink>
              );
            })}
          </nav>
        </div>

        {/* Bottom Sidebar: Hardware Health & Identity */}
        <div className="p-4 border-t border-slate-800/80 space-y-3">
          {/* Hardware Quick Status */}
          <div className="bg-slate-900/90 rounded-2xl p-3 border border-slate-800 text-xs">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Field Nodes</span>
              <span className="flex items-center gap-1.5 text-emerald-400 font-bold text-[11px]">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                {onlineCount} Online
              </span>
            </div>
            <p className="text-[11px] text-slate-500 leading-snug">
              ESP8266 HTTP ingestion active on <code className="font-mono text-[10px] text-slate-300">/hardware-event</code>
            </p>
          </div>

          {/* User Identity */}
          <div className="flex items-center justify-between pt-1">
            <div className="flex items-center gap-2.5">
              <img
                src={user?.avatar_url || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80'}
                alt={user?.full_name}
                className="w-8 h-8 rounded-xl object-cover border border-slate-700"
              />
              <div className="truncate">
                <div className="text-xs font-bold text-white truncate max-w-[110px]">{user?.full_name}</div>
                <div className="text-[10px] text-emerald-400 uppercase font-mono">Superadmin</div>
              </div>
            </div>

            <button
              onClick={handleLogout}
              title="Sign Out"
              className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-slate-900 rounded-lg transition-colors"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 bg-slate-900">
        {/* Top Header */}
        <header className="h-16 bg-slate-950/80 backdrop-blur-md border-b border-slate-800/80 px-4 sm:px-8 flex items-center justify-between sticky top-0 z-30">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="lg:hidden p-2 text-slate-400 hover:text-white rounded-lg"
            >
              {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
            <span className="hidden sm:inline-block text-xs font-semibold text-slate-400">
              Cadastral Administration & Hardware Ingestion
            </span>
          </div>

          <div className="flex items-center gap-3">
            {/* Interactive Demo Persona Switcher */}
            <div className="flex items-center bg-slate-900 border border-emerald-500/40 rounded-xl px-2.5 py-1 text-xs gap-2">
              <span className="flex items-center gap-1.5 text-emerald-400 font-bold text-[11px] uppercase tracking-wide">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                Demo: Administrator
              </span>
              <span className="text-slate-700">|</span>
              <button
                onClick={() => {
                  switchDemoPersona('owner');
                  navigate('/portal');
                }}
                className="text-xs font-semibold text-slate-300 hover:text-emerald-300 flex items-center gap-1 transition-colors"
                title="Switch to Property Owner Portal (Aarav Sundaram)"
              >
                <span>Switch to Owner View</span>
                <ArrowRightLeft className="w-3 h-3 text-slate-400" />
              </button>
            </div>

            {/* Owner Portal Direct Link */}
            <button
              onClick={() => {
                switchDemoPersona('owner');
                navigate('/portal');
              }}
              className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition-colors border border-slate-700"
            >
              <span>Owner Portal</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </button>
          </div>
        </header>

        {/* Mobile Navigation Drawer */}
        {sidebarOpen && (
          <div className="lg:hidden bg-slate-950 border-b border-slate-800 p-4 space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.path}
                  to={item.path}
                  onClick={() => setSidebarOpen(false)}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold text-slate-300 hover:bg-slate-900"
                >
                  <Icon className="w-4 h-4" />
                  <span>{item.label}</span>
                </NavLink>
              );
            })}
          </div>
        )}

        {/* Admin Toast */}
        {adminToast && (
          <div className="fixed bottom-5 right-5 z-50 bg-slate-950 text-white px-4 py-3 rounded-2xl shadow-2xl border border-emerald-500/40 flex items-center gap-3 animate-in fade-in slide-in-from-bottom-3 duration-200">
            <div className="w-8 h-8 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center flex-shrink-0">
              <Radio className="w-4 h-4" />
            </div>
            <div>
              <div className="text-xs font-bold text-white">{adminToast.title}</div>
              <div className="text-[11px] text-slate-300">{adminToast.message}</div>
            </div>
          </div>
        )}

        {/* Body Container */}
        <main className="flex-1 p-4 sm:p-8 max-w-7xl w-full mx-auto overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
};
