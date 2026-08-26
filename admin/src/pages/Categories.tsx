import React, { useState, useEffect, useCallback } from 'react';
import { Helmet } from 'react-helmet-async';
import { FiSearch, FiEdit2, FiTrash2, FiPlus, FiTag, FiX, FiBox } from 'react-icons/fi';
import { getAllCategories, createCategory, updateCategory, deleteCategory } from '../services/products';
import { extractErrorMessage } from '../services/client';

interface Category {
  id: string;
  name: string;
  slug: string;
  description?: string;
  is_active: boolean;
  product_count?: number;
}

export const Categories: React.FC = () => {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const loadCategories = useCallback(async () => {
    try {
      setLoading(true);
      const res = await getAllCategories();
      setCategories(Array.isArray(res?.categories) ? res.categories : []);
    } catch (error) {
      console.error('Failed to load categories', error);
      window.dispatchEvent(new CustomEvent('app-toast', { detail: { type: 'error', title: 'Error', message: 'Failed to load categories' } }));
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
        await updateCategory(currentId, newName.trim(), newDesc);
        window.dispatchEvent(new CustomEvent('app-toast', { detail: { type: 'success', title: 'Success', message: 'Category updated' } }));
      } else {
        await createCategory(newName.trim(), newDesc);
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

  const handleDelete = async (cat: Category) => {
    if (!window.confirm(`Delete "${cat.name}"? This cannot be undone.`)) return;
    setDeletingId(cat.id);
    try {
      await deleteCategory(cat.id);
      window.dispatchEvent(new CustomEvent('app-toast', { detail: { type: 'success', title: 'Success', message: 'Category removed' } }));
      loadCategories();
    } catch (error: any) {
      window.dispatchEvent(new CustomEvent('app-toast', { detail: { type: 'error', title: 'Error', message: error.message || 'Failed to delete category' } }));
    } finally {
      setDeletingId(null);
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

  const openEditModal = (cat: Category) => {
    setIsEditing(true);
    setCurrentId(cat.id);
    setNewName(cat.name);
    setNewDesc(cat.description || '');
    setFormError(null);
    setIsModalOpen(true);
  };

  const filtered = categories.filter((c) => c.name.toLowerCase().includes(search.toLowerCase()));
  const totalProducts = categories.reduce((sum, c) => sum + (c.product_count || 0), 0);

  return (
    <>
      <Helmet>
        <title>Categories | Shopyos Admin</title>
      </Helmet>

      <div className="flex flex-col gap-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Categories</h1>
            <p className="text-sm text-gray-500 mt-1">Manage the product categories buyers browse by.</p>
          </div>
          <button
            onClick={openAddModal}
            className="bg-navy hover:bg-navy-mid text-white px-4 py-2.5 rounded-xl text-sm font-semibold flex items-center gap-2 transition-colors shrink-0"
          >
            <FiPlus className="w-4 h-4" /> Add Category
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="relative bg-white p-4 rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="w-9 h-9 rounded-lg flex items-center justify-center mb-3 bg-blue-50 text-blue-600"><FiTag className="w-4 h-4" /></div>
            <p className="text-xl font-bold text-gray-900">{loading ? '...' : categories.length.toLocaleString()}</p>
            <p className="text-xs font-semibold text-gray-500 mt-1">Total Categories</p>
            <span className="absolute bottom-0 left-0 right-0 h-[3px] bg-blue-500" />
          </div>
          <div className="relative bg-white p-4 rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="w-9 h-9 rounded-lg flex items-center justify-center mb-3 bg-purple-50 text-purple-600"><FiBox className="w-4 h-4" /></div>
            <p className="text-xl font-bold text-gray-900">{loading ? '...' : totalProducts.toLocaleString()}</p>
            <p className="text-xs font-semibold text-gray-500 mt-1">Categorized Products</p>
            <span className="absolute bottom-0 left-0 right-0 h-[3px] bg-purple-500" />
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="p-4 border-b border-gray-100">
            <div className="relative max-w-md">
              <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search categories..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-navy/10 focus:border-navy"
              />
            </div>
          </div>

          {loading ? (
            <div className="p-8 text-center text-sm text-gray-500">Loading categories...</div>
          ) : filtered.length === 0 ? (
            <div className="p-12 text-center text-gray-500">
              <FiTag className="w-10 h-10 mx-auto mb-3 text-gray-300" />
              <p className="text-sm">No categories found.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-gray-50/50 border-b border-gray-100">
                    <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Name</th>
                    <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Description</th>
                    <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Products</th>
                    <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filtered.map((cat) => (
                    <tr key={cat.id} className="hover:bg-gray-50/50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-lg bg-gray-100 flex items-center justify-center text-navy shrink-0">
                            <FiTag className="w-4 h-4" />
                          </div>
                          <span className="font-medium text-gray-900">{cat.name}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500 max-w-md truncate">{cat.description || 'No description'}</td>
                      <td className="px-6 py-4">
                        <span className="px-2.5 py-1 rounded-md text-xs font-semibold bg-gray-100 text-gray-600">
                          {cat.product_count ?? 0} product{cat.product_count === 1 ? '' : 's'}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center justify-end gap-1">
                          <button onClick={() => openEditModal(cat)} className="p-2 text-gray-400 hover:text-navy hover:bg-gray-100 rounded-lg transition-colors" title="Edit">
                            <FiEdit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(cat)}
                            disabled={deletingId === cat.id}
                            className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
                            title={cat.product_count ? `${cat.product_count} products use this category` : 'Delete'}
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
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <h2 className="text-lg font-bold text-gray-900">{isEditing ? 'Edit Category' : 'New Category'}</h2>
              <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                <FiX className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              {formError && (
                <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm font-medium border border-red-100">{formError}</div>
              )}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Name</label>
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="e.g. Fashion"
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-navy/10 focus:border-navy"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Description</label>
                <textarea
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                  placeholder="Brief description..."
                  rows={3}
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-navy/10 focus:border-navy resize-none"
                />
              </div>
            </div>
            <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-end gap-3 bg-gray-50/50">
              <button onClick={() => setIsModalOpen(false)} disabled={submitting} className="px-5 py-2.5 rounded-xl text-sm font-semibold text-gray-600 hover:bg-gray-100 transition-colors">
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
