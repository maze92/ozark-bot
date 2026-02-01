// src/systems/langService.js
//
// Small helper to centralise how we resolve the effective language for a guild.
// Priority:
//  1) GuildConfig.language (from dashboard) if set to 'pt' or 'en'
//  2) global config.language
//  3) default: 'en'

const config = require('../config/defaultConfig');
const { getGuildConfig } = require('./guildConfigService');

function normaliseLang(code) {
  const v = String(code || '').toLowerCase();
  if (v === 'pt') return 'pt';
  if (v === 'en') return 'en';
  return null;
}

async function getGuildLanguage(guildId) {
  // Fallback to global config if we don't have a guildId
  const globalLang = normaliseLang(config.language) || 'en';
  if (!guildId) return globalLang;

  try {
    const doc = await getGuildConfig(guildId);
    if (doc && doc.language) {
      const cfgLang = normaliseLang(doc.language);
      if (cfgLang) return cfgLang;
    }
  } catch (err) {
    // On any failure, just fallback to global config; we don't want to break commands over language.
  }

  return globalLang;
}

module.exports = { getGuildLanguage };
