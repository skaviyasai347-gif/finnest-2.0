// ==============================================================================
// FINNEST - Admin Digital Ownership Transfer Portal
// Digital Property & Land Parcel Management Platform
// ==============================================================================

import React, { useState, useEffect } from 'react';
import { useAuth } from '../../features/auth/AuthContext';
import { propertyService } from '../../services/propertyService';
import { userService } from '../../services/userService';
import { ownershipService } from '../../services/ownershipService';
import { Property, UserProfile, OwnershipHistory } from '../../types/database.types';
import { useRealtime } from '../../hooks/useRealtime';
import {
  ArrowLeftRight,
  ShieldCheck,
  Building,
  User,
  FileCheck,
  CheckCircle2,
  AlertCircle,
  Clock,
} from 'lucide-react';

export const AdminOwnershipPage: React.FC = () => {
  const { user } = useAuth();

  const [properties, setProperties] = useState<Property[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [history, setHistory] = useState<OwnershipHistory[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Form State
  const [selectedPropertyId, setSelectedPropertyId] = useState<string>('');
  const [newOwnerId, setNewOwnerId] = useState<string>('');
  const [transferReason, setTransferReason] = useState<string>('');
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const loadData = async () => {
    try {
      setLoading(true);
      const [propsRes, usersRes, histRes] = await Promise.all([
        propertyService.getProperties(),
        userService.getAllUsers(),
        ownershipService.getOwnershipHistory(),
      ]);
      setProperties(propsRes.data || []);
      setUsers(usersRes.data || []);
      setHistory(histRes.data || []);

      if (propsRes.data && propsRes.data.length > 0 && !selectedPropertyId) {
        setSelectedPropertyId(propsRes.data[0].id);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  useRealtime({
    onOwnershipTransfer: () => loadData(),
    onPropertyChange: () => loadData(),
  });

  const selectedProperty = properties.find(p => p.id === selectedPropertyId);
  const currentOwner = users.find(u => u.id === selectedProperty?.owner_id);

  const handleTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPropertyId || !newOwnerId || !transferReason.trim()) {
      setStatusMessage({ type: 'error', text: 'Please fill in all transfer requirements.' });
      return;
    }

    if (currentOwner?.id === newOwnerId) {
      setStatusMessage({ type: 'error', text: 'Selected new owner is already the registered titleholder.' });
      return;
    }

    setSubmitting(true);
    setStatusMessage(null);

    const res = await ownershipService.transferOwnership(
      selectedPropertyId,
      newOwnerId,
      transferReason.trim(),
      user?.id
    );

    setSubmitting(false);

    if (res.success) {
      setStatusMessage({
        type: 'success',
        text: `Ownership for parcel ${selectedProperty?.property_id} successfully transferred! Historical record generated.`,
      });
      setTransferReason('');
      loadData();
    } else {
      setStatusMessage({
        type: 'error',
        text: res.error || 'Failed to complete ownership transfer',
      });
    }
  };

  return (
    <div className="space-y-8 max-w-5xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold tracking-tight text-white">
          Digital Ownership Transfer Engine
        </h1>
        <p className="text-xs text-slate-400 mt-0.5">
          Execute legally binding digital title reassignments with automatic audit chronicle generation
        </p>
      </div>

      {statusMessage && (
        <div
          className={`p-4 rounded-2xl text-xs flex items-center gap-3 border ${
            statusMessage.type === 'success'
              ? 'bg-emerald-950/60 border-emerald-800/60 text-emerald-300'
              : 'bg-red-950/60 border-red-800/60 text-red-300'
          }`}
        >
          {statusMessage.type === 'success' ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0" />
          ) : (
            <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0" />
          )}
          <span>{statusMessage.text}</span>
        </div>
      )}

      {/* Transfer Execution Card */}
      <div className="bg-slate-950 rounded-3xl p-6 sm:p-8 border border-slate-800 shadow-sm">
        <h2 className="text-base font-bold text-white mb-1">Execute Title Transfer</h2>
        <p className="text-xs text-slate-400 mb-6">
          Title reassignments update the cadastral registry and immediately sync between user portals in realtime.
        </p>

        <form onSubmit={handleTransfer} className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {/* Step 1: Select Property */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                1. Select Cadastral Parcel
              </label>
              <select
                value={selectedPropertyId}
                onChange={e => setSelectedPropertyId(e.target.value)}
                className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:border-emerald-500"
              >
                {properties.map(p => (
                  <option key={p.id} value={p.id}>
                    {p.property_id} &bull; {p.title} ({p.survey_number})
                  </option>
                ))}
              </select>

              {/* Current Titleholder Info Card */}
              {selectedProperty && (
                <div className="mt-3 p-3.5 bg-slate-900/90 rounded-2xl border border-slate-800/80 text-xs">
                  <div className="text-[10px] uppercase font-bold text-slate-500 tracking-wider mb-1">
                    Current Registered Titleholder
                  </div>
                  <div className="flex items-center gap-2">
                    <User className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                    <div>
                      <span className="font-bold text-white block">
                        {currentOwner?.full_name || 'Cadastral Land Bank'}
                      </span>
                      <span className="text-[11px] text-slate-400 font-mono">
                        {currentOwner?.email || 'unassigned@finnest.io'}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Step 2: Select New Owner */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                2. Select New Titleholder (Assignee)
              </label>
              <select
                value={newOwnerId}
                onChange={e => setNewOwnerId(e.target.value)}
                required
                className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:border-emerald-500"
              >
                <option value="">-- Choose Registered User --</option>
                {users.map(u => (
                  <option key={u.id} value={u.id}>
                    {u.full_name} &bull; {u.email}
                  </option>
                ))}
              </select>

              {/* Step 3: Reason */}
              <div className="mt-3">
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  3. Legal Ground / Deed Document Reference
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Registered Sale Deed Doc No. 4088/2024"
                  value={transferReason}
                  onChange={e => setTransferReason(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                />
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-slate-800 flex items-center justify-end">
            <button
              type="submit"
              disabled={submitting}
              className="px-6 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs rounded-xl flex items-center gap-2 transition-all shadow-md shadow-emerald-500/20 disabled:opacity-50"
            >
              {submitting ? (
                <span>Executing Digital Title Transfer...</span>
              ) : (
                <>
                  <ArrowLeftRight className="w-4 h-4" />
                  <span>Execute Digital Ownership Transfer</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>

      {/* Historical Ownership Transfer Chain */}
      <div className="bg-slate-950 rounded-3xl p-6 sm:p-8 border border-slate-800 shadow-sm">
        <h2 className="text-base font-bold text-white mb-1">Chain of Title Audit History</h2>
        <p className="text-xs text-slate-400 mb-6">
          Every ownership transfer creates an immutable historical record
        </p>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-900/80 text-[11px] uppercase font-bold text-slate-400 tracking-wider border-b border-slate-800">
              <tr>
                <th className="py-3 px-4">Date / Time</th>
                <th className="py-3 px-4">Parcel ID</th>
                <th className="py-3 px-4">Previous Titleholder</th>
                <th className="py-3 px-4">New Titleholder</th>
                <th className="py-3 px-4">Legal Ground / Reason</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {history.length > 0 ? (
                history.map((h) => (
                  <tr key={h.id} className="hover:bg-slate-900/50 transition-colors">
                    <td className="py-3 px-4 whitespace-nowrap font-mono text-slate-400">
                      {new Date(h.changed_at).toLocaleString()}
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap font-mono font-bold text-white">
                      {h.property?.property_id || 'FN-PARCEL'}
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      <span className="font-semibold text-slate-300">
                        {h.previous_owner?.full_name || 'Original Assignee'}
                      </span>
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      <span className="font-semibold text-emerald-400">
                        {h.new_owner?.full_name || 'Unassigned'}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-slate-400 max-w-sm truncate">
                      {h.reason}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-slate-500">
                    No historical transfer records logged yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
