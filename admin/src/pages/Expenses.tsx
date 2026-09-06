import React, { useState, useEffect, useCallback } from 'react';
import { Helmet } from 'react-helmet-async';
import { FiPlus, FiTrendingDown, FiX, FiEdit2, FiTrash2, FiRepeat } from 'react-icons/fi';
import {
  getExpenses, createExpense, updateExpense, deleteExpense, getExpenseCategories,
} from '../services/admin';
import { extractErrorMessage } from '../services/client';
import { TableRowsSkeleton } from '../components/common/TableRowsSkeleton';

interface ExpenseCategory { id: string; name: string; is_active: boolean }
interface Expense {
  id: string;
  category_id: string;
  category?: { id: string; name: string } | null;
  amount: number;
  description?: string | null;
  expense_date: string;
  is_recurring: boolean;
  recurrence_frequency?: string | null;
  recurrence_end_date?: string | null;
}

const EMPTY_FORM = {
  categoryId: '', amount: '', description: '', expenseDate: new Date().toISOString().slice(0, 10),
  isRecurring: false, recurrenceFrequency: 'monthly' as 'daily' | 'weekly' | 'monthly' | 'yearly', recurrenceEndDate: '',
};

const formatCurrency = (n: number) => `₵${Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const formatDate = (d: string) => new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });

export const Expenses: React.FC = () => {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [categories, setCategories] = useState<ExpenseCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [categoryFilter, setCategoryFilter] = useState('');

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [expRes, catRes] = await Promise.all([
        getExpenses({ categoryId: categoryFilter || undefined, limit: 100 }),
        getExpenseCategories(),
      ]);
      setExpenses(Array.isArray(expRes?.data) ? expRes.data : []);
      setCategories(Array.isArray(catRes?.data) ? catRes.data : []);
    } catch (error) {
      console.error('Failed to load expenses', error);
      window.dispatchEvent(new CustomEvent('app-toast', { detail: { type: 'error', title: 'Error', message: 'Failed to load expenses' } }));
    } finally {
      setLoading(false);
    }
  }, [categoryFilter]);

  useEffect(() => { loadData(); }, [loadData]);

  const openAddModal = () => {
    setIsEditing(false);
    setCurrentId(null);
    setForm({ ...EMPTY_FORM, categoryId: categories[0]?.id || '' });
    setFormError(null);
    setIsModalOpen(true);
  };

  const openEditModal = (exp: Expense) => {
    setIsEditing(true);
    setCurrentId(exp.id);
    setForm({
      categoryId: exp.category_id,
      amount: String(exp.amount),
      description: exp.description || '',
      expenseDate: exp.expense_date?.slice(0, 10),
      isRecurring: exp.is_recurring,
      recurrenceFrequency: (exp.recurrence_frequency as any) || 'monthly',
      recurrenceEndDate: exp.recurrence_end_date?.slice(0, 10) || '',
    });
    setFormError(null);
    setIsModalOpen(true);
  };

  const handleSave = async () => {
    const numericAmount = Number.parseFloat(form.amount);
    if (!form.categoryId) { setFormError('Please select a category.'); return; }
    if (!Number.isFinite(numericAmount) || numericAmount <= 0) { setFormError('Enter a valid positive amount.'); return; }
    if (!form.expenseDate) { setFormError('Please pick an expense date.'); return; }

    setSubmitting(true);
    setFormError(null);
    try {
      const payload = {
        categoryId: form.categoryId,
        amount: numericAmount,
        description: form.description || undefined,
        expenseDate: form.expenseDate,
        isRecurring: form.isRecurring,
        recurrenceFrequency: form.isRecurring ? form.recurrenceFrequency : undefined,
        recurrenceEndDate: form.isRecurring && form.recurrenceEndDate ? form.recurrenceEndDate : undefined,
      };
      if (isEditing && currentId) {
        await updateExpense(currentId, payload);
        window.dispatchEvent(new CustomEvent('app-toast', { detail: { type: 'success', title: 'Success', message: 'Expense updated' } }));
      } else {
        await createExpense(payload);
        window.dispatchEvent(new CustomEvent('app-toast', { detail: { type: 'success', title: 'Success', message: 'Expense recorded' } }));
      }
      setIsModalOpen(false);
      loadData();
    } catch (error) {
      setFormError(extractErrorMessage(error));
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (exp: Expense) => {
    if (!window.confirm('Delete this expense entry? This cannot be undone.')) return;
    setDeletingId(exp.id);
    try {
      await deleteExpense(exp.id);
      window.dispatchEvent(new CustomEvent('app-toast', { detail: { type: 'success', title: 'Success', message: 'Expense deleted' } }));
      loadData();
    } catch (error: any) {
      window.dispatchEvent(new CustomEvent('app-toast', { detail: { type: 'error', title: 'Error', message: error.message || 'Failed to delete expense' } }));
    } finally {
      setDeletingId(null);
    }
  };

  const totalShown = expenses.reduce((sum, e) => sum + Number(e.amount || 0), 0);

  return (
    <>
      <Helmet>
        <title>Expenses | Shopyos Admin</title>
      </Helmet>

      <div className="flex flex-col gap-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-body">Expenses</h1>
            <p className="text-sm text-secondary mt-1">Log operational costs against configurable categories.</p>
          </div>
          <button
            onClick={openAddModal}
            className="bg-navy hover:bg-navy-mid text-white px-4 py-2.5 rounded-xl text-sm font-semibold flex items-center gap-2 transition-colors shrink-0"
          >
            <FiPlus className="w-4 h-4" /> Log Expense
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="relative bg-card p-4 rounded-xl shadow-sm border border-border overflow-hidden">
            <div className="w-9 h-9 rounded-lg flex items-center justify-center mb-3 bg-red-50 text-red-600"><FiTrendingDown className="w-4 h-4" /></div>
            <p className="text-xl font-bold text-body">{loading ? '...' : formatCurrency(totalShown)}</p>
            <p className="text-xs font-semibold text-secondary mt-1">Total (filtered list)</p>
            <span className="absolute bottom-0 left-0 right-0 h-[3px] bg-red-500" />
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setCategoryFilter('')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${categoryFilter === '' ? 'bg-navy text-white border-navy' : 'bg-card text-secondary border-border hover:border-border-strong'}`}
          >
            All Categories
          </button>
          {categories.map((c) => (
            <button
              key={c.id}
              onClick={() => setCategoryFilter(c.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${categoryFilter === c.id ? 'bg-navy text-white border-navy' : 'bg-card text-secondary border-border hover:border-border-strong'}`}
            >
              {c.name}
            </button>
          ))}
        </div>

        <div className="bg-card rounded-xl shadow-sm border border-border overflow-hidden">
          {!loading && expenses.length === 0 ? (
            <div className="p-12 text-center text-secondary">
              <FiTrendingDown className="w-10 h-10 mx-auto mb-3 text-subtle" />
              <p className="text-sm">No expenses logged yet.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-surface-muted/50 border-b border-border">
                    <th className="px-6 py-4 text-xs font-semibold text-secondary uppercase tracking-wider">Category</th>
                    <th className="px-6 py-4 text-xs font-semibold text-secondary uppercase tracking-wider">Description</th>
                    <th className="px-6 py-4 text-xs font-semibold text-secondary uppercase tracking-wider">Amount</th>
                    <th className="px-6 py-4 text-xs font-semibold text-secondary uppercase tracking-wider">Date</th>
                    <th className="px-6 py-4 text-xs font-semibold text-secondary uppercase tracking-wider">Recurring</th>
                    <th className="px-6 py-4 text-xs font-semibold text-secondary uppercase tracking-wider text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {loading ? (
                    <TableRowsSkeleton columns={6} />
                  ) : expenses.map((exp) => (
                    <tr key={exp.id} className="hover:bg-surface-muted/50 transition-colors">
                      <td className="px-6 py-4 font-medium text-body">{exp.category?.name || '—'}</td>
                      <td className="px-6 py-4 text-sm text-secondary max-w-xs truncate">{exp.description || '—'}</td>
                      <td className="px-6 py-4 text-sm font-semibold text-body">{formatCurrency(exp.amount)}</td>
                      <td className="px-6 py-4 text-sm text-secondary">{formatDate(exp.expense_date)}</td>
                      <td className="px-6 py-4">
                        {exp.is_recurring ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold bg-blue-50 text-blue-700">
                            <FiRepeat className="w-3 h-3" /> {exp.recurrence_frequency}
                          </span>
                        ) : (
                          <span className="text-xs text-subtle">One-off</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button onClick={() => openEditModal(exp)} className="p-2 text-subtle hover:text-navy hover:bg-surface-muted rounded-lg transition-colors" title="Edit">
                            <FiEdit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(exp)}
                            disabled={deletingId === exp.id}
                            className="p-2 text-subtle hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
                            title="Delete"
                          >
                            <FiTrash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-card rounded-xl shadow-xl w-full max-w-md overflow-hidden">
            <div className="px-6 py-4 border-b border-border flex items-center justify-between">
              <h2 className="text-lg font-bold text-body">{isEditing ? 'Edit Expense' : 'Log Expense'}</h2>
              <button onClick={() => setIsModalOpen(false)} className="text-subtle hover:text-secondary">
                <FiX className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
              {formError && (
                <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm font-medium border border-red-100">{formError}</div>
              )}
              <div>
                <label className="block text-sm font-semibold text-body mb-1">Category</label>
                <select
                  value={form.categoryId}
                  onChange={(e) => setForm({ ...form, categoryId: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-xl border border-border text-sm focus:outline-none focus:ring-2 focus:ring-navy/10 focus:border-navy"
                >
                  <option value="">Select category...</option>
                  {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-semibold text-body mb-1">Amount (₵)</label>
                <input
                  type="number" min={0} step="0.01"
                  value={form.amount}
                  onChange={(e) => setForm({ ...form, amount: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-xl border border-border text-sm focus:outline-none focus:ring-2 focus:ring-navy/10 focus:border-navy"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-body mb-1">Description</label>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  rows={2}
                  className="w-full px-4 py-2.5 rounded-xl border border-border text-sm focus:outline-none focus:ring-2 focus:ring-navy/10 focus:border-navy resize-none"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-body mb-1">Expense Date</label>
                <input
                  type="date"
                  value={form.expenseDate}
                  onChange={(e) => setForm({ ...form, expenseDate: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-xl border border-border text-sm focus:outline-none focus:ring-2 focus:ring-navy/10 focus:border-navy"
                />
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.isRecurring}
                  onChange={(e) => setForm({ ...form, isRecurring: e.target.checked })}
                  className="w-4 h-4 rounded border-border-strong text-navy focus:ring-navy"
                />
                <span className="text-sm font-semibold text-body">This is a recurring expense</span>
              </label>
              {form.isRecurring && (
                <div className="grid grid-cols-2 gap-4 pl-6">
                  <div>
                    <label className="block text-sm font-semibold text-body mb-1">Frequency</label>
                    <select
                      value={form.recurrenceFrequency}
                      onChange={(e) => setForm({ ...form, recurrenceFrequency: e.target.value as any })}
                      className="w-full px-4 py-2.5 rounded-xl border border-border text-sm focus:outline-none focus:ring-2 focus:ring-navy/10 focus:border-navy"
                    >
                      <option value="daily">Daily</option>
                      <option value="weekly">Weekly</option>
                      <option value="monthly">Monthly</option>
                      <option value="yearly">Yearly</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-body mb-1">Ends (optional)</label>
                    <input
                      type="date"
                      value={form.recurrenceEndDate}
                      onChange={(e) => setForm({ ...form, recurrenceEndDate: e.target.value })}
                      className="w-full px-4 py-2.5 rounded-xl border border-border text-sm focus:outline-none focus:ring-2 focus:ring-navy/10 focus:border-navy"
                    />
                  </div>
                </div>
              )}
            </div>
            <div className="px-6 py-4 border-t border-border flex items-center justify-end gap-3 bg-surface-muted/50">
              <button onClick={() => setIsModalOpen(false)} disabled={submitting} className="px-5 py-2.5 rounded-xl text-sm font-semibold text-secondary hover:bg-surface-muted transition-colors">
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={submitting}
                className="px-5 py-2.5 rounded-xl text-sm font-semibold text-white bg-navy hover:bg-navy-mid transition-colors disabled:opacity-60 flex items-center gap-2"
              >
                {submitting && <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
                {submitting ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
