const winston = require('winston');

const { combine, timestamp, printf, colorize, json, errors } = winston.format;
const LOG_LEVEL = process.env.LOG_LEVEL || (process.env.NODE_ENV === 'production' ? 'info' : 'debug');

const devFormat = combine(
    colorize(),
    timestamp({ format: 'HH:mm:ss.SSS' }),
    errors({ stack: true }),
    printf(({ level, message, timestamp, requestId, ...meta }) => {
        const reqId = requestId ? ` [${requestId.substring(0, 8)}]` : '';
        const metaStr = Object.keys(meta).length > 0 && !meta.stack
            ? ` ${JSON.stringify(meta)}`
            : '';
        const stack = meta.stack ? `\n${meta.stack}` : '';
        return `${timestamp} ${level}${reqId}: ${message}${metaStr}${stack}`;
    })
);

const prodFormat = combine(
    timestamp({ format: 'ISO' }),
    errors({ stack: true }),
    json()
);

const logger = winston.createLogger({
    level: LOG_LEVEL,
    defaultMeta: { service: 'shopyos-backend' },
    format: process.env.NODE_ENV === 'production' ? prodFormat : devFormat,
    transports: [
        new winston.transports.Console({
            handleExceptions: false,
            handleRejections: false
        })
    ],
    exitOnError: false
});

logger.withContext = (context) => logger.child(context);

const httpLogMiddleware = (req, res, next) => {
    const start = Date.now();
    const originalEnd = res.end;

    res.end = function (chunk, encoding) {
        res.end = originalEnd;
        res.end(chunk, encoding);

        const duration = Date.now() - start;
        const logData = {
            method: req.method,
            url: req.originalUrl || req.url,
            status: res.statusCode,
            duration: `${duration}ms`,
            contentLength: res.get('content-length') || 0,
            requestId: req.requestId,
            ip: req.ip
        };

        if (res.statusCode >= 500) {
            logger.error('HTTP Request', logData);
        } else if (res.statusCode >= 400) {
            logger.warn('HTTP Request', logData);
        } else if (duration > 1000) {
            logger.warn('SLOW Request', logData);
        } else {
            logger.http('HTTP Request', logData);
        }
    };

    next();
};

module.exports = { logger, httpLogMiddleware };
