// ==============================================================================
// FINNEST - Cadastral Land Parcel Map Component
// Renders true GeoJSON parcel polygons with interactive hover, click dossier,
// status color fills, live GPS hardware node telemetry, and Cadastral Polygon Drawing/Editing
// ==============================================================================

import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
  MapContainer,
  TileLayer,
  GeoJSON,
  Marker,
  Popup,
  Tooltip,
  Polyline,
  Polygon,
  useMap,
  useMapEvents,
} from 'react-leaflet';
import L from 'leaflet';
import { Property, PropertyStatus, HardwareDevice, HardwareEvent, GeoJSONPolygon } from '../../types/database.types';
import { DEFAULT_MAP_CENTER, DEFAULT_MAP_ZOOM, STATUS_COLORS } from '../../lib/constants';
import { useNavigate } from 'react-router-dom';
import {
  calculatePolygonArea,
  calculateCentroid,
  AreaCalculation,
  geoJSONToLeaflet,
  leafletToGeoJSON,
  validateGeoJSONPolygon,
} from '../../utils/geometry';
import {
  Layers,
  Search,
  Maximize2,
  MapPin,
  ExternalLink,
  ShieldCheck,
  Compass,
  Radio,
  X,
  Building,
  PenTool,
  Undo2,
  RotateCcw,
  Check,
  Move,
  Eye,
  AlertCircle,
} from 'lucide-react';

export interface ParcelMapProps {
  properties: Property[];
  selectedPropertyId?: string | null;
  onSelectProperty?: (property: Property | null) => void;
  devices?: HardwareDevice[];
  activeDeviceId?: string | null;
  verificationEvents?: HardwareEvent[];
  heightClass?: string;
  showFilters?: boolean;
  showDossier?: boolean;
  basePortalPath?: string; // '/portal' or '/admin'

  // Cadastral Drawing & Editing capabilities
  allowDrawing?: boolean;
  isDrawingMode?: boolean;
  onToggleDrawingMode?: (active: boolean) => void;
  onSaveDrawnPolygon?: (geometry: GeoJSONPolygon, area: AreaCalculation, centroid: [number, number]) => void;
  initialEditGeometry?: GeoJSONPolygon | null;
  onCancelDrawing?: () => void;
}

// Controller component to smoothly pan/zoom map safely
const MapController: React.FC<{
  bounds: L.LatLngBoundsExpression | null;
  center?: [number, number];
  zoom?: number;
}> = ({ bounds, center, zoom }) => {
  const map = useMap();

  useEffect(() => {
    if (bounds) {
      try {
        map.fitBounds(bounds, { padding: [50, 50], maxZoom: 17, duration: 1 });
      } catch (e) {}
    } else if (center && Array.isArray(center) && !isNaN(center[0]) && !isNaN(center[1])) {
      try {
        map.flyTo(center, zoom || map.getZoom(), { duration: 1 });
      } catch (e) {}
    }
  }, [bounds, center, zoom, map]);

  // Handle container resize
  useEffect(() => {
    const timer = setTimeout(() => {
      try {
        map.invalidateSize();
      } catch (e) {}
    }, 250);
    return () => clearTimeout(timer);
  }, [map]);

  return null;
};

// Map click event listener for polygon drawing
const MapDrawingHandler: React.FC<{
  isDrawing: boolean;
  isClosed: boolean;
  onAddVertex: (latlng: L.LatLng) => void;
}> = ({ isDrawing, isClosed, onAddVertex }) => {
  useMapEvents({
    click(e) {
      if (isDrawing && !isClosed) {
        onAddVertex(e.latlng);
      }
    },
  });
  return null;
};

// Pulsing hardware node marker
function createDeviceMarkerIcon(isOnline: boolean) {
  const color = isOnline ? '#10b981' : '#64748b';
  const pulseHtml = isOnline
    ? `<div style="
        position: absolute;
        top: -6px;
        left: -6px;
        width: 36px;
        height: 36px;
        border-radius: 50%;
        background-color: ${color};
        opacity: 0.4;
        animation: ping 1.5s cubic-bezier(0, 0, 0.2, 1) infinite;
      "></div>`
    : '';

  const html = `
    <div style="position: relative; width: 24px; height: 24px; display: flex; align-items: center; justify-content: center;">
      ${pulseHtml}
      <div style="
        width: 20px;
        height: 20px;
        background-color: ${color};
        border: 2px solid white;
        border-radius: 50%;
        box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.3);
        display: flex;
        align-items: center;
        justify-content: center;
      ">
        <div style="width: 6px; height: 6px; background-color: white; border-radius: 50%;"></div>
      </div>
    </div>
  `;

  return L.divIcon({
    className: 'hardware-node-marker',
    html,
    iconSize: [24, 24],
    iconAnchor: [12, 12],
    popupAnchor: [0, -14],
  });
}

