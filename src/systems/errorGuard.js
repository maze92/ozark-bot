module.exports = () => {
  process.on('unhandledRejection', err => {
    console.error('[UNHANDLED REJECTION]', err);
  });

  process.on('uncaughtException', err => {
    console.error('[UNCAUGHT EXCEPTION]', err);
  });

  process.on('warning', warning => {
    console.warn('[NODE WARNING]', warning.name, warning.message);
  });
};
