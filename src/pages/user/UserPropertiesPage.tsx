// ==============================================================================
// FINNEST - User Properties Registry Page
// Digital Property & Land Parcel Management Platform
// ==============================================================================

import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../features/auth/AuthContext';
import { propertyService } from '../../services/propertyService';
import { hardwareService } from '../../services/hardwareService';
import { Property, HardwareEvent } from '../../types/database.types';
import { STATUS_COLORS } from '../../lib/constants';
import { Search, MapPin, Filter, Layers, X, ShieldCheck } from 'lucide-react';

export const UserPropertiesPage: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [properties, setProperties] = useState<Property[]>([]);
  const [events, setEvents] = useState<HardwareEvent[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');

  useEffect(() => {
    async function fetchProperties() {
      setLoading(true);
      const [propsRes, evtsRes] = await Promise.all([
        propertyService.getProperties({ owner_id: user?.id }),
        hardwareService.getHardwareEvents(100),
      ]);
      setProperties(propsRes.data || []);
      setEvents(evtsRes.data || []);
      setLoading(false);
    }
    fetchProperties();
  }, [user?.id]);

  const verifiedPropIds = useMemo(() => {
    return new Set(events.filter(e => e.property_id).map(e => e.property_id));
  }, [events]);

  const filteredProperties = useMemo(() => {
    return properties.filter((p) => {
      const matchesStatus = statusFilter === 'all' || p.status === statusFilter;
      const matchesType = typeFilter === 'all' || p.property_type === typeFilter;
      const matchesSearch =
        !searchQuery.trim() ||
        p.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.property_id.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.survey_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.address.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.city.toLowerCase().includes(searchQuery.toLowerCase());

      return matchesStatus && matchesType && matchesSearch;
    });
  }, [properties, statusFilter, typeFilter, searchQuery]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900">
            My Registered Properties
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Cadastral parcels registered under your legal ownership title
          </p>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col md:flex-row gap-3 items-center justify-between">
        {/* Search */}
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
          <input
            type="text"
            placeholder="Search by Title, ID, Survey No..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-8 py-2 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-emerald-500 transition-colors"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-3 text-slate-400 hover:text-slate-600"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Filters */}
        <div className="flex items-center gap-2 w-full md:w-auto overflow-x-auto pb-1 md:pb-0">
          <div className="flex items-center gap-1.5 text-xs text-slate-500 mr-2 flex-shrink-0">
            <Filter className="w-3.5 h-3.5" />
            <span>Filter:</span>
          </div>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-700 outline-none cursor-pointer hover:border-slate-300"
          >
            <option value="all">All Statuses</option>
            <option value="active">Active Title</option>
            <option value="pending">Pending</option>
            <option value="disputed">Disputed</option>
            <option value="transferred">Transferred</option>
          </select>

          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-700 outline-none cursor-pointer hover:border-slate-300"
          >
            <option value="all">All Types</option>
            <option value="Residential">Residential</option>
            <option value="Commercial">Commercial</option>
            <option value="Industrial">Industrial</option>
            <option value="Agricultural">Agricultural</option>
          </select>
        </div>
      </div>

      {/* Grid of Properties */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {[1, 2, 3].map((n) => (
            <div key={n} className="bg-white rounded-2xl border border-slate-200/80 p-4 h-72 animate-pulse flex flex-col justify-between">
              <div className="h-40 bg-slate-100 rounded-xl"></div>
              <div className="h-4 bg-slate-100 rounded-md w-3/4 mt-3"></div>
              <div className="h-3 bg-slate-100 rounded-md w-1/2 mt-2"></div>
            </div>
          ))}
        </div>
      ) : filteredProperties.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredProperties.map((property) => {
            const statusConfig = STATUS_COLORS[property.status] || STATUS_COLORS.active;

            return (
              <div
                key={property.id}
                onClick={() => navigate(`/portal/properties/${property.id}`)}
                className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden hover:shadow-md transition-all cursor-pointer group flex flex-col justify-between"
              >
                <div>
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
                        <span className="text-[10px] uppercase font-semibold text-slate-400 block">Area</span>
                        <span className="font-bold text-slate-800">{property.area.toLocaleString()} {property.area_unit}</span>
                      </div>
                      <div>
                        <span className="text-[10px] uppercase font-semibold text-slate-400 block">Type</span>
                        <span className="font-semibold text-slate-800">{property.property_type}</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="px-4 py-3 bg-slate-50/70 border-t border-slate-100 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-slate-500 text-[11px]">Survey: {property.survey_number}</span>
                    {verifiedPropIds.has(property.id) || verifiedPropIds.has(property.property_id) ? (
                      <span className="inline-flex items-center gap-1 text-[9px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                        <ShieldCheck className="w-2.5 h-2.5" />
                        Verified
                      </span>
                    ) : (
                      <span className="text-[9px] font-medium text-slate-400">
                        ○ Unverified
                      </span>
                    )}
                  </div>
                  <span className="text-emerald-700 font-bold group-hover:translate-x-0.5 transition-transform">
                    Inspect &rarr;
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="bg-white rounded-3xl border border-slate-200/80 p-12 text-center">
          <Layers className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <h3 className="font-bold text-slate-800 text-sm">No matching properties found</h3>
          <p className="text-xs text-slate-500 mt-1">Try adjusting your search criteria or filters.</p>
        </div>
      )}
    </div>
  );
};
