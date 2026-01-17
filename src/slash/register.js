// src/slash/register.js

const { REST, Routes } = require('discord.js');
const config = require('../config/defaultConfig');
const commands = require('./commands');

module.exports = async function registerSlashCommands(client) {
  if (!config.slash?.enabled) return;
  if (!config.slash?.registerOnStartup) return;
  if (!client?.user?.id) return;

  const token = process.env.DISCORD_TOKEN || process.env.TOKEN;
  if (!token) {
    console.error('[slash] Missing DISCORD_TOKEN / TOKEN env var');
    return;
  }

  const rest = new REST({ version: '10' }).setToken(token);

  try {
    const guildId = config.slash.guildId?.trim();

    if (guildId) {
      await rest.put(Routes.applicationGuildCommands(client.user.id, guildId), {
        body: commands
      });
      console.log(`✅ [slash] Registered guild slash commands for guild ${guildId}`);
    } else {
      await rest.put(Routes.applicationCommands(client.user.id), { body: commands });
      console.log('✅ [slash] Registered GLOBAL slash commands (may take time to propagate)');
    }
  } catch (err) {
    console.error('[slash] Failed to register slash commands:', err);
  }
};
