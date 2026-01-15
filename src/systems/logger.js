// src/systems/logger.js
// ============================================================
// Logger centralizado
// Faz:
// - Envia logs para o canal "log-bot" (ou nome definido no config)
// - Envia logs em tempo real para o Dashboard via Socket.IO
//
// Notas importantes:
// - "User" (discord.js) NÃO tem .guild
// - "GuildMember" (member) TEM .guild
// - Por isso, este logger aceita User OU GuildMember e normaliza tudo
// ============================================================

const { EmbedBuilder } = require('discord.js');
const config = require('../config/defaultConfig');
const dashboard = require('../dashboard');

/**
 * Normaliza "actor" para um formato seguro:
 * - User -> { id, tag }
 * - GuildMember -> { id, tag }
 * - null -> null
 */
function normalizeActor(actor) {
  if (!actor) return null;

  // Se for GuildMember, o "user" está em actor.user
  const u = actor.user ?? actor;

  if (!u?.id) return null;

  return {
    id: u.id,
    tag: u.tag || `${u.username ?? 'Unknown'}#0000`
  };
}

/**
 * Resolve a guild com segurança:
 * - Usa a guild passada por argumento
 * - Se não existir, tenta obter de "user" ou "executor" se forem GuildMember
 */
function resolveGuild(guild, user, executor) {
  return guild || user?.guild || executor?.guild || null;
}

/**
 * Logger centralizado
 * @param {Client} client - Instância do Discord Client
 * @param {string} title - Título do log (ex: "Automatic Warn", "Game News")
 * @param {User|GuildMember|null} user - Utilizador afetado (User ou Member)
 * @param {User|GuildMember|null} executor - Quem executou (User ou Member)
 * @param {string} description - Texto adicional
 * @param {Guild|null} guild - Guild onde enviar o log (recomendado passar SEMPRE)
 */
module.exports = async function logger(client, title, user, executor, description, guild) {
  try {
    // ------------------------------------------------------------
    // 1) Resolver a guild (onde vamos enviar o log)
    // ------------------------------------------------------------
    const resolvedGuild = resolveGuild(guild, user, executor);
    if (!resolvedGuild) return;

    // ------------------------------------------------------------
    // 2) Canal de logs (por nome)
    // ------------------------------------------------------------
    const logChannelName = config.logChannelName || 'log-bot';

    // Procura no cache
    const logChannel =
      resolvedGuild.channels?.cache?.find((ch) => ch?.name === logChannelName) || null;

    // ------------------------------------------------------------
    // 3) Normalizar dados para evitar crashes
    // ------------------------------------------------------------
    const nUser = normalizeActor(user);
    const nExec = normalizeActor(executor);

    // ------------------------------------------------------------
    // 4) Montar embed para Discord
    // ------------------------------------------------------------
    let desc = '';
    if (nUser?.tag) desc += `👤 **User:** ${nUser.tag}\n`;
    if (nExec?.tag) desc += `🛠️ **Executor:** ${nExec.tag}\n`;
    if (description) desc += `${description}`;

    const embed = new EmbedBuilder()
      .setTitle(title || 'Log')
      .setColor(0x3498db) // azul (hex) - estável
      .setDescription(desc || 'No description provided.')
      .setTimestamp(new Date());

    // ------------------------------------------------------------
    // 5) Enviar para o Discord (se canal existir)
    // ------------------------------------------------------------
    if (logChannel) {
      await logChannel.send({ embeds: [embed] }).catch(() => null);
    }

    // ------------------------------------------------------------
    // 6) Enviar para o Dashboard (tempo real)
    // - O dashboard espera sendToDashboard('log', data)
    // - Mantemos "time" em ISO para o teu HTML fazer new Date(log.time)
    // ------------------------------------------------------------
    try {
      if (dashboard?.sendToDashboard) {
        dashboard.sendToDashboard('log', {
          title: title || 'Log',
          user: nUser,
          executor: nExec,
          description: description || '',
          guild: {
            id: resolvedGuild.id,
            name: resolvedGuild.name
          },
          time: new Date().toISOString()
        });
      }
    } catch (e) {
      // Não deixamos o logger falhar por causa do dashboard
      console.error('[Logger] Dashboard send failed:', e?.message || e);
    }
  } catch (err) {
    console.error('[Logger] Error:', err);
  }
};
