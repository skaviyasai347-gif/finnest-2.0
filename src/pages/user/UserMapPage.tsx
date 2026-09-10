// ==============================================================================
// FINNEST - User Cadastral Map View
// Digital Property & Land Parcel Management Platform
// ==============================================================================

import React, { useState, useEffect } from 'react';
import { useAuth } from '../../features/auth/AuthContext';
import { propertyService } from '../../services/propertyService';
import { hardwareService } from '../../services/hardwareService';
import { Property, HardwareDevice } from '../../types/database.types';
import { ParcelMap } from '../../components/map/ParcelMap';

export const UserMapPage: React.FC = () => {
  const { user } = useAuth();
  const [properties, setProperties] = useState<Property[]>([]);
  const [devices, setDevices] = useState<HardwareDevice[]>([]);

  useEffect(() => {
    async function load() {
      const { data: props } = await propertyService.getProperties({ owner_id: user?.id });
      setProperties(props || []);
      const { data: devs } = await hardwareService.getDevices();
      setDevices(devs || []);
    }
    load();
  }, [user?.id]);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold tracking-tight text-slate-900">
          Cadastral Parcel Map
        </h1>
        <p className="text-xs text-slate-500">
          True polygon parcel boundaries with hover inspection, legal status styling, and field surveyor nodes.
        </p>
      </div>

      <div className="bg-white rounded-3xl p-3 border border-slate-200/80 shadow-xs">
        <ParcelMap
          properties={properties}
          devices={devices}
          heightClass="h-[calc(100vh-210px)] min-h-[550px]"
          showFilters={true}
          basePortalPath="/portal"
        />
      </div>
    </div>
  );
};
