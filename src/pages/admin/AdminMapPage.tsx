// ==============================================================================
// FINNEST - Admin Cadastral Map Portal
// Digital Property & Land Parcel Management Platform
// Master Cadastral Map with Georeferenced Polygon Drawing & Parcel Registration
// ==============================================================================

import React, { useState, useEffect } from 'react';
import { propertyService } from '../../services/propertyService';
import { hardwareService } from '../../services/hardwareService';
import { Property, HardwareDevice, GeoJSONPolygon } from '../../types/database.types';
import { ParcelMap } from '../../components/map/ParcelMap';
import { CadastralParcelModal } from '../../components/map/CadastralParcelModal';
import { AreaCalculation } from '../../utils/geometry';
import { PenTool, CheckCircle, Plus, Layers, ShieldCheck, MapPin } from 'lucide-react';

export const AdminMapPage: React.FC = () => {
  const [properties, setProperties] = useState<Property[]>([]);
  const [devices, setDevices] = useState<HardwareDevice[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Drawing and Registration Modal state
  const [isDrawingMode, setIsDrawingMode] = useState<boolean>(false);
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [drawnGeometry, setDrawnGeometry] = useState<GeoJSONPolygon | null>(null);
  const [drawnArea, setDrawnArea] = useState<AreaCalculation | null>(null);
  const [drawnCentroid, setDrawnCentroid] = useState<[number, number] | null>(null);
  const [recentlyCreatedId, setRecentlyCreatedId] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const loadData = async () => {
    setLoading(true);
    const [propsRes, devsRes] = await Promise.all([
      propertyService.getProperties(),
      hardwareService.getDevices(),
    ]);
    setProperties(propsRes.data || []);
    setDevices(devsRes.data || []);
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleStartDrawing = () => {
    setIsDrawingMode(true);
    setToastMessage('Click anywhere on the map to define the boundary corners of the parcel.');
    setTimeout(() => setToastMessage(null), 5000);
  };

  const handleSaveDrawnPolygon = (
    geometry: GeoJSONPolygon,
    area: AreaCalculation,
    centroid: [number, number]
  ) => {
    setDrawnGeometry(geometry);
    setDrawnArea(area);
    setDrawnCentroid(centroid);
    setIsDrawingMode(false);
    setIsModalOpen(true);
  };

  const handleModalSuccess = (newProp: Property) => {
    setRecentlyCreatedId(newProp.id);
    setToastMessage(`Parcel ${newProp.property_id} (${newProp.title}) successfully registered and georeferenced.`);
    setTimeout(() => setToastMessage(null), 6000);
    loadData();
  };

  return (
    <div className="space-y-4">
      {/* Page Header with Action Button */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-white">
            Master Cadastral Parcel Map
          </h1>
          <p className="text-xs text-slate-400">
            Georeferenced polygon land boundaries, DTCP survey sectors, and field sensor telemetry
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          {!isDrawingMode ? (
            <button
              onClick={handleStartDrawing}
              className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold rounded-xl flex items-center gap-2 transition-all shadow-md shadow-emerald-500/20"
            >
              <PenTool className="w-4 h-4" />
              <span>Draw Cadastral Parcel</span>
            </button>
          ) : (
            <button
              onClick={() => setIsDrawingMode(false)}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-xl transition-colors border border-slate-700"
            >
              Exit Drawing Mode
            </button>
          )}
        </div>
      </div>

      {/* Floating Feedback Toast */}
      {toastMessage && (
        <div className="bg-emerald-950/90 border border-emerald-500/40 text-emerald-200 px-4 py-2.5 rounded-2xl text-xs flex items-center gap-2.5 shadow-lg animate-in fade-in">
          <CheckCircle className="w-4 h-4 text-emerald-400 flex-shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Map Container */}
      <div className="bg-slate-950 rounded-3xl p-3 border border-slate-800 shadow-sm">
        <ParcelMap
          properties={properties}
          devices={devices}
          selectedPropertyId={recentlyCreatedId}
          heightClass="h-[calc(100vh-210px)] min-h-[550px]"
          showFilters={true}
          basePortalPath="/admin"
          allowDrawing={true}
          isDrawingMode={isDrawingMode}
          onToggleDrawingMode={setIsDrawingMode}
          onSaveDrawnPolygon={handleSaveDrawnPolygon}
          onCancelDrawing={() => setIsDrawingMode(false)}
        />
      </div>

      {/* Cadastral Parcel Registration Drawer/Modal */}
      <CadastralParcelModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSuccess={handleModalSuccess}
        mode="create"
        initialGeometry={drawnGeometry}
        initialArea={drawnArea}
        initialCentroid={drawnCentroid}
      />
    </div>
  );
};
