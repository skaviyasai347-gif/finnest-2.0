// ==============================================================================
// FINNEST - Admin Property Tax Assessment & Revenue Portal
// Digital Property & Land Parcel Management Platform
// Full administrative assessment creation, payment recording, and dynamic calculations
// ==============================================================================

import React, { useState, useEffect, useMemo } from 'react';
import { taxService } from '../../services/taxService';
import { propertyService } from '../../services/propertyService';
import { useAuth } from '../../features/auth/AuthContext';
import {
  Property,
  PropertyTaxAssessment,
  TaxAssessmentStatus,
  TaxAssessmentRule,
  PropertyType,
} from '../../types/database.types';
import {
  computeTaxAssessment,
  formatCurrency,
  DEFAULT_TAX_RULES,
} from '../../utils/taxEngine';
import {
  Receipt,
  Building2,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Search,
  FileText,
  Plus,
  Edit2,
  CreditCard,
  Calendar,
  Filter,
  X,
  ShieldCheck,
  Check,
  Settings2,
  ExternalLink,
  HelpCircle,
  TrendingUp,
} from 'lucide-react';

export const AdminTaxPage: React.FC = () => {
  const { user } = useAuth();

  const [assessments, setAssessments] = useState<PropertyTaxAssessment[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);
  const [taxRules, setTaxRules] = useState<Record<string, TaxAssessmentRule>>(DEFAULT_TAX_RULES);
  const [loading, setLoading] = useState<boolean>(true);

  // Tabs: 'overview' | 'assessments' | 'outstanding' | 'config'
  const [activeTab, setActiveTab] = useState<'overview' | 'assessments' | 'outstanding' | 'config'>('overview');

  // Filters
  const [search, setSearch] = useState<string>('');
  const [yearFilter, setYearFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // Create / Edit Modal State
  const [isFormModalOpen, setIsFormModalOpen] = useState<boolean>(false);
  const [formMode, setFormMode] = useState<'create' | 'edit'>('create');
  const [editingAssessmentId, setEditingAssessmentId] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    property_id: '',
    assessment_year: new Date().getFullYear().toString(),
    property_type: 'Commercial' as PropertyType,
    property_usage: 'Commercial Office Complex',
    zone_classification: 'Zone A - Central Business District',
    land_area: 5000,
    assessed_value: 5000000,
    tax_rate: 1.5,
    previous_due: 0,
    penalty: 0,
    due_date: `${new Date().getFullYear()}-10-31`,
    status: 'due' as TaxAssessmentStatus,
    notes: '',
  });

  // Payment Status Recording Modal
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState<boolean>(false);
  const [targetAssessment, setTargetAssessment] = useState<PropertyTaxAssessment | null>(null);
  const [paymentForm, setPaymentForm] = useState({
    status: 'paid' as TaxAssessmentStatus,
    payment_reference: '',
    payment_date: new Date().toISOString().split('T')[0],
  });

  // Summary Metrics State
  const [metrics, setMetrics] = useState({
    totalAssessedValue: 0,
    totalTaxDue: 0,
    totalPaid: 0,
    totalOutstanding: 0,
    overdueCount: 0,
    overdueAmount: 0,
    complianceRate: 100,
    totalAssessmentsCount: 0,
  });

  const loadAllData = async () => {
    setLoading(true);
    const [assRes, propsRes, rulesRes, metricsRes] = await Promise.all([
      taxService.getAssessments(),
      propertyService.getProperties(),
      taxService.getTaxConfigurations(),
      taxService.getTaxSummaryMetrics(),
    ]);

    setAssessments(assRes.data || []);
    setProperties(propsRes.data || []);
    setTaxRules(rulesRes);
    setMetrics(metricsRes);
    setLoading(false);
  };

  useEffect(() => {
    loadAllData();
  }, []);

  // Filtered Assessments
  const filteredAssessments = useMemo(() => {
    return assessments.filter(a => {
      const matchYear = yearFilter === 'all' || a.assessment_year === yearFilter;
      const matchStatus = statusFilter === 'all' || a.status === statusFilter;
      const matchSearch =
        !search.trim() ||
        a.assessment_year.includes(search) ||
        a.property?.property_id.toLowerCase().includes(search.toLowerCase()) ||
        a.property?.title.toLowerCase().includes(search.toLowerCase()) ||
        a.property?.survey_number.toLowerCase().includes(search.toLowerCase()) ||
        (a.property?.owner?.full_name && a.property.owner.full_name.toLowerCase().includes(search.toLowerCase()));

      return matchYear && matchStatus && matchSearch;
    });
  }, [assessments, yearFilter, statusFilter, search]);

  // Outstanding / Overdue Only
  const outstandingAssessments = useMemo(() => {
    return assessments.filter(a => a.status === 'due' || a.status === 'overdue' || a.status === 'partially_paid');
  }, [assessments]);

  // Dynamic calculation for modal
  const liveCalculation = useMemo(() => {
    return computeTaxAssessment(
      Number(formData.assessed_value),
      Number(formData.tax_rate),
      Number(formData.previous_due),
      Number(formData.penalty)
    );
  }, [formData.assessed_value, formData.tax_rate, formData.previous_due, formData.penalty]);

  // Handle Opening Create Modal
  const handleOpenCreate = () => {
    setFormMode('create');
    setEditingAssessmentId(null);
    const firstProp = properties[0];
    const defaultType = firstProp?.property_type || 'Commercial';
    const rule = taxRules[defaultType] || DEFAULT_TAX_RULES.Commercial;

    setFormData({
      property_id: firstProp?.id || '',
      assessment_year: new Date().getFullYear().toString(),
      property_type: defaultType,
      property_usage: defaultType === 'Commercial' ? 'Commercial Tech Park' : 'Residential Housing',
      zone_classification: 'Zone A - Municipal Cadastral Sector',
      land_area: firstProp?.area || 5000,
      assessed_value: 5000000,
      tax_rate: rule.default_rate_percent,
      previous_due: 0,
      penalty: 0,
      due_date: `${new Date().getFullYear()}-10-31`,
      status: 'due',
      notes: 'Annual cadastral assessment record',
    });
    setIsFormModalOpen(true);
  };

  // Handle Opening Edit Modal
  const handleOpenEdit = (a: PropertyTaxAssessment) => {
    setFormMode('edit');
    setEditingAssessmentId(a.id);
    setFormData({
      property_id: a.property_id,
      assessment_year: a.assessment_year,
      property_type: a.property_type,
      property_usage: a.property_usage || '',
      zone_classification: a.zone_classification || '',
      land_area: a.land_area,
      assessed_value: a.assessed_value,
      tax_rate: a.tax_rate,
      previous_due: a.previous_due,
      penalty: a.penalty,
      due_date: a.due_date,
      status: a.status,
      notes: a.notes || '',
    });
    setIsFormModalOpen(true);
  };

  // Handle Property Selection change in Create Modal
  const handlePropertyChange = (propertyId: string) => {
    const prop = properties.find(p => p.id === propertyId);
    if (prop) {
      const rule = taxRules[prop.property_type] || DEFAULT_TAX_RULES[prop.property_type] || DEFAULT_TAX_RULES.Commercial;
      setFormData(prev => ({
        ...prev,
        property_id: prop.id,
        property_type: prop.property_type,
        land_area: prop.area,
        tax_rate: rule.default_rate_percent,
        assessed_value: Math.round(prop.area * (prop.property_type === 'Commercial' ? 600 : 400)),
      }));
    }
  };

  // Submit Assessment Form
  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.property_id) {
      alert('Please select a property.');
      return;
    }

    if (formMode === 'create') {
      await taxService.createAssessment(formData, user?.id);
    } else if (editingAssessmentId) {
      await taxService.updateAssessment(editingAssessmentId, formData, user?.id);
    }

    setIsFormModalOpen(false);
    loadAllData();
  };

  // Open Payment Recording Modal
  const handleOpenPaymentModal = (a: PropertyTaxAssessment) => {
    setTargetAssessment(a);
    setPaymentForm({
      status: a.status === 'paid' ? 'paid' : 'paid',
      payment_reference: a.payment_reference || `CHALLAN-TX-${Math.floor(100000 + Math.random() * 900000)}`,
      payment_date: new Date().toISOString().split('T')[0],
    });
    setIsPaymentModalOpen(true);
  };

  // Submit Payment Status Update
  const handlePaymentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetAssessment) return;

    await taxService.updatePaymentStatus(
      targetAssessment.id,
      paymentForm.status,
      paymentForm.payment_reference,
      paymentForm.payment_date,
      user?.id
    );

    setIsPaymentModalOpen(false);
    loadAllData();
  };

  const getStatusBadge = (status: TaxAssessmentStatus) => {
    switch (status) {
      case 'paid':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <CheckCircle2 className="w-3 h-3" /> Paid
          </span>
        );
      case 'partially_paid':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-blue-500/10 text-blue-400 border border-blue-500/20">
            <Clock className="w-3 h-3" /> Partially Paid
          </span>
        );
      case 'overdue':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-red-500/10 text-red-400 border border-red-500/20">
            <AlertTriangle className="w-3 h-3" /> Overdue
          </span>
        );
      case 'due':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-amber-500/10 text-amber-400 border border-amber-500/20">
            <Clock className="w-3 h-3" /> Due
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-slate-500/10 text-slate-400 border border-slate-500/20">
            {status}
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-white">
            Property Tax & Municipal Assessment
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Cadastral valuation schedules, municipal demands, payment status tracking, and revenue compliance
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={handleOpenCreate}
            className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold rounded-xl flex items-center gap-2 transition-all shadow-md shadow-emerald-500/20"
          >
            <Plus className="w-4 h-4" />
            <span>Create Assessment</span>
          </button>
        </div>
      </div>

      {/* Primary Metric Ribbon */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-400">Total Assessed Valuation</span>
            <Building2 className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-xl font-bold text-white font-mono">
            {formatCurrency(metrics.totalAssessedValue)}
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            Across {metrics.totalAssessmentsCount} cadastral assessments
          </div>
        </div>

        <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-400">Total Revenue Collected</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-xl font-bold text-emerald-400 font-mono">
            {formatCurrency(metrics.totalPaid)}
          </div>
          <div className="text-[11px] text-emerald-400/80 mt-1 font-semibold">
            {metrics.complianceRate}% Collection compliance
          </div>
        </div>

        <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-400">Outstanding Balance</span>
            <Clock className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-xl font-bold text-amber-400 font-mono">
            {formatCurrency(metrics.totalOutstanding)}
          </div>
          <div className="text-[11px] text-slate-500 mt-1">Active fiscal year demands</div>
        </div>

        <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-400">Overdue Demands</span>
            <AlertTriangle className="w-4 h-4 text-red-400" />
          </div>
          <div className="text-xl font-bold text-red-400 font-mono">
            {formatCurrency(metrics.overdueAmount)}
          </div>
          <div className="text-[11px] text-red-400/80 mt-1 font-semibold">
            {metrics.overdueCount} Demands past statutory due date
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex items-center gap-2 border-b border-slate-800 pb-3 text-xs font-semibold">
        <button
          onClick={() => setActiveTab('overview')}
          className={`px-3.5 py-1.5 rounded-xl transition-colors ${
            activeTab === 'overview'
              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          Overview & Demands
        </button>

        <button
          onClick={() => setActiveTab('assessments')}
          className={`px-3.5 py-1.5 rounded-xl transition-colors ${
            activeTab === 'assessments'
              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          All Assessments ({assessments.length})
        </button>

        <button
          onClick={() => setActiveTab('outstanding')}
          className={`px-3.5 py-1.5 rounded-xl transition-colors flex items-center gap-1.5 ${
            activeTab === 'outstanding'
              ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <span>Outstanding & Overdue</span>
          <span className="px-1.5 py-0.2 rounded-full bg-amber-500/20 text-amber-300 text-[10px]">
            {outstandingAssessments.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('config')}
          className={`px-3.5 py-1.5 rounded-xl transition-colors flex items-center gap-1.5 ml-auto ${
            activeTab === 'config'
              ? 'bg-slate-800 text-white border border-slate-700'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <Settings2 className="w-3.5 h-3.5" />
          <span>Assessment Configuration</span>
        </button>
      </div>

      {/* Tab Content 1: Overview & Assessments List */}
      {(activeTab === 'overview' || activeTab === 'assessments' || activeTab === 'outstanding') && (
        <div className="space-y-4">
          {/* Search and Filters */}
          <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 shadow-sm flex flex-col md:flex-row gap-3 items-center justify-between">
            <div className="relative w-full md:w-80">
              <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
              <input
                type="text"
                placeholder="Search by ID, parcel, survey no, or owner..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-10 pr-8 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
              />
              {search && (
                <button
                  onClick={() => setSearch('')}
                  className="absolute right-3 top-3 text-slate-400 hover:text-white"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <div className="flex items-center gap-2 w-full md:w-auto overflow-x-auto">
              <select
                value={yearFilter}
                onChange={e => setYearFilter(e.target.value)}
                className="bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs font-semibold text-slate-300 outline-none"
              >
                <option value="all">All Fiscal Years</option>
                <option value="2026">FY 2026</option>
                <option value="2025">FY 2025</option>
                <option value="2024">FY 2024</option>
              </select>

              {activeTab !== 'outstanding' && (
                <select
                  value={statusFilter}
                  onChange={e => setStatusFilter(e.target.value)}
                  className="bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs font-semibold text-slate-300 outline-none"
                >
                  <option value="all">All Statuses</option>
                  <option value="due">Due</option>
                  <option value="paid">Paid</option>
                  <option value="overdue">Overdue</option>
                  <option value="partially_paid">Partially Paid</option>
                  <option value="draft">Draft</option>
                </select>
              )}
            </div>
          </div>

          {/* Assessments Table */}
          <div className="bg-slate-950 rounded-3xl border border-slate-800 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="bg-slate-900/80 text-[11px] uppercase font-bold text-slate-400 tracking-wider border-b border-slate-800">
                  <tr>
                    <th className="py-3.5 px-4">Parcel ID & Year</th>
                    <th className="py-3.5 px-4">Property & Titleholder</th>
                    <th className="py-3.5 px-4">Assessed Value</th>
                    <th className="py-3.5 px-4">Rate & Base Tax</th>
                    <th className="py-3.5 px-4">Penalty & Total Due</th>
                    <th className="py-3.5 px-4">Due Date</th>
                    <th className="py-3.5 px-4">Status</th>
                    <th className="py-3.5 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {(activeTab === 'outstanding' ? outstandingAssessments : filteredAssessments).length > 0 ? (
                    (activeTab === 'outstanding' ? outstandingAssessments : filteredAssessments).map(a => {
                      return (
                        <tr key={a.id} className="hover:bg-slate-900/50 transition-colors">
                          <td className="py-3.5 px-4 whitespace-nowrap">
                            <span className="font-mono font-bold text-white bg-slate-900 px-2 py-0.5 rounded border border-slate-800">
                              {a.property?.property_id || a.property_id}
                            </span>
                            <div className="text-[10px] text-slate-500 mt-1 font-mono">
                              Period: FY {a.assessment_year}
                            </div>
                          </td>

                          <td className="py-3.5 px-4">
                            <div className="font-semibold text-white truncate max-w-xs">
                              {a.property?.title || 'Cadastral Parcel'}
                            </div>
                            <div className="text-[11px] text-slate-400 flex items-center gap-1.5">
                              <span>{a.property?.owner?.full_name || 'Government Land Bank'}</span>
                              {a.property?.owner?.is_verified && (
                                <ShieldCheck className="w-3 h-3 text-emerald-400" />
                              )}
                            </div>
                          </td>

                          <td className="py-3.5 px-4 whitespace-nowrap font-mono text-slate-200">
                            {formatCurrency(a.assessed_value)}
                            <div className="text-[10px] text-slate-500 font-sans">
                              {a.land_area?.toLocaleString()} sq.ft
                            </div>
                          </td>

                          <td className="py-3.5 px-4 whitespace-nowrap font-mono">
                            <span className="text-slate-300">{a.tax_rate}%</span>
                            <div className="text-slate-400 text-[11px]">{formatCurrency(a.base_tax)}</div>
                          </td>

                          <td className="py-3.5 px-4 whitespace-nowrap font-mono">
                            <span className="text-emerald-400 font-bold text-sm">
                              {formatCurrency(a.total_due)}
                            </span>
                            {a.penalty > 0 && (
                              <div className="text-[10px] text-red-400">+ {formatCurrency(a.penalty)} penalty</div>
                            )}
                          </td>

                          <td className="py-3.5 px-4 whitespace-nowrap text-slate-400">
                            {a.due_date}
                          </td>

                          <td className="py-3.5 px-4 whitespace-nowrap">
                            {getStatusBadge(a.status)}
                            {a.payment_reference && (
                              <div className="text-[9px] font-mono text-slate-500 truncate max-w-[120px] mt-0.5">
                                Ref: {a.payment_reference}
                              </div>
                            )}
                          </td>

                          <td className="py-3.5 px-4 text-right whitespace-nowrap">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                onClick={() => handleOpenPaymentModal(a)}
                                title="Record Payment / Status"
                                className="p-1.5 rounded-lg text-slate-400 hover:text-emerald-400 hover:bg-slate-800 transition-colors"
                              >
                                <CreditCard className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => handleOpenEdit(a)}
                                title="Edit Assessment"
                                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={8} className="py-10 text-center text-slate-500">
                        No property tax assessment records found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Tab Content 2: Assessment Configuration Presets */}
      {activeTab === 'config' && (
        <div className="space-y-4">
          <div className="bg-slate-900/40 p-4 rounded-2xl border border-slate-800">
            <div className="flex items-center gap-2 mb-1">
              <Settings2 className="w-4 h-4 text-emerald-400" />
              <h2 className="text-sm font-bold text-white">Assessment Parameters Configuration</h2>
            </div>
            <p className="text-xs text-slate-400">
              Administrative schedules used by the assessment engine to evaluate annual property tax demands.
              These rates represent configurable municipal schedules and do not constitute statutory enactments.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {Object.entries(taxRules).map(([type, rule]) => (
              <div key={type} className="bg-slate-950 p-5 rounded-2xl border border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-bold text-white">{type} Zoning Class</span>
                  <span className="px-2.5 py-0.5 rounded-md text-xs font-mono font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                    {rule.default_rate_percent}% Assessment Rate
                  </span>
                </div>

                <p className="text-xs text-slate-400">{rule.description}</p>

                <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-800/80 text-xs">
                  <div>
                    <span className="text-slate-500 block">Default Assessment Rate</span>
                    <span className="font-mono text-slate-200 font-semibold">{rule.default_rate_percent}% / yr</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Overdue Penalty Surcharge</span>
                    <span className="font-mono text-slate-200 font-semibold">{rule.penalty_rate_percent}%</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Modal 1: Create / Edit Tax Assessment */}
      {isFormModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-slate-950 border border-slate-800 rounded-3xl w-full max-w-2xl p-6 sm:p-8 my-8 shadow-2xl text-slate-100 max-h-[92vh] overflow-y-auto animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-widest text-emerald-400">
                  Cadastral Tax Engine
                </span>
                <h2 className="text-lg font-bold text-white mt-0.5">
                  {formMode === 'create' ? 'Create Property Tax Assessment' : 'Edit Tax Assessment'}
                </h2>
              </div>
              <button
                onClick={() => setIsFormModalOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleFormSubmit} className="space-y-4 mt-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Property Selector */}
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Cadastral Parcel <span className="text-emerald-500">*</span>
                  </label>
                  <select
                    required
                    disabled={formMode === 'edit'}
                    value={formData.property_id}
                    onChange={e => handlePropertyChange(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                  >
                    <option value="">-- Select Registered Cadastral Parcel --</option>
                    {properties.map(p => (
                      <option key={p.id} value={p.id}>
                        {p.property_id} • {p.title} ({p.owner?.full_name || 'Unassigned'})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Fiscal Year & Property Type */}
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Assessment Fiscal Year <span className="text-emerald-500">*</span>
                  </label>
                  <select
                    value={formData.assessment_year}
                    onChange={e => setFormData({ ...formData, assessment_year: e.target.value })}
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500 font-mono"
                  >
                    <option value="2026">2026 (FY 2026-2027)</option>
                    <option value="2025">2025 (FY 2025-2026)</option>
                    <option value="2024">2024 (FY 2024-2025)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Property Zoning Class</label>
                  <select
                    value={formData.property_type}
                    onChange={e => {
                      const newType = e.target.value as PropertyType;
                      const rule = taxRules[newType] || DEFAULT_TAX_RULES[newType];
                      setFormData({
                        ...formData,
                        property_type: newType,
                        tax_rate: rule.default_rate_percent,
                      });
                    }}
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                  >
                    <option value="Commercial">Commercial</option>
                    <option value="Residential">Residential</option>
                    <option value="Industrial">Industrial</option>
                    <option value="Agricultural">Agricultural</option>
                  </select>
                </div>

                {/* Assessed Value & Tax Rate */}
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Assessed Property Value (₹) <span className="text-emerald-500">*</span>
                  </label>
                  <input
                    type="number"
                    step="1000"
                    required
                    value={formData.assessed_value}
                    onChange={e => setFormData({ ...formData, assessed_value: Number(e.target.value) })}
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500 font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Assessment Rate (%) <span className="text-emerald-500">*</span>
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={formData.tax_rate}
                    onChange={e => setFormData({ ...formData, tax_rate: Number(e.target.value) })}
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500 font-mono"
                  />
                </div>

                {/* Previous Due & Penalty */}
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Previous Arrears (₹)</label>
                  <input
                    type="number"
                    step="100"
                    value={formData.previous_due}
                    onChange={e => setFormData({ ...formData, previous_due: Number(e.target.value) })}
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500 font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Late Penalty (₹)</label>
                  <input
                    type="number"
                    step="100"
                    value={formData.penalty}
                    onChange={e => setFormData({ ...formData, penalty: Number(e.target.value) })}
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500 font-mono"
                  />
                </div>

                {/* Due Date & Initial Status */}
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Statutory Due Date</label>
                  <input
                    type="date"
                    required
                    value={formData.due_date}
                    onChange={e => setFormData({ ...formData, due_date: e.target.value })}
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500 font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Demand Status</label>
                  <select
                    value={formData.status}
                    onChange={e => setFormData({ ...formData, status: e.target.value as TaxAssessmentStatus })}
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500 capitalize"
                  >
                    <option value="due">Due</option>
                    <option value="paid">Paid</option>
                    <option value="overdue">Overdue</option>
                    <option value="partially_paid">Partially Paid</option>
                    <option value="draft">Draft</option>
                  </select>
                </div>

                {/* Calculation Summary Card */}
                <div className="sm:col-span-2 bg-slate-900 p-4 rounded-2xl border border-slate-800 space-y-2">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Configurable Assessment Calculation
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-xs">
                    <div>
                      <span className="text-slate-500 block">Base Tax:</span>
                      <span className="font-mono text-slate-200 font-semibold">{liveCalculation.formattedBaseTax}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block">Arrears & Penalty:</span>
                      <span className="font-mono text-slate-200 font-semibold">
                        {formatCurrency(formData.previous_due + formData.penalty)}
                      </span>
                    </div>
                    <div>
                      <span className="text-emerald-400 block font-bold">Total Demand:</span>
                      <span className="font-mono text-emerald-400 font-bold text-sm">
                        {liveCalculation.formattedTotalPayable}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Notes */}
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Assessment Notes</label>
                  <textarea
                    rows={2}
                    placeholder="Municipal notification reference or assessment remarks..."
                    value={formData.notes}
                    onChange={e => setFormData({ ...formData, notes: e.target.value })}
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsFormModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs rounded-xl shadow-md shadow-emerald-500/20"
                >
                  {formMode === 'create' ? 'Save & Issue Assessment' : 'Update Assessment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal 2: Record Payment Status */}
      {isPaymentModalOpen && targetAssessment && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-slate-950 border border-slate-800 rounded-3xl w-full max-w-md p-6 shadow-2xl text-slate-100 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-widest text-emerald-400">
                  Municipal Revenue Record
                </span>
                <h3 className="font-bold text-white text-base">Record Payment Status</h3>
              </div>
              <button
                onClick={() => setIsPaymentModalOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="my-4 p-3 bg-slate-900 rounded-xl border border-slate-800 text-xs space-y-1">
              <div className="flex justify-between">
                <span className="text-slate-400">Parcel:</span>
                <span className="font-mono text-white font-bold">{targetAssessment.property?.property_id}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Assessment Period:</span>
                <span className="text-white">FY {targetAssessment.assessment_year}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Total Demand:</span>
                <span className="font-mono text-emerald-400 font-bold">
                  {formatCurrency(targetAssessment.total_due)}
                </span>
              </div>
            </div>

            <form onSubmit={handlePaymentSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Payment Status</label>
                <select
                  value={paymentForm.status}
                  onChange={e => setPaymentForm({ ...paymentForm, status: e.target.value as TaxAssessmentStatus })}
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                >
                  <option value="paid">Paid in Full</option>
                  <option value="partially_paid">Partially Paid</option>
                  <option value="due">Due / Outstanding</option>
                  <option value="overdue">Overdue Demand</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Payment Reference / Challan Number
                </label>
                <input
                  type="text"
                  placeholder="e.g. TX-CHALLAN-2026-8812"
                  value={paymentForm.payment_reference}
                  onChange={e => setPaymentForm({ ...paymentForm, payment_reference: e.target.value })}
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Settlement Date</label>
                <input
                  type="date"
                  value={paymentForm.payment_date}
                  onChange={e => setPaymentForm({ ...paymentForm, payment_date: e.target.value })}
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsPaymentModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs rounded-xl shadow-md shadow-emerald-500/20"
                >
                  Save Status Record
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
