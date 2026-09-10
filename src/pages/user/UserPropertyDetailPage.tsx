// ==============================================================================
// FINNEST - Property Dossier & Inspection Page
// Digital Property & Land Parcel Management Platform
// ==============================================================================

import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../features/auth/AuthContext';
import { propertyService } from '../../services/propertyService';
import { ownershipService } from '../../services/ownershipService';
import { imageService } from '../../services/imageService';
import { hardwareService, formatVerificationSource } from '../../services/hardwareService';
import { Property, OwnershipHistory, PropertyImage, HardwareEvent, PropertyTaxAssessment } from '../../types/database.types';
import { STATUS_COLORS } from '../../lib/constants';
import { ParcelMap } from '../../components/map/ParcelMap';
import { taxService } from '../../services/taxService';
import { formatCurrency } from '../../utils/taxEngine';
import {
  ArrowLeft,
  MapPin,
  Upload,
  ShieldCheck,
  Radio,
  Image as ImageIcon,
  Trash2,
  AlertTriangle,
  Receipt,
  ExternalLink,
  Camera,
  CameraOff,
  Maximize2,
  X,
} from 'lucide-react';

export const UserPropertyDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [property, setProperty] = useState<Property | null>(null);
  const [images, setImages] = useState<PropertyImage[]>([]);
  const [history, setHistory] = useState<OwnershipHistory[]>([]);
  const [events, setEvents] = useState<HardwareEvent[]>([]);
  const [taxAssessment, setTaxAssessment] = useState<PropertyTaxAssessment | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [viewingPhoto, setViewingPhoto] = useState<string | null>(null);

  // Upload modal/state
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [caption, setCaption] = useState<string>('');
  const [uploading, setUploading] = useState<boolean>(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const loadDetails = async () => {
    if (!id) return;
    try {
      setLoading(true);
      const { data: prop } = await propertyService.getPropertyById(id);
      if (prop) {
        setProperty(prop);

        // Load images
        const { data: imgs } = await imageService.getPropertyImages(prop.id);
        setImages(imgs || []);

        // Load ownership history
        const { data: hist } = await ownershipService.getOwnershipHistory(prop.id);
        setHistory(hist || []);

        // Load hardware events
        const { data: evts } = await hardwareService.getHardwareEvents(10, prop.id);
        setEvents(evts || []);

        // Load property tax assessment
        const { data: taxList } = await taxService.getAssessments({ property_id: prop.id });
        if (taxList && taxList.length > 0) {
          setTaxAssessment(taxList[0]);
        } else {
          setTaxAssessment(null);
        }
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDetails();
  }, [id]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setSelectedFile(file);
      setPreviewUrl(URL.createObjectURL(file));
      setCaption(file.name.replace(/\.[^/.]+$/, ''));
      setUploadError(null);
    }
  };

  const handleUploadImage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile || !property) return;

    setUploading(true);
    setUploadError(null);

    const { data: newImage, error } = await imageService.uploadPropertyImage(
      property.id,
      selectedFile,
      caption,
      user?.id
    );

    setUploading(false);

    if (error || !newImage) {
      setUploadError(error || 'Failed to upload photograph');
      return;
    }

    // Append to images
    setImages(prev => [newImage, ...prev]);
    setSelectedFile(null);
    setPreviewUrl(null);
    setCaption('');
  };

  const handleDeleteImage = async (imgId: string, path: string) => {
    if (!window.confirm('Delete this photograph?')) return;
    await imageService.deletePropertyImage(imgId, path);
    setImages(prev => prev.filter(img => img.id !== imgId));
  };

  if (loading) {
    return (
      <div className="py-20 text-center">
        <div className="w-8 h-8 border-3 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
        <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider">Loading Property Dossier...</p>
      </div>
    );
  }

  if (!property) {
    return (
      <div className="bg-white rounded-3xl border border-slate-200 p-12 text-center max-w-lg mx-auto my-12">
        <AlertTriangle className="w-10 h-10 text-amber-500 mx-auto mb-3" />
        <h2 className="text-base font-bold text-slate-900">Property Not Found</h2>
        <p className="text-xs text-slate-500 mt-1">The requested cadastral parcel does not exist or has been relocated.</p>
        <button
          onClick={() => navigate(-1)}
          className="mt-5 px-4 py-2 bg-slate-900 text-white text-xs font-semibold rounded-xl hover:bg-slate-800"
        >
          Return to Previous
        </button>
      </div>
    );
  }

  const statusConfig = STATUS_COLORS[property.status] || STATUS_COLORS.active;

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Top Breadcrumb & Actions */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-1.5 text-xs font-bold text-slate-600 hover:text-slate-900 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Properties</span>
        </button>

        <div className="flex items-center gap-2">
          <span className="font-mono text-xs font-bold bg-slate-100 text-slate-800 px-3 py-1 rounded-lg border border-slate-200">
            {property.property_id}
          </span>
          <span className={`px-3 py-1 rounded-lg text-xs font-bold uppercase tracking-wider border ${statusConfig.textColor}`}>
            {statusConfig.label}
          </span>
        </div>
      </div>

      {/* Main Dossier Header */}
      <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/80 shadow-xs">
        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-6">
          <div className="flex-1">
            <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-md border border-emerald-200 uppercase tracking-wider">
              {property.property_type} Land Parcel
            </span>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 mt-2">
              {property.title}
            </h1>
            <div className="flex items-center gap-2 text-slate-500 text-xs mt-2">
              <MapPin className="w-4 h-4 text-slate-400 flex-shrink-0" />
              <span>{property.address}, {property.city}, {property.state} {property.postal_code}</span>
            </div>
            {property.description && (
              <p className="mt-4 text-xs sm:text-sm text-slate-600 leading-relaxed max-w-3xl">
                {property.description}
              </p>
            )}
          </div>

          {/* Key Metric Highlights */}
          <div className="grid grid-cols-2 gap-3 min-w-[280px]">
            <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100">
              <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">Land Area</span>
              <span className="text-base font-bold text-slate-900 mt-0.5 block">
                {property.area.toLocaleString()} {property.area_unit}
              </span>
            </div>
            <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100">
              <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">Survey Number</span>
              <span className="text-base font-mono font-bold text-slate-900 mt-0.5 block">
                {property.survey_number}
              </span>
            </div>
            <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100">
              <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">Registration Doc</span>
              <span className="text-xs font-mono font-bold text-slate-800 mt-0.5 block truncate">
                {property.registration_number}
              </span>
            </div>
            <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100">
              <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">Field Verification</span>
              {events.length > 0 ? (
                <div className="mt-0.5">
                  <span className="text-xs font-bold text-emerald-700 flex items-center gap-1">
                    <ShieldCheck className="w-3.5 h-3.5" />
                    Verified
                  </span>
                  <span className="text-[10px] text-slate-500 block font-mono truncate">
                    {formatVerificationSource(events[0].verification_source)}
                  </span>
                </div>
              ) : (
                <div className="mt-0.5">
                  <span className="text-xs font-semibold text-slate-500 flex items-center gap-1">
                    ○ Not Yet Verified
                  </span>
                  <span className="text-[10px] text-slate-400 block font-mono">
                    Pending Ground Audit
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Cadastral Parcel Map */}
      <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-xs">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-base font-bold text-slate-900">Cadastral Polygon Boundary</h2>
            <p className="text-xs text-slate-500">True georeferenced boundary vector on OpenStreetMap</p>
          </div>
          <div className="font-mono text-xs text-slate-500 bg-slate-50 px-3 py-1 rounded-xl border border-slate-200">
            Coordinates: {property.latitude.toFixed(4)}, {property.longitude.toFixed(4)}
          </div>
        </div>

        <div className="h-[420px] rounded-2xl overflow-hidden border border-slate-100">
          <ParcelMap
            properties={[property]}
            selectedPropertyId={property.id}
            verificationEvents={events}
            heightClass="h-[420px]"
            showFilters={false}
            showDossier={false}
            basePortalPath="/portal"
          />
        </div>
      </div>

      {/* Property Tax Assessment Summary */}
      <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4 pb-3 border-b border-slate-100">
          <div>
            <div className="flex items-center gap-2">
              <Receipt className="w-4 h-4 text-emerald-600" />
              <h2 className="text-base font-bold text-slate-900">Property Tax Assessment</h2>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Annual municipal valuation and statutory demand clearance
            </p>
          </div>

          <button
            onClick={() => navigate('/portal/tax')}
            className="px-3.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-xl flex items-center gap-1.5 transition-colors self-start sm:self-auto"
          >
            <span>View Tax Details</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </button>
        </div>

        {taxAssessment ? (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100">
              <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">Assessment Year</span>
              <span className="text-sm font-bold text-slate-900 mt-0.5 block font-mono">
                FY {taxAssessment.assessment_year}
              </span>
            </div>

            <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100">
              <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">Assessed Value</span>
              <span className="text-sm font-bold text-slate-900 mt-0.5 block font-mono">
                {formatCurrency(taxAssessment.assessed_value)}
              </span>
            </div>

            <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100">
              <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">Tax Due</span>
              <span className="text-sm font-bold text-emerald-700 mt-0.5 block font-mono">
                {formatCurrency(taxAssessment.total_due)}
              </span>
            </div>

            <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100">
              <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">Status & Due Date</span>
              <div className="mt-0.5 flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-700 capitalize">
                  {taxAssessment.status}
                </span>
                <span className="text-[10px] text-slate-400 font-mono">
                  {taxAssessment.due_date}
                </span>
              </div>
            </div>
          </div>
        ) : (
          <div className="py-4 text-center text-xs text-slate-500 bg-slate-50 rounded-2xl border border-slate-100">
            No active municipal tax assessment records generated yet for this cadastral parcel.
          </div>
        )}
      </div>

      {/* Property Photographs & Direct Upload */}
      <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6 pb-4 border-b border-slate-100">
          <div>
            <h2 className="text-base font-bold text-slate-900">Property Photographs</h2>
            <p className="text-xs text-slate-500">
              Site photographs stored securely in Supabase Storage
            </p>
          </div>
        </div>

        {/* Upload Form */}
        <form onSubmit={handleUploadImage} className="mb-8 p-5 bg-slate-50 rounded-2xl border border-slate-200/80">
          <span className="text-xs font-bold text-slate-800 block mb-2">Upload Property Image</span>
          <p className="text-xs text-slate-500 mb-4">
            Select a property photo from your computer or phone to attach it to this land parcel dossier.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-start">
            <div>
              <label className="block border-2 border-dashed border-slate-300 rounded-xl p-4 text-center cursor-pointer hover:border-emerald-500 hover:bg-emerald-50/20 transition-all">
                <Upload className="w-5 h-5 text-slate-400 mx-auto mb-1" />
                <span className="text-xs font-semibold text-slate-700 block">
                  {selectedFile ? selectedFile.name : 'Choose Photograph'}
                </span>
                <span className="text-[10px] text-slate-400">JPG, PNG, WebP up to 10MB</span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleFileChange}
                  className="hidden"
                />
              </label>

              {uploadError && (
                <p className="text-[11px] text-red-600 font-medium mt-2">{uploadError}</p>
              )}
            </div>

            {previewUrl && (
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <img
                    src={previewUrl}
                    alt="Upload Preview"
                    className="w-20 h-20 rounded-xl object-cover border border-slate-200 shadow-xs"
                  />
                  <div className="flex-1">
                    <input
                      type="text"
                      placeholder="Caption (e.g. South Perimeter Fence)"
                      value={caption}
                      onChange={e => setCaption(e.target.value)}
                      className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium text-slate-800 placeholder-slate-400 focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={uploading}
                  className="w-full py-2 px-4 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
                >
                  {uploading ? (
                    <span>Uploading to Supabase Storage...</span>
                  ) : (
                    <>
                      <Upload className="w-3.5 h-3.5" />
                      <span>Upload Property Image</span>
                    </>
                  )}
                </button>
              </div>
            )}
          </div>
        </form>

        {/* Image Gallery */}
        {images.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {images.map((img) => (
              <div key={img.id} className="group relative rounded-2xl overflow-hidden border border-slate-200/80 bg-slate-100 shadow-xs flex flex-col justify-between">
                <div className="h-48 w-full overflow-hidden">
                  <img
                    src={img.image_url}
                    alt={img.caption || 'Property image'}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                </div>
                <div className="p-3 bg-white flex items-center justify-between text-xs">
                  <div className="truncate pr-2">
                    <p className="font-semibold text-slate-800 truncate">{img.caption || 'Site Photograph'}</p>
                    <span className="text-[10px] text-slate-400">{new Date(img.created_at).toLocaleDateString()}</span>
                  </div>
                  <button
                    onClick={() => handleDeleteImage(img.id, img.storage_path)}
                    title="Delete photograph"
                    className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="py-8 text-center text-slate-400 text-xs">
            <ImageIcon className="w-8 h-8 text-slate-300 mx-auto mb-2 opacity-50" />
            No property images uploaded yet.
          </div>
        )}
      </div>

      {/* Ownership Transfer History & Hardware Verification Timeline */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Ownership Chain */}
        <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-xs">
          <h2 className="text-base font-bold text-slate-900 mb-1">Chain of Title History</h2>
          <p className="text-xs text-slate-500 mb-4">Historical audit record of all title reassignments</p>

          <div className="space-y-3">
            {history.length > 0 ? (
              history.map((h) => (
                <div key={h.id} className="p-3.5 rounded-2xl bg-slate-50 border border-slate-100 text-xs">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="font-bold text-slate-800">
                      {h.previous_owner?.full_name || 'Prior Holder'} &rarr; {h.new_owner?.full_name || 'New Holder'}
                    </span>
                    <span className="text-[10px] font-mono text-slate-400">
                      {new Date(h.changed_at).toLocaleDateString()}
                    </span>
                  </div>
                  <p className="text-slate-600 text-[11px] leading-relaxed">
                    Reason: {h.reason}
                  </p>
                </div>
              ))
            ) : (
              <div className="py-6 text-center text-slate-400 text-xs">
                No historical ownership transfers recorded. Current title is original assignment.
              </div>
            )}
          </div>
        </div>

        {/* Property Verification History */}
        <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between mb-1">
            <h2 className="text-base font-bold text-slate-900">Property Verification History</h2>
            <Radio className="w-4 h-4 text-emerald-600" />
          </div>
          <p className="text-xs text-slate-500 mb-4">
            Traceable on-site cadastral audits, GPS observations, and RFID telemetry records
          </p>

          <div className="space-y-3">
            {events.length > 0 ? (
              events.map((ev) => {
                const src = ev.verification_source || (ev.payload as any)?.source || (ev.device_id?.startsWith('SIM') ? 'simulator' : 'hardware');
                const srcBadgeColor = src === 'simulator'
                  ? 'bg-purple-50 text-purple-700 border-purple-200'
                  : src === 'manual'
                  ? 'bg-amber-50 text-amber-700 border-amber-200'
                  : 'bg-blue-50 text-blue-700 border-blue-200';

                return (
                  <div key={ev.id} className="p-3.5 rounded-2xl bg-slate-50 border border-slate-100 text-xs">
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-1.5">
                        <span className="inline-flex items-center gap-1 font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 text-[10px]">
                          <ShieldCheck className="w-3 h-3" />
                          Verified
                        </span>
                        <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border ${srcBadgeColor}`}>
                          {formatVerificationSource(src)}
                        </span>
                      </div>
                      <span className="text-[10px] text-slate-400 font-mono">
                        {new Date(ev.created_at).toLocaleDateString()}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 mt-2 pt-2 border-t border-slate-200/50 text-[11px] text-slate-600">
                      <div>
                        <span className="text-[10px] text-slate-400 block uppercase font-semibold">RFID Tag</span>
                        <span className="font-mono font-bold text-emerald-700">{ev.rfid_uid || 'N/A'}</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400 block uppercase font-semibold">GPS Coordinates</span>
                        <span className="font-mono">{ev.latitude?.toFixed(5)}, {ev.longitude?.toFixed(5)}</span>
                      </div>
                    </div>

                    {/* Actual Field Verification Photo or Clean Placeholder */}
                    {ev.image_url ? (
                      <div className="mt-3 bg-white p-2.5 rounded-2xl border border-emerald-200/80 shadow-xs">
                        <div className="flex items-center justify-between mb-1.5 px-1">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-800 flex items-center gap-1">
                            <Camera className="w-3.5 h-3.5 text-emerald-600" />
                            ACTUAL FIELD PHOTO
                          </span>
                          <button
                            type="button"
                            onClick={() => setViewingPhoto(ev.image_url!)}
                            className="text-[10px] text-emerald-700 hover:underline font-semibold flex items-center gap-1"
                          >
                            <Maximize2 className="w-3 h-3" />
                            <span>Enlarge</span>
                          </button>
                        </div>
                        <div
                          className="h-44 rounded-xl overflow-hidden bg-slate-100 relative group cursor-pointer"
                          onClick={() => setViewingPhoto(ev.image_url!)}
                        >
                          <img
                            src={ev.image_url}
                            alt={`Field verification capture for ${property.property_id}`}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                            onError={(e) => {
                              (e.target as HTMLElement).style.display = 'none';
                              const el = document.getElementById(`user-hist-fallback-${ev.id}`);
                              if (el) el.style.display = 'flex';
                            }}
                          />
                          <div
                            id={`user-hist-fallback-${ev.id}`}
                            style={{ display: 'none' }}
                            className="w-full h-full flex flex-col items-center justify-center p-3 text-center bg-slate-100 text-slate-400"
                          >
                            <CameraOff className="w-6 h-6 text-slate-400 mb-1" />
                            <span className="text-xs font-semibold text-slate-500">No field photo available</span>
                          </div>
                          <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-xs font-semibold gap-1">
                            <Maximize2 className="w-4 h-4" />
                            <span>Click to view full photo</span>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="mt-2.5 py-2 px-3 bg-slate-100/80 rounded-xl text-slate-500 text-[11px] flex items-center gap-2 border border-slate-200/50">
                        <CameraOff className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                        <span className="italic">No field photo available</span>
                      </div>
                    )}
                  </div>
                );
              })
            ) : (
              <div className="py-8 text-center text-slate-400 text-xs">
                No field verification records logged for this parcel yet.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Full Resolution Photo Lightbox Modal */}
      {viewingPhoto && (
        <div
          className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150"
          onClick={() => setViewingPhoto(null)}
        >
          <div className="relative max-w-4xl max-h-[90vh] flex flex-col items-center" onClick={e => e.stopPropagation()}>
            <button
              onClick={() => setViewingPhoto(null)}
              className="absolute -top-10 right-0 text-white/80 hover:text-white flex items-center gap-1 text-xs font-bold bg-slate-900 px-3 py-1.5 rounded-xl border border-slate-700 shadow-md"
            >
              <X className="w-4 h-4" />
              <span>Close</span>
            </button>
            <div className="rounded-2xl overflow-hidden border border-slate-700 shadow-2xl bg-slate-950 max-h-[80vh]">
              <img
                src={viewingPhoto}
                alt="Full resolution field verification"
                className="max-h-[80vh] w-auto object-contain"
              />
            </div>
            <div className="mt-3 flex items-center justify-between w-full text-xs text-slate-300 px-2 font-mono">
              <span className="flex items-center gap-1.5 text-emerald-400 font-semibold">
                <ShieldCheck className="w-4 h-4" />
                <span>Verified Field Observation Photo</span>
              </span>
              <a
                href={viewingPhoto}
                target="_blank"
                rel="noopener noreferrer"
                className="text-slate-300 hover:text-white underline flex items-center gap-1"
              >
                <span>Open original</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
