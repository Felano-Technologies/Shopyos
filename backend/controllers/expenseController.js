// controllers/expenseController.js
// Admin-only CRUD for expense_categories + expenses (Financial Dashboard).

const ApiResponse = require('../utils/apiResponse');
const repositories = require('../db/repositories');

function validateCategoryPayload(body) {
  const { name, description } = body;
  if (!name || typeof name !== 'string' || !name.trim()) {
    return { error: 'name is required' };
  }
  if (name.trim().length > 100) {
    return { error: 'name must be at most 100 characters' };
  }
  return { data: { name: name.trim(), description: description?.trim() || null } };
}

const VALID_FREQUENCIES = ['daily', 'weekly', 'monthly', 'yearly'];

function validateExpensePayload(body) {
  const { categoryId, amount, description, expenseDate, isRecurring, recurrenceFrequency, recurrenceEndDate } = body;

  if (!categoryId) return { error: 'categoryId is required' };

  const numericAmount = Number.parseFloat(amount);
  if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
    return { error: 'amount must be a positive number' };
  }

  if (!expenseDate || Number.isNaN(new Date(expenseDate).getTime())) {
    return { error: 'expenseDate is required and must be a valid date' };
  }

  const recurring = !!isRecurring;
  if (recurring && !VALID_FREQUENCIES.includes(recurrenceFrequency)) {
    return { error: `recurrenceFrequency must be one of: ${VALID_FREQUENCIES.join(', ')}` };
  }
  if (recurring && recurrenceEndDate && new Date(recurrenceEndDate) < new Date(expenseDate)) {
    return { error: 'recurrenceEndDate cannot be before expenseDate' };
  }

  return {
    data: {
      category_id: categoryId,
      amount: numericAmount,
      description: description?.trim() || null,
      expense_date: expenseDate,
      is_recurring: recurring,
      recurrence_frequency: recurring ? recurrenceFrequency : null,
      recurrence_end_date: recurring ? (recurrenceEndDate || null) : null,
    },
  };
}

// ── Categories ─────────────────────────────────────────────────────────────

const getExpenseCategories = async (req, res, next) => {
  try {
    const { activeOnly } = req.query;
    const categories = await repositories.expenses.getCategories({ activeOnly: activeOnly === 'true' });
    ApiResponse.success(res, categories);
  } catch (error) {
    next(error);
  }
};

const createExpenseCategory = async (req, res, next) => {
  try {
    const { error: validationError, data } = validateCategoryPayload(req.body);
    if (validationError) return ApiResponse.error(res, validationError, 400);

    const created = await repositories.expenses.createCategory(data);
    ApiResponse.withEntity(res, 'category', created, 'Expense category created', null, 201);
  } catch (error) {
    if (error.code === '23505') return ApiResponse.error(res, 'A category with that name already exists', 400);
    next(error);
  }
};

const updateExpenseCategory = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { error: validationError, data } = validateCategoryPayload(req.body);
    if (validationError) return ApiResponse.error(res, validationError, 400);

    const updated = await repositories.expenses.updateCategory(id, data);
    ApiResponse.withEntity(res, 'category', updated, 'Expense category updated');
  } catch (error) {
    if (error.code === '23505') return ApiResponse.error(res, 'A category with that name already exists', 400);
    next(error);
  }
};

const toggleExpenseCategory = async (req, res, next) => {
  try {
    const { id } = req.params;
    const updated = await repositories.expenses.toggleCategory(id);
    ApiResponse.withEntity(res, 'category', updated, 'Expense category status updated');
  } catch (error) {
    next(error);
  }
};

// ── Expense entries ─────────────────────────────────────────────────────────

const getExpenses = async (req, res, next) => {
  try {
    const { categoryId, from, to, limit, offset } = req.query;
    const expenses = await repositories.expenses.getExpenses({
      categoryId: categoryId || undefined,
      from: from || undefined,
      to: to || undefined,
      limit: limit ? Number.parseInt(limit, 10) : 50,
      offset: offset ? Number.parseInt(offset, 10) : 0,
    });
    ApiResponse.success(res, expenses);
  } catch (error) {
    next(error);
  }
};

const createExpense = async (req, res, next) => {
  try {
    const { error: validationError, data } = validateExpensePayload(req.body);
    if (validationError) return ApiResponse.error(res, validationError, 400);

    const created = await repositories.expenses.createExpense({ ...data, created_by: req.user.id });
    ApiResponse.withEntity(res, 'expense', created, 'Expense recorded', null, 201);
  } catch (error) {
    next(error);
  }
};

// Bulk import (CSV upload, parsed client-side into rows) — each row is
// validated against the same rules as a single createExpense, plus a
// categoryName lookup (friendlier for a hand-filled CSV than requiring raw
// UUIDs). Nothing is written unless every row passes, so an admin fixing a
// typo doesn't have to guess which rows already landed.
const bulkCreateExpenses = async (req, res, next) => {
  try {
    const { rows } = req.body;
    if (!Array.isArray(rows) || rows.length === 0) {
      return ApiResponse.error(res, 'rows must be a non-empty array', 400);
    }
    if (rows.length > 1000) {
      return ApiResponse.error(res, 'A single import is limited to 1000 rows — split larger files.', 400);
    }

    const categories = await repositories.expenses.getCategories({});
    const byName = new Map(categories.map((c) => [c.name.trim().toLowerCase(), c.id]));
    const byId = new Set(categories.map((c) => c.id));

    const errors = [];
    const prepared = [];
    rows.forEach((row, index) => {
      const rowNum = index + 1;
      let categoryId = row.categoryId;
      if (!categoryId && row.categoryName) {
        categoryId = byName.get(String(row.categoryName).trim().toLowerCase());
        if (!categoryId) {
          errors.push(`Row ${rowNum}: category "${row.categoryName}" was not found`);
          return;
        }
      } else if (categoryId && !byId.has(categoryId)) {
        errors.push(`Row ${rowNum}: unknown categoryId`);
        return;
      }

      const { error: validationError, data } = validateExpensePayload({ ...row, categoryId });
      if (validationError) {
        errors.push(`Row ${rowNum}: ${validationError}`);
        return;
      }
      prepared.push(data);
    });

    if (errors.length > 0) {
      // `details` is dropped outside development (ApiResponse.error), and
      // these row errors are exactly what the admin needs to fix their CSV
      // — so they go directly in `message`, not `details`.
      return ApiResponse.error(res, `${errors.length} row(s) failed validation — nothing was imported:\n${errors.join('\n')}`, 400);
    }

    const created = [];
    for (const data of prepared) {
      created.push(await repositories.expenses.createExpense({ ...data, created_by: req.user.id }));
    }
    ApiResponse.withEntity(res, 'expenses', created, `${created.length} expense(s) imported`, null, 201);
  } catch (error) {
    next(error);
  }
};

const updateExpense = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { error: validationError, data } = validateExpensePayload(req.body);
    if (validationError) return ApiResponse.error(res, validationError, 400);

    const updated = await repositories.expenses.updateExpense(id, data);
    ApiResponse.withEntity(res, 'expense', updated, 'Expense updated');
  } catch (error) {
    next(error);
  }
};

const deleteExpense = async (req, res, next) => {
  try {
    const { id } = req.params;
    await repositories.expenses.deleteExpense(id);
    ApiResponse.success(res, null, 'Expense deleted');
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getExpenseCategories,
  createExpenseCategory,
  updateExpenseCategory,
  toggleExpenseCategory,
  getExpenses,
  createExpense,
  bulkCreateExpenses,
  updateExpense,
  deleteExpense,
};
