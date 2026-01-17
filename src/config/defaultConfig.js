// src/config/defaultConfig.js

const fs = require('fs');
const path = require('path');

function isPlainObject(x) {
  return Boolean(x) && typeof x === 'object' && !Array.isArray(x);
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

const baseConfig = {
  prefix: '!',
  language: 'en',
  logChannelName: 'log-bot',

  staffRoles: [
    '1385619241235120177',
    '1385619241235120174',
    '1385619241235120173'
  ],

  notifications: {
    dmOnWarn: true,
    dmOnMute: true
  },

  maxWarnings: 3,
  muteDuration: 10 * 60 * 1000, // 10 min

  trust: {
    enabled: true,

    base: 30,
    min: 0,
    max: 100,

    warnPenalty: 5,
    mutePenalty: 15,

    regenPerDay: 1,
    regenMaxDays: 30,

    lowThreshold: 10,
    highThreshold: 60,

    lowTrustWarningsPenalty: 1,
    lowTrustMessagesPenalty: 1,

    lowTrustMuteMultiplier: 1.5,
    highTrustMuteMultiplier: 0.8
  },

  bannedWords: {
    en: [
      'fuck','shit','bitch','asshole','dick','bastard','slut','whore',
      'fag','cunt','damn','piss','cock','motherfucker','nigger','retard',
      'douche','faggot','prick','whorebag','bollocks','bugger','twat',
      'arse','arsehole','bloody','crap','jerk','shithead','tosser'
    ],
    pt: [
      'merda','porra','caralho','bosta','cacete','foda','piranha','vadia',
      'otário','idiota','burro','imbecil','canalha','palhaço','babaca',
      'desgraçado','filho da puta','corno','viado','retardado','mané',
      'escroto','vagabundo','puta','lixo','nojento','desgraça'
    ]
  },

  cooldowns: {
    default: 3000,
    warn: 5000,
    mute: 5000,
    unmute: 5000,
    clear: 8000
  },

  antiSpam: {
    enabled: true,
    interval: 7000,
    maxMessages: 6,
    muteDuration: 60 * 1000,
    actionCooldown: 60 * 1000,
    bypassAdmins: true,
    bypassRoles: [],
    sendMessage: true,
  
    minLength: 6,
    ignoreAttachments: true,
    similarityThreshold: 0.8,
  
    channels: {
      // 'ID_DO_CANAL_MEMES': {
      //   maxMessages: 10,
      //   interval: 7000,
      //   muteDuration: 30 * 1000
      // }
    }
  },

  dashboard: {
    enabled: true,
    maxLogs: 200,
    maxDbLogs: 1000,
    requireAuth: true
  },

  gameNews: {
    enabled: true,
    interval: 30 * 60 * 1000,
    keepHashes: 10,
    maxAgeDays: 7,
    jitterMs: 20000,
    perFeedJitterMs: 1500,
    retry: {
      attempts: 2,
      baseDelayMs: 1200,
      jitterMs: 800
    },
    backoff: {
      maxFails: 3,
      pauseMs: 30 * 60 * 1000
    },
    sources: [
      {
        name: 'GameSpot/Reviews',
        feed: 'https://www.gamespot.com/feeds/reviews',
        channelId: '1431959790174736446'
      },
      {
        name: 'GameSpot/News',
        feed: 'https://www.gamespot.com/feeds/game-news',
        channelId: '1458675935854465219'
      },
      {
        name: 'GameSpot/NewGames',
        feed: 'https://www.gamespot.com/feeds/new-games',
        channelId: '1460640560778838137'
      }
    ]
  }
}

const overridesPath = path.join(__dirname, 'overrides.json');
let overrides = {};
try {
  if (fs.existsSync(overridesPath)) {
    overrides = JSON.parse(fs.readFileSync(overridesPath, 'utf8')) || {};
  }
} catch (err) {
  console.warn('[Config] Failed to load overrides.json:', err?.message || err);
  overrides = {};
}

deepMerge(baseConfig, overrides);

module.exports = baseConfig;
