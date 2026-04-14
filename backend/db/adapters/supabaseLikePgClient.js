const { getPool } = require('../../config/postgres');

const toPgError = (error, notFound = false) => {
  if (!error) return null;
  if (notFound) {
    return { code: 'PGRST116', message: 'No rows found' };
  }
  return { code: error.code || 'PG_ERROR', message: error.message };
};

const isComplexSelect = (selectString) => {
  return typeof selectString === 'string' && (selectString.includes('(') || selectString.includes(':'));
};

class QueryBuilder {
  constructor(tableName) {
    this.tableName = tableName;
    this.operation = null;
    this.selectColumns = '*';
    this.insertData = null;
    this.updateData = null;
    this.filters = [];
    this.orderBy = null;
    this.limitValue = null;
    this.offsetValue = null;
    this.returnCount = false;
    this.headOnly = false;
    this.singleMode = false;
    this.maybeSingleMode = false;
    this.upsertKeys = null;
  }

  select(columns = '*', options = {}) {
    this.operation = this.operation || 'select';
    this.selectColumns = isComplexSelect(columns) ? '*' : (columns || '*');
    this.returnCount = options.count === 'exact';
    this.headOnly = !!options.head;
    return this;
  }

  insert(data) {
    this.operation = 'insert';
    this.insertData = data;
    return this;
  }

  upsert(data, options = {}) {
    this.operation = 'upsert';
    this.insertData = data;
    this.upsertKeys = options.onConflict ? String(options.onConflict).split(',').map((k) => k.trim()) : null;
    return this;
  }

  update(data) {
    this.operation = 'update';
    this.updateData = data;
    return this;
  }

  delete() {
    this.operation = 'delete';
    return this;
  }

  eq(column, value) {
    this.filters.push({ type: 'binary', op: '=', column, value });
    return this;
  }

  neq(column, value) {
    this.filters.push({ type: 'binary', op: '!=', column, value });
    return this;
  }

  gt(column, value) {
    this.filters.push({ type: 'binary', op: '>', column, value });
    return this;
  }

  gte(column, value) {
    this.filters.push({ type: 'binary', op: '>=', column, value });
    return this;
  }

  lt(column, value) {
    this.filters.push({ type: 'binary', op: '<', column, value });
    return this;
  }

  lte(column, value) {
    this.filters.push({ type: 'binary', op: '<=', column, value });
    return this;
  }

  is(column, value) {
    this.filters.push({ type: 'is', column, value });
    return this;
  }

  in(column, values) {
    this.filters.push({ type: 'in', column, values });
    return this;
  }

  ilike(column, value) {
    this.filters.push({ type: 'binary', op: 'ILIKE', column, value });
    return this;
  }

  or(expression) {
    this.filters.push({ type: 'or', expression });
    return this;
  }

  order(column, { ascending = true } = {}) {
    this.orderBy = { column, ascending };
    return this;
  }

  limit(value) {
    this.limitValue = value;
    return this;
  }

  range(from, to) {
    this.offsetValue = from;
    this.limitValue = (to - from) + 1;
    return this;
  }

  single() {
    this.singleMode = true;
    return this;
  }

  maybeSingle() {
    this.maybeSingleMode = true;
    return this;
  }

  then(resolve, reject) {
    return this.execute().then(resolve, reject);
  }

  _whereClause() {
    const clauses = [];
    const values = [];

    const pushValue = (value) => {
      values.push(value);
      return `$${values.length}`;
    };

    this.filters.forEach((filter) => {
      if (filter.type === 'binary') {
        clauses.push(`${filter.column} ${filter.op} ${pushValue(filter.value)}`);
      }

      if (filter.type === 'is') {
        if (filter.value === null) {
          clauses.push(`${filter.column} IS NULL`);
        } else {
          clauses.push(`${filter.column} IS ${pushValue(filter.value)}`);
        }
      }

      if (filter.type === 'in') {
        const placeholders = (filter.values || []).map((v) => pushValue(v));
        if (placeholders.length === 0) {
          clauses.push('1=0');
        } else {
          clauses.push(`${filter.column} IN (${placeholders.join(', ')})`);
        }
      }

      if (filter.type === 'or') {
        const orParts = String(filter.expression)
          .split(',')
          .map((segment) => segment.trim())
          .filter(Boolean)
          .map((segment) => {
            const [left, op, ...rest] = segment.split('.');
            const rhs = rest.join('.');
            if (!left || !op) return null;
            if (op === 'eq') {
              return `${left} = ${pushValue(rhs)}`;
            }
            if (op === 'ilike') {
              return `${left} ILIKE ${pushValue(rhs)}`;
            }
            return null;
          })
          .filter(Boolean);

        if (orParts.length > 0) {
          clauses.push(`(${orParts.join(' OR ')})`);
        }
      }
    });

    if (clauses.length === 0) {
      return { clause: '', values };
    }

    return { clause: ` WHERE ${clauses.join(' AND ')}`, values };
  }

