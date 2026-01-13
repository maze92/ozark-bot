const { EmbedBuilder, ChannelType } = require('discord.js');
const config = require('../config/defaultConfig');

/**
 * Logger centralizado para enviar logs no canal de moderação
 * @param {Client} client - Cliente Discord
 * @param {string} title - Título do log
 * @param {User|null} user - Usuário afetado (ex: punido, warned)
 * @param {User|null} executor - Quem realizou a ação (pode ser o mesmo do usuário)
 * @param {string} description - Descrição adicional do log
 * @param {Guild} [guild] - Guilda onde o log será enviado (opcional)
 */
module.exports = async function logger(client, title, user, executor, description, guild) {
  try {
    // Tenta usar a guilda passada ou pega do usuário
    guild = guild || user?.guild;
    if (!guild) return; // Se não houver guilda, não envia log

    // Nome do canal de logs configurável
    const logChannelName = config.logChannelName || 'log-bot';

    // Procura o canal de texto na guilda
    const logChannel = guild.channels.cache.find(
      ch => ch.name === logChannelName && ch.isTextBased()
    );

    if (!logChannel) {
      console.warn(`[Logger] Canal de logs não encontrado: ${logChannelName}`);
      return;
    }

    // Monta a descrição do embed
    let desc = '';
    if (user) desc += `👤 **Usuário:** ${user.tag}\n`;
    if (executor) desc += `🛠️ **Executor:** ${executor.tag}\n`;
    if (description) desc += `${description}`;

    // Cria o embed
    const embed = new EmbedBuilder()
      .setTitle(title)
      .setColor('Blue')
      .setDescription(desc)
      .setTimestamp();

    // Envia a mensagem no canal
    await logChannel.send({ embeds: [embed] });
  } catch (err) {
    console.error('[Logger] Erro ao enviar log:', err);
  }
};

