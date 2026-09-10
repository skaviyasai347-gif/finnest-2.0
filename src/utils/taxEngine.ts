// ==============================================================================
// FINNEST - Cadastral Property Tax Calculation Engine
// Reusable, Deterministic, and Configurable Assessment Calculator
// NOTE: Rates and formulas represent configurable administrative assessment
// parameters and do NOT constitute statutory or government-mandated tax codes.
// ==============================================================================

import { PropertyType, TaxAssessmentRule, TaxAssessmentStatus } from '../types/database.types';

export interface TaxCalculationResult {
  assessedValue: number;
  taxRatePercent: number;
  baseTax: number;
  previousDue: number;
  penalty: number;
  totalPayable: number;
  formattedAssessedValue: string;
  formattedBaseTax: string;
  formattedTotalPayable: string;
}

export const DEFAULT_TAX_RULES: Record<PropertyType, TaxAssessmentRule> = {
  Commercial: {
    property_type: 'Commercial',
    default_rate_percent: 1.5,
    penalty_rate_percent: 2.0,
    description: 'Commercial Office, IT Park, & Retail Cadastral Zone Assessment',
  },
  Residential: {
    property_type: 'Residential',
    default_rate_percent: 0.8,
    penalty_rate_percent: 1.5,
    description: 'Residential Township, Villa, & Apartment Sector Assessment',
  },
  Industrial: {
    property_type: 'Industrial',
    default_rate_percent: 1.2,
    penalty_rate_percent: 2.5,
    description: 'Manufacturing, Logistics, & Industrial Corridor Assessment',
  },
  Agricultural: {
    property_type: 'Agricultural',
    default_rate_percent: 0.3,
    penalty_rate_percent: 1.0,
    description: 'Agricultural Greenbelt & Horticultural Holding Assessment',
  },
};

/**
 * Formats a numeric amount in Indian Currency format (₹ XX,XX,XXX)
 */
export function formatCurrency(amount: number): string {
  if (isNaN(amount)) return '₹ 0';
  return `₹ ${Math.round(amount).toLocaleString('en-IN')}`;
}

/**
 * Calculates base tax from assessed market value and configured tax rate percentage
 * Formula: Assessed Value * (Rate / 100)
 */
export function calculateBaseTax(assessedValue: number, ratePercent: number): number {
  if (!assessedValue || assessedValue <= 0 || !ratePercent || ratePercent <= 0) return 0;
  return Math.round((assessedValue * ratePercent) / 100.0);
}

/**
 * Calculates total payable from base tax, previous outstanding balance, and late penalty
 * Formula: Base Tax + Previous Outstanding + Penalty
 */
export function calculateTotalPayable(baseTax: number, previousDue: number = 0, penalty: number = 0): number {
  const cleanBase = Math.max(0, baseTax || 0);
  const cleanPrev = Math.max(0, previousDue || 0);
  const cleanPenalty = Math.max(0, penalty || 0);
  return Math.round(cleanBase + cleanPrev + cleanPenalty);
}

/**
 * Full assessment calculator producing detailed breakdown
 */
export function computeTaxAssessment(
  assessedValue: number,
  ratePercent: number,
  previousDue: number = 0,
  penalty: number = 0
): TaxCalculationResult {
  const baseTax = calculateBaseTax(assessedValue, ratePercent);
  const totalPayable = calculateTotalPayable(baseTax, previousDue, penalty);

  return {
    assessedValue,
    taxRatePercent: ratePercent,
    baseTax,
    previousDue,
    penalty,
    totalPayable,
    formattedAssessedValue: formatCurrency(assessedValue),
    formattedBaseTax: formatCurrency(baseTax),
    formattedTotalPayable: formatCurrency(totalPayable),
  };
}

/**
 * Determines whether an assessment is overdue based on due date and status
 */
export function isAssessmentOverdue(dueDateStr: string, status: TaxAssessmentStatus): boolean {
  if (status === 'paid' || status === 'draft') return false;
  if (!dueDateStr) return false;

  const dueDate = new Date(dueDateStr);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return dueDate < today;
}

/**
 * Derives dynamic status flag considering due date
 */
export function getEffectiveTaxStatus(storedStatus: TaxAssessmentStatus, dueDateStr: string): TaxAssessmentStatus {
  if (storedStatus === 'paid' || storedStatus === 'draft' || storedStatus === 'partially_paid') {
    return storedStatus;
  }
  if (isAssessmentOverdue(dueDateStr, storedStatus)) {
    return 'overdue';
  }
  return storedStatus;
}
