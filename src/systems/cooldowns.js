// src/systems/cooldowns.js
// ============================================================
// Cooldowns por comando e utilizador
//
// O que faz:
// - Limita o "spam" de comandos por user
// - Usa valores definidos em config.cooldowns:
//     cooldowns: {
//       default: 3000,
//       warn: 5000,
//       ...
//     }
//
// Retorno:
// - null   -> pode executar o comando
// - "X.X"  -> bloqueado, string com segundos restantes (ex: "2.4")
// ============================================================

const config = require('../config/defaultConfig');

// Estrutura em memória:
// Map<commandName, Map<userId, lastUsedMs>>
const cooldowns = new Map();

/**
 * Lê cooldown do config com defaults e proteções
 * @param {string} commandName
 * @returns {number} cooldown em ms
 */
function getCommandCooldownMs(commandName) {
  // Lê valor bruto do config
  const raw =
    (config.cooldowns && config.cooldowns[commandName]) ??
    (config.cooldowns && config.cooldowns.default) ??
    3000;

  let ms = Number(raw);

  // Se vier algo inválido (NaN, negativo, etc.), usa fallback
  if (!Number.isFinite(ms) || ms < 0) {
    ms = 3000;
  }

  // Limite "saudável" de cooldown (por segurança)
  // Ex: 10 minutos máx. para evitar configs absurdas tipo 99999999
  const MAX_SAFE_COOLDOWN = 10 * 60 * 1000; // 10 min
  if (ms > MAX_SAFE_COOLDOWN) {
    ms = MAX_SAFE_COOLDOWN;
  }

  return ms;
}

/**
 * Verifica cooldown de um comando para um utilizador.
 * @param {string} commandName - Nome do comando (ex: "mute", "warn")
 * @param {string} userId - ID do utilizador
 * @returns {string|null} - null se pode executar, ou string com segundos restantes
 */
module.exports = function checkCooldown(commandName, userId) {
  // Se por algum motivo não tivermos dados básicos, não aplicamos cooldown
  if (!commandName || !userId) return null;

  const now = Date.now();
  const commandCooldown = getCommandCooldownMs(commandName);

  // Se cooldown for 0 → sem limite (útil se um dia quiseres desativar num comando específico)
  if (commandCooldown <= 0) {
    return null;
  }

  // Garante o Map para este comando
  if (!cooldowns.has(commandName)) {
    cooldowns.set(commandName, new Map());
  }

  const timestamps = cooldowns.get(commandName);

  // Já existe registo para este user?
  if (timestamps.has(userId)) {
    const lastUsed = timestamps.get(userId);
    const expiration = lastUsed + commandCooldown;

    if (now < expiration) {
      const remainingSeconds = ((expiration - now) / 1000).toFixed(1);
      return remainingSeconds; // bloqueado
    }
  }

  // Marca o uso agora
  timestamps.set(userId, now);

  // Limpa automaticamente depois do cooldown acabar
  setTimeout(() => {
    const map = cooldowns.get(commandName);
    if (!map) return;
    map.delete(userId);
    // opcional: se o comando ficar sem users, podíamos limpar o comando também
    // if (map.size === 0) cooldowns.delete(commandName);
  }, commandCooldown).unref?.();

  return null; // pode executar
};
