const ApiResponse = require('../utils/apiResponse');
const repositories = require('../db/repositories');
const { logger } = require('../config/logger');
const { invalidateCategories } = require('../config/cacheInvalidation');

class CategoryController {
    constructor() {
        this.repo = repositories.products;
    }

    getAll = async (req, res) => {
        try {
            // Fetch categories and product counts in parallel
            const [{ data: categories, error: catError }, { data: catCounts, error: rpcError }] = await Promise.all([
                this.repo.db.from('categories').select('*').eq('is_active', true),
                this.repo.db.rpc('get_category_counts')
            ]);

            if (catError) throw catError;
            if (rpcError) throw rpcError;

            // Map counts to category names for O(1) lookup
            const countMap = (catCounts || []).reduce((acc, curr) => {
                acc[curr.category] = Number.parseInt(curr.product_count);
                return acc;
            }, {});

            // Merge counts and sort
            const result = (categories || []).map(cat => ({
                ...cat,
                product_count: countMap[cat.name] || 0
            })).sort((a, b) => b.product_count - a.product_count);

            return ApiResponse.withEntity(res, 'categories', result);
        } catch (error) {
            logger.error('Fetch categories error:', error);
            return ApiResponse.error(res, 'Server Error', 500);
        }
    }

    create = async (req, res, next) => {
        try {
            const { name, description } = req.body;
            if (!name) return ApiResponse.error(res, 'Name is required', 400);

            const slug = name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');

            const { data: existing } = await this.repo.db.from('categories').select('id').eq('name', name).single();
            if (existing) return ApiResponse.error(res, 'Category already exists', 400);

            const { data: category, error } = await this.repo.db
                .from('categories')
                .insert({ name, slug, description, created_by: req.user.id, is_active: true })
                .select()
                .single();

            if (error) throw error;
            await invalidateCategories();
            ApiResponse.withEntity(res, 'category', category, null, null, 201);
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
                return ApiResponse.error(res, 'Category not found', 404);
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
            ApiResponse.withEntity(res, 'category', category);
        } catch (error) {
            next(error);
        }
    };

    delete = async (req, res, next) => {
        try {
            const { id } = req.params;
            const { force } = req.query;

            const { data: category } = await this.repo.db.from('categories').select('name').eq('id', id).single();
            if (!category) return ApiResponse.error(res, 'Category not found', 404);

            const { count, error: countError } = await this.repo.db
                .from('products')
                .select('id', { count: 'exact', head: true })
                .eq('category', category.name)
                .is('deleted_at', null);

            if (countError) throw countError;

            if (count > 0 && force !== 'true') {
                return ApiResponse.error(res, `Cannot delete category. It is used by ${count} products.`, 400);
            }

            const { error } = await this.repo.db.from('categories').delete().eq('id', id);
            if (error) throw error;

            await invalidateCategories();
            ApiResponse.success(res, null, 'Category deleted successfully');
        } catch (error) {
            next(error);
        }
    };
}

module.exports = new CategoryController();