// Draggable vertex marker icon
function createVertexMarkerIcon(index: number, isFirst: boolean, isDraggable: boolean) {
  return L.divIcon({
    className: 'cadastral-vertex-marker',
    html: `
      <div style="
        width: ${isFirst ? '22px' : '18px'};
        height: ${isFirst ? '22px' : '18px'};
        background: ${isFirst ? '#059669' : '#0284c7'};
        border: 2px solid #ffffff;
        border-radius: 50%;
        box-shadow: 0 3px 6px rgba(0,0,0,0.4);
        display: flex;
        align-items: center;
        justify-content: center;
        color: white;
        font-size: 10px;
        font-weight: 800;
        font-family: monospace;
        cursor: ${isDraggable ? 'grab' : 'pointer'};
        transition: transform 0.15s ease;
      ">
        ${index + 1}
      </div>
    `,
    iconSize: isFirst ? [22, 22] : [18, 18],
    iconAnchor: isFirst ? [11, 11] : [9, 9],
  });
}

// Field verification GPS observation point icon (Target Crosshair)
function createVerificationMarkerIcon(source?: string | null) {
  const s = (source || '').toLowerCase();
  const color = s === 'simulator' ? '#9333ea' : s === 'manual' ? '#d97706' : '#2563eb';
  const pulseColor = s === 'simulator' ? 'rgba(147, 51, 234, 0.4)' : s === 'manual' ? 'rgba(217, 119, 6, 0.4)' : 'rgba(37, 99, 235, 0.4)';

  const html = `
    <div style="position: relative; width: 28px; height: 28px; display: flex; align-items: center; justify-content: center;">
      <div style="
        position: absolute;
        width: 32px;
        height: 32px;
        border-radius: 50%;
        background-color: ${pulseColor};
        animation: ping 2s cubic-bezier(0, 0, 0.2, 1) infinite;
      "></div>
      <div style="
        position: relative;
        width: 22px;
        height: 22px;
        background-color: ${color};
        border: 2px solid white;
        border-radius: 50%;
        box-shadow: 0 4px 8px rgba(0, 0, 0, 0.4);
        display: flex;
        align-items: center;
        justify-content: center;
      ">
        <div style="width: 6px; height: 6px; background-color: white; border-radius: 50%;"></div>
      </div>
    </div>
  `;

  return L.divIcon({
    className: 'field-verification-marker',
    html,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
    popupAnchor: [0, -16],
  });
}

