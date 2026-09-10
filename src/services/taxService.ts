// ==============================================================================
// FINNEST - Cadastral Property Tax Assessment Service
// Digital Property & Land Parcel Management Platform
// Handles tax assessment records, dynamic calculations, payment status updates,
// and audit logging via Supabase with resilient fallback persistence
// ==============================================================================

import { supabase, isSupabaseConfigured } from '../lib/supabase';
import {
  PropertyTaxAssessment,
  TaxAssessmentStatus,
  TaxAssessmentRule,
  Property,
} from '../types/database.types';
import {
  DEFAULT_TAX_RULES,
  computeTaxAssessment,
  getEffectiveTaxStatus,
} from '../utils/taxEngine';
import { propertyService } from './propertyService';

const LOCAL_TAX_KEY = 'finnest_tax_assessments_store';
const LOCAL_TAX_CONFIG_KEY = 'finnest_tax_configs_store';

// Helper to generate seed assessments attached to seeded properties
function generateSeedAssessments(): PropertyTaxAssessment[] {
  const years = ['2026', '2025'];
  const seeds: PropertyTaxAssessment[] = [
    {
      id: 'tx-fn1001-2026',
      property_id: 'fn-prop-1001',
      assessment_year: '2026',
      property_type: 'Commercial',
      property_usage: 'Corporate IT Park',
      zone_classification: 'Zone A - Commercial Corridor',
      land_area: 12000,
      assessed_value: 8500000,
      tax_rate: 1.5,
      base_tax: 127500,
      previous_due: 0,
      penalty: 0,
      total_due: 127500,
      due_date: '2026-10-31',
      status: 'due',
      payment_date: null,
      payment_reference: null,
      notes: 'FY 2026 Annual Cadastral Assessment Schedule',
      created_by: null,
      created_at: '2026-04-01T00:00:00.000Z',
      updated_at: '2026-04-01T00:00:00.000Z',
    },
    {
      id: 'tx-fn1001-2025',
      property_id: 'fn-prop-1001',
      assessment_year: '2025',
      property_type: 'Commercial',
      property_usage: 'Corporate IT Park',
      zone_classification: 'Zone A - Commercial Corridor',
      land_area: 12000,
      assessed_value: 8000000,
      tax_rate: 1.5,
      base_tax: 120000,
      previous_due: 0,
      penalty: 0,
      total_due: 120000,
      due_date: '2025-10-31',
      status: 'paid',
      payment_date: '2025-08-15T10:30:00.000Z',
      payment_reference: 'MUNICIPAL-TX-2025-8819',
      notes: 'Paid in full under early assessment rebate schedule',
      created_by: null,
      created_at: '2025-04-01T00:00:00.000Z',
      updated_at: '2025-08-15T10:30:00.000Z',
    },
    {
      id: 'tx-fn1002-2026',
      property_id: 'fn-prop-1002',
      assessment_year: '2026',
      property_type: 'Residential',
      property_usage: 'Township Enclave',
      zone_classification: 'Zone B - Residential Urban',
      land_area: 8500,
      assessed_value: 5200000,
      tax_rate: 0.8,
      base_tax: 41600,
      previous_due: 0,
      penalty: 0,
      total_due: 41600,
      due_date: '2026-09-30',
      status: 'paid',
      payment_date: '2026-05-12T14:20:00.000Z',
      payment_reference: 'TX-CH-2026-4402',
      notes: 'Cleared through RTGS statutory remittance',
      created_by: null,
      created_at: '2026-04-01T00:00:00.000Z',
      updated_at: '2026-05-12T14:20:00.000Z',
    },
    {
      id: 'tx-fn1003-2026',
      property_id: 'fn-prop-1003',
      assessment_year: '2026',
      property_type: 'Commercial',
      property_usage: 'Logistics Warehouse',
      zone_classification: 'Zone C - Industrial Corridor',
      land_area: 15400,
      assessed_value: 6800000,
      tax_rate: 1.5,
      base_tax: 102000,
      previous_due: 15000,
      penalty: 2500,
      total_due: 119500,
      due_date: '2026-06-30',
      status: 'overdue',
      payment_date: null,
      payment_reference: null,
      notes: 'Demand notice issued. Overdue assessment penalty applied.',
      created_by: null,
      created_at: '2026-04-01T00:00:00.000Z',
      updated_at: '2026-07-01T00:00:00.000Z',
    },
    {
      id: 'tx-fn1004-2026',
      property_id: 'fn-prop-1004',
      assessment_year: '2026',
      property_type: 'Residential',
      property_usage: 'Single Family Villa',
      zone_classification: 'Zone B - Residential Urban',
      land_area: 4200,
      assessed_value: 3600000,
      tax_rate: 0.8,
      base_tax: 28800,
      previous_due: 0,
      penalty: 0,
      total_due: 28800,
      due_date: '2026-11-30',
      status: 'due',
      payment_date: null,
      payment_reference: null,
      notes: 'Current assessment demand notice',
      created_by: null,
      created_at: '2026-04-01T00:00:00.000Z',
      updated_at: '2026-04-01T00:00:00.000Z',
    },
    {
      id: 'tx-fn1005-2026',
      property_id: 'fn-prop-1005',
      assessment_year: '2026',
      property_type: 'Industrial',
      property_usage: 'Manufacturing Plant',
      zone_classification: 'Zone C - Industrial Corridor',
      land_area: 24000,
      assessed_value: 12500000,
      tax_rate: 1.2,
      base_tax: 150000,
      previous_due: 0,
      penalty: 0,
      total_due: 150000,
      due_date: '2026-10-15',
      status: 'partially_paid',
      payment_date: '2026-06-01T11:00:00.000Z',
      payment_reference: 'CHQ-PARTIAL-9921',
      notes: 'Installment 1 of 2 received (₹ 75,000 paid)',
      created_by: null,
      created_at: '2026-04-01T00:00:00.000Z',
      updated_at: '2026-06-01T11:00:00.000Z',
    },
  ];

  return seeds;
}

