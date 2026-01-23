// Estado simples
const state = {
  lang: 'pt',
};

// Traduções
const I18N = {
  pt: {
    // Topbar / layout
    app_subtitle: 'Painel de gestão e moderação',
    select_guild: 'Selecione um servidor',
    badge_bot_online: '● Bot online',

    // Tabs
    tab_overview: 'Visão geral',
    tab_logs: 'Moderação',
    tab_cases: 'Casos',
    tab_tickets: 'Tickets',
    tab_gamenews: 'GameNews',
    tab_user: 'Utilizadores',
    tab_config: 'Configuração',

    // Overview
    overview_title: 'Visão geral',
    overview_hint: 'Resumo de alto nível sobre o estado do bot, servidores ligados e atividade recente.',
    kpi_guilds: 'Servidores ligados',
    kpi_users: 'Utilizadores monitorizados',
    kpi_actions_24h: 'Ações de moderação (últimas 24h)',

    // Logs
    logs_title: 'Hub de moderação',
    logs_hint: 'Consulta centralizada de avisos, mutes, bans e restantes ações de moderação.',
    logs_search_placeholder: 'Procurar por utilizador, moderador ou detalhe do log',
    logs_filter_all: 'Todos os tipos',
    logs_reload: 'Recarregar',
    logs_empty: 'Não existem registos para o filtro atual.',
    logs_loading: 'A carregar logs…',
    logs_error_generic: 'Não foi possível carregar os logs.',
    logs_error_http: 'Erro ao carregar logs.',
    logs_user_label: 'Utilizador',
    logs_executor_label: 'Moderador',
    logs_timestamp_label: 'Data',

    // Cases
    cases_title: 'Casos',
    cases_hint: 'Visão consolidada das infrações de cada utilizador ao longo do tempo.',
    cases_empty: 'Ainda não existem casos registados para este servidor.',

    // Tickets
    tickets_title: 'Tickets',
    tickets_hint: 'Gestão de pedidos de suporte e tickets abertos nos servidores configurados.',
    tickets_empty: 'Não foram encontrados tickets para o período selecionado.',

    // GameNews
    gamenews_title: 'GameNews',
    gamenews_hint: 'Estado dos feeds de notícias, últimos envios e potenciais falhas na publicação.',
    gamenews_empty: 'Nenhum feed de GameNews se encontra configurado neste momento.',

    // Users
    users_title: 'Utilizadores',
    users_hint: 'Consulta rápida de métricas e histórico de casos de cada utilizador.',
    users_empty: 'Selecione um servidor para ver utilizadores.',

    // Config
    config_title: 'Configuração do servidor',
    config_hint: 'Defina canais, cargos de staff e preferências de registo para este servidor.',
    config_empty: 'Em breve: integração direta com a API do OzarkBot para guardar estas definições.',

    // Mensagens auxiliares
    warn_select_guild: 'Selecione um servidor para aceder às restantes secções.',
    language_changed: 'Idioma alterado.',
  },

  en: {
    // Topbar / layout
    app_subtitle: 'Moderation and management dashboard',
    select_guild: 'Select a server',
    badge_bot_online: '● Bot online',

    // Tabs
    tab_overview: 'Overview',
    tab_logs: 'Moderation',
    tab_cases: 'Cases',
    tab_tickets: 'Tickets',
    tab_gamenews: 'GameNews',
    tab_user: 'Users',
    tab_config: 'Configuration',

    // Overview
    overview_title: 'Overview',
    overview_hint: 'High-level summary of bot status, connected guilds and recent activity.',
    kpi_guilds: 'Connected guilds',
    kpi_users: 'Monitored users',
    kpi_actions_24h: 'Moderation actions (last 24h)',

    // Logs
    logs_title: 'Moderation hub',
    logs_hint: 'Central place to review warns, mutes, bans and other moderation events.',
    logs_search_placeholder: 'Search by user, moderator or log details',
    logs_filter_all: 'All types',
    logs_reload: 'Reload',
    logs_empty: 'There are no records matching the current filter.',
    logs_loading: 'Loading logs…',
    logs_error_generic: 'Could not load logs.',
    logs_error_http: 'Error loading logs.',
    logs_user_label: 'User',
    logs_executor_label: 'Moderator',
    logs_timestamp_label: 'Date',

    // Cases
    cases_title: 'Cases',
    cases_hint: 'Consolidated view of each user’s infractions over time.',
    cases_empty: 'No cases have been registered for this server yet.',

    // Tickets
    tickets_title: 'Tickets',
    tickets_hint: 'Manage support requests and open tickets across your configured guilds.',
    tickets_empty: 'No tickets were found for the selected period.',

    // GameNews
    gamenews_title: 'GameNews',
    gamenews_hint: 'Status of news feeds, recent posts and any delivery failures.',
    gamenews_empty: 'No GameNews feeds are configured at the moment.',

    // Users
    users_title: 'Users',
    users_hint: 'Quick access to metrics, case history and actions applied per user.',
    users_empty: 'Select a server to list and analyse its users.',

    // Config
    config_title: 'Server configuration',
    config_hint: 'Configure channels, staff roles and logging preferences for this server.',
    config_empty: 'Coming soon: direct integration with the OzarkBot API to persist these settings.',

    // Helper messages
    warn_select_guild: 'Select a server to access the other sections.',
    language_changed: 'Language updated.',
  },
};