export const ParcelMap: React.FC<ParcelMapProps> = ({
  properties,
  selectedPropertyId,
  onSelectProperty,
  devices = [],
  activeDeviceId,
  verificationEvents = [],
  heightClass = 'h-[650px]',
  showFilters = true,
  showDossier = true,
  basePortalPath = '/portal',
  allowDrawing = false,
  isDrawingMode: externalDrawingMode,
  onToggleDrawingMode,
  onSaveDrawnPolygon,
  initialEditGeometry,
  onCancelDrawing,
}) => {
  const navigate = useNavigate();
  const [selectedProperty, setSelectedProperty] = useState<Property | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [mapBounds, setMapBounds] = useState<L.LatLngBoundsExpression | null>(null);

  // Drawing state
  const [internalDrawingMode, setInternalDrawingMode] = useState<boolean>(false);
  const isDrawing = externalDrawingMode !== undefined ? externalDrawingMode : internalDrawingMode;

  // Vertices in Leaflet [lat, lng] format
  const [vertices, setVertices] = useState<[number, number][]>([]);
  const [isClosed, setIsClosed] = useState<boolean>(false);
  const [drawingError, setDrawingError] = useState<string | null>(null);

  // Initialize from initialEditGeometry if provided
  useEffect(() => {
    if (initialEditGeometry && initialEditGeometry.coordinates && initialEditGeometry.coordinates[0]) {
      const leafletCoords = geoJSONToLeaflet(initialEditGeometry.coordinates[0]);
      // Remove duplicate closing point for editable vertices list
      const uniqueVertices =
        leafletCoords.length > 3 &&
        leafletCoords[0][0] === leafletCoords[leafletCoords.length - 1][0] &&
        leafletCoords[0][1] === leafletCoords[leafletCoords.length - 1][1]
          ? leafletCoords.slice(0, -1)
          : leafletCoords;

      setVertices(uniqueVertices as [number, number][]);
      setIsClosed(true);
    }
  }, [initialEditGeometry]);

  const setDrawingActive = (active: boolean) => {
    if (onToggleDrawingMode) {
      onToggleDrawingMode(active);
    } else {
      setInternalDrawingMode(active);
    }
    if (!active) {
      setVertices([]);
      setIsClosed(false);
      setDrawingError(null);
    }
  };

  // Sync selectedProperty from props
  useEffect(() => {
    if (selectedPropertyId) {
      const match = properties.find(p => p.id === selectedPropertyId || p.property_id === selectedPropertyId);
      if (match) {
        setSelectedProperty(match);
        // Automatically pan to selected property
        if (match.latitude && match.longitude) {
          setMapBounds([
            [match.latitude - 0.003, match.longitude - 0.003],
            [match.latitude + 0.003, match.longitude + 0.003],
          ]);
        }
      }
    } else if (properties.length === 1) {
      const single = properties[0];
      setSelectedProperty(single);
      if (single.latitude && single.longitude) {
        setMapBounds([
          [single.latitude - 0.003, single.longitude - 0.003],
          [single.latitude + 0.003, single.longitude + 0.003],
        ]);
      }
    } else {
      setSelectedProperty(null);
    }
  }, [selectedPropertyId, properties]);

  // Filter properties
  const filteredProperties = useMemo(() => {
    return properties.filter(p => {
      const matchesStatus = statusFilter === 'all' || p.status === statusFilter;
      const matchesSearch =
        !searchQuery.trim() ||
        p.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.property_id.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.survey_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.address.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (p.owner?.full_name && p.owner.full_name.toLowerCase().includes(searchQuery.toLowerCase()));
      return matchesStatus && matchesSearch;
    });
  }, [properties, statusFilter, searchQuery]);

  // Convert filtered properties to a valid GeoJSON FeatureCollection
  const geoJsonData = useMemo<GeoJSON.FeatureCollection>(() => {
    const features: GeoJSON.Feature[] = filteredProperties
      .filter(p => p.boundary_geojson && p.boundary_geojson.coordinates)
      .map(p => ({
        type: 'Feature',
        id: p.id,
        properties: {
          id: p.id,
          property_id: p.property_id,
          title: p.title,
          status: p.status,
          area: p.area,
          area_unit: p.area_unit,
          property_type: p.property_type,
          survey_number: p.survey_number,
          address: p.address,
          owner_name: p.owner?.full_name || 'Government Cadastral Bank',
        },
        geometry: p.boundary_geojson as any,
      }));

    return {
      type: 'FeatureCollection',
      features,
    };
  }, [filteredProperties]);

  // Live calculation of polygon area from vertices
  const liveArea = useMemo<AreaCalculation>(() => {
    if (vertices.length < 3) {
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
    // Convert Leaflet [lat, lng] to GeoJSON [lng, lat]
    const geoCoords: [number, number][] = vertices.map(v => [v[1], v[0]]);
    return calculatePolygonArea(geoCoords);
  }, [vertices]);

  // Live centroid calculation
  const liveCentroid = useMemo<[number, number]>(() => {
    if (vertices.length === 0) return [80.235, 12.98];
    const geoCoords: [number, number][] = vertices.map(v => [v[1], v[0]]);
    return calculateCentroid(geoCoords);
  }, [vertices]);

  // Handle clicking map to append vertex
  const handleAddVertex = useCallback(
    (latlng: L.LatLng) => {
      setDrawingError(null);
      setVertices(prev => [...prev, [latlng.lat, latlng.lng]]);
    },
    []
  );

  // Handle dragging an existing vertex handle
  const handleVertexDrag = useCallback((index: number, newLatLng: L.LatLng) => {
    setVertices(prev => {
      const next = [...prev];
      next[index] = [newLatLng.lat, newLatLng.lng];
      return next;
    });
  }, []);

  // Handle undoing last placed vertex
  const handleUndoVertex = () => {
    setDrawingError(null);
    if (isClosed) {
      setIsClosed(false);
    } else {
      setVertices(prev => prev.slice(0, -1));
    }
  };

  // Handle clearing vertices to redraw
  const handleClearDrawing = () => {
    setVertices([]);
    setIsClosed(false);
    setDrawingError(null);
  };

  // Handle closing the polygon ring
  const handleClosePolygon = () => {
    if (vertices.length < 3) {
      setDrawingError('A parcel polygon requires at least 3 vertices before it can be closed.');
      return;
    }
    setIsClosed(true);
    setDrawingError(null);
  };

  // Handle saving the completed polygon
  const handleSavePolygon = () => {
    if (vertices.length < 3) {
      setDrawingError('Minimum 3 vertices required to define a valid cadastral parcel boundary.');
      return;
    }

    // Convert Leaflet [lat, lng] to closed GeoJSON [lng, lat]
    const geoJSONCoords = leafletToGeoJSON(vertices);

    const polygonPayload: GeoJSONPolygon = {
      type: 'Polygon',
      coordinates: [geoJSONCoords],
    };

    const validation = validateGeoJSONPolygon(polygonPayload);
    if (!validation.valid) {
      setDrawingError(validation.error || 'Invalid polygon geometry.');
      return;
    }

    if (onSaveDrawnPolygon) {
      onSaveDrawnPolygon(polygonPayload, liveArea, liveCentroid);
    }
  };

  // Handle zooming to fit all parcels
  const fitAllParcels = () => {
    if (filteredProperties.length === 0) return;
    const lats = filteredProperties.map(p => p.latitude);
    const lngs = filteredProperties.map(p => p.longitude);
    const minLat = Math.min(...lats);
    const maxLat = Math.max(...lats);
    const minLng = Math.min(...lngs);
    const maxLng = Math.max(...lngs);

    setMapBounds([
      [minLat - 0.003, minLng - 0.003],
      [maxLat + 0.003, maxLng + 0.003],
    ]);
  };

  // Function to style each GeoJSON parcel polygon
  const parcelStyle = (feature: any) => {
    const status = (feature?.properties?.status as PropertyStatus) || 'active';
    const isSelected =
      selectedProperty &&
      (selectedProperty.id === feature?.properties?.id ||
        selectedProperty.property_id === feature?.properties?.property_id);
    const colorConfig = STATUS_COLORS[status] || STATUS_COLORS.active;

    return {
      fillColor: colorConfig.bg,
      fillOpacity: isSelected ? 0.75 : 0.4,
      color: isSelected ? '#1e293b' : colorConfig.border,
      weight: isSelected ? 3.5 : 2,
      dashArray: status === 'pending' ? '4, 4' : undefined,
    };
  };

  // Handle interactions for each parcel feature
  const onEachFeature = (feature: any, layer: L.Layer) => {
    const props = feature.properties;

    // Tooltip on hover
    layer.bindTooltip(
      `<div class="font-sans text-xs font-medium">
        <span class="font-bold text-slate-800">${props.property_id}</span> • ${props.title}<br/>
        <span class="text-slate-500">${props.area} ${props.area_unit} | Survey: ${props.survey_number}</span>
      </div>`,
      { sticky: true, className: 'parcel-tooltip' }
    );

    layer.on({
      mouseover: e => {
        if (isDrawing) return;
        const l = e.target;
        if (!selectedProperty || selectedProperty.id !== props.id) {
          l.setStyle({
            fillOpacity: 0.65,
            weight: 2.5,
          });
        }
      },
      mouseout: e => {
        if (isDrawing) return;
        const l = e.target;
        if (!selectedProperty || selectedProperty.id !== props.id) {
          const status = (props.status as PropertyStatus) || 'active';
          const colorConfig = STATUS_COLORS[status] || STATUS_COLORS.active;
          l.setStyle({
            fillOpacity: 0.4,
            weight: 2,
            color: colorConfig.border,
          });
        }
      },
      click: () => {
        if (isDrawing) return;
        const match = properties.find(p => p.id === props.id);
        if (match) {
          setSelectedProperty(match);
          if (onSelectProperty) onSelectProperty(match);
        }
      },
    });
  };

  return (
    <div
      className={`relative w-full ${heightClass} rounded-2xl overflow-hidden border border-slate-200/80 shadow-sm flex flex-col bg-slate-100 ${
        isDrawing ? 'cursor-crosshair' : ''
      }`}
    >
      {/* Top Filter & Drawing Mode Bar */}
      <div className="absolute top-4 left-4 right-4 z-[1000] flex flex-wrap items-center justify-between gap-3 pointer-events-none">
        {/* Search Box (hidden when drawing) */}
        {showFilters && !isDrawing && (
          <div className="pointer-events-auto flex items-center bg-white/95 backdrop-blur-md px-3 py-2 rounded-xl shadow-md border border-slate-200/80 w-72 sm:w-80 transition-all focus-within:ring-2 focus-within:ring-emerald-500/30">
            <Search className="w-4 h-4 text-slate-400 mr-2 flex-shrink-0" />
            <input
              type="text"
              placeholder="Search parcel, ID, survey, owner..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full text-xs font-medium text-slate-800 bg-transparent outline-none placeholder:text-slate-400"
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery('')} className="text-slate-400 hover:text-slate-600">
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        )}

        {/* Drawing Mode Active Status Notice */}
        {isDrawing && (
          <div className="pointer-events-auto flex items-center gap-2 bg-emerald-950/90 text-emerald-300 border border-emerald-500/40 backdrop-blur-md px-4 py-2 rounded-xl shadow-xl animate-in fade-in">
            <PenTool className="w-4 h-4 text-emerald-400 animate-pulse" />
            <div className="text-xs">
              <span className="font-bold text-white">Cadastral Drawing Active: </span>
              {isClosed ? 'Ring Enclosed. Drag corner handles to refine boundary.' : 'Click map to place parcel corners.'}
            </div>
          </div>
        )}

        {/* Status Tabs, Drawing Toggle & Fit Button */}
        <div className="pointer-events-auto flex items-center gap-2 ml-auto">
          {showFilters && !isDrawing && (
            <div className="flex bg-white/95 backdrop-blur-md p-1 rounded-xl shadow-md border border-slate-200/80 text-xs font-semibold text-slate-600">
              <button
                onClick={() => setStatusFilter('all')}
                className={`px-3 py-1 rounded-lg transition-colors ${
                  statusFilter === 'all' ? 'bg-slate-900 text-white' : 'hover:bg-slate-100'
                }`}
              >
                All ({properties.length})
              </button>
              <button
                onClick={() => setStatusFilter('active')}
                className={`px-3 py-1 rounded-lg transition-colors flex items-center gap-1.5 ${
                  statusFilter === 'active' ? 'bg-emerald-600 text-white' : 'hover:bg-slate-100 text-emerald-700'
                }`}
              >
                <span className="w-2 h-2 rounded-full bg-emerald-500"></span> Active
              </button>
              <button
                onClick={() => setStatusFilter('pending')}
                className={`px-3 py-1 rounded-lg transition-colors flex items-center gap-1.5 ${
                  statusFilter === 'pending' ? 'bg-amber-600 text-white' : 'hover:bg-slate-100 text-amber-700'
                }`}
              >
                <span className="w-2 h-2 rounded-full bg-amber-500"></span> Pending
              </button>
              <button
                onClick={() => setStatusFilter('disputed')}
                className={`px-3 py-1 rounded-lg transition-colors flex items-center gap-1.5 ${
                  statusFilter === 'disputed' ? 'bg-red-600 text-white' : 'hover:bg-slate-100 text-red-700'
                }`}
              >
                <span className="w-2 h-2 rounded-full bg-red-500"></span> Disputed
              </button>
            </div>
          )}

          {/* Admin Draw Polygon Trigger */}
          {allowDrawing && !isDrawing && (
            <button
              onClick={() => setDrawingActive(true)}
              className="px-3.5 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs rounded-xl shadow-md shadow-emerald-500/20 flex items-center gap-1.5 transition-all"
            >
              <PenTool className="w-3.5 h-3.5" />
              <span>Draw Parcel</span>
            </button>
          )}

          {!isDrawing && (
            <button
              onClick={fitAllParcels}
              title="Fit all parcels in view"
              className="p-2 bg-white/95 backdrop-blur-md rounded-xl shadow-md border border-slate-200/80 text-slate-700 hover:bg-slate-50 transition-colors"
            >
              <Maximize2 className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Interactive Cadastral Drawing HUD (Docked when drawing is active) */}
      {isDrawing && (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-[1000] bg-slate-950/95 backdrop-blur-md border border-slate-800 rounded-2xl shadow-2xl p-4 w-[92%] max-w-xl animate-in slide-in-from-bottom-4 duration-200">
          <div className="flex flex-col gap-3">
            {/* Top row: Metrics & Indicators */}
            <div className="flex items-center justify-between border-b border-slate-800/80 pb-2.5">
              <div className="flex items-center gap-3">
                <div className="bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 rounded-lg">
                  <span className="text-[10px] uppercase font-bold text-emerald-400 tracking-wider">Vertices</span>
                  <div className="text-sm font-mono font-bold text-white">{vertices.length} Points</div>
                </div>

                <div className="bg-slate-900 border border-slate-800 px-3 py-1 rounded-lg">
                  <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Calculated Area</span>
                  <div className="text-sm font-bold text-emerald-400">{liveArea.formattedM2}</div>
                </div>

                <div className="hidden sm:block text-right">
                  <span className="text-[10px] uppercase font-semibold text-slate-500">Imperial Equivalents</span>
                  <div className="text-xs font-mono text-slate-300">
                    {liveArea.formattedSqFt} • {liveArea.formattedAcres}
                  </div>
                </div>
              </div>

              <div className="text-right">
                <span className="text-[10px] uppercase font-semibold text-slate-500">Centroid</span>
                <div className="text-[11px] font-mono text-slate-300">
                  {liveCentroid[1].toFixed(4)}° N, {liveCentroid[0].toFixed(4)}° E
                </div>
              </div>
            </div>

            {/* Error Message if any */}
            {drawingError && (
              <div className="flex items-center gap-2 text-xs text-red-400 bg-red-950/50 border border-red-800/50 px-3 py-1.5 rounded-lg">
                <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                <span>{drawingError}</span>
              </div>
            )}

            {/* Bottom row: Control Actions */}
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleUndoVertex}
                  disabled={vertices.length === 0}
                  className="px-2.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-slate-300 disabled:opacity-40 text-xs font-semibold rounded-lg flex items-center gap-1.5 transition-colors border border-slate-800"
                  title="Undo last vertex"
                >
                  <Undo2 className="w-3.5 h-3.5" />
                  <span>Undo</span>
                </button>

                <button
                  type="button"
                  onClick={handleClearDrawing}
                  disabled={vertices.length === 0}
                  className="px-2.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-slate-300 disabled:opacity-40 text-xs font-semibold rounded-lg flex items-center gap-1.5 transition-colors border border-slate-800"
                  title="Clear all vertices and redraw"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Redraw</span>
                </button>

                {!isClosed && vertices.length >= 3 && (
                  <button
                    type="button"
                    onClick={handleClosePolygon}
                    className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-lg flex items-center gap-1.5 transition-colors shadow-sm"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>Close Boundary</span>
                  </button>
                )}
              </div>

              <div className="flex items-center gap-2 ml-auto">
                <button
                  type="button"
                  onClick={() => {
                    setDrawingActive(false);
                    if (onCancelDrawing) onCancelDrawing();
                  }}
                  className="px-3 py-1.5 text-xs font-semibold text-slate-400 hover:text-white transition-colors"
                >
                  Cancel
                </button>

                <button
                  type="button"
                  onClick={handleSavePolygon}
                  disabled={vertices.length < 3}
                  className="px-4 py-1.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 disabled:opacity-40 font-bold text-xs rounded-lg flex items-center gap-1.5 transition-all shadow-md shadow-emerald-500/20"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>Save Parcel Boundary</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Main Leaflet Map */}
      <MapContainer
        center={DEFAULT_MAP_CENTER}
        zoom={DEFAULT_MAP_ZOOM}
        className="w-full h-full z-0"
        scrollWheelZoom={true}
      >
        <MapController bounds={mapBounds} />

        {/* Map Drawing Click Listener */}
        <MapDrawingHandler isDrawing={isDrawing} isClosed={isClosed} onAddVertex={handleAddVertex} />

        {/* Clean Carto Positron basemap tiles */}
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
          url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
          maxZoom={19}
        />

        {/* Existing GeoJSON Cadastral Parcels Layer */}
        {geoJsonData.features.length > 0 && (
          <GeoJSON
            key={`geojson-${statusFilter}-${geoJsonData.features.length}-${selectedProperty?.id || 'none'}`}
            data={geoJsonData}
            style={parcelStyle}
            onEachFeature={onEachFeature}
          />
        )}

        {/* Active Cadastral Drawing Polylines & Polygon */}
        {isDrawing && vertices.length > 0 && (
          <>
            {isClosed ? (
              <Polygon
                positions={vertices}
                pathOptions={{
                  color: '#059669',
                  weight: 3.5,
                  fillColor: '#10b981',
                  fillOpacity: 0.35,
                }}
              />
            ) : (
              <Polyline
                positions={vertices}
                pathOptions={{
                  color: '#059669',
                  weight: 3,
                  dashArray: '5, 5',
                }}
              />
            )}

            {/* Draggable Vertex Marker Handles */}
            {vertices.map((pos, idx) => (
              <Marker
                key={`vertex-${idx}-${pos[0]}-${pos[1]}`}
                position={pos}
                draggable={isDrawing}
                eventHandlers={{
                  dragend: e => {
                    const marker = e.target;
                    if (marker) {
                      handleVertexDrag(idx, marker.getLatLng());
                    }
                  },
                  click: () => {
                    // Clicking the first vertex when >= 3 points closes the ring
                    if (idx === 0 && vertices.length >= 3 && !isClosed) {
                      handleClosePolygon();
                    }
                  },
                }}
                icon={createVertexMarkerIcon(idx, idx === 0, isDrawing)}
              >
                <Tooltip direction="top" offset={[0, -10]} permanent={false}>
                  <div className="font-sans text-xs">
                    <span className="font-bold text-slate-900">Corner #{idx + 1}</span>
                    {idx === 0 && !isClosed && vertices.length >= 3 && (
                      <span className="block text-emerald-600 font-semibold">Click to Close Boundary</span>
                    )}
                    <span className="block text-[10px] text-slate-500 font-mono">
                      {pos[0].toFixed(5)}, {pos[1].toFixed(5)}
                    </span>
                  </div>
                </Tooltip>
              </Marker>
            ))}
          </>
        )}

        {/* Hardware Devices Live Location Pins */}
        {devices.map(dev => {
          if (!dev.latitude || !dev.longitude) return null;
          return (
            <Marker
              key={dev.device_id}
              position={[dev.latitude, dev.longitude]}
              icon={createDeviceMarkerIcon(dev.status === 'online')}
            >
              <Popup className="custom-popup">
                <div className="font-sans p-1 text-xs">
                  <div className="flex items-center gap-1.5 font-bold text-slate-800">
                    <Radio className="w-3.5 h-3.5 text-emerald-600" />
                    {dev.device_name}
                  </div>
                  <div className="text-slate-500 mt-1">
                    ID: <span className="font-mono text-slate-700">{dev.device_id}</span>
                  </div>
                  <div className="text-slate-500">
                    Status:{' '}
                    <span className={`font-semibold ${dev.status === 'online' ? 'text-emerald-600' : 'text-slate-400'}`}>
                      {dev.status.toUpperCase()}
                    </span>
                  </div>
                  <div className="text-slate-400 text-[10px] mt-1">
                    Coordinates: {dev.latitude.toFixed(4)}, {dev.longitude.toFixed(4)}
                  </div>
                </div>
              </Popup>
            </Marker>
          );
        })}

        {/* Field Verification GPS Observation Point Markers */}
        {verificationEvents.map(ev => {
          if (!ev.latitude || !ev.longitude) return null;
          const srcLabel = ev.verification_source === 'simulator'
            ? 'Simulator'
            : ev.verification_source === 'manual'
            ? 'Manual'
            : 'Hardware';

          return (
            <Marker
              key={`field-verif-${ev.id}`}
              position={[ev.latitude, ev.longitude]}
              icon={createVerificationMarkerIcon(ev.verification_source)}
            >
              <Popup className="custom-popup">
                <div className="font-sans p-2 text-xs min-w-[210px]">
                  <div className="flex items-center gap-1.5 font-bold text-slate-900 border-b border-slate-200/80 pb-1.5 mb-2">
                    <ShieldCheck className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                    <div>
                      <span className="block leading-tight">Field Verification Location</span>
                      <span className="text-[10px] font-normal text-slate-500 font-mono">GPS Observation Point</span>
                    </div>
                  </div>

                  <div className="space-y-1.5 text-slate-600">
                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-400 block">Cadastral Parcel</span>
                      <span className="font-semibold text-slate-800">
                        {ev.property ? `${ev.property.property_id}: ${ev.property.title}` : 'Unassigned'}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-1 text-[11px] pt-1">
                      <div>
                        <span className="text-[10px] uppercase font-bold text-slate-400 block">Source</span>
                        <span className="font-bold text-purple-700 capitalize">{srcLabel}</span>
                      </div>
                      <div>
                        <span className="text-[10px] uppercase font-bold text-slate-400 block">RFID Tag</span>
                        <span className="font-mono font-bold text-emerald-700">{ev.rfid_uid || 'N/A'}</span>
                      </div>
                    </div>

                    <div className="pt-1">
                      <span className="text-[10px] uppercase font-bold text-slate-400 block">Observed Coordinates</span>
                      <span className="font-mono text-slate-800 font-medium">
                        {ev.latitude.toFixed(5)}, {ev.longitude.toFixed(5)}
                      </span>
                    </div>

                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-400 block">Recorded At</span>
                      <span className="text-[11px] text-slate-500">
                        {new Date(ev.created_at).toLocaleString()}
                      </span>
                    </div>
                  </div>

                  <div className="mt-2 pt-1.5 border-t border-slate-100 text-[9px] text-slate-400 italic leading-tight">
                    * GIS Observation marker only. Official cadastral boundary polygon remains unchanged.
                  </div>
                </div>
              </Popup>
            </Marker>
          );
        })}
      </MapContainer>

      {/* Bottom Status Legend (hidden when drawing) */}
      {!isDrawing && (
        <div className="absolute bottom-4 left-4 z-[1000] bg-white/95 backdrop-blur-md px-3.5 py-2 rounded-xl shadow-md border border-slate-200/80 flex items-center gap-4 text-xs font-medium text-slate-600 flex-wrap">
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-sm bg-emerald-500/70 border border-emerald-600"></span>
            <span>Active</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-sm bg-amber-500/70 border border-amber-600"></span>
            <span>Pending</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-sm bg-red-500/70 border border-red-600"></span>
            <span>Disputed</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-sm bg-indigo-500/70 border border-indigo-600"></span>
            <span>Transferred</span>
          </div>
          <div className="flex items-center gap-1.5 border-l border-slate-200 pl-3">
            <span className="w-2.5 h-2.5 rounded-full bg-purple-600"></span>
            <span className="text-[11px] font-medium text-slate-700">Verification Point</span>
          </div>
        </div>
      )}

      {/* Selected Parcel Slide-Over Dossier Panel */}
      {selectedProperty && !isDrawing && showDossier && (
        <div className="absolute top-4 right-4 bottom-4 w-84 sm:w-96 z-[1000] bg-white/95 backdrop-blur-md rounded-2xl shadow-xl border border-slate-200/80 p-5 flex flex-col justify-between overflow-y-auto animate-in fade-in slide-in-from-right-4 duration-200">
          <div>
            {/* Header */}
            <div className="flex items-start justify-between gap-2 pb-3 border-b border-slate-100">
              <div>
                <span className="text-[11px] font-bold tracking-wider font-mono uppercase text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                  {selectedProperty.property_id}
                </span>
                <h3 className="font-semibold text-slate-900 text-base mt-1.5 leading-snug">
                  {selectedProperty.title}
                </h3>
              </div>
              <button
                onClick={() => {
                  setSelectedProperty(null);
                  if (onSelectProperty) onSelectProperty(null);
                }}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Core Details Grid */}
            <div className="grid grid-cols-2 gap-3 my-4">
              <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                <span className="text-[10px] uppercase font-semibold text-slate-400 tracking-wider">Parcel Area</span>
                <p className="font-bold text-slate-800 text-sm mt-0.5">
                  {selectedProperty.area.toLocaleString()} {selectedProperty.area_unit}
                </p>
              </div>
              <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                <span className="text-[10px] uppercase font-semibold text-slate-400 tracking-wider">Property Type</span>
                <p className="font-bold text-slate-800 text-sm mt-0.5">
                  {selectedProperty.property_type}
                </p>
              </div>
              <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                <span className="text-[10px] uppercase font-semibold text-slate-400 tracking-wider">Survey Number</span>
                <p className="font-mono font-bold text-slate-800 text-sm mt-0.5">
                  {selectedProperty.survey_number}
                </p>
              </div>
              <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                <span className="text-[10px] uppercase font-semibold text-slate-400 tracking-wider">Status</span>
                <p className="font-bold text-sm mt-0.5 capitalize flex items-center gap-1.5">
                  <span
                    className={`w-2 h-2 rounded-full ${STATUS_COLORS[selectedProperty.status]?.bg || 'bg-slate-400'}`}
                  ></span>
                  {selectedProperty.status}
                </p>
              </div>
            </div>

            {/* Ownership & Location */}
            <div className="space-y-2.5 text-xs text-slate-600">
              <div className="flex items-start gap-2">
                <Building className="w-4 h-4 text-slate-400 flex-shrink-0 mt-0.5" />
                <div>
                  <span className="font-semibold text-slate-700">Registered Owner: </span>
                  {selectedProperty.owner?.full_name || 'Government Cadastral Bank'}
                  {selectedProperty.owner_verified && (
                    <span className="inline-flex items-center gap-1 ml-1.5 px-1.5 py-0.5 text-[9px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded">
                      <ShieldCheck className="w-2.5 h-2.5" /> Verified Title
                    </span>
                  )}
                </div>
              </div>

              <div className="flex items-start gap-2">
                <MapPin className="w-4 h-4 text-slate-400 flex-shrink-0 mt-0.5" />
                <div>
                  <span className="font-semibold text-slate-700">Address: </span>
                  {selectedProperty.address}, {selectedProperty.city}
                </div>
              </div>

              {selectedProperty.rfid_uid && (
                <div className="flex items-start gap-2">
                  <Radio className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <span className="font-semibold text-slate-700">RFID Anchor: </span>
                    <span className="font-mono font-bold text-emerald-800">{selectedProperty.rfid_uid}</span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Action Button */}
          <div className="pt-4 mt-4 border-t border-slate-100">
            <button
              onClick={() => navigate(`${basePortalPath}/properties/${selectedProperty.id}`)}
              className="w-full py-2.5 px-4 bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs rounded-xl flex items-center justify-center gap-2 transition-colors shadow-sm"
            >
              <span>View Property Dossier</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
