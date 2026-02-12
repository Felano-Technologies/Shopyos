const repositories = require('../db/repositories');

class CategoryController {
    constructor() {
        this.repo = repositories.products; // Using product repo as base since it has DB access
    }

    // @desc    Get all categories with management info
    // @route   GET /api/categories
    // @access  Public
    getAll = async (req, res) => {
        try {
            const { data: categories, error } = await this.repo.db
                .from('categories')
                .select('*')
                .order('name');

            if (error) throw error;

            res.status(200).json({
                success: true,
                categories
            });
        } catch (error) {
            console.error('Error fetching categories:', error);
            res.status(500).json({ success: false, error: 'Server Error' });
        }
    };

    // @desc    Create category
    // @route   POST /api/categories
    // @access  Private (Seller/Admin)
    create = async (req, res) => {
        try {
            const { name, description } = req.body;
            const userId = req.user.id;

            if (!name) {
                return res.status(400).json({ success: false, error: 'Name is required' });
            }

            const slug = name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');

            // Check duplicate
            const { data: existing } = await this.repo.db
                .from('categories')
                .select('id')
                .eq('name', name)
                .single();

            if (existing) {
                return res.status(400).json({ success: false, error: 'Category already exists' });
            }

            const { data: category, error } = await this.repo.db
                .from('categories')
                .insert({
                    name,
                    slug,
                    description,
                    created_by: userId,
                    is_active: true
                })
                .select()
                .single();

            if (error) throw error;

            res.status(201).json({
                success: true,
                category
            });
        } catch (error) {
            console.error('Error creating category:', error);
            res.status(500).json({ success: false, error: 'Server Error' });
        }
    };

    // @desc    Update category
    // @route   PUT /api/categories/:id
    // @access  Private (Seller/Admin)
    update = async (req, res) => {
        try {
            const { id } = req.params;
            const { name, description, is_active } = req.body;

            // Get current category first
            const { data: currentCategory, error: fetchError } = await this.repo.db
                .from('categories')
                .select('*')
                .eq('id', id)
                .single();

            if (fetchError || !currentCategory) {
                return res.status(404).json({ success: false, error: 'Category not found' });
            }

            const updates = {};
            if (name && name !== currentCategory.name) {
                updates.name = name;
                updates.slug = name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
            }
            if (description !== undefined) updates.description = description;
            if (is_active !== undefined) updates.is_active = is_active;
            updates.updated_at = new Date();

            const { data: category, error } = await this.repo.db
                .from('categories')
                .update(updates)
                .eq('id', id)
                .select()
                .single();

            if (error) throw error;

            // If name changed, update all products that used the old name
            if (updates.name) {
                await this.repo.db
                    .from('products')
                    .update({ category: updates.name })
                    .eq('category', currentCategory.name);
            }

            res.status(200).json({
                success: true,
                category
            });
        } catch (error) {
            console.error('Error updating category:', error);
            res.status(500).json({ success: false, error: 'Server Error' });
        }
    };

    // @desc    Delete category
    // @route   DELETE /api/categories/:id
    // @access  Private (Seller/Admin)
    delete = async (req, res) => {
        try {
            const { id } = req.params;
            const { force } = req.query; // If true, delete even if used? Dangerous.

            // Check if category is used by products
            const { data: category } = await this.repo.db
                .from('categories')
                .select('name')
                .eq('id', id)
                .single();

            if (!category) {
                return res.status(404).json({ success: false, error: 'Category not found' });
            }

            // Check usage in products
            // Products store category as string
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
                    requiresConfirmation: true,
                    productCount: count
                });
            }

            // If force is true, or count is 0, delete
            // Note: If we delete, the products still have the string 'category' but it won't match any category ID.
            // This is consistent with loose coupling.

            const { error } = await this.repo.db
                .from('categories')
                .delete()
                .eq('id', id);

            if (error) throw error;

            res.status(200).json({
                success: true,
                message: 'Category deleted successfully'
            });
        } catch (error) {
            console.error('Error deleting category:', error);
            res.status(500).json({ success: false, error: 'Server Error' });
        }
    };
}

module.exports = new CategoryController();
