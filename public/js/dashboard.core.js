'use strict';
  // ==========================================
  // Dashboard helpers & state (shared)
  // ==========================================


(function () {
  const state = {
    lang: 'pt',
    guildId: null,
    currentTab: 'overview',
    guilds: []
  };

  const API_BASE = '/api';
  const TOKEN_KEY = 'OZARK_DASH_TOKEN';

  // -----------------------------
  // Small helpers
  // -----------------------------

  function getToken() {
    try {
      return localStorage.getItem(TOKEN_KEY) || '';
    } catch (e) {
      return '';
    }
  }

  function setToken(token) {
    try {
      if (token) {
        localStorage.setItem(TOKEN_KEY, token);
      }
    } catch (e) {
      // ignore
    }
  }

  function ensureToken() {
    let token = getToken();
    if (token) return token;

    const msg =
      state.lang === 'en'
        ? 'Enter the dashboard token (DASHBOARD_TOKEN from .env):'
        : 'Introduz o token do dashboard (DASHBOARD_TOKEN do .env):';
    token = window.prompt(msg, '') || '';
    token = token.trim();
    if (!token) return '';
    setToken(token);
    return token;
  }

  function getAuthHeaders() {
    const headers = {};
    const token = ensureToken();
    if (token) {
      // Backend aceita tanto Authorization Bearer como x-dashboard-token.
      headers['x-dashboard-token'] = token;
    }
    return headers;
  }

  async function apiGet(path) {
    const res = await fetch(API_BASE + path, {
      method: 'GET',
      headers: getAuthHeaders(),
    });
    if (!res.ok) {
      throw new Error(`HTTP ${res.status} for ${path}`);
    }
    return res.json();
  }

  async function apiPost(path, body) {
    const res = await fetch(API_BASE + path, {
      method: 'POST',
      headers: Object.assign({ 'Content-Type': 'application/json' }, getAuthHeaders()),
      body: JSON.stringify(body || {}),
    });
    if (!res.ok) {
      throw new Error(`HTTP ${res.status} for ${path}`);
    }
    return res.json();
  }


  // ==========================================
  // Moderation: Logs & Cases & GameNews helpers
  // ==========================================

  function createLogRow(log) {
    const row = document.createElement('div');
    row.className = 'list-item';

    const title = log.title || 'Log';
    const subtitleParts = [];

    if (log.user && log.user.tag) {
      subtitleParts.push('User: ' + log.user.tag);
    }
    if (log.executor && log.executor.tag) {
      subtitleParts.push('Mod: ' + log.executor.tag);
    }
    if (log.description) {
      subtitleParts.push(log.description);
    }

    const createdAt = log.createdAt || log.time;
    if (createdAt) {
      try {
        const d = new Date(createdAt);
        if (!isNaN(d.getTime())) {
          subtitleParts.push(d.toLocaleString());
        }
      } catch (e) {
        // ignore
      }
    }

    row.innerHTML = `
        <div class="title">${escapeHtml(title)}</div>
        <div class="subtitle">${escapeHtml(subtitleParts.join(' • '))}</div>
      `;

    return row;
  }


  function createCaseRow(c) {
    const row = document.createElement('div');
    row.className = 'list-item';

    const title = (c.type || 'CASE') + ' • ' + (c.userId || '—');
    const subtitleParts = [];

    if (c.caseId) subtitleParts.push('#' + c.caseId);
    if (c.reason) subtitleParts.push(c.reason);
    if (c.createdAt) subtitleParts.push(new Date(c.createdAt).toLocaleString());

    row.innerHTML = `
          <div class="title">${escapeHtml(title)}</div>
          <div class="subtitle">${escapeHtml(subtitleParts.join(' • '))}</div>
        `;

    return row;
  }

  function createGameNewsFeedRow(f, idx) {
    const row = document.createElement('div');
    row.className = 'list-item';
    row.dataset.index = String(idx);

    row.innerHTML = `
        <div class="row gap">
          <div class="col">
            <label>${escapeHtml(t('gamenews_feed_name_label'))}</label>
            <input type="text" class="input feed-name" value="${escapeHtml(f.name || '')}" />
          </div>
          <div class="col">
            <label>${escapeHtml(t('gamenews_feed_url_label'))}</label>
            <input type="text" class="input feed-url" value="${escapeHtml(f.feedUrl || '')}" />
          </div>
        </div>
        <div class="row gap" style="margin-top:6px;">
          <div class="col">
            <label>${escapeHtml(t('gamenews_feed_channel_label'))}</label>
            <input type="text" class="input feed-channel" value="${escapeHtml(f.channelId || '')}" />
          </div>
          <div class="col" style="display:flex;align-items:center;gap:8px;">
            <label>
              <input type="checkbox" class="feed-enabled"${f.enabled === false ? '' : ' checked'}>
              ${escapeHtml(t('gamenews_feed_enabled_label'))}
            </label>
            <button type="button" class="btn btn-small btn-remove-feed">
              ${escapeHtml(t('gamenews_feed_remove_label'))}
            </button>
          </div>
        </div>
      `;

    return row;
  }

  function toast(message) {
    const id = 'ozarkToast';
    let el = document.getElementById(id);
    if (!el) {
      el = document.createElement('div');
      el.id = id;
      el.style.position = 'fixed';
      el.style.right = '16px';
      el.style.bottom = '16px';
      el.style.padding = '10px 14px';
      el.style.background = 'rgba(0,0,0,0.75)';
      el.style.color = '#fff';
      el.style.borderRadius = '6px';
      el.style.fontSize = '13px';
      el.style.zIndex = '9999';
      el.style.transition = 'opacity 0.25s ease';
      document.body.appendChild(el);
    }
    el.textContent = message;
    el.style.opacity = '1';
    clearTimeout(el._hideTimer);
    el._hideTimer = setTimeout(function () {
      el.style.opacity = '0';
    }, 2400);
  }

  function escapeHtml(value) {
    if (value === null || value === undefined) return '';
    return value
      .toString()
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  // -----------------------------
  // i18n (simplificado)
  // -----------------------------

  const I18N = {
    pt: {
      app_subtitle: 'Dashboard de moderação e gestão',
      select_guild: 'Seleciona um servidor',
      badge_bot_online: '* Bot online',

      tab_overview: 'Visão geral',
      tab_logs: 'Moderação',
      tab_cases: 'Casos',
      tab_tickets: 'Tickets',
      tab_gamenews: 'GameNews',
      tab_user: 'Utilizadores',
      tab_config: 'Configuração',

      warn_select_guild: 'Selecione um servidor para aceder às restantes secções.',

      logs_title: 'Hub de moderação',
      logs_hint: 'Consulta centralizada de avisos, mutes, bans, tickets e restantes ações de moderação.',
      logs_search_placeholder: 'Procurar por utilizador, moderador ou detalhe do log',
      logs_filter_all: 'Todos os tipos',
      logs_filter_tickets: 'Tickets (suporte)',
      logs_reload: 'Recarregar',
      logs_empty: 'Não existem registos para o filtro atual.',
      logs_loading: 'A carregar logs...',
      logs_error_generic: 'Não foi possível carregar os logs.',
      overview_error_generic: 'Não foi possível carregar a visão geral.',
      guilds_error_generic: 'Não foi possível carregar a lista de servidores.',
      users_error_generic: 'Não foi possível carregar a lista de utilizadores.',
      cases_error_generic: 'Não foi possível carregar os casos.',
      tickets_error_action: 'Não foi possível executar a ação no ticket.',
      config_error_save: 'Não foi possível guardar a configuração.',

      overview_title: 'Visão geral',
      overview_hint: 'Resumo rápido da atividade de moderação do bot.',
      kpi_guilds: 'Servidores ligados',
      kpi_users: 'Utilizadores monitorizados',
      kpi_actions_24h: 'Ações de moderação (últimas 24h)',

      tickets_title: 'Tickets',
      tickets_hint: 'Gerir pedidos de suporte abertos através do bot.',
      tickets_empty: 'Ainda não existem tickets neste servidor.',
      tickets_loading: 'A carregar tickets...',
      tickets_error_generic: 'Não foi possível carregar os tickets.',
      tickets_reply_placeholder: 'Escreve a resposta a enviar para o ticket...',
      tickets_reply_success: 'Resposta enviada para o ticket.',
      tickets_close_success: 'Ticket fechado.',
      tickets_close_confirm: 'Tens a certeza que queres fechar este ticket?',

      gamenews_title: 'GameNews',
      gamenews_hint: 'Estado dos feeds de notícias e últimas publicações.',
      gamenews_empty: 'Nenhum feed de GameNews configurado neste momento.',
      gamenews_loading: 'A carregar estado dos feeds...',
      gamenews_select_guild: 'Selecione um servidor para configurar GameNews.',
      gamenews_error_generic: 'Não foi possível carregar GameNews.',
      gamenews_editor_title: 'Configuração de feeds',
      gamenews_editor_hint: 'Adiciona, edita ou remove feeds e escolhe o canal para cada um.',
      gamenews_add_feed: 'Adicionar feed',
      gamenews_save_feeds: 'Guardar alterações',
      gamenews_save_success: 'Feeds de GameNews guardados.',
      gamenews_editor_empty: 'Ainda não existem feeds configurados. Adiciona o primeiro feed para começar.',
      gamenews_feed_name_label: 'Nome',
      gamenews_feed_url_label: 'URL do feed',
      gamenews_feed_channel_label: 'Canal',
      gamenews_feed_enabled_label: 'Ativo',
      gamenews_feed_url_label: 'URL do feed',
      gamenews_feed_channel_label: 'Canal ID',
      gamenews_feed_remove_label: 'Remover',
      gamenews_status_last_label: 'Último envio',
      gamenews_status_state_ok: 'Ativo',
      gamenews_status_state_paused: 'Em pausa',
      gamenews_status_state_error: 'Em erro',

      users_title: 'Utilizadores',
      users_hint: 'Lista de utilizadores e acesso rápido ao histórico de moderação.',
      users_empty: 'Selecione um servidor para ver utilizadores.',
      users_detail_empty: 'Selecione um utilizador para ver o histórico de moderação e tickets.',
      users_history_title: 'Histórico do utilizador',
      users_history_infractions: 'Infrações recentes',
      users_history_tickets: 'Tickets recentes',
      users_history_none: 'Sem histórico de moderação para este utilizador.',
      users_history_click_to_remove: 'Clique numa infração para a remover e ajustar o trust.',
      users_history_remove_confirm: 'Tens a certeza que queres remover esta infração? Isto pode ajustar o trust e o número de avisos.',
      users_history_remove_success: 'Infração removida com sucesso.',
      users_trust_title: 'Nível de confiança (trust)',
      users_trust_score: 'Trust',
      users_trust_next_penalty_prefix: 'Próximo auto-mute estimado após mais',
      users_trust_next_penalty_suffix: 'duração aproximada',
      users_trust_next_penalty_simple_prefix: 'Próximo auto-mute estimado:',
      users_trust_next_penalty_at_threshold: 'Já atingiu o limiar de auto-mute; próximo warn irá gerar um mute de aproximadamente',
      users_trust_automation_disabled: 'Automação de mute automática está desativada para este servidor.',
      users_actions_title: 'Ações rápidas de moderação',
      users_actions_warn: 'Warn',
      users_actions_unmute: 'Unmute',
      users_actions_reset: 'Repor trust/avisos',
      users_actions_reset_history: 'Limpar histórico',
      users_actions_reason_placeholder: 'Motivo (opcional)',

      config_title: 'Configuração do servidor',
      config_hint: 'Define canais de logs e cargos de staff para este servidor.',
      config_log_channel: 'Canal de logs principal',
      config_dashboard_log_channel: 'Canal de logs da dashboard',
      config_ticket_channel: 'Canal de suporte (tickets)',
      config_ticket_channel_hint:
        'Canal onde será publicada a mensagem de suporte com o emoji para criar tickets.',
      config_staff_roles: 'Cargos de staff',
      config_staff_roles_hint:
        'Se vazio, são usadas as roles de staff globais definidas no ficheiro de configuração.',
      config_reload: 'Recarregar',
      config_save: 'Guardar configuração',
      config_saved: 'Configuração do servidor guardada.',
      config_loading: 'A carregar configuração...',

      config_trust_title: 'Sistema de confiança (Trust)',
      config_trust_hint: 'Valores globais usados pelo AutoMod e pelos comandos de moderação. Não é possível alterar estes valores pela dashboard.',
      config_trust_base: 'Nível base',
      config_trust_minmax: 'Mínimo / Máximo',
      config_trust_penalties: 'Penalizações',
      config_trust_regen: 'Regeneração',
      config_trust_risk: 'Limiares',

      config_error_generic: 'Não foi possível carregar a configuração.',
    },

    en: {
      app_subtitle: 'Moderation and management dashboard',
      select_guild: 'Select a server',
      badge_bot_online: '* Bot online',

      tab_overview: 'Overview',
      tab_logs: 'Moderation',
      tab_cases: 'Cases',
      tab_tickets: 'Tickets',
      tab_gamenews: 'GameNews',
      tab_user: 'Users',
      tab_config: 'Server config',

      warn_select_guild: 'Select a server to access the other sections.',

      logs_title: 'Moderation hub',
      logs_hint: 'Centralised view of warns, mutes, bans, tickets and other moderation actions.',
      logs_search_placeholder: 'Search by user, moderator or log detail',
      logs_filter_all: 'All types',
      logs_filter_tickets: 'Tickets (support)',
      logs_reload: 'Reload',
      logs_empty: 'There are no records for the current filter.',
      logs_loading: 'Loading logs...',
      logs_error_generic: 'Could not load logs.',

      overview_title: 'Overview',
      overview_hint: 'Quick summary of the bot moderation activity.',
      kpi_guilds: 'Connected guilds',
      kpi_users: 'Monitored users',
      kpi_actions_24h: 'Moderation actions (last 24h)',

      tickets_title: 'Tickets',
      tickets_hint: 'Manage support requests opened via the bot.',
      tickets_empty: 'There are no tickets for this guild yet.',
      tickets_loading: 'Loading tickets...',
      tickets_error_generic: 'Could not load tickets.',
      tickets_reply_placeholder: 'Write the reply to send to this ticket...',
      tickets_reply_success: 'Reply sent to ticket.',
      tickets_close_success: 'Ticket closed.',
      tickets_close_confirm: 'Are you sure you want to close this ticket?',

      gamenews_title: 'GameNews',
      gamenews_hint: 'Status of news feeds and last deliveries.',
      gamenews_empty: 'No GameNews feeds are configured at the moment.',
      gamenews_loading: 'Loading GameNews status...',
      gamenews_select_guild: 'Select a server to configure GameNews.',
      gamenews_error_generic: 'Could not load GameNews.',
      gamenews_editor_title: 'Feeds configuration',
      gamenews_editor_hint: 'Add, edit or remove feeds and choose the target channel for each one.',
      gamenews_add_feed: 'Add feed',
      gamenews_save_feeds: 'Save changes',
      gamenews_save_success: 'GameNews feeds saved.',
      gamenews_editor_empty: 'No feeds configured yet. Add your first feed to get started.',
      gamenews_feed_name_label: 'Name',
      gamenews_feed_url_label: 'Feed URL',
      gamenews_feed_channel_label: 'Channel',
      gamenews_feed_enabled_label: 'Enabled',
      gamenews_feed_url_label: 'Feed URL',
      gamenews_feed_channel_label: 'Channel ID',
      gamenews_feed_remove_label: 'Remove',
      gamenews_status_last_label: 'Last sent',
      gamenews_status_state_ok: 'Active',
      gamenews_status_state_paused: 'Paused',
      gamenews_status_state_error: 'Error',

      users_title: 'Users',
      users_hint: 'Users list with quick access to their moderation history.',
      users_empty: 'Select a server to see the users list.',
      users_detail_empty: 'Select a user to see their moderation and ticket history.',
      users_history_title: 'User history',
      users_history_infractions: 'Recent infractions',
      users_history_tickets: 'Recent tickets',
      users_history_none: 'No moderation history for this user.',
      users_history_click_to_remove: 'Click an infraction to remove it and adjust trust.',
      users_history_remove_confirm: 'Are you sure you want to remove this infraction? This may adjust trust and warning count.',
      users_history_remove_success: 'Infraction removed successfully.',
      users_trust_title: 'Trust level',
      users_trust_score: 'Trust',
      users_trust_next_penalty_prefix: 'Next estimated auto-mute after',
      users_trust_next_penalty_suffix: 'estimated duration',
      users_trust_next_penalty_simple_prefix: 'Next estimated auto-mute:',
      users_trust_next_penalty_at_threshold: 'Already at the auto-mute threshold; next warn will trigger a mute of about',
      users_trust_automation_disabled: 'Automatic mute automation is disabled for this server.',
      users_actions_title: 'Quick moderation actions',
      users_actions_warn: 'Warn',
      users_actions_unmute: 'Unmute',
      users_actions_reset: 'Reset trust/warnings',
      users_actions_reset_history: 'Clear history',
      users_actions_reason_placeholder: 'Reason (optional)',

      config_title: 'Server configuration',
      config_hint: 'Define log channels, support channel and staff roles for this guild.',
      config_log_channel: 'Main log channel',
      config_dashboard_log_channel: 'Dashboard log channel',
      config_ticket_channel: 'Support channel (tickets)',
      config_ticket_channel_hint:
        'Channel where the support message with the ticket emoji will be posted.',
      config_staff_roles: 'Staff roles',
      config_staff_roles_hint:
        'If empty, the global staffRoles from config file are used.',
      config_reload: 'Reload',
      config_save: 'Save configuration',
      config_saved: 'Server configuration saved.',
      config_loading: 'Loading configuration...',

      config_trust_title: 'Trust system',
      config_trust_hint: 'Global values used by AutoMod and moderation commands. These values cannot be changed from the dashboard.',
      config_trust_base: 'Base level',
      config_trust_minmax: 'Minimum / Maximum',
      config_trust_penalties: 'Penalties',
      config_trust_regen: 'Regeneration',
      config_trust_risk: 'Thresholds',

      config_error_generic: 'Could not load configuration.',
    },
  };

  function t(key) {
    const lang = I18N[state.lang] ? state.lang : 'pt';
    const table = I18N[lang] || I18N.pt;
    return Object.prototype.hasOwnProperty.call(table, key)
      ? table[key]
      : (I18N.pt && I18N.pt[key]) || key;
  }

  function applyI18n() {
    document.documentElement.lang = state.lang;

    document.querySelectorAll('[data-i18n]').forEach(function (el) {
      const key = el.getAttribute('data-i18n');
      if (!key) return;
      el.textContent = t(key);
    });

    document.querySelectorAll('[data-i18n-placeholder]').forEach(function (el) {
      const key = el.getAttribute('data-i18n-placeholder');
      if (!key) return;
      el.setAttribute('placeholder', t(key));
    });

    const warn = document.getElementById('tabWarning');
    if (warn) warn.textContent = t('warn_select_guild');
  }

  function setLang(newLang) {
    state.lang = (newLang || 'pt').toLowerCase();
    applyI18n();
    const msg = state.lang === 'en' ? 'Language updated.' : 'Idioma alterado.';
    toast(msg);
  }

  // -----------------------------
  // Tab / layout helpers
  // -----------------------------

  function setTab(name) {
    const tabsRequiringGuild = ['logs', 'cases', 'gamenews', 'user', 'config'];
    if (!state.guildId && tabsRequiringGuild.indexOf(name) !== -1) {
      // Em vez de mudar tab, certifica-nos que overview está ativo
      state.currentTab = 'overview';
      const warn = document.getElementById('tabWarning');
      if (warn) {
        warn.style.display = 'block';
      }
      // Reforçar botões ativos
      document.querySelectorAll('.section').forEach(function (sec) {
        sec.classList.remove('active');
      });
      document.querySelectorAll('.tabs button[data-tab]').forEach(function (btn) {
        btn.classList.remove('active');
      });
      const section = document.getElementById('tab-overview');
      const button = document.querySelector('.topnav button[data-tab="overview"]');
      if (section) section.classList.add('active');
      if (button) button.classList.add('active');
      return;
    }
    state.currentTab = name;

    document.querySelectorAll('.section').forEach(function (sec) {
      sec.classList.remove('active');
    });
    document.querySelectorAll('.tabs button[data-tab]').forEach(function (btn) {
      btn.classList.remove('active');
    });

    const section = document.getElementById('tab-' + name);
    const button = document.querySelector('.topnav button[data-tab="' + name + '"]');
    if (section) section.classList.add('active');
    if (button) button.classList.add('active');

    updateTabAccess();
    if (name === 'overview') {
      loadOverview().catch(function () {});
    } else if (name === 'logs') {
      loadLogs().catch(function () {});
    } else if (name === 'cases') {
      loadCases().catch(function () {});
    } else if (name === 'gamenews') {
      loadGameNews().catch(function () {});
    } else if (name === 'user') {
      loadUsers().catch(function () {});
    } else if (name === 'config') {
      loadGuildConfig().catch(function () {});
    }
  }

  function updateTabAccess() {
    const warn = document.getElementById('tabWarning');
    const hasGuild = !!state.guildId;
    if (warn) {
      warn.style.display = hasGuild ? 'none' : 'block';
    }

    const tabsRequiringGuild = ['logs', 'cases', 'gamenews', 'user', 'config'];
    tabsRequiringGuild.forEach(function (name) {
      const btn = document.querySelector('.topnav button[data-tab="' + name + '"]');
      if (!btn) return;
      btn.disabled = !hasGuild;
    });
  }

  // -----------------------------
  // Overview
  // -----------------------------

  async function loadOverview() {
    const guildsEl = document.getElementById('kpiGuilds');
    const usersEl = document.getElementById('kpiUsers');
    const actionsEl = document.getElementById('kpiActions24h');
    if (!guildsEl || !usersEl || !actionsEl) return;

    try {
      const data = await apiGet('/overview');
      if (!data || data.ok === false) {
        throw new Error('Bad payload');
      }
      guildsEl.textContent = String(data.guilds ?? 0);
      usersEl.textContent = String(data.users ?? 0);
      actionsEl.textContent = String(data.actions24h ?? 0);
    } catch (err) {
      console.error('Overview load error', err);
      toast(t('overview_error_generic'));
    }
  }

  // -----------------------------
  // Guilds + Users
  // -----------------------------

  async function loadGuilds() {
    const select = document.getElementById('guildPicker');
    if (!select) return;

    select.innerHTML = '';
    const optLoading = document.createElement('option');
    optLoading.value = '';
    optLoading.textContent = '...';
    select.appendChild(optLoading);

    try {
      const res = await apiGet('/guilds');
      const items = (res && res.items) || [];
      state.guilds = items;
      select.innerHTML = '';

      const optEmpty = document.createElement('option');
      optEmpty.value = '';
      optEmpty.textContent = t('select_guild');
      select.appendChild(optEmpty);

      items.forEach(function (g) {
        const opt = document.createElement('option');
        opt.value = g.id;
        opt.textContent = g.name;
        select.appendChild(opt);
      });

      if (state.guildId) {
        select.value = state.guildId;
      }
    } catch (err) {
      console.error('Failed to load guilds', err);
      toast(t('guilds_error_generic'));
    }
  }

  // ==========================================