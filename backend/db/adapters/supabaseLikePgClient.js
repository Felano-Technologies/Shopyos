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

  onConflict(columns) {
    // Store conflict columns; paired with .ignore() for DO NOTHING
    // or used automatically by upsert() for DO UPDATE SET
    this._conflictColumns = Array.isArray(columns) ? columns : [columns];
    return this;
  }

  ignore() {
    // When called after insert().onConflict(), produces ON CONFLICT DO NOTHING
    this._ignoreConflict = true;
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

        if (this._ignoreConflict) {
          // insert().onConflict([...]).ignore() => ON CONFLICT DO NOTHING
          const conflictCols = this._conflictColumns?.length ? ` (${this._conflictColumns.join(', ')})` : '';
          sql += ` ON CONFLICT${conflictCols} DO NOTHING RETURNING *`;
          const result = await db.query(sql, values);
          
          const rowCount = typeof result.rowCount === 'number' ? result.rowCount : result.rows.length;
          const inserted = result.rows[0] || null;
          const conflictIgnored = rowCount === 0;

          return { 
            data: inserted, 
            error: null, 
            rowCount, 
            conflictIgnored 
          };
        }

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

      // Sanitize select columns for Postgres
      let finalSelect = this.selectColumns;
      if (finalSelect.includes('(') || finalSelect.includes(':')) {
        finalSelect = '*';
      }

      const sql = `SELECT ${finalSelect} FROM ${this.tableName}${clause}${orderSql}${limitSql}${offsetSql}`;
      const result = await db.query(sql, values);

      // --- JOIN SHIM START ---
      // If we're selecting from user_roles and we had a complex select, 
      // manually fetch the role names to mimic the Supabase join.
      if (this.tableName === 'user_roles' && result.rows.length > 0) {
        const roleIds = [...new Set(result.rows.map(r => r.role_id))];
        const { rows: roles } = await db.query('SELECT * FROM roles WHERE id = ANY($1)', [roleIds]);
        const roleMap = roles.reduce((acc, r) => ({ ...acc, [r.id]: r }), {});
        
        result.rows = result.rows.map(row => ({
          ...row,
          role: roleMap[row.role_id] || null,
          roles: roleMap[row.role_id] || null // Match both singular and plural
        }));
      }

      // --- USERS JOIN SHIM (FOR ROLES) ---
      if (this.tableName === 'users' && result.rows.length > 0) {
        const userIds = result.rows.map(u => u.id);
        
        // Fetch all roles for these users
        const { rows: userRoles } = await db.query(
          `SELECT ur.*, r.name, r.display_name 
           FROM user_roles ur 
           JOIN roles r ON ur.role_id = r.id 
           WHERE ur.user_id = ANY($1) AND ur.is_active = TRUE`,
          [userIds]
        );

        // Group roles by user
        const rolesByUser = userRoles.reduce((acc, ur) => {
          if (!acc[ur.user_id]) acc[ur.user_id] = [];
          acc[ur.user_id].push({
            is_active: ur.is_active,
            roles: { name: ur.name, display_name: ur.display_name }
          });
          return acc;
        }, {});

        result.rows = result.rows.map(user => ({
          ...user,
          user_roles: rolesByUser[user.id] || []
        }));
      }

      // --- CARTS JOIN SHIM ---
      if (this.tableName === 'carts' && result.rows.length > 0) {
        const cartIds = result.rows.map(c => c.id);
        
        // 1. Fetch cart_items
        const { rows: allCartItems } = await db.query(
          `SELECT ci.*, 
                  p.id as p_id, p.title as p_title, p.description as p_description, p.price as p_price, p.store_id as p_store_id,
                  s.store_name as s_name, s.logo_url as s_logo,
                  i.quantity as i_qty
           FROM cart_items ci
           LEFT JOIN products p ON ci.product_id = p.id
           LEFT JOIN stores s ON p.store_id = s.id
           LEFT JOIN inventory i ON p.id = i.product_id
           WHERE ci.cart_id = ANY($1)`,
          [cartIds]
        );

        // 2. Fetch images for these products
        const productIds = [...new Set(allCartItems.map(ci => ci.product_id).filter(Boolean))];
        let imageMap = {};
        if (productIds.length > 0) {
          const { rows: images } = await db.query(
            `SELECT * FROM product_images WHERE product_id = ANY($1)`,
            [productIds]
          );
          images.forEach(img => {
            if (!imageMap[img.product_id]) imageMap[img.product_id] = [];
            imageMap[img.product_id].push(img);
          });
        }

        // 3. Assemble the nested structure
        const cartItemsByCart = allCartItems.reduce((acc, ci) => {
          if (!acc[ci.cart_id]) acc[ci.cart_id] = [];
          acc[ci.cart_id].push({
            id: ci.id,
            product_id: ci.product_id,
            quantity: ci.quantity,
            added_at: ci.added_at,
            products: ci.p_id ? {
              id: ci.p_id,
              title: ci.p_title,
              description: ci.p_description,
              price: ci.p_price,
              store_id: ci.p_store_id,
              product_images: imageMap[ci.p_id] || [],
              stores: {
                store_name: ci.s_name,
                logo_url: ci.s_logo
              },
              inventory: {
                quantity: ci.i_qty
              }
            } : null
          });
          return acc;
        }, {});

        result.rows = result.rows.map(cart => ({
          ...cart,
          cart_items: cartItemsByCart[cart.id] || []
        }));
      }

      // --- ORDERS JOIN SHIM ---
      if (this.tableName === 'orders' && result.rows.length > 0) {
        const orderIds = result.rows.map(o => o.id);

        // 1. Fetch Order Items
        const { rows: allOrderItems } = await db.query(
          `SELECT DISTINCT ON (oi.id) oi.*, 
                  p.id as p_id,
                  pi.image_url as p_image
           FROM order_items oi
           LEFT JOIN products p ON oi.product_id = p.id
           LEFT JOIN product_images pi ON p.id = pi.product_id
           WHERE oi.order_id = ANY($1)
           ORDER BY oi.id, pi.display_order ASC`,
          [orderIds]
        );

        // 2. Fetch Payments
        const { rows: allPayments } = await db.query(
          `SELECT * FROM payments WHERE order_id = ANY($1)`,
          [orderIds]
        );

        // 3. Fetch Deliveries + Driver Profiles
        const { rows: allDeliveries } = await db.query(
          `SELECT d.*, 
                  up.full_name as driver_name, up.phone as driver_phone, up.avatar_url as driver_avatar,
                  dp.vehicle_type, dp.license_plate
           FROM deliveries d
           LEFT JOIN driver_profiles dp ON d.driver_id = dp.user_id
           LEFT JOIN user_profiles up ON dp.user_id = up.user_id
           WHERE d.order_id = ANY($1)`,
          [orderIds]
        );

        // 4. Fetch Stores
        const storeIds = [...new Set(result.rows.map(o => o.store_id).filter(Boolean))];
        let storeMap = {};
        if (storeIds.length > 0) {
          const { rows: stores } = await db.query(
            `SELECT * FROM stores WHERE id = ANY($1)`,
            [storeIds]
          );
          stores.forEach(s => { storeMap[s.id] = s; });
        }

        // 5. Fetch Buyers
        const buyerIds = [...new Set(result.rows.map(o => o.buyer_id).filter(Boolean))];
        let buyerMap = {};
        if (buyerIds.length > 0) {
          const { rows: buyers } = await db.query(
            `SELECT u.id, u.email, up.full_name, up.phone 
             FROM users u
             LEFT JOIN user_profiles up ON u.id = up.user_id
             WHERE u.id = ANY($1)`,
            [buyerIds]
          );
          buyers.forEach(b => { 
            buyerMap[b.id] = { 
              id: b.id, email: b.email, 
              user_profiles: { full_name: b.full_name, phone: b.phone } 
            }; 
          });
        }

        // Assemble everything
        const itemsByOrder = allOrderItems.reduce((acc, oi) => {
          if (!acc[oi.order_id]) acc[oi.order_id] = [];
          acc[oi.order_id].push({
            ...oi,
            product: {
              product_images: oi.p_image ? [{ image_url: oi.p_image }] : []
            }
          });
          return acc;
        }, {});

        const paymentsByOrder = allPayments.reduce((acc, p) => {
          if (!acc[p.order_id]) acc[p.order_id] = [];
          acc[p.order_id].push(p);
          return acc;
        }, {});

        const deliveriesByOrder = allDeliveries.reduce((acc, d) => {
          if (!acc[d.order_id]) acc[d.order_id] = [];
          acc[d.order_id].push({
            ...d,
            driver: d.driver_id ? {
              user_profiles: { 
                full_name: d.driver_name, 
                phone: d.driver_phone, 
                avatar_url: d.driver_avatar 
              },
              vehicle_type: d.vehicle_type,
              plate_number: d.license_plate
            } : null
          });
          return acc;
        }, {});

        result.rows = result.rows.map(order => ({
          ...order,
          buyer: buyerMap[order.buyer_id] || null,
          store: storeMap[order.store_id] || null,
          order_items: itemsByOrder[order.id] || [],
          payments: paymentsByOrder[order.id] || [],
          deliveries: deliveriesByOrder[order.id] || []
        }));
      }

      // --- PRODUCTS JOIN SHIM ---
      if (this.tableName === 'products' && result.rows.length > 0) {
        const productIds = result.rows.map(p => p.id);
        
        // 1. Fetch stores
        const storeIds = [...new Set(result.rows.map(p => p.store_id).filter(Boolean))];
        let storeMap = {};
        if (storeIds.length > 0) {
          const { rows: stores } = await db.query(
            `SELECT id, store_name, slug, average_rating, total_reviews, owner_id, logo_url, is_verified FROM stores WHERE id = ANY($1)`,
            [storeIds]
          );
          stores.forEach(s => { storeMap[s.id] = s; });
        }

        // 2. Fetch images
        let imageMap = {};
        const { rows: images } = await db.query(
          `SELECT * FROM product_images WHERE product_id = ANY($1) ORDER BY display_order ASC`,
          [productIds]
        );
        images.forEach(img => {
          if (!imageMap[img.product_id]) imageMap[img.product_id] = [];
          imageMap[img.product_id].push(img);
        });

        // 3. Fetch inventory
        let inventoryMap = {};
        const { rows: inventory } = await db.query(
          `SELECT * FROM inventory WHERE product_id = ANY($1)`,
          [productIds]
        );
        inventory.forEach(inv => { inventoryMap[inv.product_id] = inv; });

        result.rows = result.rows.map(product => ({
          ...product,
          stores: storeMap[product.store_id] || null,
          product_images: imageMap[product.id] || [],
          inventory: inventoryMap[product.id] || null
        }));
      }

      // --- MESSAGES JOIN SHIM ---
      if (this.tableName === 'messages' && result.rows.length > 0) {
        const senderIds = [...new Set(result.rows.map(m => m.sender_id).filter(Boolean))];
        const replyToIds = [...new Set(result.rows.map(m => m.reply_to_message_id).filter(Boolean))];

        // 1. Fetch senders' user profiles
        let senderMap = {};
        if (senderIds.length > 0) {
          const { rows: senders } = await db.query(
            `SELECT u.id, up.full_name, up.avatar_url 
             FROM users u
             LEFT JOIN user_profiles up ON u.id = up.user_id
             WHERE u.id = ANY($1)`,
            [senderIds]
          );
          senders.forEach(s => {
            senderMap[s.id] = {
              id: s.id,
              user_profiles: { full_name: s.full_name, avatar_url: s.avatar_url }
            };
          });
        }

        // 2. Fetch parent messages for replies
        let replyMap = {};
        if (replyToIds.length > 0) {
          const { rows: parentMessages } = await db.query(
            `SELECT * FROM messages WHERE id = ANY($1)`,
            [replyToIds]
          );

          // Get parent senders
          const parentSenderIds = [...new Set(parentMessages.map(pm => pm.sender_id).filter(Boolean))];
          let parentSenderMap = {};
          if (parentSenderIds.length > 0) {
            const { rows: parentSenders } = await db.query(
              `SELECT u.id, up.full_name 
               FROM users u
               LEFT JOIN user_profiles up ON u.id = up.user_id
               WHERE u.id = ANY($1)`,
              [parentSenderIds]
            );
            parentSenders.forEach(ps => {
              parentSenderMap[ps.id] = {
                id: ps.id,
                user_profiles: { full_name: ps.full_name }
              };
            });
          }

          parentMessages.forEach(pm => {
            replyMap[pm.id] = {
              id: pm.id,
              content: pm.content,
              sender_id: pm.sender_id,
              sender: parentSenderMap[pm.sender_id] || null
            };
          });
        }

        // 3. Hydrate messages
        result.rows = result.rows.map(m => ({
          ...m,
          sender: senderMap[m.sender_id] || null,
          reply_to_message: replyMap[m.reply_to_message_id] || null
        }));
      }

      // --- CONVERSATIONS JOIN SHIM ---
      if (this.tableName === 'conversations' && result.rows.length > 0) {
        const conversationIds = result.rows.map(c => c.id);
        const participantIds = [
          ...new Set([
            ...result.rows.map(c => c.participant1_id),
            ...result.rows.map(c => c.participant2_id)
          ])
        ].filter(Boolean);

        // 1. Fetch participants (users + profiles + stores)
        let participantMap = {};
        if (participantIds.length > 0) {
          const { rows: participants } = await db.query(
            `SELECT u.id, u.email,
                    up.full_name, up.avatar_url, up.phone,
                    s.id AS store_id, s.store_name, s.logo_url
             FROM users u
             LEFT JOIN user_profiles up ON u.id = up.user_id
             LEFT JOIN stores s ON u.id = s.owner_id
             WHERE u.id = ANY($1)`,
            [participantIds]
          );

          participants.forEach(p => {
            participantMap[p.id] = {
              id: p.id,
              email: p.email,
              user_profiles: p.full_name ? [{
                full_name: p.full_name,
                avatar_url: p.avatar_url,
                phone: p.phone
              }] : [],
              stores: p.store_id ? [{
                id: p.store_id,
                store_name: p.store_name,
                logo_url: p.logo_url
              }] : []
            };
          });
        }

        // 2. Fetch all messages for these conversations
        let messagesMap = {};
        if (conversationIds.length > 0) {
          const { rows: messages } = await db.query(
            `SELECT id, conversation_id, content, created_at, is_read, sender_id 
             FROM messages 
             WHERE conversation_id = ANY($1)
             ORDER BY created_at DESC`,
            [conversationIds]
          );

          messages.forEach(m => {
            if (!messagesMap[m.conversation_id]) {
              messagesMap[m.conversation_id] = [];
            }
            messagesMap[m.conversation_id].push(m);
          });
        }

        // 3. Assemble conversations
        result.rows = result.rows.map(c => ({
          ...c,
          participant1: participantMap[c.participant1_id] || null,
          participant2: participantMap[c.participant2_id] || null,
          messages: messagesMap[c.id] || []
        }));
      }
      // --- JOIN SHIM END ---

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
        const values = keys.map((k) => {
          const val = args[k];
          // If it's an object or array, stringify it for Postgres JSONB/JSON params
          if (val !== null && typeof val === 'object') {
            return JSON.stringify(val);
          }
          return val;
        });
        const placeholders = values.map((_, i) => `$${i + 1}`).join(', ');
        const sql = `SELECT * FROM ${fnName}(${placeholders})`;
        const result = await db.query(sql, values);
        // Unwrap the result if it's a JSONB return
        const data = result.rows.length === 1 && Object.keys(result.rows[0]).length === 1 && result.rows[0][fnName] 
          ? result.rows[0][fnName] 
          : result.rows;
        return { data, error: null };
      } catch (error) {
        return { data: null, error: toPgError(error) };
      }
    },
    async query(sql, values = []) {
      const db = getPool();
      try {
        const result = await db.query(sql, values);
        return { data: result.rows, rows: result.rows, error: null };
      } catch (error) {
        return { data: null, rows: [], error: toPgError(error) };
      }
    }
  };
};

module.exports = {
  createPgClient,
};