function getLocalAssessments(): PropertyTaxAssessment[] {
  try {
    const raw = localStorage.getItem(LOCAL_TAX_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) {}
  const seeds = generateSeedAssessments();
  try {
    localStorage.setItem(LOCAL_TAX_KEY, JSON.stringify(seeds));
  } catch (e) {}
  return seeds;
}

function saveLocalAssessments(records: PropertyTaxAssessment[]): void {
  try {
    localStorage.setItem(LOCAL_TAX_KEY, JSON.stringify(records));
  } catch (e) {}
}

export const taxService = {
  /**
   * Fetches property tax assessments with optional filtering
   */
  async getAssessments(filters?: {
    property_id?: string;
    owner_id?: string;
    year?: string;
    status?: TaxAssessmentStatus | 'all';
    search?: string;
  }): Promise<{ data: PropertyTaxAssessment[]; error: string | null }> {
    try {
      let assessments: PropertyTaxAssessment[] | null = null;

      // 1. Try Supabase query
      if (isSupabaseConfigured) {
        try {
          let query = supabase
            .from('property_tax_assessments')
            .select(`
              *,
              property:properties(
                id,
                property_id,
                title,
                property_type,
                address,
                city,
                survey_number,
                area,
                area_unit,
                owner_id,
                owner:profiles(id, full_name, email, is_verified)
              )
            `)
            .order('assessment_year', { ascending: false });

          if (filters?.property_id) {
            query = query.eq('property_id', filters.property_id);
          }

          if (filters?.year && filters.year !== 'all') {
            query = query.eq('assessment_year', filters.year);
          }

          if (filters?.status && filters.status !== 'all') {
            query = query.eq('status', filters.status);
          }

          const { data, error } = await query;

          if (!error && data && Array.isArray(data)) {
            assessments = data.map((rec: any) => ({
              ...rec,
              status: getEffectiveTaxStatus(rec.status, rec.due_date),
            }));

            // If owner_id filter is requested, filter by property.owner_id
            if (filters?.owner_id) {
              assessments = assessments.filter(
                a => a.property?.owner_id === filters.owner_id
              );
            }
          }
        } catch (e) {
          console.warn('Supabase property_tax_assessments notice:', e);
        }
      }

      // 2. Resilient local fallback if table does not exist on remote DB or query failed
      if (assessments === null) {
        let local = getLocalAssessments();
        const { data: allProps } = await propertyService.getProperties();
        const propMap = new Map((allProps || []).map(p => [p.id, p]));
        const propIdCodeMap = new Map((allProps || []).map(p => [p.property_id, p]));

        // Attach property relations
        assessments = local.map(a => {
          const matchedProp = propMap.get(a.property_id) || propIdCodeMap.get(a.property_id);
          return {
            ...a,
            status: getEffectiveTaxStatus(a.status, a.due_date),
            property: matchedProp || null,
          };
        });

        if (filters?.property_id) {
          assessments = assessments.filter(
            a => a.property_id === filters.property_id || a.property?.id === filters.property_id || a.property?.property_id === filters.property_id
          );
        }

        if (filters?.owner_id) {
          assessments = assessments.filter(
            a => a.property?.owner_id === filters.owner_id
          );
        }

        if (filters?.year && filters.year !== 'all') {
          assessments = assessments.filter(a => a.assessment_year === filters.year);
        }

        if (filters?.status && filters.status !== 'all') {
          assessments = assessments.filter(a => a.status === filters.status);
        }
      }

      // Search filter
      if (filters?.search && filters.search.trim()) {
        const q = filters.search.toLowerCase().trim();
        assessments = assessments.filter(
          a =>
            a.assessment_year.includes(q) ||
            a.property?.property_id.toLowerCase().includes(q) ||
            a.property?.title.toLowerCase().includes(q) ||
            a.property?.survey_number.toLowerCase().includes(q) ||
            (a.property?.owner?.full_name && a.property.owner.full_name.toLowerCase().includes(q))
        );
      }

      return { data: assessments, error: null };
    } catch (err: any) {
      return { data: getLocalAssessments(), error: null };
    }
  },

  /**
   * Fetches single assessment by ID
   */
  async getAssessmentById(id: string): Promise<{ data: PropertyTaxAssessment | null; error: string | null }> {
    try {
      const { data } = await this.getAssessments();
      const match = (data || []).find(a => a.id === id);
      return { data: match || null, error: match ? null : 'Assessment not found' };
    } catch (err: any) {
      return { data: null, error: err.message };
    }
  },

  /**
   * Creates a new property tax assessment
   */
  async createAssessment(
    assessment: Partial<PropertyTaxAssessment>,
    adminId?: string
  ): Promise<{ data: PropertyTaxAssessment | null; error: string | null }> {
    try {
      const newId = assessment.id || crypto.randomUUID();
      const assessedValue = Number(assessment.assessed_value) || 1000000;
      const rate = Number(assessment.tax_rate) || 1.5;
      const prevDue = Number(assessment.previous_due) || 0;
      const penalty = Number(assessment.penalty) || 0;

      const calc = computeTaxAssessment(assessedValue, rate, prevDue, penalty);

      const record: PropertyTaxAssessment = {
        id: newId,
        property_id: assessment.property_id || '',
        assessment_year: assessment.assessment_year || new Date().getFullYear().toString(),
        property_type: assessment.property_type || 'Commercial',
        property_usage: assessment.property_usage || 'General Commercial',
        zone_classification: assessment.zone_classification || 'Zone A - Municipal Sector',
        land_area: Number(assessment.land_area) || 1000,
        assessed_value: calc.assessedValue,
        tax_rate: calc.taxRatePercent,
        base_tax: calc.baseTax,
        previous_due: calc.previousDue,
        penalty: calc.penalty,
        total_due: calc.totalPayable,
        due_date: assessment.due_date || `${new Date().getFullYear()}-12-31`,
        status: assessment.status || 'due',
        payment_date: assessment.payment_date || null,
        payment_reference: assessment.payment_reference || null,
        notes: assessment.notes || null,
        created_by: adminId || null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      // 1. Try Supabase insert
      if (isSupabaseConfigured) {
        try {
          const { error } = await supabase.from('property_tax_assessments').insert(record);
          if (!error) {
            // Log audit event in property_activity
            await supabase.from('property_activity').insert({
              property_id: record.property_id,
              user_id: adminId || null,
              action: 'tax_assessment_created',
              description: `Tax assessment for FY ${record.assessment_year} created. Total Payable: ₹ ${record.total_due.toLocaleString('en-IN')}`,
              metadata: {
                assessment_id: record.id,
                assessment_year: record.assessment_year,
                assessed_value: record.assessed_value,
                total_due: record.total_due,
              },
            });
          }
        } catch (e) {
          console.warn('Supabase assessment insertion notice:', e);
        }
      }

      // 2. Persist locally as well
      const local = getLocalAssessments();
      local.unshift(record);
      saveLocalAssessments(local);

      return { data: record, error: null };
    } catch (err: any) {
      return { data: null, error: err.message };
    }
  },

  /**
   * Updates an existing tax assessment
   */
  async updateAssessment(
    id: string,
    updates: Partial<PropertyTaxAssessment>,
    adminId?: string
  ): Promise<{ data: PropertyTaxAssessment | null; error: string | null }> {
    try {
      const local = getLocalAssessments();
      const idx = local.findIndex(a => a.id === id);
      const existing = idx >= 0 ? local[idx] : null;

      const assessedValue = updates.assessed_value !== undefined ? Number(updates.assessed_value) : (existing?.assessed_value || 1000000);
      const rate = updates.tax_rate !== undefined ? Number(updates.tax_rate) : (existing?.tax_rate || 1.5);
      const prevDue = updates.previous_due !== undefined ? Number(updates.previous_due) : (existing?.previous_due || 0);
      const penalty = updates.penalty !== undefined ? Number(updates.penalty) : (existing?.penalty || 0);

      const calc = computeTaxAssessment(assessedValue, rate, prevDue, penalty);

      const updatedRecord: PropertyTaxAssessment = {
        ...(existing || {} as any),
        ...updates,
        assessed_value: calc.assessedValue,
        tax_rate: calc.taxRatePercent,
        base_tax: calc.baseTax,
        previous_due: calc.previousDue,
        penalty: calc.penalty,
        total_due: calc.totalPayable,
        updated_at: new Date().toISOString(),
      };

      // 1. Update Supabase
      if (isSupabaseConfigured) {
        try {
          const { error } = await supabase
            .from('property_tax_assessments')
            .update(updatedRecord)
            .eq('id', id);

          if (!error) {
            await supabase.from('property_activity').insert({
              property_id: updatedRecord.property_id,
              user_id: adminId || null,
              action: 'tax_assessment_updated',
              description: `Tax assessment for FY ${updatedRecord.assessment_year} updated by administrator. Total Payable: ₹ ${updatedRecord.total_due.toLocaleString('en-IN')}`,
              metadata: { assessment_id: id, total_due: updatedRecord.total_due },
            });
          }
        } catch (e) {}
      }

      // 2. Update local storage
      if (idx >= 0) {
        local[idx] = updatedRecord;
        saveLocalAssessments(local);
      } else {
        local.unshift(updatedRecord);
        saveLocalAssessments(local);
      }

      return { data: updatedRecord, error: null };
    } catch (err: any) {
      return { data: null, error: err.message };
    }
  },

  /**
   * Updates payment status on an assessment
   */
  async updatePaymentStatus(
    id: string,
    status: TaxAssessmentStatus,
    paymentReference?: string,
    paymentDate?: string,
    adminId?: string
  ): Promise<{ data: PropertyTaxAssessment | null; error: string | null }> {
    try {
      const payload: Partial<PropertyTaxAssessment> = {
        status,
        payment_reference: paymentReference || null,
        payment_date: paymentDate || (status === 'paid' ? new Date().toISOString() : null),
        updated_at: new Date().toISOString(),
      };

      const result = await this.updateAssessment(id, payload, adminId);
      if (result.data) {
        // Additional specific activity log for status change
        if (isSupabaseConfigured) {
          try {
            await supabase.from('property_activity').insert({
              property_id: result.data.property_id,
              user_id: adminId || null,
              action: 'tax_status_updated',
              description: `Tax status updated to ${status.toUpperCase()} for FY ${result.data.assessment_year}. Reference: ${paymentReference || 'None'}`,
              metadata: { assessment_id: id, status, payment_reference: paymentReference },
            });
          } catch (e) {}
        }
      }
      return result;
    } catch (err: any) {
      return { data: null, error: err.message };
    }
  },

  /**
   * Retrieves configurable assessment parameters
   */
  async getTaxConfigurations(): Promise<Record<string, TaxAssessmentRule>> {
    try {
      if (isSupabaseConfigured) {
        const { data, error } = await supabase.from('tax_configurations').select('*');
        if (!error && data && data.length > 0) {
          const map: Record<string, TaxAssessmentRule> = {};
          data.forEach(d => {
            map[d.property_type] = {
              property_type: d.property_type,
              default_rate_percent: Number(d.default_rate_percent),
              penalty_rate_percent: Number(d.penalty_rate_percent),
              description: d.description,
            };
          });
          return map;
        }
      }
      return DEFAULT_TAX_RULES;
    } catch (e) {
      return DEFAULT_TAX_RULES;
    }
  },

  /**
   * Computes summary metrics across all assessments dynamically
   */
  async getTaxSummaryMetrics(): Promise<{
    totalAssessedValue: number;
    totalTaxDue: number;
    totalPaid: number;
    totalOutstanding: number;
    overdueCount: number;
    overdueAmount: number;
    complianceRate: number;
    totalAssessmentsCount: number;
  }> {
    const { data } = await this.getAssessments();
    const list = data || [];

    let totalAssessedValue = 0;
    let totalTaxDue = 0;
    let totalPaid = 0;
    let totalOutstanding = 0;
    let overdueCount = 0;
    let overdueAmount = 0;
    let paidCount = 0;

    list.forEach(a => {
      totalAssessedValue += Number(a.assessed_value) || 0;
      totalTaxDue += Number(a.total_due) || 0;

      if (a.status === 'paid') {
        totalPaid += Number(a.total_due) || 0;
        paidCount++;
      } else if (a.status === 'partially_paid') {
        const half = (Number(a.total_due) || 0) * 0.5;
        totalPaid += half;
        totalOutstanding += half;
      } else {
        totalOutstanding += Number(a.total_due) || 0;
      }

      if (a.status === 'overdue') {
        overdueCount++;
        overdueAmount += Number(a.total_due) || 0;
      }
    });

    const complianceRate = list.length > 0 ? Math.round((paidCount / list.length) * 1000) / 10 : 100;

    return {
      totalAssessedValue,
      totalTaxDue,
      totalPaid,
      totalOutstanding,
      overdueCount,
      overdueAmount,
      complianceRate,
      totalAssessmentsCount: list.length,
    };
  },
};
