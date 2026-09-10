// ==============================================================================
// FINNEST - Cadastral Parcel Registration & Editing Modal
// Digital Property & Land Parcel Management Platform
// Integrates georeferenced polygon geometry, geodesic area, and owner assignment
// ==============================================================================

import React, { useState, useEffect, useMemo } from 'react';
import { Property, UserProfile, PropertyStatus, PropertyType, GeoJSONPolygon } from '../../types/database.types';
import { propertyService } from '../../services/propertyService';
import { userService } from '../../services/userService';
import {
  calculatePolygonArea,
  calculateCentroid,
  validateGeoJSONPolygon,
  AreaCalculation,
} from '../../utils/geometry';
import { ParcelMap } from './ParcelMap';
import {
  X,
  Check,
  MapPin,
  Building,
  ShieldCheck,
  AlertCircle,
  PenTool,
  RotateCcw,
  Radio,
  FileText,
  HelpCircle,
} from 'lucide-react';

interface CadastralParcelModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (property: Property) => void;
  mode: 'create' | 'edit';
  initialProperty?: Property | null;
  initialGeometry?: GeoJSONPolygon | null;
  initialArea?: AreaCalculation | null;
  initialCentroid?: [number, number] | null;
}

export const CadastralParcelModal: React.FC<CadastralParcelModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  mode,
  initialProperty,
  initialGeometry,
  initialArea,
  initialCentroid,
}) => {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [saving, setSaving] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isEditorMapOpen, setIsEditorMapOpen] = useState<boolean>(false);

  // Default coordinate ring around Guindy / Chennai Cadastral Grid
  const defaultGeometry: GeoJSONPolygon = {
    type: 'Polygon',
    coordinates: [
      [
        [80.234, 12.979],
        [80.236, 12.9792],
        [80.2358, 12.9805],
        [80.2338, 12.9803],
        [80.234, 12.979],
      ],
    ],
  };

  // Form State
  const [formData, setFormData] = useState({
    property_id: '',
    title: '',
    description: '',
    owner_id: '',
    owner_verified: false,
    property_type: 'Commercial' as PropertyType,
    status: 'active' as PropertyStatus,
    survey_number: '',
    registration_number: '',
    rfid_uid: '',
    address: '',
    city: 'Chennai',
    state: 'Tamil Nadu',
    postal_code: '600001',
    area: 5000,
    area_unit: 'sq.ft',
    latitude: 12.98,
    longitude: 80.235,
  });

  // Current active polygon geometry
  const [activeGeometry, setActiveGeometry] = useState<GeoJSONPolygon>(defaultGeometry);

  // Load registered users list for titleholder dropdown
  useEffect(() => {
    async function loadUsers() {
      const { data } = await userService.getAllUsers();
      setUsers(data || []);
    }
    loadUsers();
  }, []);

  // Initialize or reset form when modal opens
  useEffect(() => {
    if (!isOpen) {
      setErrorMessage(null);
      setIsEditorMapOpen(false);
      return;
    }

    if (mode === 'edit' && initialProperty) {
      const geom = initialProperty.boundary_geojson || defaultGeometry;
      setActiveGeometry(geom);

      setFormData({
        property_id: initialProperty.property_id,
        title: initialProperty.title,
        description: initialProperty.description || '',
        owner_id: initialProperty.owner_id || '',
        owner_verified: initialProperty.owner_verified || false,
        property_type: initialProperty.property_type,
        status: initialProperty.status,
        survey_number: initialProperty.survey_number,
        registration_number: initialProperty.registration_number,
        rfid_uid: initialProperty.rfid_uid || '',
        address: initialProperty.address,
        city: initialProperty.city,
        state: initialProperty.state,
        postal_code: initialProperty.postal_code,
        area: initialProperty.area,
        area_unit: initialProperty.area_unit,
        latitude: initialProperty.latitude,
        longitude: initialProperty.longitude,
      });
    } else {
      // Create mode
      const geom = initialGeometry || defaultGeometry;
      setActiveGeometry(geom);

      const calculatedGeomArea = geom.coordinates?.[0] ? calculatePolygonArea(geom.coordinates[0]) : null;
      const calculatedGeomCentroid = geom.coordinates?.[0] ? calculateCentroid(geom.coordinates[0]) : [80.235, 12.98];

      const areaVal = initialArea?.sqFeet || calculatedGeomArea?.sqFeet || 5000;
      const centerLng = initialCentroid ? initialCentroid[0] : calculatedGeomCentroid[0];
      const centerLat = initialCentroid ? initialCentroid[1] : calculatedGeomCentroid[1];

      setFormData({
        property_id: `FN-${Math.floor(1000 + Math.random() * 9000)}`,
        title: '',
        description: '',
        owner_id: '',
        owner_verified: false,
        property_type: 'Commercial',
        status: 'active',
        survey_number: `SY-${Math.floor(100 + Math.random() * 900)}/${Math.floor(1 + Math.random() * 9)}`,
        registration_number: `TN-CHN-${new Date().getFullYear()}-REG-${Math.floor(1000 + Math.random() * 9000)}`,
        rfid_uid: '',
        address: '',
        city: 'Chennai',
        state: 'Tamil Nadu',
        postal_code: '600001',
        area: Math.round(areaVal),
        area_unit: 'sq.ft',
        latitude: centerLat,
        longitude: centerLng,
      });
    }
  }, [isOpen, mode, initialProperty, initialGeometry, initialArea, initialCentroid]);

  // Derived real-time metrics from current geometry
  const currentAreaMetrics = useMemo<AreaCalculation>(() => {
    if (!activeGeometry.coordinates || !activeGeometry.coordinates[0]) {
      return {
        sqMeters: 0,
        sqFeet: 0,
        acres: 0,
        hectares: 0,
        formattedM2: '0 m²',
        formattedSqFt: '0 sq.ft',
        formattedAcres: '0 acres',
      };
    }
    return calculatePolygonArea(activeGeometry.coordinates[0]);
  }, [activeGeometry]);

  // Selected user profile for titleholder preview
  const selectedUser = useMemo(() => {
    return users.find(u => u.id === formData.owner_id);
  }, [users, formData.owner_id]);

  // Handle polygon drawing update from mini map
  const handlePolygonUpdated = (geom: GeoJSONPolygon, area: AreaCalculation, centroid: [number, number]) => {
    setActiveGeometry(geom);
    setFormData(prev => ({
      ...prev,
      area: prev.area_unit === 'sq.m' ? Math.round(area.sqMeters) : Math.round(area.sqFeet),
      longitude: centroid[0],
      latitude: centroid[1],
    }));
    setIsEditorMapOpen(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    // 1. Validate geometry
    const geomValidation = validateGeoJSONPolygon(activeGeometry);
    if (!geomValidation.valid) {
      setErrorMessage(`Cadastral Geometry Error: ${geomValidation.error}`);
      return;
    }

    // 2. Validate required fields
    if (!formData.title.trim()) {
      setErrorMessage('Property title is required.');
      return;
    }
    if (!formData.survey_number.trim()) {
      setErrorMessage('Survey number is required.');
      return;
    }
    if (!formData.registration_number.trim()) {
      setErrorMessage('Registration document number is required.');
      return;
    }
    if (!formData.address.trim()) {
      setErrorMessage('Physical street address is required.');
      return;
    }

    try {
      setSaving(true);

      const payload: Partial<Property> = {
        property_id: formData.property_id,
        title: formData.title.trim(),
        description: formData.description.trim() || null,
        owner_id: formData.owner_id || null,
        property_type: formData.property_type,
        status: formData.status,
        survey_number: formData.survey_number.trim(),
        registration_number: formData.registration_number.trim(),
        rfid_uid: formData.rfid_uid.trim().toUpperCase() || null,
        address: formData.address.trim(),
        city: formData.city.trim(),
        state: formData.state.trim(),
        postal_code: formData.postal_code.trim(),
        area: Number(formData.area),
        area_unit: formData.area_unit,
        latitude: Number(formData.latitude),
        longitude: Number(formData.longitude),
        boundary_geojson: activeGeometry,
      };

      // If owner is selected and owner_verified is checked, certify titleholder in profiles
      if (formData.owner_id && formData.owner_verified) {
        await userService.verifyOwner(formData.owner_id);
      }

      if (mode === 'create') {
        const { data, error } = await propertyService.createProperty(payload);
        if (error || !data) {
          throw new Error(error || 'Failed to create cadastral parcel.');
        }
        onSuccess(data);
      } else if (initialProperty) {
        const { data, error } = await propertyService.updateProperty(initialProperty.id, payload);
        if (error || !data) {
          throw new Error(error || 'Failed to update cadastral parcel.');
        }
        onSuccess(data);
      }
      onClose();
    } catch (err: any) {
      setErrorMessage(err.message || 'An unexpected error occurred while saving.');
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[1100] flex items-center justify-center p-4 sm:p-6 bg-slate-950/80 backdrop-blur-sm overflow-y-auto animate-in fade-in duration-150">
      <div className="bg-slate-950 border border-slate-800 rounded-3xl w-full max-w-4xl shadow-2xl overflow-hidden my-auto max-h-[92vh] flex flex-col">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800/80 bg-slate-900/60">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-widest text-emerald-400">
              {mode === 'create' ? 'Official Cadastral Parcel Registration' : 'Edit Parcel Specifications'}
            </span>
            <h2 className="text-lg font-bold text-white mt-0.5">
              {mode === 'create' ? 'Register Georeferenced Land Parcel' : `Update Parcel: ${formData.property_id}`}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6 overflow-y-auto flex-1">
          {/* Error Banner */}
          {errorMessage && (
            <div className="p-3.5 bg-red-950/60 border border-red-800/60 rounded-xl flex items-center gap-2.5 text-xs text-red-300">
              <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Cadastral Polygon Geometry Overview Box */}
          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
              <div>
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                  <span className="text-xs font-bold text-white uppercase tracking-wider">
                    Georeferenced Polygon Boundary
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Closed GeoJSON coordinates ring with live geodesic spherical area calculation
                </p>
              </div>

              <button
                type="button"
                onClick={() => setIsEditorMapOpen(!isEditorMapOpen)}
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-xl flex items-center gap-1.5 transition-colors border border-slate-700 self-start sm:self-auto"
              >
                <PenTool className="w-3.5 h-3.5 text-emerald-400" />
                <span>{isEditorMapOpen ? 'Hide Boundary Map' : 'Refine / Redraw on Map'}</span>
              </button>
            </div>

            {/* Metrics Ribbon */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mt-3 text-xs">
              <div className="bg-slate-950/60 p-2.5 rounded-xl border border-slate-800">
                <span className="text-[10px] uppercase font-bold text-slate-500 block">Spherical Area (m²)</span>
                <span className="text-sm font-bold text-emerald-400 block mt-0.5">
                  {currentAreaMetrics.formattedM2}
                </span>
              </div>

              <div className="bg-slate-950/60 p-2.5 rounded-xl border border-slate-800">
                <span className="text-[10px] uppercase font-bold text-slate-500 block">Imperial (sq.ft / acres)</span>
                <span className="text-xs font-mono text-slate-300 block mt-0.5 truncate">
                  {currentAreaMetrics.formattedSqFt} ({currentAreaMetrics.formattedAcres})
                </span>
              </div>

              <div className="bg-slate-950/60 p-2.5 rounded-xl border border-slate-800">
                <span className="text-[10px] uppercase font-bold text-slate-500 block">Centroid Coordinates</span>
                <span className="text-xs font-mono text-slate-300 block mt-0.5 truncate">
                  {formData.latitude.toFixed(4)}, {formData.longitude.toFixed(4)}
                </span>
              </div>

              <div className="bg-slate-950/60 p-2.5 rounded-xl border border-slate-800">
                <span className="text-[10px] uppercase font-bold text-slate-500 block">Polygon Corners</span>
                <span className="text-xs font-mono text-slate-300 block mt-0.5">
                  {activeGeometry.coordinates?.[0]?.length ? activeGeometry.coordinates[0].length - 1 : 0} Vertices
                </span>
              </div>
            </div>

            {/* Interactive Embedded Cadastral Drawing Map (Collapsible) */}
            {isEditorMapOpen && (
              <div className="mt-4 pt-3 border-t border-slate-800">
                <div className="mb-2 text-[11px] text-slate-400 flex items-center justify-between">
                  <span>Click map to append corners, or drag corner handles (1, 2, 3...) to adjust boundaries.</span>
                  <span className="font-mono text-emerald-400 text-[10px]">WGS84 Cadastral Datum</span>
                </div>
                <div className="rounded-xl overflow-hidden border border-slate-800 h-64">
                  <ParcelMap
                    properties={[]}
                    heightClass="h-64"
                    showFilters={false}
                    allowDrawing={true}
                    isDrawingMode={true}
                    initialEditGeometry={activeGeometry}
                    onSaveDrawnPolygon={handlePolygonUpdated}
                    onCancelDrawing={() => setIsEditorMapOpen(false)}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Form Fields Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Title */}
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Property / Parcel Name <span className="text-emerald-500">*</span>
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Phoenix Tech Park - Cadastral Block 4"
                value={formData.title}
                onChange={e => setFormData({ ...formData, title: e.target.value })}
                className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500 transition-colors"
              />
            </div>

            {/* Parcel ID & Survey Number */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Cadastral Parcel ID <span className="text-emerald-500">*</span>
              </label>
              <input
                type="text"
                required
                value={formData.property_id}
                onChange={e => setFormData({ ...formData, property_id: e.target.value.toUpperCase() })}
                className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs font-mono font-bold text-emerald-400 focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Survey Number <span className="text-emerald-500">*</span>
              </label>
              <input
                type="text"
                required
                placeholder="e.g. SY-412/1A"
                value={formData.survey_number}
                onChange={e => setFormData({ ...formData, survey_number: e.target.value })}
                className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-emerald-500"
              />
            </div>

            {/* Titleholder Selection & KYC Verification */}
            <div className="sm:col-span-2 bg-slate-900/40 p-3.5 rounded-2xl border border-slate-800 space-y-2.5">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-semibold text-slate-300">
                  Assigned Titleholder / Legal Owner
                </label>
                {selectedUser && (
                  <span
                    className={`inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold rounded-md ${
                      selectedUser.is_verified
                        ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                        : 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                    }`}
                  >
                    <ShieldCheck className="w-3 h-3" />
                    {selectedUser.is_verified ? 'Verified Titleholder' : 'Registered User (Unverified)'}
                  </span>
                )}
              </div>

              <select
                value={formData.owner_id}
                onChange={e => {
                  const uid = e.target.value;
                  const matched = users.find(u => u.id === uid);
                  setFormData({
                    ...formData,
                    owner_id: uid,
                    owner_verified: matched?.is_verified || false,
                  });
                }}
                className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
              >
                <option value="">-- Government / Cadastral Land Bank (Unassigned) --</option>
                {users.map(u => (
                  <option key={u.id} value={u.id}>
                    {u.full_name} ({u.email}) {u.is_verified ? '✓ Verified' : ''}
                  </option>
                ))}
              </select>

              {formData.owner_id && (
                <div className="flex items-center gap-2 pt-1">
                  <input
                    type="checkbox"
                    id="modal_owner_verified"
                    checked={formData.owner_verified}
                    onChange={e => setFormData({ ...formData, owner_verified: e.target.checked })}
                    className="w-4 h-4 rounded text-emerald-500 focus:ring-emerald-500 bg-slate-900 border-slate-700"
                  />
                  <label htmlFor="modal_owner_verified" className="text-xs text-slate-300 cursor-pointer">
                    Certify titleholder ownership as KYC-verified for this parcel
                  </label>
                </div>
              )}
            </div>

            {/* Area & Unit */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Parcel Area <span className="text-emerald-500">*</span>
              </label>
              <input
                type="number"
                step="any"
                required
                value={formData.area}
                onChange={e => setFormData({ ...formData, area: Number(e.target.value) })}
                className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Area Unit</label>
              <select
                value={formData.area_unit}
                onChange={e => setFormData({ ...formData, area_unit: e.target.value })}
                className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
              >
                <option value="sq.ft">Square Feet (sq.ft)</option>
                <option value="acres">Acres</option>
                <option value="hectares">Hectares</option>
                <option value="sq.m">Square Meters (sq.m)</option>
              </select>
            </div>

            {/* Property Type & Status */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Property Type</label>
              <select
                value={formData.property_type}
                onChange={e => setFormData({ ...formData, property_type: e.target.value as PropertyType })}
                className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
              >
                <option value="Commercial">Commercial</option>
                <option value="Residential">Residential</option>
                <option value="Industrial">Industrial</option>
                <option value="Agricultural">Agricultural</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Cadastral Status</label>
              <select
                value={formData.status}
                onChange={e => setFormData({ ...formData, status: e.target.value as PropertyStatus })}
                className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500 capitalize"
              >
                <option value="active">Active</option>
                <option value="pending">Pending</option>
                <option value="disputed">Disputed</option>
                <option value="transferred">Transferred</option>
                <option value="archived">Archived</option>
              </select>
            </div>

            {/* Registration Doc & RFID UID */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Registration Document Number <span className="text-emerald-500">*</span>
              </label>
              <input
                type="text"
                required
                placeholder="e.g. TN-CHN-2024-REG-0941"
                value={formData.registration_number}
                onChange={e => setFormData({ ...formData, registration_number: e.target.value })}
                className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">RFID Hardware Anchor UID</label>
              <input
                type="text"
                placeholder="e.g. A1B2C3D4 (Optional)"
                value={formData.rfid_uid}
                onChange={e => setFormData({ ...formData, rfid_uid: e.target.value.toUpperCase() })}
                className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs font-mono text-emerald-400 placeholder:text-slate-600 focus:outline-none focus:border-emerald-500"
              />
            </div>

            {/* Street Address */}
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Physical Property Address <span className="text-emerald-500">*</span>
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Plot 14-A, Rajiv Gandhi Salai, Taramani"
                value={formData.address}
                onChange={e => setFormData({ ...formData, address: e.target.value })}
                className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
              />
            </div>

            {/* City, State, Pincode */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">City</label>
              <input
                type="text"
                required
                value={formData.city}
                onChange={e => setFormData({ ...formData, city: e.target.value })}
                className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Postal Code</label>
              <input
                type="text"
                required
                value={formData.postal_code}
                onChange={e => setFormData({ ...formData, postal_code: e.target.value })}
                className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
              />
            </div>

            {/* Description */}
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-300 mb-1">Description / Cadastral Notes</label>
              <textarea
                rows={2}
                placeholder="Additional survey boundaries, zoning restrictions, or title notes..."
                value={formData.description}
                onChange={e => setFormData({ ...formData, description: e.target.value })}
                className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>

          {/* Legal Cadastral Disclaimer */}
          <div className="p-3 bg-slate-900/50 border border-slate-800/80 rounded-xl text-[10px] text-slate-500 leading-relaxed flex items-start gap-2">
            <HelpCircle className="w-3.5 h-3.5 text-slate-400 flex-shrink-0 mt-0.5" />
            <span>
              <strong>Cadastral Datum Notice:</strong> Digital parcel polygons in FinNest are georeferenced boundary records
              for digital property and titleholder management. They facilitate administrative governance and do not replace physical
              cadastral survey certifications issued by statutory land survey authorities.
            </span>
          </div>

          {/* Modal Actions */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-white transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2.5 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-slate-950 font-bold text-xs rounded-xl transition-all shadow-md shadow-emerald-500/20 flex items-center gap-2"
            >
              <Check className="w-4 h-4" />
              <span>
                {saving
                  ? 'Saving to Supabase...'
                  : mode === 'create'
                  ? 'Register Parcel to Database'
                  : 'Save Geometry Updates'}
              </span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
