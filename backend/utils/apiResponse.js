class ApiResponse {
  /**
   * Send a success response
   */
  static success(res, data, message = null, pagination = null, statusCode = 200) {
    const body = { success: true };
    if (message) body.message = message;
    if (data !== undefined) body.data = data;
    if (pagination) body.pagination = pagination;
    return res.status(statusCode).json(body);
  }

  /**
   * Send a success response with a specific entity key
   * e.g., ApiResponse.withEntity(res, 'product', product)
   */
  static withEntity(res, entityKey, data, message = null, pagination = null, statusCode = 200) {
    const body = { success: true };
    if (message) body.message = message;
    body[entityKey] = data;
    if (pagination) body.pagination = pagination;
    return res.status(statusCode).json(body);
  }

  /**
   * Send a paginated list response
   */
  static paginated(res, data, pagination) {
    return this.success(res, data, null, pagination);
  }

  /**
   * Send an error response
   */
  static error(res, message, statusCode = 400, details = null) {
    const body = { success: false, error: message };
    if (details && process.env.NODE_ENV === 'development') body.details = details;
    return res.status(statusCode).json(body);
  }

  /**
   * Send a created response (201)
   */
  static created(res, data, message = 'Created successfully') {
    return this.success(res, data, message, null, 201);
  }
}

module.exports = ApiResponse;
