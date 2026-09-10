// ==============================================================================
// FINNEST - Owner Portal Property Tax Assessment Page
// Digital Property & Land Parcel Management Platform
// View municipal valuation, statutory demands, and payment receipts for owned parcels
// ==============================================================================

import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../../features/auth/AuthContext';
import { taxService } from '../../services/taxService';
import { PropertyTaxAssessment, TaxAssessmentStatus } from '../../types/database.types';
import { formatCurrency } from '../../utils/taxEngine';
import {
  Receipt,
  CheckCircle2,
  FileText,
  Download,
  Building2,
  ShieldCheck,
  Clock,
  AlertTriangle,
  HelpCircle,
  X,
} from 'lucide-react';

export const UserTaxPage: React.FC = () => {
  const { user } = useAuth();

  const [assessments, setAssessments] = useState<PropertyTaxAssessment[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [activeTab, setActiveTab] = useState<'current' | 'outstanding' | 'history'>('current');
  const [selectedReceipt, setSelectedReceipt] = useState<PropertyTaxAssessment | null>(null);

  useEffect(() => {
    async function loadUserAssessments() {
      if (user?.id) {
        setLoading(true);
        // Specifically filter by owner_id to strictly retrieve only owned parcels
        const { data } = await taxService.getAssessments({ owner_id: user.id });
        setAssessments(data || []);
        setLoading(false);
      } else {
        setAssessments([]);
        setLoading(false);
      }
    }
    loadUserAssessments();
  }, [user?.id]);

  const currentYear = new Date().getFullYear().toString();

  // Tab 1: Current Tax Demands (Current Fiscal Year)
  const currentAssessments = useMemo(() => {
    return assessments.filter(a => a.assessment_year === currentYear);
  }, [assessments, currentYear]);

  // Tab 2: Outstanding / Overdue Dues
  const outstandingAssessments = useMemo(() => {
    return assessments.filter(a => a.status === 'due' || a.status === 'overdue' || a.status === 'partially_paid');
  }, [assessments]);

  // Tab 3: Historical Assessments (Past Years or Cleared records)
  const historyAssessments = useMemo(() => {
    return assessments.filter(a => a.assessment_year !== currentYear || a.status === 'paid');
  }, [assessments, currentYear]);

  const displayedList = useMemo(() => {
    if (activeTab === 'current') return currentAssessments;
    if (activeTab === 'outstanding') return outstandingAssessments;
    return historyAssessments;
  }, [activeTab, currentAssessments, outstandingAssessments, historyAssessments]);

  const getStatusBadge = (status: TaxAssessmentStatus) => {
    switch (status) {
      case 'paid':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-emerald-50 text-emerald-700 border border-emerald-200">
            <CheckCircle2 className="w-3.5 h-3.5" /> Cleared / Paid
          </span>
        );
      case 'partially_paid':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-blue-50 text-blue-700 border border-blue-200">
            <Clock className="w-3.5 h-3.5" /> Partially Settled
          </span>
        );
      case 'overdue':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-red-50 text-red-700 border border-red-200">
            <AlertTriangle className="w-3.5 h-3.5" /> Overdue Notice
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-amber-50 text-amber-700 border border-amber-200">
            <Clock className="w-3.5 h-3.5" /> Due for Payment
          </span>
        );
    }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div>
        <h1 className="text-xl font-bold tracking-tight text-slate-900">
          Property Tax & Municipal Assessment
        </h1>
        <p className="text-xs text-slate-500 mt-0.5">
          Official cadastral valuation, annual municipal demands, and payment receipts for your registered parcels
        </p>
      </div>

      {/* Tab Navigation */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-3 text-xs font-semibold">
        <button
          onClick={() => setActiveTab('current')}
          className={`px-3.5 py-1.5 rounded-xl transition-colors ${
            activeTab === 'current'
              ? 'bg-slate-900 text-white'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          Current Tax ({currentAssessments.length})
        </button>

        <button
          onClick={() => setActiveTab('outstanding')}
          className={`px-3.5 py-1.5 rounded-xl transition-colors flex items-center gap-1.5 ${
            activeTab === 'outstanding'
              ? 'bg-amber-600 text-white'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <span>Outstanding Dues</span>
          {outstandingAssessments.length > 0 && (
            <span className="px-1.5 py-0.2 rounded-full bg-amber-100 text-amber-800 text-[10px]">
              {outstandingAssessments.length}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('history')}
          className={`px-3.5 py-1.5 rounded-xl transition-colors ${
            activeTab === 'history'
              ? 'bg-slate-900 text-white'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          Tax History ({historyAssessments.length})
        </button>
      </div>

      {/* Loading & Empty State */}
      {loading ? (
        <div className="py-12 flex justify-center">
          <div className="w-8 h-8 border-3 border-emerald-600 border-t-transparent rounded-full animate-spin"></div>
        </div>
      ) : displayedList.length === 0 ? (
        <div className="bg-white rounded-2xl p-8 border border-slate-200 text-center text-slate-500">
          <Receipt className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <h3 className="font-bold text-slate-800 text-sm">No Assessment Records</h3>
          <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
            {activeTab === 'outstanding'
              ? 'All municipal property tax demands for your registered parcels are fully settled.'
              : 'No municipal tax assessments found in this view.'}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {displayedList.map(a => {
            return (
              <div key={a.id} className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-xs">
                {/* Card Header */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-4 border-b border-slate-100">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center font-bold">
                      <Building2 className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="font-bold text-slate-900 text-sm">
                        {a.property?.title || 'Cadastral Parcel'}
                      </h3>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="font-mono text-xs text-emerald-700 font-semibold">
                          {a.property?.property_id || a.property_id}
                        </span>
                        <span className="text-xs text-slate-400">
                          &bull; Survey No: {a.property?.survey_number}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 self-start sm:self-auto">
                    {getStatusBadge(a.status)}
                  </div>
                </div>

                {/* Details Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 py-4 text-xs">
                  <div>
                    <span className="text-slate-400 block mb-1">Assessment Period</span>
                    <span className="font-semibold text-slate-800 font-mono">FY {a.assessment_year}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block mb-1">Assessed Value</span>
                    <span className="font-semibold text-slate-800 font-mono">{formatCurrency(a.assessed_value)}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block mb-1">Assessment Rate</span>
                    <span className="font-semibold text-slate-800 font-mono">{a.tax_rate}% / yr</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block mb-1 font-bold text-slate-700">Total Demand Payable</span>
                    <span className="font-mono font-bold text-emerald-800 text-sm">
                      {formatCurrency(a.total_due)}
                    </span>
                  </div>
                </div>

                {/* Additional Arrears & Due Date info */}
                <div className="bg-slate-50 p-3 rounded-xl text-[11px] text-slate-600 flex flex-wrap items-center justify-between gap-2 border border-slate-100">
                  <div>
                    <span className="text-slate-400">Due Date: </span>
                    <span className="font-semibold text-slate-700">{a.due_date}</span>
                    {a.penalty > 0 && (
                      <span className="text-red-600 ml-2 font-semibold">
                        (Includes {formatCurrency(a.penalty)} late penalty)
                      </span>
                    )}
                  </div>

                  {a.payment_reference && (
                    <div>
                      <span className="text-slate-400">Payment Reference: </span>
                      <span className="font-mono font-bold text-slate-800">{a.payment_reference}</span>
                    </div>
                  )}
                </div>

                {/* Footer Action */}
                <div className="pt-3 mt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-1.5 text-slate-500">
                    <ShieldCheck className="w-4 h-4 text-emerald-600" />
                    <span>Official FinNest Cadastral Clearance Record</span>
                  </div>

                  <button
                    onClick={() => setSelectedReceipt(a)}
                    className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-700 hover:text-emerald-800 transition-colors"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>View Assessment Statement</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Statement / Receipt Modal */}
      {selectedReceipt && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-lg p-6 sm:p-8 shadow-2xl text-slate-900 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-start justify-between pb-4 border-b border-slate-100">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-widest text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                  Municipal Cadastral Demand Notice
                </span>
                <h3 className="font-bold text-slate-900 text-lg mt-1.5">
                  Assessment Statement: FY {selectedReceipt.assessment_year}
                </h3>
                <p className="text-xs text-slate-500 font-mono mt-0.5">
                  Parcel: {selectedReceipt.property?.property_id} • Survey No: {selectedReceipt.property?.survey_number}
                </p>
              </div>
              <button
                onClick={() => setSelectedReceipt(null)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="py-4 space-y-3 text-xs">
              <div className="flex justify-between py-1.5 border-b border-slate-100">
                <span className="text-slate-500">Property Title:</span>
                <span className="font-semibold text-slate-800">{selectedReceipt.property?.title}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-slate-100">
                <span className="text-slate-500">Registered Owner:</span>
                <span className="font-semibold text-slate-800">{user?.full_name}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-slate-100">
                <span className="text-slate-500">Assessed Property Valuation:</span>
                <span className="font-mono font-semibold text-slate-800">
                  {formatCurrency(selectedReceipt.assessed_value)}
                </span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-slate-100">
                <span className="text-slate-500">Assessment Rate Schedule:</span>
                <span className="font-mono font-semibold text-slate-800">{selectedReceipt.tax_rate}% / yr</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-slate-100">
                <span className="text-slate-500">Calculated Base Tax:</span>
                <span className="font-mono font-semibold text-slate-800">
                  {formatCurrency(selectedReceipt.base_tax)}
                </span>
              </div>
              {selectedReceipt.previous_due > 0 && (
                <div className="flex justify-between py-1.5 border-b border-slate-100">
                  <span className="text-slate-500">Previous Outstanding Arrears:</span>
                  <span className="font-mono font-semibold text-slate-800">
                    {formatCurrency(selectedReceipt.previous_due)}
                  </span>
                </div>
              )}
              {selectedReceipt.penalty > 0 && (
                <div className="flex justify-between py-1.5 border-b border-slate-100 text-red-600">
                  <span>Overdue Penalty Surcharge:</span>
                  <span className="font-mono font-semibold">
                    {formatCurrency(selectedReceipt.penalty)}
                  </span>
                </div>
              )}
              <div className="flex justify-between py-2.5 bg-slate-50 px-3 rounded-xl text-sm font-bold">
                <span className="text-slate-800">Total Demand Payable:</span>
                <span className="font-mono text-emerald-800">
                  {formatCurrency(selectedReceipt.total_due)}
                </span>
              </div>
              <div className="flex justify-between py-1.5 text-slate-500">
                <span>Payment Settlement Status:</span>
                <span>{getStatusBadge(selectedReceipt.status)}</span>
              </div>
              {selectedReceipt.payment_reference && (
                <div className="flex justify-between py-1.5 text-slate-500 font-mono">
                  <span>Challan / Bank Ref:</span>
                  <span className="font-bold text-slate-800">{selectedReceipt.payment_reference}</span>
                </div>
              )}
            </div>

            <div className="pt-4 border-t border-slate-100 flex items-center justify-end">
              <button
                onClick={() => setSelectedReceipt(null)}
                className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs rounded-xl"
              >
                Close Statement
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
