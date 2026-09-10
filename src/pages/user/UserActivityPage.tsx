// ==============================================================================
// FINNEST - User Activity Log Page
// Digital Property & Land Parcel Management Platform
// ==============================================================================

import React, { useState, useEffect } from 'react';
import { activityService } from '../../services/activityService';
import { PropertyActivity } from '../../types/database.types';
import { Clock, Shield, Upload, FileCheck, RefreshCw } from 'lucide-react';

export const UserActivityPage: React.FC = () => {
  const [activities, setActivities] = useState<PropertyActivity[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  const loadActivities = async () => {
    setLoading(true);
    const { data } = await activityService.getActivity(50);
    setActivities(data || []);
    setLoading(false);
  };

  useEffect(() => {
    loadActivities();
  }, []);

  const getActionIcon = (action: string) => {
    switch (action) {
      case 'rfid_verified':
        return <Shield className="w-4 h-4 text-emerald-600" />;
      case 'ownership_transferred':
        return <FileCheck className="w-4 h-4 text-indigo-600" />;
      case 'image_uploaded':
        return <Upload className="w-4 h-4 text-sky-600" />;
      case 'property_created':
        return <FileCheck className="w-4 h-4 text-emerald-600" />;
      default:
        return <Clock className="w-4 h-4 text-slate-500" />;
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900">
            Cadastral Activity & Audit Log
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Immutable chronicle of property registrations, ownership transfers, and hardware verifications
          </p>
        </div>
        <button
          onClick={loadActivities}
          className="p-2 rounded-xl bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors shadow-xs"
          title="Refresh Log"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs p-6 divide-y divide-slate-100">
        {activities.length > 0 ? (
          activities.map((act) => (
            <div key={act.id} className="py-4 flex items-start gap-4 text-xs first:pt-0 last:pb-0">
              <div className="w-8 h-8 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                {getActionIcon(act.action)}
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-900 capitalize">
                    {act.action.replace(/_/g, ' ')}
                  </span>
                  <span className="text-[11px] font-mono text-slate-400">
                    {new Date(act.created_at).toLocaleString()}
                  </span>
                </div>
                <p className="text-slate-600 mt-1 leading-relaxed">
                  {act.description}
                </p>
                {act.property && (
                  <span className="inline-block mt-2 font-mono text-[10px] font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                    Parcel: {act.property.property_id} • {act.property.title}
                  </span>
                )}
              </div>
            </div>
          ))
        ) : (
          <div className="py-12 text-center text-slate-400 text-xs">
            <Clock className="w-8 h-8 text-slate-300 mx-auto mb-2 opacity-50" />
            No activity records logged.
          </div>
        )}
      </div>
    </div>
  );
};
