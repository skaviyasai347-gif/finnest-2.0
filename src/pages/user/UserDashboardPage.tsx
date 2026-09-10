// ==============================================================================
// FINNEST - User Dashboard Page
// Digital Property & Land Parcel Management Platform
// ==============================================================================

import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../features/auth/AuthContext';
import { propertyService } from '../../services/propertyService';
import { activityService } from '../../services/activityService';
import { hardwareService } from '../../services/hardwareService';
import { Property, PropertyActivity, HardwareEvent, HardwareDevice } from '../../types/database.types';
import { STATUS_COLORS } from '../../lib/constants';
import { ParcelMap } from '../../components/map/ParcelMap';
import { useRealtime } from '../../hooks/useRealtime';
import {
  Layers,
  MapPin,
  Clock,
  ArrowUpRight,
  ShieldCheck,
  Radio,
  CheckCircle2,
  AlertCircle,
  Maximize2,
  Building,
} from 'lucide-react';

export const UserDashboardPage: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [properties, setProperties] = useState<Property[]>([]);
  const [activities, setActivities] = useState<PropertyActivity[]>([]);
  const [devices, setDevices] = useState<HardwareDevice[]>([]);
  const [latestHardwareEvent, setLatestHardwareEvent] = useState<HardwareEvent | null>(null);

  const loadData = async () => {
    const { data: props } = await propertyService.getProperties({ owner_id: user?.id });
    setProperties(props || []);

    const { data: acts } = await activityService.getActivity(10);
    setActivities(acts || []);

    const { data: devs } = await hardwareService.getDevices();
    setDevices(devs || []);

    const { data: events } = await hardwareService.getHardwareEvents(1);
    if (events && events.length > 0) {
      setLatestHardwareEvent(events[0]);
    }
  };

  useEffect(() => {
    loadData();
  }, [user?.id]);

  // Realtime subscription: updates dashboard when admin transfers or edits properties
  useRealtime({
    onPropertyChange: () => loadData(),
    onHardwareEvent: (ev) => {
      setLatestHardwareEvent(ev);
      loadData();
    },
    onActivity: () => loadData(),
  });

  // Calculate metrics
  const totalParcels = properties.length;
  const activeCount = properties.filter(p => p.status === 'active').length;
  const pendingCount = properties.filter(p => p.status === 'pending' || p.status === 'disputed').length;

  const totalAreaSqFt = useMemo(() => {
    return properties.reduce((acc, p) => {
      if (p.area_unit === 'acres') return acc + p.area * 43560;
      return acc + Number(p.area);
    }, 0);
  }, [properties]);

  return (
    <div className="space-y-6">
      {/* Welcome Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 rounded-3xl p-6 sm:p-8 text-white shadow-lg border border-slate-800 relative overflow-hidden">
        <div className="relative z-10 max-w-2xl">
          <span className="text-[11px] font-bold text-emerald-400 uppercase tracking-wider bg-emerald-500/10 px-2.5 py-1 rounded-full border border-emerald-500/20">
            Cadastral Asset Dossier
          </span>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white mt-2">
            Welcome, {user?.full_name}
          </h1>
          <p className="mt-1 text-xs sm:text-sm text-slate-300 font-normal leading-relaxed">
            Monitor registered land parcels, inspect GeoJSON boundary vectors, track digital ownership transfers, and review physical RFID/GPS boundary verifications.
          </p>
        </div>

        {/* Ambient background glow */}
        <div className="absolute top-0 right-0 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none"></div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Assigned Parcels</span>
          <div className="flex items-baseline justify-between mt-2">
            <span className="text-2xl sm:text-3xl font-bold text-slate-900">{totalParcels}</span>
            <div className="w-8 h-8 rounded-xl bg-slate-100 flex items-center justify-center text-slate-600">
              <Layers className="w-4 h-4" />
            </div>
          </div>
          <span className="text-[11px] text-slate-500 mt-2 block">
            {totalParcels === 0 ? 'No parcels registered' : 'Under active title'}
          </span>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Total Land Area</span>
          <div className="flex items-baseline justify-between mt-2">
            <span className="text-2xl sm:text-3xl font-bold text-slate-900">
              {totalAreaSqFt.toLocaleString()}
            </span>
            <div className="w-8 h-8 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600">
              <Maximize2 className="w-4 h-4" />
            </div>
          </div>
          <span className="text-[11px] text-slate-500 mt-2 block">
            sq.ft (~{(totalAreaSqFt / 43560).toFixed(2)} acres)
          </span>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Active Title</span>
          <div className="flex items-baseline justify-between mt-2">
            <span className="text-2xl sm:text-3xl font-bold text-emerald-600">{activeCount}</span>
            <div className="w-8 h-8 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <span className="text-[11px] text-slate-500 mt-2 block">
            Fully verified & clear title
          </span>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Pending / Review</span>
          <div className="flex items-baseline justify-between mt-2">
            <span className="text-2xl sm:text-3xl font-bold text-amber-600">{pendingCount}</span>
            <div className="w-8 h-8 rounded-xl bg-amber-50 flex items-center justify-center text-amber-600">
              <AlertCircle className="w-4 h-4" />
            </div>
          </div>
          <span className="text-[11px] text-slate-500 mt-2 block">
            Awaiting survey or documentation
          </span>
        </div>
      </div>

      {/* Cadastral Map Preview & Last Verification Highlight */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Map View */}
        <div className="lg:col-span-2 bg-white p-5 rounded-3xl border border-slate-200/80 shadow-xs flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-base font-bold text-slate-900">Cadastral Parcel Map</h2>
              <p className="text-xs text-slate-500">True polygon boundaries of your assigned land parcels</p>
            </div>
            <button
              onClick={() => navigate('/portal/map')}
              className="text-xs font-bold text-emerald-700 hover:text-emerald-800 flex items-center gap-1"
            >
              <span>Fullscreen Map</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="flex-1 min-h-[380px] rounded-2xl overflow-hidden border border-slate-100">
            <ParcelMap
              properties={properties}
              devices={devices}
              heightClass="h-[380px]"
              showFilters={false}
              basePortalPath="/portal"
            />
          </div>
        </div>

        {/* Latest Verification & Hardware Info */}
        <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-bold text-slate-900">Last Verification</h2>
              <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-[10px] font-bold border border-emerald-200">
                <Radio className="w-3 h-3 text-emerald-600" />
                Live Feed
              </span>
            </div>

            {latestHardwareEvent ? (
              <div className="space-y-4">
                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100">
                  <div className="flex items-center justify-between text-xs mb-2">
                    <span className="text-slate-400 font-semibold uppercase tracking-wider text-[10px]">Scanned Tag UID</span>
                    <span className="font-mono font-bold text-slate-800 bg-white px-2 py-0.5 rounded-md border border-slate-200">
                      {latestHardwareEvent.rfid_uid || 'N/A'}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-xs mb-2">
                    <span className="text-slate-400 font-semibold uppercase tracking-wider text-[10px]">Survey Device</span>
                    <span className="font-semibold text-slate-700">
                      {latestHardwareEvent.device_id}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-xs mb-2">
                    <span className="text-slate-400 font-semibold uppercase tracking-wider text-[10px]">Timestamp</span>
                    <span className="text-slate-600 text-[11px]">
                      {new Date(latestHardwareEvent.created_at).toLocaleString()}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-400 font-semibold uppercase tracking-wider text-[10px]">GPS Coordinates</span>
                    <span className="font-mono text-slate-600 text-[11px]">
                      {latestHardwareEvent.latitude?.toFixed(4)}, {latestHardwareEvent.longitude?.toFixed(4)}
                    </span>
                  </div>
                </div>

                <div className="p-3.5 rounded-2xl bg-emerald-50/70 border border-emerald-100 text-xs text-emerald-900 flex items-start gap-2.5">
                  <ShieldCheck className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
                  <p className="leading-snug">
                    Boundary marker scanned and authenticated via field sensor telemetry.
                  </p>
                </div>
              </div>
            ) : (
              <div className="p-8 text-center text-slate-400 text-xs">
                <Radio className="w-8 h-8 text-slate-300 mx-auto mb-2 opacity-50" />
                No hardware verification events recorded yet.
              </div>
            )}
          </div>

          <div className="pt-4 mt-4 border-t border-slate-100">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-2">
              Active Hardware Sensors
            </span>
            <div className="space-y-1.5">
              {devices.slice(0, 2).map((dev) => (
                <div key={dev.device_id} className="flex items-center justify-between text-xs py-1">
                  <div className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${dev.status === 'online' ? 'bg-emerald-500' : 'bg-slate-400'}`}></span>
                    <span className="font-semibold text-slate-800">{dev.device_name}</span>
                  </div>
                  <span className="font-mono text-[10px] text-slate-400">{dev.device_id}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* My Properties Cards Grid */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-base font-bold text-slate-900">My Registered Properties</h2>
            <p className="text-xs text-slate-500">Cadastral parcels registered under your title</p>
          </div>
          <button
            onClick={() => navigate('/portal/properties')}
            className="text-xs font-bold text-emerald-700 hover:text-emerald-800 flex items-center gap-1"
          >
            <span>View All ({properties.length})</span>
            <ArrowUpRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {properties.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {properties.map((property) => {
              const statusConfig = STATUS_COLORS[property.status] || STATUS_COLORS.active;
              return (
                <div
                  key={property.id}
                  onClick={() => navigate(`/portal/properties/${property.id}`)}
                  className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden hover:shadow-md transition-all cursor-pointer group flex flex-col justify-between"
                >
                  <div>
                    {/* Thumbnail Image */}
                    <div className="h-44 w-full bg-slate-100 relative overflow-hidden">
                      <img
                        src={
                          property.images && property.images.length > 0
                            ? property.images[0].image_url
                            : 'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=600&auto=format&fit=crop&q=80'
                        }
                        alt={property.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                      <div className="absolute top-3 left-3">
                        <span className="px-2.5 py-1 rounded-lg bg-slate-900/85 backdrop-blur-md text-white font-mono font-bold text-[11px] shadow-sm">
                          {property.property_id}
                        </span>
                      </div>
                      <div className="absolute top-3 right-3">
                        <span className={`px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider shadow-sm border ${statusConfig.textColor}`}>
                          {statusConfig.label}
                        </span>
                      </div>
                    </div>

                    {/* Content */}
                    <div className="p-4">
                      <h3 className="font-bold text-slate-900 text-sm group-hover:text-emerald-600 transition-colors line-clamp-1">
                        {property.title}
                      </h3>

                      <div className="flex items-center gap-1.5 text-slate-500 text-xs mt-1.5">
                        <MapPin className="w-3.5 h-3.5 flex-shrink-0 text-slate-400" />
                        <span className="truncate">{property.address}, {property.city}</span>
                      </div>

                      <div className="grid grid-cols-2 gap-2 mt-4 pt-3 border-t border-slate-100 text-xs">
                        <div>
                          <span className="text-[10px] uppercase font-semibold text-slate-400 block">Land Area</span>
                          <span className="font-bold text-slate-800">{property.area.toLocaleString()} {property.area_unit}</span>
                        </div>
                        <div>
                          <span className="text-[10px] uppercase font-semibold text-slate-400 block">Survey No</span>
                          <span className="font-mono font-bold text-slate-800">{property.survey_number}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="px-4 py-3 bg-slate-50/70 border-t border-slate-100 flex items-center justify-between text-xs">
                    <span className="text-slate-500 text-[11px] font-medium">DTCP Verified Title</span>
                    <span className="text-emerald-700 font-bold group-hover:translate-x-0.5 transition-transform flex items-center gap-1">
                      Inspect Dossier &rarr;
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="bg-white rounded-3xl border border-slate-200/80 p-12 text-center">
            <Building className="w-10 h-10 text-slate-300 mx-auto mb-3" />
            <h3 className="font-bold text-slate-800 text-sm">No properties assigned yet</h3>
            <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
              You currently do not have registered land parcels assigned to your title. Once the administrator registers or transfers a title, it will automatically appear here.
            </p>
          </div>
        )}
      </div>

      {/* Recent Activity Stream */}
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-base font-bold text-slate-900">Recent Platform Activity</h2>
            <p className="text-xs text-slate-500">Ownership transfers, boundary verifications, and audit logs</p>
          </div>
          <button
            onClick={() => navigate('/portal/activity')}
            className="text-xs font-bold text-emerald-700 hover:text-emerald-800 flex items-center gap-1"
          >
            <span>Full Audit Log</span>
            <ArrowUpRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="divide-y divide-slate-100">
          {activities.length > 0 ? (
            activities.slice(0, 4).map((activity) => (
              <div key={activity.id} className="py-3 flex items-start gap-3 text-xs">
                <div className="w-7 h-7 rounded-xl bg-slate-100 flex items-center justify-center text-slate-600 flex-shrink-0 mt-0.5">
                  <Clock className="w-3.5 h-3.5" />
                </div>
                <div className="flex-1">
                  <p className="font-medium text-slate-800">{activity.description}</p>
                  <span className="text-[11px] text-slate-400 mt-0.5 block">
                    {new Date(activity.created_at).toLocaleString()}
                  </span>
                </div>
              </div>
            ))
          ) : (
            <div className="py-6 text-center text-slate-400 text-xs">
              No recent activity recorded.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
