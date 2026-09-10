// ==============================================================================
// FINNEST - User Profile Page
// Digital Property & Land Parcel Management Platform
// ==============================================================================

import React from 'react';
import { useAuth } from '../../features/auth/AuthContext';
import { Mail, Phone, ShieldCheck, Building2 } from 'lucide-react';

export const UserProfilePage: React.FC = () => {
  const { user } = useAuth();

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <div>
        <h1 className="text-xl font-bold tracking-tight text-slate-900">
          User Legal Profile
        </h1>
        <p className="text-xs text-slate-500 mt-0.5">
          Verified cadastral title-holder identity credentials
        </p>
      </div>

      <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/80 shadow-xs">
        <div className="flex items-center gap-5 pb-6 border-b border-slate-100">
          <img
            src={user?.avatar_url || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200&auto=format&fit=crop&q=80'}
            alt={user?.full_name}
            className="w-16 h-16 rounded-2xl object-cover border-2 border-slate-200 shadow-sm"
          />
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded border border-emerald-200">
              Verified Titleholder ({user?.role || 'user'})
            </span>
            <h2 className="text-lg font-bold text-slate-900 mt-1">{user?.full_name}</h2>
            <p className="text-xs font-mono text-slate-400">UUID: {user?.id}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 my-6">
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100 flex items-start gap-3">
            <Mail className="w-4 h-4 text-slate-400 flex-shrink-0 mt-0.5" />
            <div>
              <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">Email Address</span>
              <span className="text-xs font-semibold text-slate-800 mt-0.5 block">{user?.email}</span>
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100 flex items-start gap-3">
            <Phone className="w-4 h-4 text-slate-400 flex-shrink-0 mt-0.5" />
            <div>
              <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">Phone Contact</span>
              <span className="text-xs font-semibold text-slate-800 mt-0.5 block">{user?.phone || '+91 98401 00000'}</span>
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100 flex items-start gap-3">
            <ShieldCheck className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
            <div>
              <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">KYC Status</span>
              <span className="text-xs font-bold text-emerald-700 mt-0.5 block">Legally Verified Title</span>
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100 flex items-start gap-3">
            <Building2 className="w-4 h-4 text-indigo-600 flex-shrink-0 mt-0.5" />
            <div>
              <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">Jurisdiction</span>
              <span className="text-xs font-semibold text-slate-800 mt-0.5 block">Tamil Nadu Cadastre Division</span>
            </div>
          </div>
        </div>

        <div className="pt-4 border-t border-slate-100 text-xs text-slate-500">
          Account registered on: {user?.created_at ? new Date(user.created_at).toLocaleDateString() : 'N/A'}
        </div>
      </div>
    </div>
  );
};