  async execute() {
    const db = getPool();

    try {
      if (this.operation === 'insert' || this.operation === 'upsert') {
        const records = Array.isArray(this.insertData) ? this.insertData : [this.insertData];
        if (records.length === 0) return { data: [], error: null };

        const keys = Object.keys(records[0]);
        const values = [];
        const rowPlaceholders = records.map((record) => {
          const placeholders = keys.map((key) => {
            values.push(record[key]);
            return `$${values.length}`;
          });
          return `(${placeholders.join(', ')})`;
        });

        let sql = `INSERT INTO ${this.tableName} (${keys.join(', ')}) VALUES ${rowPlaceholders.join(', ')}`;

        if (this.operation === 'upsert' && this.upsertKeys && this.upsertKeys.length > 0) {
          const updatable = keys.filter((k) => !this.upsertKeys.includes(k));
          const updates = updatable.map((k) => `${k} = EXCLUDED.${k}`).join(', ');
          sql += ` ON CONFLICT (${this.upsertKeys.join(', ')}) DO UPDATE SET ${updates || updatable[0]}`;
        }

        sql += ' RETURNING *';
        const result = await db.query(sql, values);
        return { data: this.singleMode || this.maybeSingleMode ? result.rows[0] || null : result.rows, error: null };
      }

      if (this.operation === 'update') {
        const updateKeys = Object.keys(this.updateData || {});
        const setValues = [];
        const setSql = updateKeys.map((key) => {
          setValues.push(this.updateData[key]);
          return `${key} = $${setValues.length}`;
        }).join(', ');

        const { clause, values } = this._whereClause();
        const params = [...setValues, ...values];
        const shiftedClause = clause.replace(/\$(\d+)/g, (_, i) => `$${parseInt(i, 10) + setValues.length}`);

        const sql = `UPDATE ${this.tableName} SET ${setSql}${shiftedClause} RETURNING *`;
        const result = await db.query(sql, params);

        if ((this.singleMode || this.maybeSingleMode) && result.rows.length === 0) {
          return { data: null, error: toPgError(new Error('No rows'), true) };
        }

        return { data: this.singleMode || this.maybeSingleMode ? result.rows[0] || null : result.rows, error: null };
      }

      if (this.operation === 'delete') {
        const { clause, values } = this._whereClause();
        const sql = `DELETE FROM ${this.tableName}${clause} RETURNING *`;
        const result = await db.query(sql, values);
        return { data: this.singleMode || this.maybeSingleMode ? result.rows[0] || null : result.rows, error: null };
      }

      const { clause, values } = this._whereClause();
      const orderSql = this.orderBy ? ` ORDER BY ${this.orderBy.column} ${this.orderBy.ascending ? 'ASC' : 'DESC'}` : '';
      const limitSql = Number.isInteger(this.limitValue) ? ` LIMIT ${this.limitValue}` : '';
      const offsetSql = Number.isInteger(this.offsetValue) ? ` OFFSET ${this.offsetValue}` : '';

      if (this.headOnly && this.returnCount) {
        const countResult = await db.query(`SELECT COUNT(*)::int AS count FROM ${this.tableName}${clause}`, values);
        return { data: null, count: countResult.rows[0]?.count || 0, error: null };
      }

      const sql = `SELECT ${this.selectColumns} FROM ${this.tableName}${clause}${orderSql}${limitSql}${offsetSql}`;
      const result = await db.query(sql, values);

      if (this.singleMode) {
        if (result.rows.length === 0) {
          return { data: null, error: toPgError(new Error('No rows'), true) };
        }
        return { data: result.rows[0], error: null };
      }

      if (this.maybeSingleMode) {
        return { data: result.rows[0] || null, error: null };
      }

      const response = { data: result.rows, error: null };

      if (this.returnCount) {
        const countResult = await db.query(`SELECT COUNT(*)::int AS count FROM ${this.tableName}${clause}`, values);
        response.count = countResult.rows[0]?.count || 0;
      }

      return response;
    } catch (error) {
      return { data: null, error: toPgError(error) };
    }
  }
}

const createPgClient = () => {
  return {
    from(tableName) {
      return new QueryBuilder(tableName);
    },
    async rpc(fnName, args = {}) {
      const db = getPool();
      try {
        const keys = Object.keys(args);
        const values = keys.map((k) => args[k]);
        const placeholders = values.map((_, i) => `$${i + 1}`).join(', ');
        const sql = `SELECT * FROM ${fnName}(${placeholders})`;
        const result = await db.query(sql, values);
        return { data: result.rows, error: null };
      } catch (error) {
        return { data: null, error: toPgError(error) };
      }
    },
  };
};

module.exports = {
  createPgClient,
};
