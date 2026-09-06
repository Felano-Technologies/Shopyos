import React, { useState, useEffect, useCallback } from 'react';
import { Helmet } from 'react-helmet-async';
import { FiSearch, FiEdit2, FiPlus, FiTag, FiX } from 'react-icons/fi';
import { getExpenseCategories, createExpenseCategory, updateExpenseCategory, toggleExpenseCategory } from '../services/admin';
import { extractErrorMessage } from '../services/client';
import { TableRowsSkeleton } from '../components/common/TableRowsSkeleton';

interface ExpenseCategory {
  id: string;
  name: string;
  description?: string | null;
  is_active: boolean;
}

export const ExpenseCategories: React.FC = () => {
  const [categories, setCategories] = useState<ExpenseCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const loadCategories = useCallback(async () => {
    try {
      setLoading(true);
      const res = await getExpenseCategories();
      setCategories(Array.isArray(res?.data) ? res.data : []);
    } catch (error) {
      console.error('Failed to load expense categories', error);
      window.dispatchEvent(new CustomEvent('app-toast', { detail: { type: 'error', title: 'Error', message: 'Failed to load expense categories' } }));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadCategories(); }, [loadCategories]);

  const handleSave = async () => {
    if (!newName.trim()) {
      setFormError('Category name is required.');
      return;
    }
    setSubmitting(true);
    setFormError(null);
    try {
      if (isEditing && currentId) {
        await updateExpenseCategory(currentId, { name: newName.trim(), description: newDesc });
        window.dispatchEvent(new CustomEvent('app-toast', { detail: { type: 'success', title: 'Success', message: 'Category updated' } }));
      } else {
        await createExpenseCategory({ name: newName.trim(), description: newDesc });
        window.dispatchEvent(new CustomEvent('app-toast', { detail: { type: 'success', title: 'Success', message: 'Category created' } }));
      }
      setIsModalOpen(false);
      loadCategories();
    } catch (error) {
      setFormError(extractErrorMessage(error));
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggle = async (cat: ExpenseCategory) => {
    setTogglingId(cat.id);
    try {
      await toggleExpenseCategory(cat.id);
      setCategories((prev) => prev.map((c) => (c.id === cat.id ? { ...c, is_active: !c.is_active } : c)));
    } catch (error: any) {
      window.dispatchEvent(new CustomEvent('app-toast', { detail: { type: 'error', title: 'Error', message: error.message || 'Failed to update category status' } }));
    } finally {
      setTogglingId(null);
    }
  };

  const openAddModal = () => {
    setIsEditing(false);
    setCurrentId(null);
    setNewName('');
    setNewDesc('');
    setFormError(null);
    setIsModalOpen(true);
  };

  const openEditModal = (cat: ExpenseCategory) => {
    setIsEditing(true);
    setCurrentId(cat.id);
    setNewName(cat.name);
    setNewDesc(cat.description || '');
    setFormError(null);
    setIsModalOpen(true);
  };

  const filtered = categories.filter((c) => c.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <>
      <Helmet>
        <title>Expense Categories | Shopyos Admin</title>
      </Helmet>

      <div className="flex flex-col gap-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-body">Expense Categories</h1>
            <p className="text-sm text-secondary mt-1">Configure the operational cost buckets used to log expenses.</p>
          </div>
          <button
            onClick={openAddModal}
            className="bg-navy hover:bg-navy-mid text-white px-4 py-2.5 rounded-xl text-sm font-semibold flex items-center gap-2 transition-colors shrink-0"
          >
            <FiPlus className="w-4 h-4" /> Add Category
          </button>
        </div>

        <div className="bg-card rounded-xl shadow-sm border border-border overflow-hidden">
          <div className="p-4 border-b border-border">
            <div className="relative max-w-md">
              <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-subtle" />
              <input
                type="text"
                placeholder="Search categories..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2 rounded-xl border border-border text-sm focus:outline-none focus:ring-2 focus:ring-navy/10 focus:border-navy"
              />
            </div>
          </div>

          {!loading && filtered.length === 0 ? (
            <div className="p-12 text-center text-secondary">
              <FiTag className="w-10 h-10 mx-auto mb-3 text-subtle" />
              <p className="text-sm">No expense categories found.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-surface-muted/50 border-b border-border">
                    <th className="px-6 py-4 text-xs font-semibold text-secondary uppercase tracking-wider">Name</th>
                    <th className="px-6 py-4 text-xs font-semibold text-secondary uppercase tracking-wider">Description</th>
                    <th className="px-6 py-4 text-xs font-semibold text-secondary uppercase tracking-wider">Status</th>
                    <th className="px-6 py-4 text-xs font-semibold text-secondary uppercase tracking-wider text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {loading ? (
                    <TableRowsSkeleton columns={4} leadingIcon />
                  ) : filtered.map((cat) => (
                    <tr key={cat.id} className="hover:bg-surface-muted/50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-lg bg-surface-muted flex items-center justify-center text-navy shrink-0">
                            <FiTag className="w-4 h-4" />
                          </div>
                          <span className="font-medium text-body">{cat.name}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-secondary max-w-md truncate">{cat.description || 'No description'}</td>
                      <td className="px-6 py-4">
                        <button
                          onClick={() => handleToggle(cat)}
                          disabled={togglingId === cat.id}
                          className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-colors disabled:opacity-50 ${
                            cat.is_active ? 'bg-green-50 text-green-700 hover:bg-green-100' : 'bg-surface-muted text-secondary hover:bg-border-strong'
                          }`}
                        >
                          {cat.is_active ? 'Active' : 'Inactive'}
                        </button>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button onClick={() => openEditModal(cat)} className="p-2 text-subtle hover:text-navy hover:bg-surface-muted rounded-lg transition-colors inline-flex" title="Edit">
                          <FiEdit2 className="w-4 h-4" />
                        </button>
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
              <h2 className="text-lg font-bold text-body">{isEditing ? 'Edit Category' : 'New Category'}</h2>
              <button onClick={() => setIsModalOpen(false)} className="text-subtle hover:text-secondary">
                <FiX className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              {formError && (
                <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm font-medium border border-red-100">{formError}</div>
              )}
              <div>
                <label className="block text-sm font-semibold text-body mb-1">Name</label>
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="e.g. Hosting & Infrastructure"
                  className="w-full px-4 py-2.5 rounded-xl border border-border text-sm focus:outline-none focus:ring-2 focus:ring-navy/10 focus:border-navy"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-body mb-1">Description</label>
                <textarea
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                  placeholder="Brief description..."
                  rows={3}
                  className="w-full px-4 py-2.5 rounded-xl border border-border text-sm focus:outline-none focus:ring-2 focus:ring-navy/10 focus:border-navy resize-none"
                />
              </div>
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
