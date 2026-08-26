import React, { useState, useEffect, useCallback } from 'react';
import { FiSearch, FiEdit2, FiTrash2, FiPlus, FiTag } from 'react-icons/fi';
import { getAllCategories, createCategory, updateCategory, deleteCategory } from '../services/products';

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

  const loadCategories = useCallback(async () => {
    try {
      setLoading(true);
      const res = await getAllCategories();
      if (res.success || res.categories) {
        setCategories(res.categories || []);
      }
    } catch (error) {
      console.error('Failed to load categories', error);
      window.dispatchEvent(new CustomEvent('app-toast', {
        detail: { type: 'error', title: 'Error', message: 'Failed to load categories' }
      }));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadCategories();
  }, [loadCategories]);

  const handleSave = async () => {
    if (!newName.trim()) {
      window.dispatchEvent(new CustomEvent('app-toast', {
        detail: { type: 'error', title: 'Validation', message: 'Category name is required' }
      }));
      return;
    }

    setSubmitting(true);
    try {
      if (isEditing && currentId) {
        await updateCategory(currentId, newName, newDesc);
        window.dispatchEvent(new CustomEvent('app-toast', {
          detail: { type: 'success', title: 'Success', message: 'Category updated' }
        }));
      } else {
        await createCategory(newName, newDesc);
        window.dispatchEvent(new CustomEvent('app-toast', {
          detail: { type: 'success', title: 'Success', message: 'Category created' }
        }));
      }
      setIsModalOpen(false);
      loadCategories();
    } catch (error: any) {
      window.dispatchEvent(new CustomEvent('app-toast', {
        detail: { type: 'error', title: 'Error', message: error.message || 'Operation failed' }
      }));
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (cat: Category) => {
    if (!window.confirm(`Are you sure you want to delete "${cat.name}"?`)) return;
    try {
      await deleteCategory(cat.id);
      window.dispatchEvent(new CustomEvent('app-toast', {
        detail: { type: 'success', title: 'Success', message: 'Category removed' }
      }));
      loadCategories();
    } catch (error: any) {
      window.dispatchEvent(new CustomEvent('app-toast', {
        detail: { type: 'error', title: 'Error', message: error.message || 'Failed to delete category' }
      }));
    }
  };

  const openAddModal = () => {
    setIsEditing(false);
    setCurrentId(null);
    setNewName('');
    setNewDesc('');
    setIsModalOpen(true);
  };

  const openEditModal = (cat: Category) => {
    setIsEditing(true);
    setCurrentId(cat.id);
    setNewName(cat.name);
    setNewDesc(cat.description || '');
    setIsModalOpen(true);
  };

  const filtered = categories.filter(c => c.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-navy mb-1">Categories</h1>
          <p className="text-sm text-slate-500">Manage product categories</p>
        </div>
        <button
          onClick={openAddModal}
          className="bg-navy hover:bg-navy-mid text-white px-4 py-2.5 rounded-xl text-sm font-semibold flex items-center gap-2 transition-colors"
        >
          <FiPlus className="w-4 h-4" />
          Add Category
        </button>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-4 border-b border-slate-200 flex items-center gap-4">
          <div className="relative flex-1 max-w-md">
            <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search categories..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-navy/10 focus:border-navy"
            />
          </div>
        </div>

        {loading ? (
          <div className="p-8 flex justify-center">
            <div className="animate-spin w-8 h-8 border-4 border-navy border-t-transparent rounded-full" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center text-slate-500">
            <FiTag className="w-12 h-12 mx-auto mb-3 text-slate-300" />
            <p>No categories found</p>
          </div>
        ) : (
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500 font-semibold border-b border-slate-200">
                <th className="px-6 py-4">Name</th>
                <th className="px-6 py-4">Description</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((cat) => (
                <tr key={cat.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-navy">
                        <FiTag className="w-4 h-4" />
                      </div>
                      <span className="font-semibold text-slate-900">{cat.name}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-500 max-w-md truncate">
                    {cat.description || 'No description'}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => openEditModal(cat)}
                        className="p-2 text-slate-400 hover:text-navy hover:bg-slate-100 rounded-lg transition-colors"
                        title="Edit"
                      >
                        <FiEdit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(cat)}
                        className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
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
        )}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-xl overflow-hidden flex flex-col max-h-full">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <h2 className="text-lg font-bold text-slate-900">
                {isEditing ? 'Edit Category' : 'New Category'}
              </h2>
            </div>
            <div className="p-6 overflow-y-auto">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">Name</label>
                  <input
                    type="text"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="e.g. Fashion"
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-navy/10 focus:border-navy"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">Description</label>
                  <textarea
                    value={newDesc}
                    onChange={(e) => setNewDesc(e.target.value)}
                    placeholder="Brief description..."
                    rows={3}
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-navy/10 focus:border-navy resize-none"
                  />
                </div>
              </div>
            </div>
            <div className="p-6 border-t border-slate-100 flex items-center justify-end gap-3 bg-slate-50">
              <button
                onClick={() => setIsModalOpen(false)}
                className="px-5 py-2.5 rounded-xl text-sm font-semibold text-slate-600 hover:bg-slate-200 transition-colors"
                disabled={submitting}
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={submitting}
                className="px-5 py-2.5 rounded-xl text-sm font-semibold text-white bg-navy hover:bg-navy-mid transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                {submitting && <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
                {submitting ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
