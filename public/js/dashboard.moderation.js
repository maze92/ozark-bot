  // Moderation tab: Logs
  // ==========================================

  async function loadLogs() {
    const listEl = document.getElementById('logsList');
    const searchInput = document.getElementById('logSearch');
    const typeSelect = document.getElementById('logType');
    if (!listEl || !typeSelect) return;

    listEl.innerHTML = '';

    if (!state.guildId) {
      const empty = document.createElement('div');
      empty.className = 'empty';
      empty.textContent = t('warn_select_guild');
      listEl.appendChild(empty);
      return;
    }

    const loading = document.createElement('div');
    loading.className = 'empty';
    loading.textContent = t('logs_loading');
    listEl.appendChild(loading);

    try {
      const params = [];
      params.push('guildId=' + encodeURIComponent(state.guildId));
      params.push('limit=50');
      params.push('page=1');

      if (searchInput && searchInput.value) {
        const s = searchInput.value.toString().trim();
        if (s) params.push('search=' + encodeURIComponent(s));
      }

      const typeValue = (typeSelect.value || '').trim();
      if (typeValue) {
        params.push('type=' + encodeURIComponent(typeValue));
      }

      const url = '/logs?' + params.join('&');
      const res = await apiGet(url);

      listEl.innerHTML = '';

      const items = (res && res.items) || [];
      renderLogs(items);
    } catch (err) {
      console.error('Failed to load logs', err);
      listEl.innerHTML = '';
      const empty = document.createElement('div');
      empty.className = 'empty';
      empty.textContent = t('logs_error_generic');
      listEl.appendChild(empty);
    }
  }

  // -----------------------------
  // Cases (infractions history)
  // -----------------------------

  // ==========================================
  // Moderation tab: Cases
  // ==========================================

  async function loadCases() {
    const section = document.getElementById('tab-cases');
    if (!section) return;

    const listEl = section.querySelector('.list');
    if (!listEl) return;

    listEl.innerHTML = '';

    if (!state.guildId) {
      const div = document.createElement('div');
      div.className = 'empty';
      div.textContent = t('cases_empty');
      listEl.appendChild(div);
      return;
    }

    const loading = document.createElement('div');
    loading.className = 'empty';
    loading.textContent = '...';
    listEl.appendChild(loading);

    try {
      const res = await apiGet('/cases?guildId=' + encodeURIComponent(state.guildId) + '&limit=25&page=1');
      const items = (res && res.items) || [];
      listEl.innerHTML = '';

      if (!items.length) {
        const div = document.createElement('div');
        div.className = 'empty';
        div.textContent = t('cases_empty');
        listEl.appendChild(div);
        return;
      }

      items.forEach(function (c) {
        const row = createCaseRow(c);
        listEl.appendChild(row);
      });
    } catch (err) {
      console.error('Failed to load cases', err);
      listEl.innerHTML = '';
      const div = document.createElement('div');
      div.className = 'empty';
      div.textContent = t('cases_error_generic');
      listEl.appendChild(div);
    }
  }

