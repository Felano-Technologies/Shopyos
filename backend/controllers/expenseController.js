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
  updateExpense,
  deleteExpense,
};
