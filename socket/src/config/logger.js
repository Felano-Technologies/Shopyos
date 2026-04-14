const log = (level, message, meta = {}) => {
  const payload = {
    level,
    message,
    timestamp: new Date().toISOString(),
    service: 'shopyos-socket',
    ...meta,
  };

  if (level === 'error' || level === 'warn') {
    console.error(JSON.stringify(payload));
  } else {
    console.log(JSON.stringify(payload));
  }
};

module.exports = {
  info: (message, meta) => log('info', message, meta),
  debug: (message, meta) => log('debug', message, meta),
  warn: (message, meta) => log('warn', message, meta),
  error: (message, meta) => log('error', message, meta),
};
