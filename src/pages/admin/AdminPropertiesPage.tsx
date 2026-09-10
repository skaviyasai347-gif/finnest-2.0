// ==============================================================================
// FINNEST - Admin Properties Management Page (Full Cadastral CRUD)
// Digital Property & Land Parcel Management Platform
// ==============================================================================

import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { propertyService } from '../../services/propertyService';
import { userService } from '../../services/userService';
import { hardwareService } from '../../services/hardwareService';
import { Property, UserProfile, PropertyStatus, PropertyType, HardwareEvent } from '../../types/database.types';
import { STATUS_COLORS } from '../../lib/constants';
import { CadastralParcelModal } from '../../components/map/CadastralParcelModal';
import {
  Plus,
  Search,
  Filter,
  Edit2,
  Archive,
  Trash2,
  ExternalLink,
  MapPin,
  X,
  Check,
  AlertCircle,
  Building,
  ShieldCheck,
  Map,
} from 'lucide-react';

export const AdminPropertiesPage: React.FC = () => {
  const navigate = useNavigate();

  const [properties, setProperties] = useState<Property[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [events, setEvents] = useState<HardwareEvent[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');

  // Modal states
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [modalMode, setModalMode] = useState<'create' | 'edit'>('create');
  const [selectedPropertyForEdit, setSelectedPropertyForEdit] = useState<Property | null>(null);

  const loadData = async () => {
    setLoading(true);
    const [propsRes, usersRes, evtsRes] = await Promise.all([
      propertyService.getProperties(),
      userService.getAllUsers(),
      hardwareService.getHardwareEvents(100),
    ]);
    setProperties(propsRes.data || []);
    setUsers(usersRes.data || []);
    setEvents(evtsRes.data || []);
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  const verifiedPropIds = useMemo(() => {
    return new Set(events.filter(e => e.property_id).map(e => e.property_id));
  }, [events]);

  const filteredProperties = useMemo(() => {
    return properties.filter(p => {
      const matchesStatus = statusFilter === 'all' || p.status === statusFilter;
      const matchesType = typeFilter === 'all' || p.property_type === typeFilter;
      const matchesSearch =
        !searchQuery.trim() ||
        p.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.property_id.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.survey_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.address.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (p.owner?.full_name && p.owner.full_name.toLowerCase().includes(searchQuery.toLowerCase()));

      return matchesStatus && matchesType && matchesSearch;
    });
  }, [properties, statusFilter, typeFilter, searchQuery]);

  const handleOpenCreate = () => {
    setModalMode('create');
    setSelectedPropertyForEdit(null);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (prop: Property) => {
    setModalMode('edit');
    setSelectedPropertyForEdit(prop);
    setIsModalOpen(true);
  };

  const handleArchive = async (id: string, title: string) => {
    if (!window.confirm(`Are you sure you want to archive parcel "${title}"?`)) return;
    await propertyService.archiveProperty(id);
    loadData();
  };

  const handleDelete = async (id: string, title: string) => {
    if (!window.confirm(`Permanently delete parcel "${title}"? This cannot be undone.`)) return;
    await propertyService.deleteProperty(id);
    loadData();
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-white">
            Cadastral Property Registry
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Full administrative CRUD, parcel polygon georeferencing, and legal titles
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => navigate('/admin/map')}
            className="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-slate-200 text-xs font-semibold rounded-xl flex items-center gap-1.5 transition-colors border border-slate-800"
          >
            <Map className="w-4 h-4 text-emerald-400" />
            <span>Open Cadastral Map</span>
          </button>

          <button
            onClick={handleOpenCreate}
            className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold rounded-xl flex items-center gap-2 transition-all shadow-md shadow-emerald-500/20"
          >
            <Plus className="w-4 h-4" />
            <span>Register New Parcel</span>
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 shadow-sm flex flex-col md:flex-row gap-3 items-center justify-between">
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
          <input
            type="text"
            placeholder="Search by ID, Title, Survey No, Owner..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-10 pr-8 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery('')} className="absolute right-3 top-3 text-slate-400 hover:text-white">
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto overflow-x-auto pb-1 md:pb-0">
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            className="bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs font-semibold text-slate-300 outline-none cursor-pointer"
          >
            <option value="all">All Statuses</option>
            <option value="active">Active</option>
            <option value="pending">Pending</option>
            <option value="disputed">Disputed</option>
            <option value="transferred">Transferred</option>
            <option value="archived">Archived</option>
          </select>

          <select
            value={typeFilter}
            onChange={e => setTypeFilter(e.target.value)}
            className="bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs font-semibold text-slate-300 outline-none cursor-pointer"
          >
            <option value="all">All Types</option>
            <option value="Residential">Residential</option>
            <option value="Commercial">Commercial</option>
            <option value="Industrial">Industrial</option>
            <option value="Agricultural">Agricultural</option>
          </select>
        </div>
      </div>

      {/* Properties Table */}
      <div className="bg-slate-950 rounded-3xl border border-slate-800 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-900/80 text-[11px] uppercase font-bold text-slate-400 tracking-wider border-b border-slate-800">
              <tr>
                <th className="py-3.5 px-4">Parcel ID</th>
                <th className="py-3.5 px-4">Title & Location</th>
                <th className="py-3.5 px-4">Titleholder</th>
                <th className="py-3.5 px-4">Area & Geometry</th>
                <th className="py-3.5 px-4">Survey No</th>
                <th className="py-3.5 px-4">Status</th>
                <th className="py-3.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {filteredProperties.length > 0 ? (
                filteredProperties.map(prop => {
                  const statusConfig = STATUS_COLORS[prop.status] || STATUS_COLORS.active;
                  const verticesCount = prop.boundary_geojson?.coordinates?.[0]?.length
                    ? prop.boundary_geojson.coordinates[0].length - 1
                    : 0;

                  return (
                    <tr key={prop.id} className="hover:bg-slate-900/50 transition-colors">
                      <td className="py-3.5 px-4 font-mono font-bold text-white whitespace-nowrap">
                        <span className="bg-slate-900 px-2 py-1 rounded-lg border border-slate-800 text-emerald-400">
                          {prop.property_id}
                        </span>
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="font-semibold text-white truncate max-w-xs">{prop.title}</div>
                        <div className="text-[11px] text-slate-500 truncate max-w-xs">
                          {prop.address}, {prop.city}
                        </div>
                      </td>
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <span className="font-medium text-slate-300">
                            {prop.owner?.full_name || 'Government Land Bank'}
                          </span>
                          {prop.owner_verified && (
                            <span
                              title="KYC-Verified Titleholder"
                              className="inline-flex items-center text-emerald-400"
                            >
                              <ShieldCheck className="w-3.5 h-3.5" />
                            </span>
                          )}
                        </div>
                        {prop.owner?.email && (
                          <div className="text-[10px] text-slate-500 truncate max-w-[140px]">
                            {prop.owner.email}
                          </div>
                        )}
                      </td>
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <div className="font-bold text-slate-200">
                          {prop.area.toLocaleString()} {prop.area_unit}
                        </div>
                        <div className="text-[10px] text-emerald-400 font-mono flex items-center gap-1">
                          <span>{verticesCount} Polygon Corners</span>
                        </div>
                        <div className="mt-0.5">
                          {verifiedPropIds.has(prop.id) || verifiedPropIds.has(prop.property_id) ? (
                            <span className="text-[10px] text-emerald-400 font-semibold flex items-center gap-1">
                              <ShieldCheck className="w-3 h-3" />
                              Field Verified
                            </span>
                          ) : (
                            <span className="text-[10px] text-slate-500 font-medium">
                              ○ Not Verified
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-3.5 px-4 font-mono font-medium text-slate-400 whitespace-nowrap">
                        {prop.survey_number}
                      </td>
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${statusConfig.textColor}`}
                        >
                          {statusConfig.label}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => navigate(`/admin/properties/${prop.id}`)}
                            title="Inspect Dossier"
                            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleOpenEdit(prop)}
                            title="Edit Parcel Specifications & Polygon"
                            className="p-1.5 rounded-lg text-slate-400 hover:text-emerald-400 hover:bg-slate-800 transition-colors"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleArchive(prop.id, prop.title)}
                            title="Archive Parcel"
                            className="p-1.5 rounded-lg text-slate-400 hover:text-amber-400 hover:bg-slate-800 transition-colors"
                          >
                            <Archive className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDelete(prop.id, prop.title)}
                            title="Permanently Delete"
                            className="p-1.5 rounded-lg text-slate-400 hover:text-red-400 hover:bg-slate-800 transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={7} className="py-10 text-center text-slate-500">
                    No properties match your filter criteria.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Cadastral Parcel Modal for Creation & Editing */}
      <CadastralParcelModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSuccess={() => loadData()}
        mode={modalMode}
        initialProperty={selectedPropertyForEdit}
      />
    </div>
  );
};
