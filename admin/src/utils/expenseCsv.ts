// src/utils/expenseCsv.ts
// Client-side CSV parsing + template download for bulk expense import
// (Expenses.tsx). Parsing happens in the browser so the admin gets instant
// feedback on obvious mistakes before anything is sent to the server —
// POST /admin/expenses/bulk still re-validates every row itself and is the
// actual source of truth.

export type ParsedExpenseRow = {
  categoryName: string;
  amount: number;
  description?: string;
  expenseDate: string;
  isRecurring: boolean;
  recurrenceFrequency?: 'daily' | 'weekly' | 'monthly' | 'yearly';
  recurrenceEndDate?: string;
};

const HEADER_ALIASES: Record<string, keyof ParsedExpenseRow> = {
  category: 'categoryName',
  categoryname: 'categoryName',
  'category name': 'categoryName',
  amount: 'amount',
  description: 'description',
  expensedate: 'expenseDate',
  'expense date': 'expenseDate',
  date: 'expenseDate',
  isrecurring: 'isRecurring',
  'is recurring': 'isRecurring',
  recurring: 'isRecurring',
  recurrencefrequency: 'recurrenceFrequency',
  'recurrence frequency': 'recurrenceFrequency',
  frequency: 'recurrenceFrequency',
  recurrenceenddate: 'recurrenceEndDate',
  'recurrence end date': 'recurrenceEndDate',
  'end date': 'recurrenceEndDate',
};

const TRUTHY = new Set(['true', 'yes', 'y', '1']);
const VALID_FREQUENCIES = new Set(['daily', 'weekly', 'monthly', 'yearly']);

// Splits one CSV file's full text into rows of raw string cells, handling
// quoted fields (commas/newlines inside quotes, "" as an escaped quote) —
// a plain text.split(',') breaks the moment a description contains a comma.
function splitCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; } else { inQuotes = false; }
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      row.push(field);
      field = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(field);
      field = '';
      if (row.some((c) => c.trim() !== '')) rows.push(row);
      row = [];
    } else {
      field += ch;
    }
  }
  if (field !== '' || row.length > 0) {
    row.push(field);
    if (row.some((c) => c.trim() !== '')) rows.push(row);
  }
  return rows;
}

export function parseExpenseCsv(text: string): { rows: ParsedExpenseRow[]; errors: string[] } {
  const raw = splitCsv(text);
  if (raw.length < 2) {
    return { rows: [], errors: ['The file needs a header row plus at least one data row.'] };
  }

  const headerRow = raw[0].map((h) => h.trim().toLowerCase());
  const columns = headerRow.map((h) => HEADER_ALIASES[h] || null);
  if (!columns.includes('categoryName') || !columns.includes('amount') || !columns.includes('expenseDate')) {
    return { rows: [], errors: ['The file must have "categoryName", "amount", and "expenseDate" columns (use the template).'] };
  }

  const rows: ParsedExpenseRow[] = [];
  const errors: string[] = [];

  raw.slice(1).forEach((cells, i) => {
    const rowNum = i + 2; // +1 for header row, +1 for 1-indexing
    const get = (key: keyof ParsedExpenseRow) => {
      const colIndex = columns.indexOf(key);
      return colIndex === -1 ? '' : (cells[colIndex] || '').trim();
    };

    const categoryName = get('categoryName');
    if (!categoryName) { errors.push(`Row ${rowNum}: missing category`); return; }

    const amountStr = get('amount');
    const amount = Number.parseFloat(amountStr);
    if (!Number.isFinite(amount) || amount <= 0) { errors.push(`Row ${rowNum}: "${amountStr}" is not a valid positive amount`); return; }

    const expenseDate = get('expenseDate');
    if (!expenseDate || Number.isNaN(new Date(expenseDate).getTime())) { errors.push(`Row ${rowNum}: "${expenseDate}" is not a valid date`); return; }

    const isRecurring = TRUTHY.has(get('isRecurring').toLowerCase());
    let recurrenceFrequency: ParsedExpenseRow['recurrenceFrequency'];
    if (isRecurring) {
      const freq = get('recurrenceFrequency').toLowerCase();
      if (!VALID_FREQUENCIES.has(freq)) { errors.push(`Row ${rowNum}: recurring rows need a recurrenceFrequency of daily/weekly/monthly/yearly`); return; }
      recurrenceFrequency = freq as ParsedExpenseRow['recurrenceFrequency'];
    }
    const recurrenceEndDate = get('recurrenceEndDate') || undefined;

    rows.push({
      categoryName,
      amount,
      description: get('description') || undefined,
      expenseDate,
      isRecurring,
      recurrenceFrequency,
      recurrenceEndDate,
    });
  });

  return { rows, errors };
}

export function downloadExpenseCsvTemplate() {
  const csv = [
    'categoryName,amount,description,expenseDate,isRecurring,recurrenceFrequency,recurrenceEndDate',
    'Rent,2500,Warehouse rent for the month,2026-09-01,true,monthly,',
    'Marketing,450.50,Facebook ad campaign,2026-09-05,false,,',
  ].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'expense-import-template.csv';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
