// src/slash/commands.js

const { SlashCommandBuilder } = require('discord.js');

module.exports = function buildSlashCommands(prefix) {
  const p = prefix || '!';

  const warn = new SlashCommandBuilder()
    .setName('warn')
    .setDescription('Warn a member and register an infraction')
    .setDescriptionLocalizations({
      'pt-PT': 'Aplicar um aviso a um membro e registar uma infração',
    })
    .addUserOption((opt) =>
      opt
        .setName('user')
        .setDescription('User to warn')
        .setDescriptionLocalizations({
          'pt-PT': 'Utilizador a avisar',
        })
        .setRequired(true)
    )
    .addStringOption((opt) =>
      opt
        .setName('reason')
        .setDescription('Reason')
        .setDescriptionLocalizations({
          'pt-PT': 'Motivo',
        })
        .setRequired(false)
    );

  const mute = new SlashCommandBuilder()
    .setName('mute')
    .setDescription('Temporarily mute a member')
    .setDescriptionLocalizations({
      'pt-PT': 'Silenciar temporariamente um membro',
    })
    .addUserOption((opt) =>
      opt
        .setName('user')
        .setDescription('User to mute')
        .setDescriptionLocalizations({
          'pt-PT': 'Utilizador a silenciar',
        })
        .setRequired(true)
    )
    .addStringOption((opt) =>
      opt
        .setName('duration')
        .setDescription('Duration (e.g. 10m, 1h, 1d)')
        .setDescriptionLocalizations({
          'pt-PT': 'Duração (ex.: 10m, 1h, 1d)',
        })
        .setRequired(true)
    )
    .addStringOption((opt) =>
      opt
        .setName('reason')
        .setDescription('Reason')
        .setDescriptionLocalizations({
          'pt-PT': 'Motivo',
        })
        .setRequired(false)
    );

  const unmute = new SlashCommandBuilder()
    .setName('unmute')
    .setDescription('Remove an active mute from a member')
    .setDescriptionLocalizations({
      'pt-PT': 'Remover um mute ativo de um membro',
    })
    .addUserOption((opt) =>
      opt
        .setName('user')
        .setDescription('User to unmute')
        .setDescriptionLocalizations({
          'pt-PT': 'Utilizador a desmutar',
        })
        .setRequired(true)
    );

  const clear = new SlashCommandBuilder()
    .setName('clear')
    .setDescription('Bulk delete a number of recent messages in this channel')
    .setDescriptionLocalizations({
      'pt-PT': 'Apagar em massa um número de mensagens recentes neste canal',
    })
    .addIntegerOption((opt) =>
      opt
        .setName('amount')
        .setDescription('Number of messages to delete (max 100)')
        .setDescriptionLocalizations({
          'pt-PT': 'Número de mensagens a apagar (máx. 100)',
        })
        .setRequired(true)
    );

  const userinfo = new SlashCommandBuilder()
    .setName('userinfo')
    .setDescription('Show basic information about a member')
    .setDescriptionLocalizations({
      'pt-PT': 'Mostrar informação básica sobre um membro',
    })
    .addUserOption((opt) =>
      opt
        .setName('user')
        .setDescription('User to inspect')
        .setDescriptionLocalizations({
          'pt-PT': 'Utilizador a inspecionar',
        })
        .setRequired(false)
    );

  const history = new SlashCommandBuilder()
    .setName('history')
    .setDescription('Show moderation history for a member')
    .setDescriptionLocalizations({
      'pt-PT': 'Mostrar histórico de moderação de um membro',
    })
    .addUserOption((opt) =>
      opt
        .setName('user')
        .setDescription('User to inspect')
        .setDescriptionLocalizations({
          'pt-PT': 'Utilizador a inspecionar',
        })
        .setRequired(true)
    );

  const help = new SlashCommandBuilder()
    .setName('help')
    .setDescription('Show help and a summary of available commands')
    .setDescriptionLocalizations({
      'pt-PT': 'Mostrar ajuda e um resumo dos comandos disponíveis',
    });

  return [warn, mute, unmute, clear, userinfo, history, help].map((c) => c.toJSON());
};
