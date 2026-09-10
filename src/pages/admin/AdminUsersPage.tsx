// ==============================================================================
// FINNEST - Admin Users & Titleholder Management
// Digital Property & Land Parcel Management Platform
// ==============================================================================

import React, { useState, useEffect } from 'react';
import { userService } from '../../services/userService';
import { propertyService } from '../../services/propertyService';
import { authService } from '../../services/authService';
import { useAuth } from '../../features/auth/AuthContext';
import { UserProfile, Property } from '../../types/database.types';
import {
  Users,
  Mail,
  Phone,
  Building,
  ShieldCheck,
  Shield,
  ExternalLink,
  Search,
  CheckCircle2,
  UserPlus,
  ArrowLeftRight,
  X,
  AlertCircle,
  FileCheck,
  BadgeCheck,
  Lock,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export const AdminUsersPage: React.FC = () => {
  const { user: currentAdmin } = useAuth();
  const navigate = useNavigate();

  const [users, setUsers] = useState<(UserProfile & { propertiesCount?: number })[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Modal States
  const [assignModalOpen, setAssignModalOpen] = useState<boolean>(false);
  const [selectedUserForAssign, setSelectedUserForAssign] = useState<UserProfile | null>(null);
  const [selectedPropertyId, setSelectedPropertyId] = useState<string>('');
  const [assignReason, setAssignReason] = useState<string>('Administrative Titleholder Registration');
  const [assigning, setAssigning] = useState<boolean>(false);

  // Register New Owner Modal
  const [createModalOpen, setCreateModalOpen] = useState<boolean>(false);
  const [newName, setNewName] = useState<string>('');
  const [newEmail, setNewEmail] = useState<string>('');
  const [newPhone, setNewPhone] = useState<string>('');
  const [newPassword, setNewPassword] = useState<string>('OwnerPass@2026');
  const [creating, setCreating] = useState<boolean>(false);

  const loadData = async () => {
    setLoading(true);
    const [uRes, pRes] = await Promise.all([
      userService.getAllUsers(),
      propertyService.getProperties(),
    ]);
    setUsers(uRes.data || []);
    setProperties(pRes.data || []);
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  const filteredUsers = users.filter(u =>
    u.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    u.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (u.phone && u.phone.includes(searchQuery))
  );

  const handleVerifyOwner = async (targetUser: UserProfile) => {
    try {
      const res = await userService.verifyOwner(targetUser.id, currentAdmin?.id);
      if (res.success) {
        setNotification({
          type: 'success',
          message: `Official titleholder KYC verification approved for ${targetUser.full_name}.`,
        });
        loadData();
      } else {
        setNotification({
          type: 'error',
          message: res.error || 'Failed to verify titleholder',
        });
      }
    } catch (err: any) {
      setNotification({ type: 'error', message: err.message });
    }
  };

  const handleOpenAssignModal = (targetUser: UserProfile) => {
    setSelectedUserForAssign(targetUser);
    if (properties.length > 0) {
      setSelectedPropertyId(properties[0].id);
    }
    setAssignReason('Administrative Titleholder Assignment');
    setAssignModalOpen(true);
  };

  const handleExecuteAssign = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUserForAssign || !selectedPropertyId) return;

    setAssigning(true);
    const res = await userService.assignParcelToOwner(
      selectedPropertyId,
      selectedUserForAssign.id,
      assignReason,
      currentAdmin?.id
    );
    setAssigning(false);

    if (res.success) {
      const matchedProp = properties.find(p => p.id === selectedPropertyId);
      setNotification({
        type: 'success',
        message: `Parcel ${matchedProp?.property_id || ''} successfully assigned to ${selectedUserForAssign.full_name}. Ownership history recorded.`,
      });
      setAssignModalOpen(false);
      loadData();
    } else {
      setNotification({
        type: 'error',
        message: res.error || 'Failed to assign parcel to user',
      });
    }
  };

  const handleCreateOwner = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim() || !newEmail.trim() || !newPassword.trim()) return;

    setCreating(true);
    const res = await authService.signUp(newEmail.trim(), newPassword, newName.trim(), newPhone.trim());
    setCreating(false);

    if (res.profile) {
      setNotification({
        type: 'success',
        message: `Titleholder account for ${newName} created successfully.`,
      });
      setCreateModalOpen(false);
      setNewName('');
      setNewEmail('');
      setNewPhone('');
      loadData();
    } else {
      setNotification({
        type: 'error',
        message: res.error || 'Failed to register account',
      });
    }
  };

  return (
    <div className="space-y-6">
      {/* Notification Toast */}
      {notification && (
        <div
          className={`p-4 rounded-2xl text-xs flex items-center justify-between border ${
            notification.type === 'success'
              ? 'bg-emerald-950/60 border-emerald-800/60 text-emerald-300'
              : 'bg-red-950/60 border-red-800/60 text-red-300'
          }`}
        >
          <div className="flex items-center gap-2">
            {notification.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
            )}
            <span>{notification.message}</span>
          </div>
          <button onClick={() => setNotification(null)} className="text-slate-400 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-white">
            Registered Titleholders & System Users
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Directory of legal titleholders, cadastral profiles, parcel assignments, and verification credentials
          </p>
        </div>

        <button
          onClick={() => setCreateModalOpen(true)}
          className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold rounded-xl flex items-center gap-2 transition-all shadow-md shadow-emerald-500/20 self-start sm:self-auto"
        >
          <UserPlus className="w-4 h-4" />
          <span>Register Titleholder</span>
        </button>
      </div>

      {/* Search Bar */}
      <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 shadow-sm flex items-center justify-between">
        <div className="relative w-full max-w-sm">
          <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
          <input
            type="text"
            placeholder="Search users by name, email, or phone..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-10 pr-3.5 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
          />
        </div>
        <div className="text-xs text-slate-400 font-semibold">
          {filteredUsers.length} Users Registered
        </div>
      </div>

      {/* Users Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {filteredUsers.map((u) => {
          const userProps = properties.filter(p => p.owner_id === u.id);
          const isVerified = u.is_verified || u.role === 'admin';
          const isOwnerAssigned = userProps.length > 0;

          return (
            <div
              key={u.id}
              className="bg-slate-950 rounded-2xl p-5 border border-slate-800 shadow-sm flex flex-col justify-between"
            >
              <div>
                <div className="flex items-start justify-between gap-3 mb-4">
                  <div className="flex items-center gap-3">
                    <img
                      src={u.avatar_url || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=120&auto=format&fit=crop&q=80'}
                      alt={u.full_name}
                      className="w-12 h-12 rounded-xl object-cover border border-slate-700"
                    />
                    <div>
                      <h3 className="font-bold text-white text-sm">{u.full_name}</h3>
                      <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                        {/* Role Badge */}
                        <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full inline-block ${
                          u.role === 'admin'
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                            : 'bg-slate-800 text-slate-300'
                        }`}>
                          {u.role === 'admin' ? 'Administrator' : 'User'}
                        </span>

                        {/* Owner Status Badge */}
                        {u.role !== 'admin' && (
                          isVerified ? (
                            <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full inline-flex items-center gap-1 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                              <BadgeCheck className="w-3 h-3" />
                              Owner Verified
                            </span>
                          ) : isOwnerAssigned ? (
                            <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full inline-flex items-center gap-1 bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                              <Building className="w-3 h-3" />
                              Owner Assigned
                            </span>
                          ) : (
                            <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full inline-block bg-slate-800/80 text-slate-400">
                              Registered User
                            </span>
                          )
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-2 text-xs text-slate-400 pt-2 border-t border-slate-800/80">
                  <div className="flex items-center gap-2">
                    <Mail className="w-3.5 h-3.5 text-slate-500 flex-shrink-0" />
                    <span className="truncate">{u.email}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Phone className="w-3.5 h-3.5 text-slate-500 flex-shrink-0" />
                    <span>{u.phone || 'No phone registered'}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Building className="w-3.5 h-3.5 text-slate-500 flex-shrink-0" />
                    <span className="font-semibold text-white">
                      {userProps.length} Assigned {userProps.length === 1 ? 'Parcel' : 'Parcels'}
                    </span>
                  </div>
                </div>

                {userProps.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-slate-800/60">
                    <span className="text-[10px] font-bold uppercase text-slate-500 tracking-wider block mb-1.5">
                      Registered Parcels
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {userProps.map(p => (
                        <button
                          key={p.id}
                          onClick={() => navigate(`/portal/properties/${p.id}`)}
                          className="font-mono text-[10px] bg-slate-900 hover:bg-slate-800 border border-slate-800 text-emerald-400 px-2 py-0.5 rounded transition-colors"
                          title={p.title}
                        >
                          {p.property_id}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Administrative Actions */}
              <div className="mt-4 pt-3 border-t border-slate-800/60 space-y-2">
                {u.role !== 'admin' && (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleOpenAssignModal(u)}
                      className="flex-1 py-1.5 px-3 bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-800 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors"
                    >
                      <ArrowLeftRight className="w-3.5 h-3.5 text-indigo-400" />
                      <span>Assign Parcel</span>
                    </button>

                    {!isVerified && (
                      <button
                        onClick={() => handleVerifyOwner(u)}
                        className="py-1.5 px-3 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-colors"
                        title="Mark KYC & Titleholder identity officially verified"
                      >
                        <ShieldCheck className="w-3.5 h-3.5" />
                        <span>Verify</span>
                      </button>
                    )}
                  </div>
                )}

                <div className="text-[11px] text-slate-500 flex items-center justify-between pt-1">
                  <span>Joined {new Date(u.created_at).toLocaleDateString()}</span>
                  <span className="font-mono text-[10px] text-slate-600">ID: {u.id.substring(0, 8)}...</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Modal 1: Assign Parcel to Owner */}
      {assignModalOpen && selectedUserForAssign && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-slate-950 border border-slate-800 rounded-3xl w-full max-w-lg p-6 shadow-2xl text-slate-100 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <div>
                <h2 className="text-base font-bold text-white">
                  Assign Parcel to Titleholder
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Associate a cadastral land parcel with {selectedUserForAssign.full_name}
                </p>
              </div>
              <button
                onClick={() => setAssignModalOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleExecuteAssign} className="space-y-4 mt-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Select Cadastral Parcel
                </label>
                <select
                  value={selectedPropertyId}
                  onChange={e => setSelectedPropertyId(e.target.value)}
                  required
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                >
                  {properties.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.property_id} &bull; {p.title} (Current Owner: {p.owner?.full_name || 'Unassigned'})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Legal Assignment Reason / Deed Reference
                </label>
                <input
                  type="text"
                  required
                  value={assignReason}
                  onChange={e => setAssignReason(e.target.value)}
                  placeholder="e.g. Registered Title Assignment per DTCP Sanction"
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="p-3 bg-slate-900/80 rounded-xl border border-slate-800/80 text-[11px] text-slate-400">
                <span className="font-bold text-slate-300 block mb-0.5">Audit Trail Note:</span>
                This assignment will update the property record, register an immutable row in <code className="text-emerald-400">ownership_history</code>, and log an activity record.
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setAssignModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={assigning}
                  className="px-5 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs rounded-xl transition-all shadow-md shadow-emerald-500/20 disabled:opacity-50"
                >
                  {assigning ? 'Assigning...' : 'Confirm Parcel Assignment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal 2: Register New Owner Account */}
      {createModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-slate-950 border border-slate-800 rounded-3xl w-full max-w-lg p-6 shadow-2xl text-slate-100 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <div>
                <h2 className="text-base font-bold text-white">
                  Register New Titleholder Account
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Create a new verified titleholder profile in the cadastral directory
                </p>
              </div>
              <button
                onClick={() => setCreateModalOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateOwner} className="space-y-4 mt-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Full Legal Name
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Ramesh V. Sundaram"
                  value={newName}
                  onChange={e => setNewName(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Official Email Address
                </label>
                <input
                  type="email"
                  required
                  placeholder="e.g. ramesh@example.com"
                  value={newEmail}
                  onChange={e => setNewEmail(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Contact Phone
                </label>
                <input
                  type="tel"
                  placeholder="+91 98400 00000"
                  value={newPhone}
                  onChange={e => setNewPhone(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Initial Account Password
                </label>
                <input
                  type="password"
                  required
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setCreateModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="px-5 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs rounded-xl transition-all shadow-md shadow-emerald-500/20 disabled:opacity-50"
                >
                  {creating ? 'Creating Account...' : 'Register Titleholder'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
