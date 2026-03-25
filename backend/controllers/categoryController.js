const repositories = require('../db/repositories');
const { logger } = require('../config/logger');
const { invalidateCategories } = require('../config/cacheInvalidation');

class CategoryController {
    constructor() {
        this.repo = repositories.products;
    }

    getAll = async (req, res, next) => {
        try {
            // Fetch categories with product counts via a RPC or subquery
            // For Supabase, we can use a select with a count on join
            const { data, error } = await this.repo.db
                .from('categories')
                .select('*, products(id)')
                .eq('is_active', true);

            if (error) throw error;

            // Transform to include productCount
            const categories = data.map(cat => ({
                ...cat,
                productCount: cat.products?.length || 0
            }));

            // Sort by product count descending
            categories.sort((a, b) => b.productCount - a.productCount);

            res.status(200).json({ success: true, categories });
        } catch (error) {
            next(error);
        }
    };

    create = async (req, res, next) => {
        try {
            const { name, description } = req.body;
            if (!name) return res.status(400).json({ success: false, error: 'Name is required' });

            const slug = name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');

            const { data: existing } = await this.repo.db.from('categories').select('id').eq('name', name).single();
            if (existing) return res.status(400).json({ success: false, error: 'Category already exists' });

            const { data: category, error } = await this.repo.db
                .from('categories')
                .insert({ name, slug, description, created_by: req.user.id, is_active: true })
                .select()
                .single();

            if (error) throw error;
            await invalidateCategories();
            res.status(201).json({ success: true, category });
        } catch (error) {
            next(error);
        }
    };

    update = async (req, res, next) => {
        try {
            const { id } = req.params;
            const { name, description, is_active } = req.body;

            const { data: currentCategory, error: fetchError } = await this.repo.db
                .from('categories').select('*').eq('id', id).single();

            if (fetchError || !currentCategory) {
                return res.status(404).json({ success: false, error: 'Category not found' });
            }

            const updates = { updated_at: new Date() };
            if (name && name !== currentCategory.name) {
                updates.name = name;
                updates.slug = name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
            }
            if (description !== undefined) updates.description = description;
            if (is_active !== undefined) updates.is_active = is_active;

            const { data: category, error } = await this.repo.db
                .from('categories').update(updates).eq('id', id).select().single();

            if (error) throw error;

            if (updates.name) {
                await this.repo.db.from('products').update({ category: updates.name }).eq('category', currentCategory.name);
            }

            await invalidateCategories();
            res.status(200).json({ success: true, category });
        } catch (error) {
            next(error);
        }
    };

    delete = async (req, res, next) => {
        try {
            const { id } = req.params;
            const { force } = req.query;

            const { data: category } = await this.repo.db.from('categories').select('name').eq('id', id).single();
            if (!category) return res.status(404).json({ success: false, error: 'Category not found' });

            const { count, error: countError } = await this.repo.db
                .from('products')
                .select('id', { count: 'exact', head: true })
                .eq('category', category.name)
                .is('deleted_at', null);

            if (countError) throw countError;

            if (count > 0 && force !== 'true') {
                return res.status(400).json({
                    success: false,
                    error: `Cannot delete category. It is used by ${count} products.`,
                    requiresConfirmation: true, productCount: count
                });
            }

            const { error } = await this.repo.db.from('categories').delete().eq('id', id);
            if (error) throw error;

            await invalidateCategories();
            res.status(200).json({ success: true, message: 'Category deleted successfully' });
        } catch (error) {
            next(error);
        }
    };
}

module.exports = new CategoryController();
