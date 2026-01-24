const Ticket = require('../database/models/Ticket');
const { t } = require('../systems/i18n');
const { isStaff } = require('../utils/staff');

module.exports = async (client, interaction) => {
  try {
    if (!interaction || !interaction.guild || !interaction.channel) return;

    const guild = interaction.guild;
    const member = interaction.member;
    const channel = interaction.channel;

    const ticket = await Ticket.findOne({ guildId: guild.id, channelId: channel.id }).lean();
    if (!ticket) {
      return interaction.reply({
        content: t('tickets.notFound', '❌ Não foi encontrado nenhum ticket associado a este canal.'),
        flags: 64
      }).catch(() => null);
    }

    const isTicketOwner = ticket.userId === member.id || ticket.createdById === member.id;
    const staff = await isStaff(guild, member).catch(() => false);

    if (!staff && !isTicketOwner) {
      return interaction.reply({
        content: t('tickets.noPermissionClose', '❌ Apenas staff ou o autor do ticket podem fechá-lo.'),
        flags: 64
      }).catch(() => null);
    }

    if (ticket.status === 'CLOSED') {
      return interaction.reply({
        content: t('tickets.alreadyClosed', 'Este ticket já se encontra fechado.'),
        flags: 64
      }).catch(() => null);
    }

    await interaction.reply({
      content: t('tickets.closedByCommandEphemeral', '✅ Ticket fechado. Obrigado por entrares em contacto!'),
      flags: 64
    }).catch(() => null);

    (async () => {
      try {
        await Ticket.updateOne(
          { _id: ticket._id },
          { $set: { status: 'CLOSED', closedById: member.id, closedAt: new Date() } }
        ).catch(() => null);

        try {
          const userId = ticket.userId;
          if (userId) {
            const targetMember =
              guild.members.cache.get(userId) ||
              await guild.members.fetch(userId).catch(() => null);
            if (targetMember) {
              await channel.permissionOverwrites.edit(targetMember, { SendMessages: false }).catch(() => null);
            }
          }
        } catch (err) {
          console.warn('[slash/ticketclose] Failed to update overwrites:', err?.message || err);
        }

        try {
          const currentName = channel.name || '';
          const baseName = currentName
            .replace(/^closed-/, '')
            .replace(/^ticket-/, '');
          const newName = `closed-ticket-${baseName}`.slice(0, 95);
          await channel.setName(newName).catch(() => null);
        } catch (err) {
          console.warn('[slash/ticketclose] Failed to rename ticket channel:', err?.message || err);
        }

        try {
          await channel.send(
            t('tickets.closedByCommand', '✅ Ticket fechado. Obrigado por entrares em contacto!')
          ).catch(() => null);
        } catch {
        }
      } catch (err) {
        console.error('[slash/ticketclose] Error after reply:', err);
      }
    })();

  } catch (err) {
    console.error('[slash/ticketclose] Error:', err);
    try {
      const msg = t('common.unexpectedError', 'Ocorreu um erro inesperado.');
      if (interaction && (interaction.replied || interaction.deferred)) {
        await interaction.followUp({ content: msg, flags: 64 });
      } else if (interaction) {
        await interaction.reply({ content: msg, flags: 64 });
      }
    } catch {
    }
  }
};
