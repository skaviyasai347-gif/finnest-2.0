// ==============================================================================
// FINNEST - Admin Overview Dashboard
// Digital Property & Land Parcel Management Platform
// ==============================================================================

import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { propertyService } from '../../services/propertyService';
import { userService } from '../../services/userService';
import { hardwareService, formatVerificationSource } from '../../services/hardwareService';
import { activityService } from '../../services/activityService';
import { taxService } from '../../services/taxService';
import { formatCurrency } from '../../utils/taxEngine';
import { Property, HardwareDevice, HardwareEvent, PropertyActivity, UserProfile } from '../../types/database.types';
import { ParcelMap } from '../../components/map/ParcelMap';
import { useRealtime } from '../../hooks/useRealtime';
import {
  Layers,
  Users,
  Maximize2,
  CheckCircle2,
  AlertCircle,
  Radio,
  Cpu,
  ArrowUpRight,
  Clock,
  ShieldCheck,
  Receipt,
  Sliders,
  Activity,
  Server,
  Database,
  Check,
} from 'lucide-react';

export const AdminOverviewPage: React.FC = () => {
  const navigate = useNavigate();

  const [properties, setProperties] = useState<Property[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [devices, setDevices] = useState<HardwareDevice[]>([]);
  const [recentEvents, setRecentEvents] = useState<HardwareEvent[]>([]);
  const [allEvents, setAllEvents] = useState<HardwareEvent[]>([]);
  const [activities, setActivities] = useState<PropertyActivity[]>([]);
  const [taxSummary, setTaxSummary] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(true);

  const loadData = async () => {
    try {
      setLoading(true);
      const [propsRes, usersRes, devsRes, eventsRes, actsRes, taxMetrics, allEvtsRes] = await Promise.all([
        propertyService.getProperties(),
        userService.getAllUsers(),
        hardwareService.getDevices(),
        hardwareService.getHardwareEvents(5),
        activityService.getActivity(6),
        taxService.getTaxSummaryMetrics(),
        hardwareService.getHardwareEvents(100),
      ]);

      setProperties(propsRes.data || []);
      setUsers(usersRes.data || []);
      setDevices(devsRes.data || []);
      setRecentEvents(eventsRes.data || []);
      setActivities(actsRes.data || []);
      setTaxSummary(taxMetrics || null);
      setAllEvents(allEvtsRes.data || []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  useRealtime({
    onPropertyChange: () => loadData(),
    onHardwareEvent: () => loadData(),
    onActivity: () => loadData(),
  });

  const activeCount = properties.filter(p => p.status === 'active').length;
  const verifiedOwnersCount = users.filter(u => u.is_verified).length;
  const onlineDevicesCount = devices.filter(d => d.status === 'online').length;

  // Count parcels that have at least one valid field verification event
  const fieldVerifiedParcelsCount = useMemo(() => {
    const verifiedPropertyIds = new Set(
      allEvents.filter(e => e.property_id).map(e => e.property_id)
    );
    return properties.filter(p => verifiedPropertyIds.has(p.id) || verifiedPropertyIds.has(p.property_id)).length;
  }, [properties, allEvents]);

  const latestEvent = recentEvents[0] || null;

  const renderSourcePill = (source?: string | null) => {
    const s = (source || 'hardware').toLowerCase();
    if (s === 'simulator') {
      return (
        <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-purple-500/10 text-purple-400 border border-purple-500/30">
          Simulator
        </span>
      );
    }
    if (s === 'manual') {
      return (
        <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/30">
          Manual
        </span>
      );
    }
    return (
      <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/30">
        Hardware
      </span>
    );
  };

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-white">
            System Administration Overview
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Master cadastral registry, title verification, municipal tax ledger, and field telemetry
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate('/admin/hardware')}
            className="px-3.5 py-2 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-bold hover:bg-emerald-500/20 transition-colors flex items-center gap-2"
          >
            <Cpu className="w-4 h-4" />
            <span>Field Verification Center</span>
          </button>
        </div>
      </div>

      {/* Primary Metrics Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Metric 1: Total Properties */}
        <div className="bg-slate-950 p-5 rounded-2xl border border-slate-800 shadow-sm">
          <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Total Properties</span>
          <div className="flex items-baseline justify-between mt-2">
            <span className="text-2xl sm:text-3xl font-bold text-white">{properties.length}</span>
            <div className="w-8 h-8 rounded-xl bg-slate-900 flex items-center justify-center text-slate-400">
              <Layers className="w-4 h-4" />
            </div>
          </div>
          <span className="text-[11px] text-emerald-400 mt-2 block font-medium">
            {activeCount} Active Titles Registered
          </span>
        </div>

        {/* Metric 2: Verified Owners */}
        <div className="bg-slate-950 p-5 rounded-2xl border border-slate-800 shadow-sm">
          <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Verified Owners</span>
          <div className="flex items-baseline justify-between mt-2">
            <span className="text-2xl sm:text-3xl font-bold text-white">{verifiedOwnersCount}</span>
            <div className="w-8 h-8 rounded-xl bg-slate-900 flex items-center justify-center text-slate-400">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <span className="text-[11px] text-slate-400 mt-2 block">
            Certified titleholders in registry
          </span>
        </div>

        {/* Metric 3: Field Verified Properties */}
        <div className="bg-slate-950 p-5 rounded-2xl border border-slate-800 shadow-sm">
          <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Field Verified Parcels</span>
          <div className="flex items-baseline justify-between mt-2">
            <span className="text-2xl sm:text-3xl font-bold text-emerald-400">
              {fieldVerifiedParcelsCount} <span className="text-sm text-slate-500 font-normal">/ {properties.length}</span>
            </span>
            <div className="w-8 h-8 rounded-xl bg-slate-900 flex items-center justify-center text-emerald-400">
              <ShieldCheck className="w-4 h-4" />
            </div>
          </div>
          <span className="text-[11px] text-emerald-400 mt-2 block font-medium">
            RFID + GPS Ground Certifications
          </span>
        </div>

        {/* Metric 4: Outstanding Tax */}
        <div className="bg-slate-950 p-5 rounded-2xl border border-slate-800 shadow-sm">
          <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Outstanding Tax</span>
          <div className="flex items-baseline justify-between mt-2">
            <span className="text-2xl sm:text-3xl font-bold text-amber-400">
              {taxSummary ? formatCurrency(taxSummary.totalOutstanding) : '₹0'}
            </span>
            <div className="w-8 h-8 rounded-xl bg-slate-900 flex items-center justify-center text-amber-400">
              <Receipt className="w-4 h-4" />
            </div>
          </div>
          <span className="text-[11px] text-slate-400 mt-2 block">
            {taxSummary?.unpaidCount || 0} Unpaid Municipal Assessments
          </span>
        </div>
      </div>

      {/* Cadastral Parcel Map Master View */}
      <div className="bg-slate-950 p-6 rounded-3xl border border-slate-800 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-base font-bold text-white">Master Cadastral Parcel Map</h2>
            <p className="text-xs text-slate-400">All registered land parcels with georeferenced polygon boundaries</p>
          </div>
          <button
            onClick={() => navigate('/admin/map')}
            className="text-xs font-bold text-emerald-400 hover:text-emerald-300 flex items-center gap-1"
          >
            <span>Fullscreen Map</span>
            <ArrowUpRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="h-[460px] rounded-2xl overflow-hidden border border-slate-800">
          <ParcelMap
            properties={properties}
            devices={devices}
            heightClass="h-[460px]"
            showFilters={true}
            basePortalPath="/admin"
          />
        </div>
      </div>

      {/* Three Panel Section: Field Verification, System Health, and Audit Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Panel 1: Field Verification Summary */}
        <div className="bg-slate-950 p-6 rounded-3xl border border-slate-800 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Radio className="w-4 h-4 text-emerald-400" />
                <h2 className="text-base font-bold text-white">Field Verification</h2>
              </div>
              <button
                onClick={() => navigate('/admin/hardware')}
                className="text-xs font-bold text-emerald-400 hover:text-emerald-300 flex items-center gap-1"
              >
                <span>Console</span>
                <ArrowUpRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Hardware / Simulator State */}
            <div className="p-3 bg-slate-900 rounded-xl border border-slate-800 space-y-2 mb-4">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400">Physical Hardware</span>
                {onlineDevicesCount > 0 ? (
                  <span className="flex items-center gap-1 font-semibold text-emerald-400">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                    Online ({onlineDevicesCount})
                  </span>
                ) : (
                  <span className="flex items-center gap-1 font-semibold text-slate-400">
                    <span className="w-1.5 h-1.5 rounded-full bg-slate-500"></span>
                    Currently Offline
                  </span>
                )}
              </div>

              <div className="flex items-center justify-between text-xs pt-2 border-t border-slate-800/80">
                <span className="text-slate-400">Verification Simulator</span>
                <span className="flex items-center gap-1 font-semibold text-purple-400">
                  <span className="w-1.5 h-1.5 rounded-full bg-purple-400"></span>
                  Ready / Operational
                </span>
              </div>
            </div>

            {/* Latest Verification */}
            {latestEvent ? (
              <div className="bg-slate-900/60 p-3.5 rounded-xl border border-slate-800 text-xs">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[10px] uppercase font-bold text-slate-400">Last Verified</span>
                  {renderSourcePill(latestEvent.verification_source)}
                </div>
                <p className="font-bold text-white">
                  {latestEvent.property ? latestEvent.property.title : 'Unassigned Survey Point'}
                </p>
                <div className="flex items-center justify-between text-[11px] text-slate-400 mt-2 pt-2 border-t border-slate-800/60 font-mono">
                  <span>RFID: {latestEvent.rfid_uid || 'N/A'}</span>
                  <span>{new Date(latestEvent.created_at).toLocaleTimeString()}</span>
                </div>
              </div>
            ) : (
              <div className="py-6 text-center text-xs text-slate-500">
                No verification packets received yet.
              </div>
            )}
          </div>

          <div className="pt-4 mt-4 border-t border-slate-800 text-xs text-slate-400 flex items-center justify-between">
            <span>Ingestion Endpoint:</span>
            <code className="font-mono text-[10px] text-emerald-400 bg-slate-900 px-2 py-0.5 rounded border border-slate-800">
              POST /functions/v1/hardware-event
            </code>
          </div>
        </div>

        {/* Panel 2: System Health */}
        <div className="bg-slate-950 p-6 rounded-3xl border border-slate-800 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Server className="w-4 h-4 text-emerald-400" />
              <h2 className="text-base font-bold text-white">System Health</h2>
            </div>
            <p className="text-xs text-slate-400 mb-4">Continuous operational telemetry of all core modules</p>

            <div className="space-y-2 text-xs">
              <div className="flex items-center justify-between p-2.5 bg-slate-900 rounded-xl border border-slate-800">
                <span className="text-slate-300 font-medium">Web Application</span>
                <span className="flex items-center gap-1.5 text-emerald-400 font-bold text-[11px]">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                  Operational
                </span>
              </div>

              <div className="flex items-center justify-between p-2.5 bg-slate-900 rounded-xl border border-slate-800">
                <span className="text-slate-300 font-medium">Supabase Database</span>
                <span className="flex items-center gap-1.5 text-emerald-400 font-bold text-[11px]">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                  Connected
                </span>
              </div>

              <div className="flex items-center justify-between p-2.5 bg-slate-900 rounded-xl border border-slate-800">
                <span className="text-slate-300 font-medium">Realtime WebSocket</span>
                <span className="flex items-center gap-1.5 text-emerald-400 font-bold text-[11px]">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                  Connected
                </span>
              </div>

              <div className="flex items-center justify-between p-2.5 bg-slate-900 rounded-xl border border-slate-800">
                <span className="text-slate-300 font-medium">Cadastral GIS Engine</span>
                <span className="flex items-center gap-1.5 text-emerald-400 font-bold text-[11px]">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                  Operational
                </span>
              </div>

              <div className="flex items-center justify-between p-2.5 bg-slate-900 rounded-xl border border-slate-800">
                <span className="text-slate-300 font-medium">Tax Assessment Module</span>
                <span className="flex items-center gap-1.5 text-emerald-400 font-bold text-[11px]">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                  Operational
                </span>
              </div>

              <div className="flex items-center justify-between p-2.5 bg-slate-900 rounded-xl border border-slate-800">
                <span className="text-slate-300 font-medium">Physical Field Nodes</span>
                {onlineDevicesCount > 0 ? (
                  <span className="flex items-center gap-1.5 text-emerald-400 font-bold text-[11px]">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                    Online ({onlineDevicesCount})
                  </span>
                ) : (
                  <span className="flex items-center gap-1.5 text-slate-400 font-semibold text-[11px]">
                    <span className="w-1.5 h-1.5 rounded-full bg-slate-500"></span>
                    Offline (Simulator Ready)
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="pt-4 mt-4 border-t border-slate-800 text-[11px] text-slate-500">
            Note: Offline hardware does not degrade core platform functions.
          </div>
        </div>

        {/* Panel 3: Recent Audit Activity */}
        <div className="bg-slate-950 p-6 rounded-3xl border border-slate-800 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-base font-bold text-white">System Audit Log</h2>
                <p className="text-xs text-slate-400">Immutable title, tax, and verification ledger</p>
              </div>
              <button
                onClick={() => navigate('/admin/activity')}
                className="text-xs font-bold text-emerald-400 hover:text-emerald-300 flex items-center gap-1"
              >
                <span>Full Audit</span>
                <ArrowUpRight className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="space-y-3">
              {activities.length > 0 ? (
                activities.slice(0, 4).map(act => (
                  <div key={act.id} className="text-xs flex items-start gap-2.5">
                    <div className="w-6 h-6 rounded-lg bg-slate-900 flex items-center justify-center text-slate-400 flex-shrink-0 mt-0.5">
                      <Clock className="w-3 h-3" />
                    </div>
                    <div className="flex-1">
                      <p className="text-slate-300 font-medium leading-snug">{act.description}</p>
                      <span className="text-[10px] text-slate-500 font-mono block mt-0.5">
                        {new Date(act.created_at).toLocaleString()}
                      </span>
                    </div>
                  </div>
                ))
              ) : (
                <div className="py-8 text-center text-slate-500 text-xs">
                  No audit entries recorded.
                </div>
              )}
            </div>
          </div>

          <div className="pt-4 mt-4 border-t border-slate-800 text-xs text-slate-400">
            Audit logging: active and immutable
          </div>
        </div>
      </div>
    </div>
  );
};
