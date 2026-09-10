// ==============================================================================
// FINNEST - TypeScript Database & Cadastral Entity Definitions
// Digital Property & Land Parcel Management Platform
// ==============================================================================

export type UserRole = 'user' | 'admin';

export interface UserProfile {
  id: string;
  full_name: string;
  email: string;
  phone: string | null;
  role: UserRole;
  avatar_url: string | null;
  is_verified?: boolean;
  verified_at?: string | null;
  created_at: string;
  updated_at: string;
}

export type PropertyStatus = 'active' | 'pending' | 'disputed' | 'transferred' | 'archived';
export type PropertyType = 'Residential' | 'Commercial' | 'Agricultural' | 'Industrial';

export interface GeoJSONPolygon {
  type: 'Polygon';
  coordinates: number[][][]; // [ [ [lng, lat], [lng, lat], ... ] ]
}

export interface Property {
  id: string;
  property_id: string;
  title: string;
  description: string | null;
  owner_id: string | null;
  area: number;
  area_unit: string;
  property_type: PropertyType;
  address: string;
  city: string;
  state: string;
  postal_code: string;
  latitude: number;
  longitude: number;
  boundary_geojson: GeoJSONPolygon;
  status: PropertyStatus;
  registration_number: string;
  survey_number: string;
  rfid_uid: string | null;
  owner_verified?: boolean;
  created_at: string;
  updated_at: string;
  // Joins
  owner?: UserProfile | null;
  images?: PropertyImage[];
}

export interface PropertyImage {
  id: string;
  property_id: string;
  image_url: string;
  storage_path: string;
  caption: string | null;
  uploaded_by: string | null;
  event_id?: string | null;
  is_verification?: boolean;
  created_at: string;
}

export interface OwnershipHistory {
  id: string;
  property_id: string;
  previous_owner_id: string | null;
  new_owner_id: string | null;
  changed_by: string | null;
  reason: string;
  changed_at: string;
  // Joins
  previous_owner?: UserProfile | null;
  new_owner?: UserProfile | null;
  property?: Property | null;
}

export type DeviceStatus = 'online' | 'offline' | 'maintenance' | 'recently_seen';

export type VerificationSource = 'hardware' | 'simulator' | 'manual';

export interface HardwareDevice {
  id: string;
  device_id: string;
  device_name: string;
  device_type: string;
  status: DeviceStatus;
  last_seen: string | null;
  latitude: number | null;
  longitude: number | null;
  rfid_uid: string | null;
  created_at: string;
  updated_at: string;
}

export interface HardwareEvent {
  id: string;
  device_id: string;
  property_id: string | null;
  event_type: string;
  rfid_uid: string | null;
  latitude: number | null;
  longitude: number | null;
  verification_source?: VerificationSource;
  image_url?: string | null;
  payload: Record<string, any> | null;
  created_at: string;
  // Joins
  property?: Property | null;
  device?: HardwareDevice | null;
}

export interface PropertyActivity {
  id: string;
  property_id: string | null;
  user_id: string | null;
  action: string;
  description: string;
  metadata: Record<string, any> | null;
  created_at: string;
  // Joins
  user?: UserProfile | null;
  property?: Property | null;
}

// Hardware API Ingestion Payload (ESP8266 & Simulator)
export interface HardwareEventRequest {
  device_id: string;
  rfid_uid: string;
  latitude: number;
  longitude: number;
  event_type?: string;
  source?: VerificationSource;
  image_url?: string;
  image_base64?: string;
  image_file?: File;
  notes?: string;
  verified_by?: string;
  payload?: Record<string, any>;
}

export interface ManualVerificationRequest {
  property_id: string;
  notes: string;
  latitude?: number;
  longitude?: number;
  verified_by?: string;
  image_url?: string;
  image_file?: File;
}

export interface HardwareEventResponse {
  success: boolean;
  message: string;
  event_id?: string;
  property_id?: string | null;
  property_title?: string | null;
  matched_property?: {
    id: string;
    property_id: string;
    title: string;
    owner_id: string | null;
    status: PropertyStatus;
  } | null;
  error?: string;
}

// Property Tax Assessment Types
export type TaxAssessmentStatus = 'draft' | 'assessed' | 'due' | 'partially_paid' | 'paid' | 'overdue';

export interface PropertyTaxAssessment {
  id: string;
  property_id: string;
  assessment_year: string; // e.g. "2026", "2025"
  property_type: PropertyType;
  property_usage?: string | null;
  zone_classification?: string | null;
  land_area: number;
  assessed_value: number;
  tax_rate: number; // percentage, e.g. 1.5%
  base_tax: number;
  previous_due: number;
  penalty: number;
  total_due: number;
  due_date: string;
  status: TaxAssessmentStatus;
  payment_date?: string | null;
  payment_reference?: string | null;
  notes?: string | null;
  created_by?: string | null;
  created_at: string;
  updated_at: string;

  // Joins
  property?: Property | null;
}

export interface TaxAssessmentRule {
  property_type: PropertyType;
  default_rate_percent: number;
  penalty_rate_percent: number;
  description: string;
}