// -----------------------------
  // Tickets
  // -----------------------------

  function renderTickets(items) {
    const listEl = document.getElementById('ticketsList');
    if (!listEl) return;
    listEl.innerHTML = '';

    if (!items || !items.length) {
      const empty = document.createElement('div');
      empty.className = 'empty';
      empty.textContent = t('tickets_empty');
      listEl.appendChild(empty);
      return;
    }

    items.forEach(function (tkt) {
      const row = document.createElement('div');
      row.className = 'list-item';
      row.dataset.ticketId = String(tkt._id || tkt.id);

      const created = tkt.createdAt ? new Date(tkt.createdAt).toLocaleString() : '—';
      const status = tkt.status || 'OPEN';

      // Se tivermos informação da última resposta, usamos para um rótulo mais amigável
      let statusLabel = status;
      if (status === 'CLOSED') {
        statusLabel = t('tickets_status_closed') || 'CLOSED';
      } else if (tkt.reopenedAt) {
        statusLabel = t('tickets_status_reopened') || 'Reaberto';
      } else if (tkt.lastResponderName) {
        statusLabel = t('tickets_status_answered') || 'Respondido';
      } else {
        statusLabel = t('tickets_status_open') || 'OPEN';
      }

      let actionsHtml = '';

      if (status !== 'CLOSED') {
        actionsHtml += '  <button type="button" class="btn btn-small btn-ticket-reply">Responder</button>';
        actionsHtml += '  <button type="button" class="btn btn-small btn-ticket-close">Fechar</button>';
      } else {
        actionsHtml += '  <button type="button" class="btn btn-small btn-ticket-reopen">Reabrir</button>';
        actionsHtml += '  <button type="button" class="btn btn-small btn-ticket-delete">Apagar</button>';
      }

      // Texto da última resposta, se existir
      let lastResponderHtml = '';
      if (tkt.lastResponderName) {
        lastResponderHtml =
          '<div class="subtitle small">' +
          escapeHtml(t('tickets_last_reply') || 'Última resposta:') +
          ' ' +
          escapeHtml(tkt.lastResponderName) +
          '</div>';
      }

      row.innerHTML =
        '<div class="title">#' +
        escapeHtml(String(tkt._id || '').slice(-6)) +
        ' • ' +
        escapeHtml(tkt.subject || tkt.topic || 'Ticket') +
        '</div>' +
        '<div class="subtitle">' +
        escapeHtml(tkt.userTag || tkt.userId || '') +
        ' • ' +
        escapeHtml(statusLabel) +
        ' • ' +
        escapeHtml(created) +
        '</div>' +
        lastResponderHtml +
        '<div class="actions" style="margin-top:6px; display:flex; gap:6px; flex-wrap:wrap;">' +
        actionsHtml +
        '</div>';

      listEl.appendChild(row);
    });
  }

  async function loadTickets() {
    const listEl = document.getElementById('ticketsList');
    if (!listEl) return;

    listEl.innerHTML = '';

    if (!state.guildId) {
      const empty = document.createElement('div');
      empty.className = 'empty';
      empty.textContent = t('warn_select_guild');
      listEl.appendChild(empty);
      return;
    }

    const loading = document.createElement('div');
    loading.className = 'empty';
    loading.textContent = t('tickets_loading');
    listEl.appendChild(loading);

    try {
      const res = await apiGet('/tickets?guildId=' + encodeURIComponent(state.guildId));
      renderTickets((res && res.items) || []);
    } catch (err) {
      console.error('Failed to load tickets', err);
      listEl.innerHTML = '';
      const empty = document.createElement('div');
      empty.className = 'empty';
      empty.textContent = t('tickets_error_generic');
      listEl.appendChild(empty);
    }
  }

  async function closeTicket(ticketId) {
    if (!state.guildId) return;
    const confirmMsg = t('tickets_close_confirm');
    const ok = window.confirm(confirmMsg);
    if (!ok) return;

    try {
      await apiPost('/tickets/' + encodeURIComponent(ticketId) + '/close', {
        guildId: state.guildId,
      });
      toast(t('tickets_close_success'));
      await loadTickets();
    } catch (err) {
      console.error('Failed to close ticket', err);
      toast(t('tickets_error_action'));
    }
  }


  async function reopenTicket(ticketId) {
    if (!state.guildId) return;
    const confirmMsg = t('tickets_reopen_confirm') || 'Tens a certeza que queres reabrir este ticket?';
    const ok = window.confirm(confirmMsg);
    if (!ok) return;

    try {
      await apiPost('/tickets/' + encodeURIComponent(ticketId) + '/reopen', {
        guildId: state.guildId,
      });
      toast(t('tickets_reopen_success') || 'Ticket reaberto com sucesso.');
      await loadTickets();
    } catch (err) {
      console.error('Failed to reopen ticket', err);
      toast(t('tickets_error_action'));
    }
  }

    async function replyTicket(ticketId) {
    if (!state.guildId) return;
    const placeholder = t('tickets_reply_placeholder');
    const content = window.prompt(placeholder, '');
    if (!content) return;

    try {
      await apiPost('/tickets/' + encodeURIComponent(ticketId) + '/reply', {
        guildId: state.guildId,
        content: content,
      });
      toast(t('tickets_reply_success'));
      await loadTickets();
    } catch (err) {
      console.error('Failed to reply ticket', err);
      toast(t('tickets_error_action'));
    }
  }

  async function deleteTicket(ticketId) {
    if (!state.guildId) return;
    const confirmMsg = t('tickets_delete_confirm') || 'Tens a certeza que queres apagar este ticket?';
    const ok = window.confirm(confirmMsg);
    if (!ok) return;

    try {
      await apiPost('/tickets/' + encodeURIComponent(ticketId) + '/delete', {
        guildId: state.guildId
      });
      toast(t('tickets_delete_success') || 'Ticket apagado com sucesso.');
      await loadTickets();
    } catch (err) {
      console.error('Failed to delete ticket', err);
      toast(t('tickets_error_action'));
    }
  }

