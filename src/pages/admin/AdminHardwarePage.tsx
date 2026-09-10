// ==============================================================================
// FINNEST - Admin Field Verification Center & Sensor Network
// Digital Property & Land Parcel Management Platform
// ==============================================================================

import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { hardwareService, formatVerificationSource } from '../../services/hardwareService';
import { propertyService } from '../../services/propertyService';
import { HardwareDevice, HardwareEvent, Property, VerificationSource } from '../../types/database.types';
import { useRealtime } from '../../hooks/useRealtime';
import {
  Radio,
  Send,
  CheckCircle2,
  AlertCircle,
  Clock,
  MapPin,
  Shield,
  ShieldCheck,
  Activity,
  Code,
  RefreshCw,
  Search,
  Filter,
  Sliders,
  FileCheck,
  Cpu,
  ArrowRight,
  ExternalLink,
  Wifi,
  WifiOff,
  Info,
  Layers,
  Camera,
  CameraOff,
  Image as ImageIcon,
  Maximize2,
  X,
  Upload,
} from 'lucide-react';

type ActiveTab = 'live' | 'history' | 'devices' | 'simulator';

export const AdminHardwarePage: React.FC = () => {
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState<ActiveTab>('live');
  const [devices, setDevices] = useState<HardwareDevice[]>([]);
  const [events, setEvents] = useState<HardwareEvent[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Photo viewer modal state
  const [viewingPhoto, setViewingPhoto] = useState<string | null>(null);

  // Simulator Form State
  const [simDevice, setSimDevice] = useState<string>('ESP32-CAM-001');
  const [simPropertyId, setSimPropertyId] = useState<string>('');
  const [simRfid, setSimRfid] = useState<string>('A1B2C3D4');
  const [simLat, setSimLat] = useState<number>(12.9815);
  const [simLng, setSimLng] = useState<number>(80.2442);
  const [simImageFile, setSimImageFile] = useState<File | null>(null);
  const [simImagePreview, setSimImagePreview] = useState<string | null>(null);
  const [simPresetPhoto, setSimPresetPhoto] = useState<string>('https://images.unsplash.com/photo-1500382017468-9049fed747ef?w=1000&auto=format&fit=crop&q=80');
  const [simulating, setSimulating] = useState<boolean>(false);
  const [simResponse, setSimResponse] = useState<any>(null);

  // Manual Verification Form State
  const [manualPropId, setManualPropId] = useState<string>('');
  const [manualNotes, setManualNotes] = useState<string>('');
  const [manualLat, setManualLat] = useState<string>('');
  const [manualLng, setManualLng] = useState<string>('');
  const [manualImageFile, setManualImageFile] = useState<File | null>(null);
  const [manualImagePreview, setManualImagePreview] = useState<string | null>(null);
  const [recordingManual, setRecordingManual] = useState<boolean>(false);
  const [manualResponse, setManualResponse] = useState<any>(null);

  // History Filter State
  const [historySearch, setHistorySearch] = useState<string>('');
  const [sourceFilter, setSourceFilter] = useState<string>('all');
  const [propertyFilter, setPropertyFilter] = useState<string>('all');

  // Inspector Modal
  const [selectedEvent, setSelectedEvent] = useState<HardwareEvent | null>(null);

  const loadData = async () => {
    try {
      setLoading(true);
      const [dRes, eRes, pRes] = await Promise.all([
        hardwareService.getDevices(),
        hardwareService.getHardwareEvents(50),
        propertyService.getProperties(),
      ]);
      setDevices(dRes.data || []);
      setEvents(eRes.data || []);
      setProperties(pRes.data || []);

      // Default simulator preset if not set
      if (!simPropertyId && pRes.data && pRes.data.length > 0) {
        const first = pRes.data[0];
        setSimPropertyId(first.id);
        if (first.rfid_uid) setSimRfid(first.rfid_uid);
        setSimLat(first.latitude);
        setSimLng(first.longitude);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Supabase Realtime updates
  useRealtime({
    onHardwareEvent: (ev) => {
      setEvents(prev => [ev, ...prev]);
      loadData();
    },
    onDeviceUpdate: () => loadData(),
  });

  // Simulator preset loader (when user picks a property from dropdown)
  const handlePropertyPreset = (propId: string) => {
    setSimPropertyId(propId);
    const prop = properties.find(p => p.id === propId || p.property_id === propId);
    if (prop) {
      if (prop.rfid_uid) setSimRfid(prop.rfid_uid);
      setSimLat(prop.latitude);
      setSimLng(prop.longitude);
    }
  };

  // Submit test event via simulator pipeline
  const handleSendSimulatorEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    setSimulating(true);
    setSimResponse(null);

    const isEsp32 = simDevice.toUpperCase().includes('ESP32') || simDevice.toUpperCase().includes('CAM');
    const source: VerificationSource = isEsp32 ? 'hardware' : 'simulator';

    const payload = {
      device_id: simDevice,
      rfid_uid: simRfid.trim().toUpperCase(),
      latitude: Number(simLat),
      longitude: Number(simLng),
      event_type: 'property_verification',
      source,
      image_file: simImageFile || undefined,
      image_url: simPresetPhoto ? simPresetPhoto : undefined,
      payload: {
        device_id: simDevice,
        rfid_uid: simRfid.trim().toUpperCase(),
        source,
        battery: 98,
        signal_rssi: -48,
        operator: isEsp32 ? 'ESP32-CAM Field Unit' : 'Field Simulation Officer',
        has_camera: isEsp32 || !!simImageFile || !!simPresetPhoto,
      },
    };

    try {
      const res = await hardwareService.sendHardwareEvent(payload);
      setSimResponse(res);
      await loadData();
    } catch (err: any) {
      setSimResponse({ success: false, error: err.message });
    } finally {
      setSimulating(false);
    }
  };

  // Submit manual verification fallback
  const handleRecordManualVerification = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualPropId) return;

    setRecordingManual(true);
    setManualResponse(null);

    try {
      const res = await hardwareService.recordManualVerification({
        property_id: manualPropId,
        notes: manualNotes.trim() || 'On-site cadastral field verification performed by authorized surveyor.',
        latitude: manualLat ? parseFloat(manualLat) : undefined,
        longitude: manualLng ? parseFloat(manualLng) : undefined,
        image_file: manualImageFile || undefined,
      });

      setManualResponse(res);
      setManualNotes('');
      setManualImageFile(null);
      setManualImagePreview(null);
      await loadData();
    } catch (err: any) {
      setManualResponse({ success: false, error: err.message });
    } finally {
      setRecordingManual(false);
    }
  };

  // Computed properties and stats
  const onlineDevicesCount = devices.filter(d => d.status === 'online').length;
  const latestEvent = events[0] || null;

  // Filtered history list
  const filteredEvents = useMemo(() => {
    return events.filter(ev => {
      const src = ev.verification_source || (ev.payload as any)?.source || (ev.device_id?.startsWith('SIM') ? 'simulator' : 'hardware');
      if (sourceFilter !== 'all' && src !== sourceFilter) return false;

      if (propertyFilter !== 'all') {
        const propMatch = ev.property?.id === propertyFilter || ev.property?.property_id === propertyFilter;
        if (!propMatch) return false;
      }

      if (historySearch.trim()) {
        const query = historySearch.toLowerCase().trim();
        const propTitle = ev.property?.title?.toLowerCase() || '';
        const propId = ev.property?.property_id?.toLowerCase() || '';
        const devId = ev.device_id.toLowerCase();
        const rfid = ev.rfid_uid?.toLowerCase() || '';
        if (!propTitle.includes(query) && !propId.includes(query) && !devId.includes(query) && !rfid.includes(query)) {
          return false;
        }
      }

      return true;
    });
  }, [events, sourceFilter, propertyFilter, historySearch]);

  const renderSourceBadge = (source?: string | null, deviceId?: string | null) => {
    const isCamera = deviceId && (deviceId.toUpperCase().includes('ESP32') || deviceId.toUpperCase().includes('CAM'));
    if (isCamera) {
      return (
        <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-teal-500/10 text-teal-400 border border-teal-500/30">
          <Camera className="w-2.5 h-2.5" />
          <span>ESP32-CAM</span>
        </span>
      );
    }
    const s = (source || 'hardware').toLowerCase();
    if (s === 'simulator') {
      return (
        <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-purple-500/10 text-purple-400 border border-purple-500/30">
          <Sliders className="w-2.5 h-2.5" />
          <span>Simulator</span>
        </span>
      );
    }
    if (s === 'manual') {
      return (
        <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-400 border border-amber-500/30">
          <FileCheck className="w-2.5 h-2.5" />
          <span>Manual</span>
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-blue-500/10 text-blue-400 border border-blue-500/30">
        <Cpu className="w-2.5 h-2.5" />
        <span>Hardware</span>
      </span>
    );
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold tracking-tight text-white">
              Field Verification Center
            </h1>
            <span className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
              Live Pipeline Active
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            Realtime telemetry monitoring of ESP8266 rover nodes, cadastral RFID audits, and field verification simulator
          </p>
        </div>

        <button
          onClick={loadData}
          className="p-2 rounded-xl bg-slate-800 border border-slate-700 text-slate-300 hover:text-white transition-colors self-start sm:self-auto flex items-center gap-2 text-xs font-semibold"
          title="Refresh Data"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-emerald-400' : ''}`} />
          <span className="hidden sm:inline">Refresh Telemetry</span>
        </button>
      </div>

      {/* Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-800 pb-2 overflow-x-auto">
        <button
          onClick={() => setActiveTab('live')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 whitespace-nowrap ${
            activeTab === 'live'
              ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20'
              : 'text-slate-400 hover:text-white hover:bg-slate-900'
          }`}
        >
          <Radio className="w-3.5 h-3.5" />
          <span>Live Verification</span>
        </button>

        <button
          onClick={() => setActiveTab('history')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 whitespace-nowrap ${
            activeTab === 'history'
              ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20'
              : 'text-slate-400 hover:text-white hover:bg-slate-900'
          }`}
        >
          <Clock className="w-3.5 h-3.5" />
          <span>Verification History ({events.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('devices')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 whitespace-nowrap ${
            activeTab === 'devices'
              ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20'
              : 'text-slate-400 hover:text-white hover:bg-slate-900'
          }`}
        >
          <Cpu className="w-3.5 h-3.5" />
          <span>Hardware Devices ({devices.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('simulator')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 whitespace-nowrap ${
            activeTab === 'simulator'
              ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20'
              : 'text-slate-400 hover:text-white hover:bg-slate-900'
          }`}
        >
          <Sliders className="w-3.5 h-3.5" />
          <span>Simulator & Manual Entry</span>
        </button>
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: LIVE VERIFICATION */}
      {/* ========================================================================= */}
      {activeTab === 'live' && (
        <div className="space-y-6 animate-in fade-in duration-200">
          {/* Top Status Banner */}
          <div className="bg-slate-950 rounded-2xl p-4 border border-slate-800 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-white">Verification Engine Operational</span>
                  <span className="text-[10px] bg-slate-900 px-2 py-0.5 rounded text-slate-400 border border-slate-800 font-mono">
                    Supabase Realtime
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Listening for incoming field observations across physical hardware, field rovers, and virtual simulators.
                </p>
              </div>
            </div>

            {/* Hardware Presence Badge */}
            <div className="flex items-center gap-3 bg-slate-900 px-3.5 py-2 rounded-xl border border-slate-800 text-xs">
              <div className="flex items-center gap-1.5">
                {onlineDevicesCount > 0 ? (
                  <>
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                    <span className="font-semibold text-emerald-400">Physical Hardware: Online ({onlineDevicesCount})</span>
                  </>
                ) : (
                  <>
                    <span className="w-2 h-2 rounded-full bg-slate-500"></span>
                    <span className="font-semibold text-slate-400">Physical Hardware: Currently Offline</span>
                  </>
                )}
              </div>
              <span className="text-slate-600">|</span>
              <span className="text-[11px] text-purple-400 font-semibold flex items-center gap-1">
                <Sliders className="w-3 h-3" />
                <span>Simulator Ready</span>
              </span>
            </div>
          </div>

          {/* Latest Verification Hero Card */}
          {latestEvent ? (
            <div className="bg-gradient-to-r from-slate-950 via-slate-900 to-slate-950 rounded-3xl p-6 sm:p-8 border border-emerald-500/30 shadow-xl relative overflow-hidden">
              <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
                <div className="flex-1">
                  <div className="flex flex-wrap items-center gap-2 mb-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider bg-emerald-500/20 text-emerald-400 px-2.5 py-1 rounded-md border border-emerald-500/30 flex items-center gap-1.5">
                      <CheckCircle2 className="w-3 h-3" />
                      FIELD VERIFICATION
                    </span>
                    <span className="text-[10px] font-bold uppercase tracking-wider bg-emerald-500 text-slate-950 px-2.5 py-1 rounded-md flex items-center gap-1 shadow-sm">
                      <ShieldCheck className="w-3 h-3" />
                      ✓ PROPERTY VERIFIED
                    </span>
                    {renderSourceBadge(latestEvent.verification_source, latestEvent.device_id)}
                  </div>

                  <h2 className="text-xl sm:text-2xl font-bold text-white mt-1">
                    {latestEvent.property ? latestEvent.property.title : 'Unassigned Survey Point'}
                  </h2>

                  <div className="flex items-center gap-2 text-xs text-slate-400 mt-1 font-mono">
                    <span className="text-emerald-400 font-bold">
                      Property: {latestEvent.property?.property_id || 'Tag: ' + latestEvent.rfid_uid}
                    </span>
                    {latestEvent.property?.address && (
                      <>
                        <span>&bull;</span>
                        <span>{latestEvent.property.address}</span>
                      </>
                    )}
                  </div>

                  {/* Verification Spec Details */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-5">
                    <div className="bg-slate-900/90 p-2.5 rounded-xl border border-slate-800">
                      <span className="text-[10px] uppercase font-bold text-slate-500 block">Property</span>
                      <span className="font-mono text-xs font-bold text-white mt-0.5 block truncate">
                        {latestEvent.property?.property_id || 'FN-1001'}
                      </span>
                    </div>

                    <div className="bg-slate-900/90 p-2.5 rounded-xl border border-slate-800">
                      <span className="text-[10px] uppercase font-bold text-slate-500 block">RFID</span>
                      <span className="font-mono text-xs font-bold text-emerald-400 mt-0.5 block">
                        {latestEvent.rfid_uid || 'N/A'}
                      </span>
                    </div>

                    <div className="bg-slate-900/90 p-2.5 rounded-xl border border-slate-800">
                      <span className="text-[10px] uppercase font-bold text-slate-500 block">GPS</span>
                      <span className="font-mono text-xs text-slate-200 mt-0.5 block">
                        {latestEvent.latitude?.toFixed(6)}, {latestEvent.longitude?.toFixed(6)}
                      </span>
                    </div>

                    <div className="bg-slate-900/90 p-2.5 rounded-xl border border-slate-800">
                      <span className="text-[10px] uppercase font-bold text-slate-500 block">Source</span>
                      <span className="font-mono text-xs text-slate-300 mt-0.5 block truncate">
                        {formatVerificationSource(latestEvent.verification_source, latestEvent.device_id)}
                      </span>
                    </div>
                  </div>

                  <div className="mt-3 flex items-center gap-2 text-xs text-slate-400 font-mono">
                    <Clock className="w-3.5 h-3.5 text-slate-500" />
                    <span>Timestamp: {new Date(latestEvent.created_at).toLocaleString()}</span>
                  </div>
                </div>

                {/* Field Photo Display Section */}
                <div className="w-full lg:w-72 flex flex-col items-center">
                  {latestEvent.image_url ? (
                    <div className="w-full bg-slate-900/90 rounded-2xl border border-emerald-500/40 p-2.5 relative group overflow-hidden shadow-lg">
                      <div className="flex items-center justify-between text-[10px] text-emerald-400 font-bold uppercase mb-1.5 px-1">
                        <span className="flex items-center gap-1">
                          <Camera className="w-3 h-3" />
                          ACTUAL FIELD PHOTO
                        </span>
                        <span className="text-[9px] bg-emerald-500/20 px-1.5 py-0.5 rounded text-emerald-300">
                          Optical Verified
                        </span>
                      </div>
                      <div className="h-44 w-full rounded-xl overflow-hidden bg-slate-950 relative">
                        <img
                          src={latestEvent.image_url}
                          alt="Actual Field Verification Photo"
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300 cursor-pointer"
                          onClick={() => setViewingPhoto(latestEvent.image_url!)}
                          onError={(e) => {
                            (e.target as HTMLElement).style.display = 'none';
                            const el = document.getElementById(`hero-fallback-${latestEvent.id}`);
                            if (el) el.style.display = 'flex';
                          }}
                        />
                        <div
                          id={`hero-fallback-${latestEvent.id}`}
                          style={{ display: 'none' }}
                          className="w-full h-full flex flex-col items-center justify-center p-3 text-center bg-slate-900 text-slate-400"
                        >
                          <CameraOff className="w-6 h-6 text-slate-500 mb-1" />
                          <span className="text-xs font-semibold text-slate-300">No field photo available</span>
                        </div>
                        <button
                          onClick={() => setViewingPhoto(latestEvent.image_url!)}
                          className="absolute bottom-2 right-2 p-1.5 bg-slate-950/80 hover:bg-slate-900 text-white rounded-lg border border-slate-700 opacity-0 group-hover:opacity-100 transition-opacity shadow-sm"
                          title="View Full Resolution Photo"
                        >
                          <Maximize2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      <div className="mt-2 flex items-center justify-between text-[10px] text-slate-400 px-1">
                        <span className="truncate">{latestEvent.device_id}</span>
                        <button
                          onClick={() => setViewingPhoto(latestEvent.image_url!)}
                          className="text-emerald-400 hover:underline font-semibold"
                        >
                          Enlarge
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="w-full h-48 bg-slate-900/60 rounded-2xl border border-dashed border-slate-800 flex flex-col items-center justify-center p-4 text-center">
                      <CameraOff className="w-7 h-7 text-slate-600 mb-2" />
                      <span className="text-xs font-bold text-slate-400">No field photo available</span>
                      <span className="text-[10px] text-slate-500 mt-1 max-w-[180px]">
                        Verification recorded via radio telemetry without optical sensor
                      </span>
                    </div>
                  )}

                  {/* Quick Actions */}
                  <div className="w-full flex gap-2 mt-3">
                    {latestEvent.property && (
                      <button
                        onClick={() => navigate(`/admin/properties/${latestEvent.property?.id}`)}
                        className="flex-1 py-2 px-3 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 transition-all shadow-md shadow-emerald-500/20"
                      >
                        <span>Inspect Parcel Dossier</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    )}
                    <button
                      onClick={() => setSelectedEvent(latestEvent)}
                      className="py-2 px-3 bg-slate-900 hover:bg-slate-800 text-slate-300 text-xs font-semibold rounded-xl border border-slate-800 transition-colors"
                    >
                      Raw JSON
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-slate-950 rounded-3xl p-10 border border-slate-800 text-center">
              <Radio className="w-8 h-8 text-slate-600 mx-auto mb-2" />
              <h3 className="text-sm font-bold text-white">No Verification Events Recorded</h3>
              <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto">
                Use the Field Verification Simulator or record a manual verification to ingest the first observation packet.
              </p>
              <button
                onClick={() => setActiveTab('simulator')}
                className="mt-4 px-4 py-2 bg-emerald-500 text-slate-950 text-xs font-bold rounded-xl inline-flex items-center gap-1.5"
              >
                <Sliders className="w-3.5 h-3.5" />
                <span>Open Field Simulator</span>
              </button>
            </div>
          )}

          {/* Realtime Telemetry Feed */}
          <div className="bg-slate-950 rounded-3xl p-6 border border-slate-800 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-bold text-white">Live Ingestion Event Stream</h3>
                <p className="text-xs text-slate-400">Realtime verification packets broadcast to FinNest</p>
              </div>
              <span className="text-[11px] font-mono text-slate-500">
                Displaying last {Math.min(events.length, 15)} packets
              </span>
            </div>

            <div className="divide-y divide-slate-800/60">
              {events.slice(0, 15).map(ev => (
                <div key={ev.id} className="py-3 flex items-center justify-between hover:bg-slate-900/30 px-2 rounded-xl transition-colors text-xs">
                  <div className="flex items-center gap-3">
                    {ev.image_url ? (
                      <div
                        onClick={() => setViewingPhoto(ev.image_url!)}
                        className="w-10 h-10 rounded-lg overflow-hidden border border-emerald-500/40 bg-slate-900 cursor-pointer flex-shrink-0 group relative shadow-xs"
                        title="Click to view full resolution verification photo"
                      >
                        <img
                          src={ev.image_url}
                          alt="Field Photo"
                          className="w-full h-full object-cover group-hover:scale-110 transition-transform"
                          onError={(e) => {
                            (e.target as HTMLElement).style.display = 'none';
                            const el = document.getElementById(`feed-fallback-${ev.id}`);
                            if (el) el.style.display = 'flex';
                          }}
                        />
                        <div
                          id={`feed-fallback-${ev.id}`}
                          style={{ display: 'none' }}
                          className="w-full h-full flex items-center justify-center bg-slate-900 text-slate-500"
                        >
                          <CameraOff className="w-4 h-4 text-slate-600" />
                        </div>
                        <span className="absolute bottom-0 right-0 p-0.5 bg-slate-950/80 rounded-tl text-[8px] text-emerald-400">
                          <Camera className="w-2.5 h-2.5" />
                        </span>
                      </div>
                    ) : (
                      <div className="w-10 h-10 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-500 flex-shrink-0" title="No field photo available">
                        <CameraOff className="w-4 h-4 text-slate-600" />
                      </div>
                    )}
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-white">
                          {ev.property ? ev.property.title : 'Unmatched RFID: ' + ev.rfid_uid}
                        </span>
                        {renderSourceBadge(ev.verification_source, ev.device_id)}
                        {ev.image_url && (
                          <button
                            type="button"
                            onClick={() => setViewingPhoto(ev.image_url!)}
                            className="inline-flex items-center gap-1 text-[9px] bg-emerald-500/20 text-emerald-400 px-1.5 py-0.5 rounded border border-emerald-500/30 font-semibold hover:bg-emerald-500/30 transition-colors"
                          >
                            <Camera className="w-2.5 h-2.5" />
                            <span>Photo</span>
                          </button>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-[11px] text-slate-400 mt-0.5">
                        <span className="font-mono text-emerald-400 font-bold">{ev.property?.property_id || ev.rfid_uid}</span>
                        <span>&bull;</span>
                        <span className="font-mono">Node: {ev.device_id}</span>
                        <span>&bull;</span>
                        <span className="font-mono">{ev.latitude?.toFixed(4)}, {ev.longitude?.toFixed(4)}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <span className="text-[11px] text-slate-500 font-mono whitespace-nowrap">
                      {new Date(ev.created_at).toLocaleTimeString()}
                    </span>
                    <button
                      onClick={() => setSelectedEvent(ev)}
                      className="px-2 py-1 bg-slate-900 hover:bg-slate-800 text-[10px] font-mono text-slate-300 rounded border border-slate-800"
                    >
                      Inspect
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: VERIFICATION HISTORY */}
      {/* ========================================================================= */}
      {activeTab === 'history' && (
        <div className="space-y-6 animate-in fade-in duration-200">
          {/* Filter Bar */}
          <div className="bg-slate-950 rounded-2xl p-4 border border-slate-800 flex flex-col md:flex-row items-center gap-3">
            {/* Search Input */}
            <div className="relative flex-1 w-full">
              <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={historySearch}
                onChange={e => setHistorySearch(e.target.value)}
                placeholder="Search by Parcel ID, Title, Device ID, or RFID..."
                className="w-full pl-9 pr-4 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 font-medium"
              />
            </div>

            {/* Source Filter */}
            <div className="flex items-center gap-2 w-full md:w-auto">
              <select
                value={sourceFilter}
                onChange={e => setSourceFilter(e.target.value)}
                className="bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500 w-full md:w-auto"
              >
                <option value="all">All Verification Sources</option>
                <option value="hardware">Hardware (ESP8266)</option>
                <option value="simulator">Field Simulator</option>
                <option value="manual">Manual Verification</option>
              </select>

              {/* Property Filter */}
              <select
                value={propertyFilter}
                onChange={e => setPropertyFilter(e.target.value)}
                className="bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500 w-full md:w-auto"
              >
                <option value="all">All Cadastral Parcels</option>
                {properties.map(p => (
                  <option key={p.id} value={p.id}>
                    {p.property_id} ({p.title.substring(0, 20)}...)
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* History Table */}
          <div className="bg-slate-950 rounded-3xl p-6 border border-slate-800 shadow-sm overflow-hidden">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-bold text-white">Cadastral Verification Audit Log</h3>
                <p className="text-xs text-slate-400">Complete historical record of on-site telemetry and manual certifications</p>
              </div>
              <span className="text-xs text-slate-500 font-mono">
                {filteredEvents.length} records matching
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="bg-slate-900/80 text-[11px] uppercase font-bold text-slate-400 tracking-wider border-b border-slate-800">
                  <tr>
                    <th className="py-3 px-4">Date & Time</th>
                    <th className="py-3 px-4">Source</th>
                    <th className="py-3 px-4">Target Parcel</th>
                    <th className="py-3 px-4">RFID UID</th>
                    <th className="py-3 px-4">Field Photo</th>
                    <th className="py-3 px-4">Survey Node</th>
                    <th className="py-3 px-4">GPS Observation</th>
                    <th className="py-3 px-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {filteredEvents.length > 0 ? (
                    filteredEvents.map(ev => (
                      <tr key={ev.id} className="hover:bg-slate-900/40 transition-colors">
                        <td className="py-3 px-4 whitespace-nowrap font-mono text-slate-400">
                          {new Date(ev.created_at).toLocaleString()}
                        </td>
                        <td className="py-3 px-4 whitespace-nowrap">
                          {renderSourceBadge(ev.verification_source, ev.device_id)}
                        </td>
                        <td className="py-3 px-4 whitespace-nowrap">
                          <span className="font-semibold text-white">
                            {ev.property ? `${ev.property.property_id}: ${ev.property.title}` : 'Unassigned'}
                          </span>
                        </td>
                        <td className="py-3 px-4 whitespace-nowrap">
                          <span className="font-mono text-emerald-400 font-bold bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                            {ev.rfid_uid || 'N/A'}
                          </span>
                        </td>
                        <td className="py-3 px-4 whitespace-nowrap">
                          {ev.image_url ? (
                            <button
                              type="button"
                              onClick={() => setViewingPhoto(ev.image_url!)}
                              className="flex items-center gap-1.5 p-1 pr-2 bg-slate-900 hover:bg-slate-800 rounded-lg border border-emerald-500/30 text-emerald-400 text-[10px] font-bold transition-all shadow-xs"
                              title="Click to view full photo"
                            >
                              <img
                                src={ev.image_url}
                                alt="Photo"
                                className="w-6 h-6 object-cover rounded"
                                onError={(e) => {
                                  (e.target as HTMLElement).style.display = 'none';
                                  const el = document.getElementById(`table-fallback-${ev.id}`);
                                  if (el) el.style.display = 'inline-flex';
                                }}
                              />
                              <span id={`table-fallback-${ev.id}`} style={{ display: 'none' }} className="items-center gap-1 text-slate-500">
                                <CameraOff className="w-3 h-3 text-slate-600" />
                                <span>No photo</span>
                              </span>
                              <span className="flex items-center gap-1">
                                <Camera className="w-3 h-3" />
                                <span>View Photo</span>
                              </span>
                            </button>
                          ) : (
                            <span className="flex items-center gap-1 text-slate-500 text-[10px] italic">
                              <CameraOff className="w-3 h-3 text-slate-600" />
                              <span>No field photo available</span>
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4 whitespace-nowrap font-mono text-slate-400">
                          {ev.device_id}
                        </td>
                        <td className="py-3 px-4 whitespace-nowrap font-mono text-slate-400">
                          {ev.latitude?.toFixed(4)}, {ev.longitude?.toFixed(4)}
                        </td>
                        <td className="py-3 px-4 text-right whitespace-nowrap">
                          <button
                            onClick={() => setSelectedEvent(ev)}
                            className="px-2.5 py-1 bg-slate-900 hover:bg-slate-800 border border-slate-700 rounded text-[10px] font-mono text-slate-300"
                          >
                            Inspect
                          </button>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={8} className="py-12 text-center text-slate-500">
                        No verification events found matching the specified filters.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: HARDWARE DEVICES */}
      {/* ========================================================================= */}
      {activeTab === 'devices' && (
        <div className="space-y-6 animate-in fade-in duration-200">
          {/* Architecture Clarification Callout */}
          <div className="bg-slate-900/80 rounded-2xl p-4 border border-slate-800 flex items-start gap-3">
            <Info className="w-4 h-4 text-slate-400 flex-shrink-0 mt-0.5" />
            <div className="text-xs text-slate-400 leading-relaxed">
              <strong className="text-white font-semibold">Sensor Fleet Architecture:</strong> Physical nodes (ESP8266 + RC522 RFID + NEO-6M GPS) broadcast telemetry over Wi-Fi. Nodes are marked <span className="text-emerald-400 font-bold">Online</span> only if actively transmitting within the last 10 minutes. If physical hardware is disconnected, all FinNest cadastral operations, map rendering, and the verification simulator operate with 100% normal capability.
            </div>
          </div>

          {/* Device Fleet Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {devices.map(dev => {
              const isOnline = dev.status === 'online';
              const isRecent = dev.status === 'recently_seen';

              return (
                <div
                  key={dev.device_id}
                  className="bg-slate-950 rounded-2xl p-5 border border-slate-800 shadow-sm flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <span className="font-mono text-xs font-bold text-white bg-slate-900 px-2.5 py-1 rounded-lg border border-slate-800">
                        {dev.device_id}
                      </span>
                      <span
                        className={`flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${
                          isOnline
                            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                            : isRecent
                            ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                            : 'bg-slate-800 text-slate-400 border-slate-700'
                        }`}
                      >
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${
                            isOnline ? 'bg-emerald-400 animate-pulse' : isRecent ? 'bg-amber-400' : 'bg-slate-500'
                          }`}
                        ></span>
                        {dev.status.replace('_', ' ')}
                      </span>
                    </div>

                    <h3 className="font-bold text-white text-sm">{dev.device_name}</h3>
                    <span className="text-[11px] text-slate-400 font-mono block mt-0.5">
                      Type: {dev.device_type}
                    </span>

                    <div className="grid grid-cols-2 gap-2 mt-4 pt-3 border-t border-slate-800/80 text-xs">
                      <div>
                        <span className="text-[10px] uppercase font-bold text-slate-500 block">Last Active</span>
                        <span className="text-slate-300 text-[11px]">
                          {dev.last_seen ? new Date(dev.last_seen).toLocaleTimeString() : 'Offline / Inactive'}
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] uppercase font-bold text-slate-500 block">Last RFID</span>
                        <span className="font-mono text-emerald-400 font-bold text-[11px]">
                          {dev.rfid_uid || 'None'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {dev.latitude && dev.longitude && (
                    <div className="mt-3 pt-2 text-[10px] font-mono text-slate-500 flex items-center gap-1 border-t border-slate-900">
                      <MapPin className="w-3 h-3 text-slate-600" />
                      <span>{dev.latitude.toFixed(4)}, {dev.longitude.toFixed(4)}</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 4: SIMULATOR & MANUAL ENTRY */}
      {/* ========================================================================= */}
      {activeTab === 'simulator' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 animate-in fade-in duration-200">
          {/* Tool A: Field Verification Simulator */}
          <div className="bg-slate-950 rounded-3xl p-6 sm:p-7 border border-emerald-500/30 shadow-xl flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-[10px] font-bold uppercase tracking-wider bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded border border-emerald-500/30">
                  Field Simulator
                </span>
                <span className="text-xs text-slate-400">Automated Pipeline Test Bench</span>
              </div>
              <h2 className="text-base font-bold text-white">Simulate Field Telemetry</h2>
              <p className="text-xs text-slate-400 mt-1 mb-5 leading-relaxed">
                Dispatches an administrative verification packet through the real backend ingestion pipeline. Matches the parcel, logs audit records, and pushes via Supabase Realtime.
              </p>

              <form onSubmit={handleSendSimulatorEvent} className="space-y-4">
                {/* Field 1: Parcel Preset */}
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Select Target Cadastral Parcel
                  </label>
                  <select
                    value={simPropertyId}
                    onChange={e => handlePropertyPreset(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                  >
                    <option value="">-- Choose Cadastral Parcel --</option>
                    {properties.map(p => (
                      <option key={p.id} value={p.id}>
                        {p.property_id}: {p.title} ({p.rfid_uid || 'No RFID'})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  {/* Field 2: Simulated Node */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                      Virtual Node ID
                    </label>
                    <select
                      value={simDevice}
                      onChange={e => setSimDevice(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500 font-mono"
                    >
                      <option value="ESP32-CAM-001">ESP32-CAM-001 (Field Optical Sensor Node)</option>
                      <option value="SIM-SURVEYOR-01">SIM-SURVEYOR-01 (Virtual Rover)</option>
                      <option value="FN-ESP8266-001">FN-ESP8266-001 (Boundary Telemetry Node)</option>
                      <option value="SIM-PERIMETER-02">SIM-PERIMETER-02 (Boundary Post)</option>
                      <option value="SIM-ADMIN-STATION">SIM-ADMIN-STATION (Inspector)</option>
                    </select>
                  </div>

                  {/* Field 3: RFID Tag */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                      Scanned RFID Tag
                    </label>
                    <input
                      type="text"
                      required
                      value={simRfid}
                      onChange={e => setSimRfid(e.target.value.toUpperCase())}
                      placeholder="e.g. A1B2C3D4"
                      className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500 font-mono"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  {/* Field 4: Latitude */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">Latitude</label>
                    <input
                      type="number"
                      step="any"
                      required
                      value={simLat}
                      onChange={e => setSimLat(Number(e.target.value))}
                      className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500 font-mono"
                    />
                  </div>

                  {/* Field 5: Longitude */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">Longitude</label>
                    <input
                      type="number"
                      step="any"
                      required
                      value={simLng}
                      onChange={e => setSimLng(Number(e.target.value))}
                      className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500 font-mono"
                    />
                  </div>
                </div>

                {/* Field 6: Verification Photo (ESP32-CAM optical capture or sample photo) */}
                <div className="bg-slate-900/80 p-3.5 rounded-2xl border border-slate-800 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-white flex items-center gap-1.5">
                      <Camera className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Attach Field Verification Photo (ESP32-CAM Capture)</span>
                    </label>
                    {(simPresetPhoto || simImageFile) && (
                      <span className="text-[10px] text-emerald-400 font-mono font-semibold">Photo active</span>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <div>
                      <label className="block text-[11px] text-slate-400 mb-1">Preset Optical Capture</label>
                      <select
                        value={simPresetPhoto}
                        onChange={e => {
                          setSimPresetPhoto(e.target.value);
                          if (e.target.value) {
                            setSimImageFile(null);
                            setSimImagePreview(null);
                          }
                        }}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-emerald-500"
                      >
                        <option value="">-- No Image Attached --</option>
                        <option value="https://images.unsplash.com/photo-1500382017468-9049fed747ef?w=1000&auto=format&fit=crop&q=80">
                          Perimeter Survey Marker Post (Field Photo)
                        </option>
                        <option value="https://images.unsplash.com/photo-1541888946425-d0fbb18086f6?w=1000&auto=format&fit=crop&q=80">
                          Cadastral Boundary Stone (High-Res Ground Capture)
                        </option>
                        <option value="https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?w=1000&auto=format&fit=crop&q=80">
                          Warehouse Gate & Security Post Photo
                        </option>
                        <option value="https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=1000&auto=format&fit=crop&q=80">
                          Property Frontage Elevation Photo
                        </option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[11px] text-slate-400 mb-1">Or Upload Custom File</label>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={e => {
                          if (e.target.files && e.target.files[0]) {
                            const file = e.target.files[0];
                            setSimImageFile(file);
                            setSimImagePreview(URL.createObjectURL(file));
                            setSimPresetPhoto('');
                          }
                        }}
                        className="w-full text-xs text-slate-400 file:mr-2 file:py-1 file:px-2.5 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-emerald-500/20 file:text-emerald-400 hover:file:bg-emerald-500/30 cursor-pointer"
                      />
                    </div>
                  </div>

                  {/* Photo Thumbnail Preview */}
                  {(simImagePreview || simPresetPhoto) && (
                    <div className="flex items-center gap-3 pt-2 border-t border-slate-800">
                      <img
                        src={simImagePreview || simPresetPhoto}
                        alt="Verification Preview"
                        className="w-14 h-14 rounded-xl object-cover border border-emerald-500/40 cursor-pointer"
                        onClick={() => setViewingPhoto(simImagePreview || simPresetPhoto)}
                      />
                      <div className="flex-1 text-xs">
                        <span className="text-emerald-400 font-semibold flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" />
                          Photo Attached for Ingestion Pipeline
                        </span>
                        <p className="text-[10px] text-slate-400 mt-0.5 truncate">
                          {simImageFile ? simImageFile.name : 'Sample optical survey capture selected'}
                        </p>
                        <button
                          type="button"
                          onClick={() => {
                            setSimImageFile(null);
                            setSimImagePreview(null);
                            setSimPresetPhoto('');
                          }}
                          className="text-[10px] text-red-400 hover:underline mt-0.5 font-semibold"
                        >
                          Remove attached photo
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={simulating}
                  className="w-full py-2.5 px-4 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs rounded-xl flex items-center justify-center gap-2 transition-all shadow-md shadow-emerald-500/20 disabled:opacity-50 mt-4"
                >
                  {simulating ? (
                    <span>Transmitting Event Through Ingestion Pipeline...</span>
                  ) : (
                    <>
                      <Send className="w-4 h-4" />
                      <span>Simulate Field Verification</span>
                    </>
                  )}
                </button>
              </form>
            </div>

            {/* Simulator Response Card */}
            {simResponse && (
              <div className="mt-5 p-4 rounded-xl bg-slate-900 border border-slate-800 animate-in fade-in duration-200">
                <div className="flex items-center gap-2 mb-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <span className="text-xs font-bold text-white">Verification Ingestion Confirmed</span>
                </div>
                <div className="text-[11px] text-slate-300 space-y-1 font-mono">
                  <div><strong>Status:</strong> {simResponse.success ? '200 OK — Verified' : 'Error'}</div>
                  <div><strong>Message:</strong> {simResponse.message}</div>
                  <div><strong>Source:</strong> Simulator</div>
                  {simResponse.matched_property && (
                    <div><strong>Parcel:</strong> {simResponse.matched_property.property_id} ({simResponse.matched_property.title})</div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Tool B: Manual Verification Fallback */}
          <div className="bg-slate-950 rounded-3xl p-6 sm:p-7 border border-slate-800 shadow-xl flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-[10px] font-bold uppercase tracking-wider bg-amber-500/20 text-amber-400 px-2 py-0.5 rounded border border-amber-500/30">
                  Manual Fallback
                </span>
                <span className="text-xs text-slate-400">On-Site Officer Certification</span>
              </div>
              <h2 className="text-base font-bold text-white">Record Manual Verification</h2>
              <p className="text-xs text-slate-400 mt-1 mb-5 leading-relaxed">
                Administrative certification when hardware is unavailable or in remote terrain without network coverage. Explicitly recorded as <strong>Source: Manual Verification</strong>.
              </p>

              <form onSubmit={handleRecordManualVerification} className="space-y-4">
                {/* Field 1: Property */}
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Cadastral Parcel to Certify
                  </label>
                  <select
                    required
                    value={manualPropId}
                    onChange={e => {
                      setManualPropId(e.target.value);
                      const prop = properties.find(p => p.id === e.target.value);
                      if (prop) {
                        setManualLat(String(prop.latitude));
                        setManualLng(String(prop.longitude));
                      }
                    }}
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
                  >
                    <option value="">-- Choose Cadastral Parcel --</option>
                    {properties.map(p => (
                      <option key={p.id} value={p.id}>
                        {p.property_id}: {p.title}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Field 2: Notes / Reason */}
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Surveyor Notes & Legal Reason
                  </label>
                  <textarea
                    required
                    rows={3}
                    value={manualNotes}
                    onChange={e => setManualNotes(e.target.value)}
                    placeholder="e.g. Physical on-site cadastral inspection completed by municipal revenue officer. Boundary markers visually verified."
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl p-3 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 leading-relaxed"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  {/* Field 3: Lat */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                      Observed Latitude (Optional)
                    </label>
                    <input
                      type="number"
                      step="any"
                      value={manualLat}
                      onChange={e => setManualLat(e.target.value)}
                      placeholder="e.g. 12.9815"
                      className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500 font-mono"
                    />
                  </div>

                  {/* Field 4: Lng */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                      Observed Longitude (Optional)
                    </label>
                    <input
                      type="number"
                      step="any"
                      value={manualLng}
                      onChange={e => setManualLng(e.target.value)}
                      placeholder="e.g. 80.2442"
                      className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500 font-mono"
                    />
                  </div>
                </div>

                {/* Field 6: Optional Field Inspection Photo */}
                <div className="bg-slate-900/70 p-3 rounded-xl border border-slate-800">
                  <label className="block text-xs font-semibold text-slate-300 mb-1 flex items-center gap-1.5">
                    <Camera className="w-3.5 h-3.5 text-amber-400" />
                    <span>Attach On-Site Inspection Photograph (Optional)</span>
                  </label>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={e => {
                      if (e.target.files && e.target.files[0]) {
                        const file = e.target.files[0];
                        setManualImageFile(file);
                        setManualImagePreview(URL.createObjectURL(file));
                      }
                    }}
                    className="w-full text-xs text-slate-400 file:mr-2 file:py-1 file:px-2.5 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-amber-500/20 file:text-amber-400 hover:file:bg-amber-500/30 cursor-pointer mt-1"
                  />
                  {manualImagePreview && (
                    <div className="flex items-center gap-2.5 mt-2 pt-2 border-t border-slate-800">
                      <img src={manualImagePreview} alt="Manual inspection" className="w-12 h-12 rounded-lg object-cover border border-amber-500/30" />
                      <div className="flex-1 text-[11px]">
                        <span className="text-amber-400 font-medium block">Inspection photo attached</span>
                        <button
                          type="button"
                          onClick={() => {
                            setManualImageFile(null);
                            setManualImagePreview(null);
                          }}
                          className="text-[10px] text-red-400 hover:underline"
                        >
                          Remove photo
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={recordingManual || !manualPropId}
                  className="w-full py-2.5 px-4 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-xl flex items-center justify-center gap-2 transition-all shadow-md shadow-amber-500/20 disabled:opacity-50 mt-4"
                >
                  {recordingManual ? (
                    <span>Registering Certification...</span>
                  ) : (
                    <>
                      <FileCheck className="w-4 h-4" />
                      <span>Record Manual Verification</span>
                    </>
                  )}
                </button>
              </form>
            </div>

            {/* Manual Response Card */}
            {manualResponse && (
              <div className="mt-5 p-4 rounded-xl bg-slate-900 border border-slate-800 animate-in fade-in duration-200">
                <div className="flex items-center gap-2 mb-1">
                  <CheckCircle2 className="w-4 h-4 text-amber-400" />
                  <span className="text-xs font-bold text-white">Manual Verification Logged</span>
                </div>
                <p className="text-[11px] text-slate-300 font-mono">
                  {manualResponse.message}
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Raw Ingestion Packet Modal */}
      {selectedEvent && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-slate-950 border border-slate-800 rounded-3xl w-full max-w-xl p-6 shadow-2xl text-slate-100 animate-in fade-in duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-4">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-white text-sm">Telemetry Ingestion Inspection</h3>
                  {renderSourceBadge(selectedEvent.verification_source)}
                </div>
                <span className="text-[10px] font-mono text-slate-500">Event UUID: {selectedEvent.id}</span>
              </div>
              <button
                onClick={() => setSelectedEvent(null)}
                className="text-slate-400 hover:text-white text-lg p-1"
              >
                &times;
              </button>
            </div>

            <div className="space-y-3 mb-4 text-xs">
              <div className="grid grid-cols-2 gap-2 bg-slate-900 p-3 rounded-xl border border-slate-800">
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-500 block">Associated Parcel</span>
                  <span className="font-bold text-white">
                    {selectedEvent.property ? `${selectedEvent.property.property_id} (${selectedEvent.property.title})` : 'Unassigned'}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-500 block">RFID Tag</span>
                  <span className="font-mono text-emerald-400 font-bold">{selectedEvent.rfid_uid || 'N/A'}</span>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-500 block">GPS Coordinates</span>
                  <span className="font-mono text-slate-300">
                    {selectedEvent.latitude?.toFixed(5)}, {selectedEvent.longitude?.toFixed(5)}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-500 block">Ingestion Time</span>
                  <span className="font-mono text-slate-400">
                    {new Date(selectedEvent.created_at).toLocaleString()}
                  </span>
                </div>
              </div>

              {/* Inspection Photo Card */}
              {selectedEvent.image_url ? (
                <div className="bg-slate-900 p-3 rounded-2xl border border-emerald-500/30">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] font-bold uppercase text-emerald-400 flex items-center gap-1">
                      <Camera className="w-3.5 h-3.5" />
                      ACTUAL FIELD PHOTO
                    </span>
                    <button
                      type="button"
                      onClick={() => setViewingPhoto(selectedEvent.image_url!)}
                      className="text-[10px] text-emerald-400 hover:underline font-semibold flex items-center gap-1"
                    >
                      <Maximize2 className="w-3 h-3" />
                      <span>Full Resolution</span>
                    </button>
                  </div>
                  <div
                    className="h-56 rounded-xl overflow-hidden bg-slate-950 cursor-pointer relative group"
                    onClick={() => setViewingPhoto(selectedEvent.image_url!)}
                  >
                    <img
                      src={selectedEvent.image_url}
                      alt="Field verification capture"
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                    />
                    <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-xs font-semibold gap-1.5">
                      <Maximize2 className="w-4 h-4" />
                      <span>Click to enlarge photo</span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="bg-slate-900/60 p-4 rounded-2xl border border-dashed border-slate-800 text-center">
                  <CameraOff className="w-6 h-6 text-slate-500 mx-auto mb-1" />
                  <span className="text-xs font-semibold text-slate-300 block">No field photo available</span>
                  <span className="text-[10px] text-slate-500">
                    Verification recorded via radio telemetry without optical sensor
                  </span>
                </div>
              )}
            </div>

            <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block mb-1">
              Raw Payload Object
            </span>
            <pre className="p-4 bg-slate-900 rounded-xl border border-slate-800 text-xs font-mono text-emerald-400 overflow-x-auto max-h-56">
              {JSON.stringify(selectedEvent, null, 2)}
            </pre>
          </div>
        </div>
      )}

      {/* Lightbox Photo Modal */}
      {viewingPhoto && (
        <div
          className="fixed inset-0 z-50 bg-black/90 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150"
          onClick={() => setViewingPhoto(null)}
        >
          <div className="relative max-w-4xl max-h-[90vh] flex flex-col items-center" onClick={e => e.stopPropagation()}>
            <button
              onClick={() => setViewingPhoto(null)}
              className="absolute -top-10 right-0 text-white/80 hover:text-white flex items-center gap-1 text-xs font-bold bg-slate-900 px-3 py-1.5 rounded-xl border border-slate-800 shadow-md"
            >
              <X className="w-4 h-4" />
              <span>Close</span>
            </button>
            <div className="rounded-2xl overflow-hidden border border-slate-800 shadow-2xl bg-slate-950 max-h-[80vh]">
              <img
                src={viewingPhoto}
                alt="Full resolution field observation"
                className="max-h-[80vh] w-auto object-contain"
              />
            </div>
            <div className="mt-3 flex items-center justify-between w-full text-xs text-slate-400 px-2 font-mono">
              <span className="flex items-center gap-1.5 text-emerald-400 font-semibold">
                <ShieldCheck className="w-4 h-4" />
                <span>Verified Field Photograph</span>
              </span>
              <a
                href={viewingPhoto}
                target="_blank"
                rel="noopener noreferrer"
                className="text-slate-400 hover:text-white underline flex items-center gap-1"
              >
                <span>Open in new tab</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
