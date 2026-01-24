// src/slash/ticketclose.js

const Ticket = require('../database/models/Ticket');
const { t } = require('../systems/i18n');
const { isStaff } = require('../utils/staff');

module.exports = async (client, interaction) => {
  try {
    if (!interaction?.guild) return;

    const guild = interaction.guild;
    const member = interaction.member;
    const channel = interaction.channel;

    if (!channel || !channel.isTextBased?.()) {
      return interaction.reply({
        content: t('tickets.notATicketChannel', 'Este comando só pode ser usado dentro de um canal de ticket.'),
        flags: 64
      }).catch(() => null);
    }

    // Procurar ticket por guild + canal (OPEN, reaberto, etc.)
    const ticket = await Ticket.findOne({ guildId: guild.id, channelId: channel.id }).lean();
    if (!ticket) {
      return interaction.reply({
        content: t('tickets.notFound', 'Nenhum ticket encontrado para este canal.'),
        flags: 64
      }).catch(() => null);
    }

    // Verificar permissões: staff ou autor do ticket
    let isStaffMember = false;
    try {
      isStaffMember = await isStaff(member);
    } catch {
      isStaffMember = false;
    }

    const isOwner = ticket.userId === member.id || ticket.createdById === member.id;

    if (!isStaffMember && !isOwner) {
      return interaction.reply({
        content: t('tickets.noPermissionClose', 'Apenas a equipa de staff ou o autor do ticket pode fechá-lo.'),
        flags: 64
      }).catch(() => null);
    }

    if (ticket.status === 'CLOSED') {
      return interaction.reply({
        content: t('tickets.alreadyClosed', 'Este ticket já se encontra fechado.'),
        flags: 64
      }).catch(() => null);
    }

    // Atualizar documento do ticket
    try {
      await Ticket.updateOne(
        { _id: ticket._id },
        {
          $set: {
            status: 'CLOSED',
            closedById: member.id,
            closedAt: new Date()
          }
        }
      );
    } catch (err) {
      console.error('[slash/ticketclose] Failed to update ticket doc:', err);
    }

    // Tentar bloquear mensagens do utilizador no canal
    try {
      const userId = ticket.userId;
      if (userId) {
        const targetMember =
          guild.members.cache.get(userId) ||
          await guild.members.fetch(userId).catch(() => null);

        if (targetMember) {
          await channel.permissionOverwrites
            .edit(targetMember, { SendMessages: false })
            .catch(() => null);
        }
      }
    } catch (err) {
      console.warn('[slash/ticketclose] Failed to update channel overwrites on close:', err?.message || err);
    }

    // Tentar renomear o canal para closed-ticket-username
    try {
      const currentName = channel.name || '';
      const baseName = currentName
        .replace(/^closed-/, '')
        .replace(/^ticket-/, '');

      const newName = `closed-ticket-${baseName}`.slice(0, 95);
      await channel.setName(newName).catch(() => null);
    } catch (err) {
      console.warn('[slash/ticketclose] Failed to rename ticket channel on close:', err?.message || err);
    }

    // Mensagem no canal do ticket
    try {
      await channel.send(
        t(
          'tickets.closedByCommand',
          '✅ Ticket fechado. Obrigado por entrares em contacto!'
        )
      ).catch(() => null);
    } catch {
      // não é crítico
    }

    // Confirmação ephemera para quem executou o comando
    return interaction.reply({
      content: t(
        'tickets.closedByCommandEphemeral',
        '✅ Ticket fechado. Obrigado por entrares em contacto!'
      ),
      flags: 64
    }).catch(() => null);
  } catch (err) {
    console.error('[slash/ticketclose] Error:', err);
    try {
      const payload = {
        content: t('common.unexpectedError', 'Ocorreu um erro inesperado ao fechar o ticket.'),
        flags: 64
      };
      if (interaction.replied || interaction.deferred) {
        await interaction.followUp(payload);
      } else {
        await interaction.reply(payload);
      }
    } catch {
      // ignore qualquer erro adicional
    }
  }
};