// Helpers
function t(key) {
  const lang = I18N[state.lang] ? state.lang : 'pt';
  return I18N[lang][key] ?? I18N.pt[key] ?? key;
}

function applyI18n() {
  document.documentElement.lang = state.lang;

  document.querySelectorAll('[data-i18n]').forEach((el) => {
    const k = el.getAttribute('data-i18n');
    if (!k) return;
    el.textContent = t(k);
  });

  document.querySelectorAll('[data-i18n-placeholder]').forEach((el) => {
    const k = el.getAttribute('data-i18n-placeholder');
    if (!k) return;
    el.setAttribute('placeholder', t(k));
  });

  const warn = document.getElementById('tabWarning');
  if (warn) warn.textContent = t('warn_select_guild');
}

function setLang(newLang) {
  state.lang = (newLang || 'pt').toLowerCase();
  try {
    localStorage.setItem('OZARK_LANG_SIMPLE', state.lang);
  } catch {}

  const lp = document.getElementById('langPicker');
  if (lp) lp.value = state.lang;

  applyI18n();
}

// Pede e guarda o token da dashboard (DASHBOARD_TOKEN)
function ensureDashToken() {
  let jwt = localStorage.getItem('OZARK_DASH_JWT');
  if (!jwt) {
    const msgPt = 'Introduz o token da dashboard (DASHBOARD_TOKEN do .env):';
    const msgEn = 'Enter the dashboard token (DASHBOARD_TOKEN from .env):';
    const ask = state.lang === 'en' ? msgEn : msgPt;

    jwt = window.prompt(ask, '');
    if (jwt) {
      jwt = jwt.trim();
      if (jwt) {
        localStorage.setItem('OZARK_DASH_JWT', jwt);
      }
    }
  }
  return jwt || null;
}

