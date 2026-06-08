const BaseRepository = require('./BaseRepository');

class FlashSaleRepository extends BaseRepository {
  constructor(supabase) {
    super(supabase, 'flash_sales');
  }

  /** Returns the single currently-running flash sale with its products */
  async getActiveSale() {
    const now = new Date().toISOString();

    const { data: sale, error } = await this.db
      .from('flash_sales')
      .select('*')
      .eq('is_active', true)
      .lte('starts_at', now)
      .gte('ends_at', now)
      .order('starts_at', { ascending: false })
      .limit(1)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null; // no active sale
      throw error;
    }

    // Fetch products for this sale, joining product details
    const { data: items, error: itemsErr } = await this.db
      .from('flash_sale_products')
      .select(`
        flash_price,
        stock_limit,
        sold_count,
        product:products (
          id, title, description, price, compare_at_price,
          category, images, average_rating, total_reviews, store_id
        )
      `)
      .eq('flash_sale_id', sale.id);

    if (itemsErr) throw itemsErr;

    return { sale, items: items || [] };
  }

  /** Expire sales whose ends_at has passed — called by cron every minute */
  async expireEnded() {
    const now = new Date().toISOString();
    const { data, error } = await this.db
      .from('flash_sales')
      .update({ is_active: false, updated_at: now })
      .eq('is_active', true)
      .lt('ends_at', now)
      .select('id');

    if (error) throw error;
    return data || [];
  }

  async createSale(data) {
    const { data: sale, error } = await this.db
      .from('flash_sales')
      .insert(data)
      .select('*')
      .single();

    if (error) throw error;
    return sale;
  }

  async addProducts(flashSaleId, products) {
    const rows = products.map((p) => ({
      flash_sale_id: flashSaleId,
      product_id: p.productId,
      flash_price: p.flashPrice,
      stock_limit: p.stockLimit || null,
    }));

    const { data, error } = await this.db
      .from('flash_sale_products')
      .insert(rows)
      .select('*');

    if (error) throw error;
    return data;
  }

  async endSale(id) {
    const { data, error } = await this.db
      .from('flash_sales')
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select('*')
      .single();

    if (error) throw error;
    return data;
  }
}

module.exports = FlashSaleRepository;
