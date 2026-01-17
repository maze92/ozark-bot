// src/systems/i18n.js

const config = require('../config/defaultConfig');
const messages = require('../config/messages');

function getLang(explicitLang) {
  const lang = (explicitLang || config.language || 'en').toLowerCase();
  return messages[lang] ? lang : 'en';
}

function t(path, lang, vars) {
  const useLang = getLang(lang);
  const fallbackLang = 'en';

  const read = (obj, p) => p.split('.').reduce((acc, k) => (acc ? acc[k] : undefined), obj);

  let value = read(messages[useLang], path);
  if (value === undefined) value = read(messages[fallbackLang], path);

  if (typeof value === 'function') return value(vars);
  if (typeof value === 'string') return value;

  // fallback seguro
  return path;
}

module.exports = { t, getLang };
