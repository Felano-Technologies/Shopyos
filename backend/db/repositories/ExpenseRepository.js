// db/repositories/ExpenseRepository.js
// Data access for expense_categories + expenses (admin Financial Dashboard).

const BaseRepository = require('./BaseRepository');
const { getPool } = require('../../config/postgres');

// Maps a recurrence frequency to the INTERVAL step generate_series expands by.
const FREQUENCY_INTERVAL = {
  daily: '1 day',
  weekly: '1 week',
  monthly: '1 month',
  yearly: '1 year',
};

class ExpenseRepository extends BaseRepository {
  constructor(client) {
    super(client, 'expenses');
  }

  // ── Categories ─────────────────────────────────────────────────────────
  async getCategories({ activeOnly = false } = {}) {
    let q = this.db.from('expense_categories').select('*').order('name', { ascending: true });
    if (activeOnly) q = q.eq('is_active', true);
    const { data, error } = await q;
    if (error) throw error;
    return data || [];
  }

  async createCategory({ name, description }) {
    const { data, error } = await this.db
      .from('expense_categories')
      .insert({ name: name.trim(), description: description || null })
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  async updateCategory(id, { name, description }) {
    const { data, error } = await this.db
      .from('expense_categories')
      .update({ name: name.trim(), description: description || null, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  async toggleCategory(id) {
    const { data: existing, error: findError } = await this.db
      .from('expense_categories').select('is_active').eq('id', id).single();
    if (findError) throw findError;
    const { data, error } = await this.db
      .from('expense_categories')
      .update({ is_active: !existing.is_active, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  // ── Expense entries ────────────────────────────────────────────────────
  async getExpenses({ categoryId, from, to, limit = 50, offset = 0 } = {}) {
    let q = this.db.from('expenses').select('*, category:category_id (id, name)').order('expense_date', { ascending: false });
    if (categoryId) q = q.eq('category_id', categoryId);
    if (from) q = q.gte('expense_date', from);
    if (to) q = q.lte('expense_date', to);
    if (limit) q = q.limit(limit);
    if (offset) q = q.range(offset, offset + limit - 1);
    const { data, error } = await q;
    if (error) throw error;
    return data || [];
  }

  async createExpense(payload) {
    return this.create(payload);
  }

  async updateExpense(id, payload) {
    return this.update(id, payload);
  }

  async deleteExpense(id) {
    return this.delete(id);
  }

  // ── P&L aggregation ────────────────────────────────────────────────────
  // Recurring expenses expand virtually across [from, to] (one real row per
  // recurring cost, not materialized repeats) via generate_series stepped by
  // the row's own recurrence_frequency, capped at recurrence_end_date or
  // `to` — whichever is earlier.
  async getExpenseTotalsForRange(from, to) {
    const db = getPool();
    const { rows } = await db.query(
      `
      WITH recurring_occurrences AS (
        SELECT e.category_id, e.amount, gs.occurrence_date
        FROM expenses e
        CROSS JOIN LATERAL generate_series(
          e.expense_date::timestamp,
          LEAST(COALESCE(e.recurrence_end_date, $2::date), $2::date)::timestamp,
          (CASE e.recurrence_frequency
            WHEN 'daily' THEN INTERVAL '1 day'
            WHEN 'weekly' THEN INTERVAL '1 week'
            WHEN 'monthly' THEN INTERVAL '1 month'
            WHEN 'yearly' THEN INTERVAL '1 year'
            ELSE INTERVAL '1 day'
          END)
        ) AS gs(occurrence_date)
        WHERE e.is_recurring = TRUE
          AND e.expense_date <= $2::date
      ),
      recurring_in_range AS (
        SELECT category_id, SUM(amount) AS total
        FROM recurring_occurrences
        WHERE occurrence_date::date BETWEEN $1::date AND $2::date
        GROUP BY category_id
      ),
      one_off_in_range AS (
        SELECT category_id, SUM(amount) AS total
        FROM expenses
        WHERE is_recurring = FALSE
          AND expense_date BETWEEN $1::date AND $2::date
        GROUP BY category_id
      )
      SELECT
        c.id AS category_id,
        c.name AS category_name,
        COALESCE(o.total, 0) + COALESCE(r.total, 0) AS total
      FROM expense_categories c
      LEFT JOIN one_off_in_range o ON o.category_id = c.id
      LEFT JOIN recurring_in_range r ON r.category_id = c.id
      WHERE COALESCE(o.total, 0) + COALESCE(r.total, 0) > 0
      ORDER BY total DESC
      `,
      [from, to]
    );
    const byCategory = rows.map(r => ({
      category_id: r.category_id,
      category_name: r.category_name,
      total: Math.round(Number.parseFloat(r.total) * 100) / 100,
    }));
    const total = Math.round(byCategory.reduce((sum, r) => sum + r.total, 0) * 100) / 100;
    return { total, by_category: byCategory };
  }

  // Monthly-bucketed expense totals within [from, to], for the P&L chart —
  // same recurring-expansion logic as getExpenseTotalsForRange, grouped by
  // month instead of category.
  async getExpenseMonthlyChart(from, to) {
    const db = getPool();
    const { rows } = await db.query(
      `
      WITH recurring_occurrences AS (
        SELECT e.amount, gs.occurrence_date
        FROM expenses e
        CROSS JOIN LATERAL generate_series(
          e.expense_date::timestamp,
          LEAST(COALESCE(e.recurrence_end_date, $2::date), $2::date)::timestamp,
          (CASE e.recurrence_frequency
            WHEN 'daily' THEN INTERVAL '1 day'
            WHEN 'weekly' THEN INTERVAL '1 week'
            WHEN 'monthly' THEN INTERVAL '1 month'
            WHEN 'yearly' THEN INTERVAL '1 year'
            ELSE INTERVAL '1 day'
          END)
        ) AS gs(occurrence_date)
        WHERE e.is_recurring = TRUE
          AND e.expense_date <= $2::date
      ),
      all_occurrences AS (
        SELECT amount, occurrence_date::date AS occ_date FROM recurring_occurrences
        WHERE occurrence_date::date BETWEEN $1::date AND $2::date
        UNION ALL
        SELECT amount, expense_date AS occ_date FROM expenses
        WHERE is_recurring = FALSE AND expense_date BETWEEN $1::date AND $2::date
      )
      SELECT TO_CHAR(DATE_TRUNC('month', occ_date), 'Mon') AS label,
             DATE_TRUNC('month', occ_date) AS month_start,
             SUM(amount) AS total
      FROM all_occurrences
      GROUP BY DATE_TRUNC('month', occ_date)
      ORDER BY DATE_TRUNC('month', occ_date)
      `,
      [from, to]
    );
    return rows.map(r => ({ label: r.label, total: Math.round(Number.parseFloat(r.total) * 100) / 100 }));
  }
}

module.exports = ExpenseRepository;