// -----------------------------
  // Guild Config
  // -----------------------------

  async function loadGuildConfig() {
    if (!state.guildId) {
      updateTabAccess();
      return;
    }

    const statusEl = document.getElementById('configStatus');
    if (statusEl) {
      statusEl.textContent = t('config_loading');
    }

    try {
      const meta = await apiGet('/guilds/' + encodeURIComponent(state.guildId) + '/meta');
      const cfg = await apiGet('/guilds/' + encodeURIComponent(state.guildId) + '/config');

      const channels = (meta && meta.channels) || [];
      const roles = (meta && meta.roles) || [];
      const conf = cfg && cfg.config ? cfg.config : {};

      const logSelect = document.getElementById('configLogChannel');
      const dashLogSelect = document.getElementById('configDashboardLogChannel');
      const ticketSelect = document.getElementById('configTicketChannel');
      const staffSelect = document.getElementById('configStaffRoles');

      if (logSelect) {
        logSelect.innerHTML = '';
        const optNone = document.createElement('option');
        optNone.value = '';
        optNone.textContent = state.lang === 'en' ? '— None —' : '— Nenhum —';
        logSelect.appendChild(optNone);

        channels.forEach(function (ch) {
          const opt = document.createElement('option');
          opt.value = ch.id;
          opt.textContent = '#' + ch.name + ' (' + ch.id + ')';
          if (conf.logChannelId && conf.logChannelId === ch.id) opt.selected = true;
          logSelect.appendChild(opt);
        });
      }

      if (dashLogSelect) {
        dashLogSelect.innerHTML = '';
        const optNone2 = document.createElement('option');
        optNone2.value = '';
        optNone2.textContent = state.lang === 'en' ? '— None —' : '— Nenhum —';
        dashLogSelect.appendChild(optNone2);

        channels.forEach(function (ch) {
          const opt = document.createElement('option');
          opt.value = ch.id;
          opt.textContent = '#' + ch.name + ' (' + ch.id + ')';
          if (conf.dashboardLogChannelId && conf.dashboardLogChannelId === ch.id) opt.selected = true;
          dashLogSelect.appendChild(opt);
        });
      }

      if (ticketSelect) {
        ticketSelect.innerHTML = '';
        const optNone3 = document.createElement('option');
        optNone3.value = '';
        optNone3.textContent = state.lang === 'en' ? '— None —' : '— Nenhum —';
        ticketSelect.appendChild(optNone3);

        channels.forEach(function (ch) {
          const opt = document.createElement('option');
          opt.value = ch.id;
          opt.textContent = '#' + ch.name + ' (' + ch.id + ')';
          if (conf.ticketThreadChannelId && conf.ticketThreadChannelId === ch.id) opt.selected = true;
          ticketSelect.appendChild(opt);
        });
      }

      if (staffSelect) {
        staffSelect.innerHTML = '';
        roles.forEach(function (r) {
          const opt = document.createElement('option');
          opt.value = r.id;
          opt.textContent = '@' + r.name + ' (' + r.id + ')';
          if (Array.isArray(conf.staffRoleIds) && conf.staffRoleIds.indexOf(r.id) !== -1) {
            opt.selected = true;
          }
          staffSelect.appendChild(opt);
        });
      }

      // Trust config preview (read-only, global)
      const trust = conf && conf.trust ? conf.trust : null;
      const baseEl = document.getElementById('trustBaseValue');
      const minMaxEl = document.getElementById('trustMinMaxValue');
      const penaltiesEl = document.getElementById('trustPenaltiesValue');
      const regenEl = document.getElementById('trustRegenValue');
      const riskEl = document.getElementById('trustRiskValue');

      if (trust && baseEl && minMaxEl && penaltiesEl && regenEl && riskEl) {
        const base = Number.isFinite(Number(trust.base)) ? Number(trust.base) : null;
        const min = Number.isFinite(Number(trust.min)) ? Number(trust.min) : null;
        const max = Number.isFinite(Number(trust.max)) ? Number(trust.max) : null;

        baseEl.textContent = base !== null ? String(base) : '—';
        minMaxEl.textContent = min !== null && max !== null ? min + ' / ' + max : '—';

        const warnPenalty = Number.isFinite(Number(trust.warnPenalty)) ? Number(trust.warnPenalty) : null;
        const mutePenalty = Number.isFinite(Number(trust.mutePenalty)) ? Number(trust.mutePenalty) : null;
        penaltiesEl.textContent =
          warnPenalty !== null && mutePenalty !== null
            ? 'WARN: -' + warnPenalty + ' • MUTE: -' + mutePenalty
            : '—';

        const regenPerDay = Number.isFinite(Number(trust.regenPerDay)) ? Number(trust.regenPerDay) : null;
        const regenMaxDays = Number.isFinite(Number(trust.regenMaxDays)) ? Number(trust.regenMaxDays) : null;
        regenEl.textContent =
          regenPerDay !== null && regenMaxDays !== null
            ? regenPerDay + ' / dia até ' + regenMaxDays + ' dias'
            : '—';

        const lowT = Number.isFinite(Number(trust.lowTrustThreshold)) ? Number(trust.lowTrustThreshold) : null;
        const highT = Number.isFinite(Number(trust.highTrustThreshold)) ? Number(trust.highTrustThreshold) : null;
        if (lowT !== null && highT !== null) {
          riskEl.textContent = `< ${lowT} (risco) • > ${highT} (confiança)`;
        } else {
          riskEl.textContent = '—';
        }
      } else if (baseEl && minMaxEl && penaltiesEl && regenEl && riskEl) {
        baseEl.textContent = '—';
        minMaxEl.textContent = '—';
        penaltiesEl.textContent = '—';
        regenEl.textContent = '—';
        riskEl.textContent = '—';
      }

      if (statusEl) {
        statusEl.textContent = '';
      }
    } catch (err) {
      console.error('Failed to load guild config', err);
      if (statusEl) {
        statusEl.textContent = t('config_error_generic');
      }
    }
  }

  async function saveGuildConfig() {
    if (!state.guildId) return;

    const logSelect = document.getElementById('configLogChannel');
    const dashLogSelect = document.getElementById('configDashboardLogChannel');
    const ticketSelect = document.getElementById('configTicketChannel');
    const staffSelect = document.getElementById('configStaffRoles');
    const statusEl = document.getElementById('configStatus');

    const logChannelId = logSelect && logSelect.value ? logSelect.value : null;
    const dashLogChannelId = dashLogSelect && dashLogSelect.value ? dashLogSelect.value : null;
    const ticketThreadChannelId = ticketSelect && ticketSelect.value ? ticketSelect.value : null;

    const staffRoleIds = [];
    if (staffSelect) {
      Array.prototype.forEach.call(staffSelect.selectedOptions || [], function (opt) {
        if (opt.value) staffRoleIds.push(opt.value);
      });
    }

    try {
      await apiPost('/guilds/' + encodeURIComponent(state.guildId) + '/config', {
        logChannelId: logChannelId,
        dashboardLogChannelId: dashLogChannelId,
        ticketThreadChannelId: ticketThreadChannelId,
        staffRoleIds: staffRoleIds,
      });
      if (statusEl) {
        statusEl.textContent = t('config_saved');
      }
      toast(t('config_saved'));
    } catch (err) {
      console.error('Failed to save guild config', err);
      if (statusEl) {
        statusEl.textContent = t('config_error_generic');
      }
      toast(t('config_error_save'));
    }
  }

  // -----------------------------
  // Init
  // -----------------------------
