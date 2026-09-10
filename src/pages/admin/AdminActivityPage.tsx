// ==============================================================================
// FINNEST - Admin Master Audit Log Page
// Digital Property & Land Parcel Management Platform
// ==============================================================================

import React, { useState, useEffect } from 'react';
import { activityService } from '../../services/activityService';
import { PropertyActivity } from '../../types/database.types';
import { Clock, Shield, ArrowLeftRight, Upload, Plus, RefreshCw } from 'lucide-react';

export const AdminActivityPage: React.FC = () => {
  const [activities, setActivities] = useState<PropertyActivity[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  const loadData = async () => {
    setLoading(true);
    const { data } = await activityService.getActivity(100);
    setActivities(data || []);
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  const getActionIcon = (action: string) => {
    switch (action) {
      case 'rfid_verified':
        return <Shield className="w-4 h-4 text-emerald-400" />;
      case 'ownership_transferred':
        return <ArrowLeftRight className="w-4 h-4 text-indigo-400" />;
      case 'image_uploaded':
        return <Upload className="w-4 h-4 text-sky-400" />;
      case 'property_created':
        return <Plus className="w-4 h-4 text-emerald-400" />;
      default:
        return <Clock className="w-4 h-4 text-slate-400" />;
    }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-white">
            Comprehensive System Audit Trail
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Immutable log of all title changes, hardware verification events, and parcel modifications
          </p>
        </div>
        <button
          onClick={loadData}
          className="p-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-400 hover:text-white transition-colors"
          title="Refresh Log"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      <div className="bg-slate-950 rounded-3xl border border-slate-800 shadow-sm p-6 divide-y divide-slate-800/60">
        {activities.length > 0 ? (
          activities.map((act) => (
            <div key={act.id} className="py-4 flex items-start gap-4 text-xs first:pt-0 last:pb-0">
              <div className="w-8 h-8 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-center flex-shrink-0 mt-0.5">
                {getActionIcon(act.action)}
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-white capitalize">
                    {act.action.replace(/_/g, ' ')}
                  </span>
                  <span className="text-[11px] font-mono text-slate-500">
                    {new Date(act.created_at).toLocaleString()}
                  </span>
                </div>
                <p className="text-slate-300 mt-1 leading-relaxed">
                  {act.description}
                </p>
                {act.property && (
                  <span className="inline-block mt-2 font-mono text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-2.5 py-0.5 rounded border border-emerald-500/20">
                    Parcel: {act.property.property_id} &bull; {act.property.title}
                  </span>
                )}
              </div>
            </div>
          ))
        ) : (
          <div className="py-12 text-center text-slate-500 text-xs">
            No system audit entries logged.
          </div>
        )}
      </div>
    </div>
  );
};