// Sanitização simples de texto para evitar XSS
function escapeHtml(value) {
  if (!value) return '';
  return value
    .toString()
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// Tabs
function setTab(name) {
  document.querySelectorAll('.tab').forEach((tab) => {
    tab.classList.toggle('active', tab.dataset.tab === name);
  });

  document.querySelectorAll('.section').forEach((sec) => {
    sec.classList.toggle('active', sec.id === `tab-${name}`);
  });
}

// Bloqueio de tabs sem servidor (versão simples + garantida)
function updateTabAccess() {
  const guildPicker = document.getElementById('guildPicker');
  const warning = document.getElementById('tabWarning');
  const needsGuild = ['logs', 'cases', 'tickets', 'gamenews', 'user', 'config'];

  const currentGuild = guildPicker?.value || '';
  const hasGuild = !!currentGuild;

  // marcar/desmarcar tabs visualmente
  document.querySelectorAll('.tab').forEach((tab) => {
    const name = tab.dataset.tab;
    if (!name) return;
    if (needsGuild.includes(name)) {
      tab.classList.toggle('disabled', !hasGuild);
    }
  });

  // aviso
  if (!hasGuild) {
    if (warning) warning.classList.add('visible');

    // se por algum motivo estivermos numa tab que exige guild, volta para overview
    const active = document.querySelector('.tab.active');
    const activeName = active?.dataset.tab;
    if (activeName && needsGuild.includes(activeName)) {
      setTab('overview');
    }
  } else {
    if (warning) warning.classList.remove('visible');
  }
}

// ==== LOGS: ligação à API /api/logs ====

async function loadLogs(page = 1) {
  const guildPicker = document.getElementById('guildPicker');
  const listEl = document.getElementById('logsList');
  const typeEl = document.getElementById('logType');
  const searchEl = document.getElementById('logSearch');

  if (!listEl) return;

  const guildId = guildPicker?.value || '';
  const type = typeEl?.value || '';
  const search = searchEl?.value || '';

  if (!guildId) {
    listEl.innerHTML = `<div class="empty">${escapeHtml(t('warn_select_guild'))}</div>`;
    return;
  }

  // Estado de loading
  listEl.innerHTML = `<div class="empty">${escapeHtml(t('logs_loading'))}</div>`;

  const params = new URLSearchParams();
  params.set('page', String(page));
  params.set('limit', '20');
  params.set('guildId', guildId);
  if (type) params.set('type', type);
  if (search) params.set('search', search);

  const headers = {};
  // Garante que temos token da dashboard
  const jwt = ensureDashToken();
  if (jwt) {
    headers['Authorization'] = `Bearer ${jwt}`;
    headers['x-dashboard-token'] = jwt; // redundância: backend também pode aceitar este header
  }

  let resp;
  try {
    resp = await fetch(`/api/logs?${params.toString()}`, { headers });
  } catch (err) {
    console.error('Erro ao chamar /api/logs:', err);
    listEl.innerHTML = `<div class="empty">${escapeHtml(t('logs_error_generic'))}</div>`;
    return;
  }

  if (!resp.ok) {
    console.error('HTTP error /api/logs:', resp.status);

    if (resp.status === 401) {
      listEl.innerHTML = `<div class="empty">
        ${escapeHtml(t('logs_error_http'))} (401)<br><br>
        ${
          state.lang === 'en'
            ? 'Check if the dashboard token (DASHBOARD_TOKEN) is configured and correct.'
            : 'Verifica se o token da dashboard (DASHBOARD_TOKEN) está configurado e correto.'
        }
      </div>`;
    } else {
      listEl.innerHTML = `<div class="empty">${escapeHtml(t('logs_error_http'))} (${resp.status})</div>`;
    }
    return;
  }

  let data;
  try {
    data = await resp.json();
  } catch (err) {
    console.error('Erro a ler JSON de /api/logs:', err);
    listEl.innerHTML = `<div class="empty">${escapeHtml(t('logs_error_generic'))}</div>`;
    return;
  }

  const items = data.items || [];

  if (!items.length) {
    listEl.innerHTML = `<div class="empty">${escapeHtml(t('logs_empty'))}</div>`;
    return;
  }

  const html = items
    .map((item) => {
      const title = item.title || '';
      const userTag = item.user?.tag || item.user?.id || '—';
      const execTag = item.executor?.tag || item.executor?.id || '—';
      const time = item.time || item.createdAt || '';
      const description = item.description || '';
      return `
        <div class="card">
          <div class="row gap" style="justify-content: space-between; align-items:flex-start;">
            <div>
              <strong>${escapeHtml(title)}</strong>
              ${
                description
                  ? `<div class="hint">${escapeHtml(description)}</div>`
                  : ''
              }
            </div>
            <div style="text-align:right; font-size:11px; color:var(--text-muted);">
              <div>${escapeHtml(t('logs_user_label'))}: ${escapeHtml(userTag)}</div>
              <div>${escapeHtml(t('logs_executor_label'))}: ${escapeHtml(execTag)}</div>
              <div>${escapeHtml(t('logs_timestamp_label'))}: ${escapeHtml(time)}</div>
            </div>
          </div>
        </div>
      `;
    })
    .join('');

  listEl.innerHTML = html;
}

function initTabs() {
  const tabsEl = document.getElementById('tabs');
  if (!tabsEl) return;

  const needsGuild = ['logs', 'cases', 'tickets', 'gamenews', 'user', 'config'];
  const protectedTabs = ['logs', 'cases', 'tickets', 'gamenews', 'user', 'config'];

  tabsEl.addEventListener('click', (e) => {
    const tabEl = e.target.closest('.tab');
    if (!tabEl) return;

    const name = tabEl.dataset.tab;
    if (!name) return;

    const guildPicker = document.getElementById('guildPicker');
    const currentGuild = guildPicker?.value || '';

    // 1) Bloqueio por servidor
    if (!currentGuild && needsGuild.includes(name)) {
      updateTabAccess(); // garante aviso + volta à Overview se for preciso
      return;
    }

    // 2) Bloqueio por token (auth)
    if (protectedTabs.includes(name)) {
      const existing = localStorage.getItem('OZARK_DASH_JWT');
      const jwt = existing || ensureDashToken();
      if (!jwt) {
        // Utilizador cancelou o prompt ou não guardou token: não muda de tab
        return;
      }
    }

    // 3) Ativar tab
    setTab(name);

    // 4) Lazy load de logs quando se entra na tab
    if (name === 'logs') {
      loadLogs().catch((err) => console.error('Erro loadLogs:', err));
    }
  });
}

// Boot
document.addEventListener('DOMContentLoaded', () => {
  // idioma inicial
  const saved = (localStorage.getItem('OZARK_LANG_SIMPLE') || 'pt').toLowerCase();
  state.lang = saved;
  const lp = document.getElementById('langPicker');
  if (lp) lp.value = saved;

  applyI18n();
  initTabs();

  // Guild picker
  const guildPicker = document.getElementById('guildPicker');
  if (guildPicker) {
    updateTabAccess();

    guildPicker.addEventListener('change', () => {
      updateTabAccess();

      // se estivermos na tab de logs quando mudas de servidor, recarrega logs
      const activeName = document.querySelector('.tab.active')?.dataset.tab;
      if (activeName === 'logs') {
        loadLogs().catch((err) => console.error('Erro loadLogs (guild change):', err));
      }
    });
  } else {
    updateTabAccess();
  }

  // Listener de idioma
  const langPicker = document.getElementById('langPicker');
  if (langPicker) {
    langPicker.addEventListener('change', (e) => {
      setLang(e.target.value);
      console.log(t('language_changed'));
    });
  }

  // Botão "Recarregar" nos logs
  const reloadBtn = document.getElementById('btnReloadLogs');
  if (reloadBtn) {
    reloadBtn.addEventListener('click', () => {
      loadLogs().catch((err) => console.error('Erro loadLogs (reload):', err));
    });
  }

  // Enter no campo de pesquisa dispara reload
  const searchEl = document.getElementById('logSearch');
  if (searchEl) {
    searchEl.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        loadLogs().catch((err) => console.error('Erro loadLogs (enter search):', err));
      }
    });
  }
});
