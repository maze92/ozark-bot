// src/systems/configManager.js

const fs = require('fs');
const path = require('path');
const config = require('../config/defaultConfig');

const OVERRIDES_PATH = path.join(__dirname, '../config/overrides.json');

// Only these keys can be changed via Dashboard (safety).
const ALLOWED = {
  language: 'string',
  maxWarnings: 'number',
  muteDuration: 'number',
  trust: {
    enabled: 'boolean',
    base: 'number',
    min: 'number',
    max: 'number',
    warnPenalty: 'number',
    mutePenalty: 'number',
    regenPerDay: 'number',
    regenMaxDays: 'number',
    lowThreshold: 'number',
    highThreshold: 'number',
    lowTrustWarningsPenalty: 'number',
    lowTrustMessagesPenalty: 'number',
    lowTrustMuteMultiplier: 'number',
    highTrustMuteMultiplier: 'number'
  },
  antiSpam: {
    enabled: 'boolean',
    interval: 'number',
    maxMessages: 'number',
    muteDuration: 'number',
    actionCooldown: 'number',
    bypassAdmins: 'boolean',
    sendMessage: 'boolean',
    minLength: 'number',
    ignoreAttachments: 'boolean',
    similarityThreshold: 'number'
  },
  bannedWords: {
    en: 'stringArray',
    pt: 'stringArray'
  },
  gameNews: {
    enabled: 'boolean',
    interval: 'number',
    keepHashes: 'number',
    maxAgeDays: 'number'
  }
};

function isPlainObject(x) {
  return Boolean(x) && typeof x === 'object' && !Array.isArray(x);
}

function cloneDeep(obj) {
  return JSON.parse(JSON.stringify(obj));
}

function normalizeStringArray(arr) {
  if (!Array.isArray(arr)) return [];
  return arr
    .map((x) => String(x || '').trim())
    .filter(Boolean)
    .slice(0, 500);
}

function validateAndPick(patch, schema, pathPrefix = '') {
  const out = {};
  if (!isPlainObject(patch)) return out;

  for (const [key, type] of Object.entries(schema)) {
    const fullPath = pathPrefix ? `${pathPrefix}.${key}` : key;
    const v = patch[key];

    if (isPlainObject(type)) {
      if (isPlainObject(v)) {
        const nested = validateAndPick(v, type, fullPath);
        if (Object.keys(nested).length) out[key] = nested;
      }
      continue;
    }

    if (type === 'string') {
      if (typeof v === 'string' && v.trim().length) out[key] = v.trim();
      continue;
    }

    if (type === 'boolean') {
      if (typeof v === 'boolean') out[key] = v;
      continue;
    }

    if (type === 'number') {
      const n = Number(v);
      if (Number.isFinite(n)) out[key] = n;
      continue;
    }

    if (type === 'stringArray') {
      out[key] = normalizeStringArray(v);
      continue;
    }
  }

  return out;
}

function deepMerge(target, source) {
  if (!isPlainObject(target) || !isPlainObject(source)) return target;

  for (const [key, value] of Object.entries(source)) {
    if (isPlainObject(value)) {
      if (!isPlainObject(target[key])) target[key] = {};
      deepMerge(target[key], value);
    } else {
      target[key] = value;
    }
  }
  return target;
}

function readOverrides() {
  try {
    if (!fs.existsSync(OVERRIDES_PATH)) return {};
    const raw = fs.readFileSync(OVERRIDES_PATH, 'utf8');
    const json = JSON.parse(raw);
    return isPlainObject(json) ? json : {};
  } catch {
    return {};
  }
}

function writeOverrides(data) {
  const dir = path.dirname(OVERRIDES_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  fs.writeFileSync(OVERRIDES_PATH, JSON.stringify(data, null, 2), 'utf8');
}

function getPublicConfig() {
  // Only return allowed keys (avoid exposing tokens/ids).
  const picked = {
    language: config.language,
    maxWarnings: config.maxWarnings,
    muteDuration: config.muteDuration,
    trust: cloneDeep(config.trust || {}),
    antiSpam: cloneDeep(config.antiSpam || {}),
    bannedWords: cloneDeep(config.bannedWords || {}),
    gameNews: cloneDeep(config.gameNews || {})
  };

  // trim non-editable nested keys from antiSpam/gameNews
  const allowedPatch = validateAndPick(picked, ALLOWED);
  return allowedPatch;
}

function updateConfig(patch) {
  const safePatch = validateAndPick(patch, ALLOWED);
  if (!Object.keys(safePatch).length) {
    return { ok: false, error: 'No valid fields in patch.' };
  }

  const existing = readOverrides();
  const next = deepMerge(existing, safePatch);

  // Persist
  try {
    writeOverrides(next);
  } catch (err) {
    return { ok: false, error: 'Failed to write overrides.json.' };
  }

  // Apply in-memory immediately
  deepMerge(config, safePatch);

  return { ok: true, applied: safePatch };
}

module.exports = {
  getPublicConfig,
  updateConfig
};
