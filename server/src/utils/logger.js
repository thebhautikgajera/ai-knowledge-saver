/**
 * Logger Utility
 * 
 * Provides structured logging with performance tracking.
 * Can be extended to integrate with Prometheus/Grafana.
 */

/**
 * Log a request
 * 
 * @param {Object} req - Express request object
 * @param {string} level - Log level (info, warn, error)
 * @param {string} message - Log message
 * @param {Object} metadata - Additional metadata
 */
export const logRequest = (req, level = 'info', message, metadata = {}) => {
  const logEntry = {
    timestamp: new Date().toISOString(),
    level,
    requestId: req.requestId || 'unknown',
    method: req.method,
    path: req.path,
    message,
    ...metadata,
  };

  const logLine = JSON.stringify(logEntry);
  
  switch (level) {
    case 'error':
      console.error(logLine);
      break;
    case 'warn':
      console.warn(logLine);
      break;
    default:
      console.log(logLine);
  }

  return logEntry;
};

/**
 * Log slow database queries
 * 
 * @param {Object} req - Express request object
 * @param {string} operation - DB operation (find, update, etc.)
 * @param {string} model - Model name
 * @param {number} duration - Query duration in milliseconds
 * @param {Object} filter - Query filter (sanitized)
 */
export const logSlowQuery = (req, operation, model, duration, filter = {}) => {
  const SLOW_QUERY_THRESHOLD = parseInt(process.env.SLOW_QUERY_THRESHOLD || '1000'); // 1 second

  if (duration > SLOW_QUERY_THRESHOLD) {
    logRequest(req, 'warn', 'Slow database query detected', {
      operation,
      model,
      duration,
      threshold: SLOW_QUERY_THRESHOLD,
      filter: sanitizeFilter(filter),
    });
  }
};

/**
 * Sanitize filter object for logging (remove sensitive data)
 * 
 * @param {Object} filter - Query filter
 * @returns {Object} Sanitized filter
 */
const sanitizeFilter = (filter) => {
  const sanitized = { ...filter };
  // Remove password fields if present
  if (sanitized.password) {
    sanitized.password = '[REDACTED]';
  }
  return sanitized;
};

/**
 * Log user activity for metrics
 * 
 * @param {string} userId - User ID
 * @param {string} action - Action performed (e.g., 'product.view', 'sale.create')
 * @param {Object} metadata - Additional metadata
 */
export const logUserActivity = (userId, action, metadata = {}) => {
  const logEntry = {
    timestamp: new Date().toISOString(),
    type: 'user_activity',
    userId,
    action,
    ...metadata,
  };

  console.log(JSON.stringify(logEntry));
  
  // TODO: Push to Prometheus metrics
  // Example: prometheusCounter.inc({ userId, action });
  
  return logEntry;
};

/**
 * Example Prometheus metrics (commented out - requires prom-client package)
 * 
 * Uncomment and install 'prom-client' to enable:
 * 
 * import promClient from 'prom-client';
 * 
 * const register = new promClient.Registry();
 * 
 * const httpRequestDuration = new promClient.Histogram({
 *   name: 'http_request_duration_seconds',
 *   help: 'Duration of HTTP requests in seconds',
 *   labelNames: ['method', 'route', 'status'],
 *   buckets: [0.1, 0.5, 1, 2, 5],
 * });
 * 
 * const dbQueryDuration = new promClient.Histogram({
 *   name: 'db_query_duration_seconds',
 *   help: 'Duration of database queries in seconds',
 *   labelNames: ['operation', 'model'],
 *   buckets: [0.01, 0.05, 0.1, 0.5, 1, 2],
 * });
 * 
 * const requestCount = new promClient.Counter({
 *   name: 'requests_total',
 *   help: 'Total number of requests',
 *   labelNames: ['endpoint'],
 * });
 * 
 * register.registerMetric(httpRequestDuration);
 * register.registerMetric(dbQueryDuration);
 * register.registerMetric(requestCount);
 * 
 * // Export metrics endpoint
 * app.get('/metrics', async (req, res) => {
 *   res.set('Content-Type', register.contentType);
 *   res.end(await register.metrics());
 * });
 */

