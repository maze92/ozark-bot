// Estado simples
const state = {
  lang: 'pt',
  guildChannelsCache: {}, // guildId -> canais
};


// Simple toast helper
function toast(message) {
  try {
    if (!message) return;
    let container = document.getElementById('toast-container');
    if (!container) {
      container = document.createElement('div');
      container.id = 'toast-container';
      container.style.position = 'fixed';
      container.style.bottom = '1.5rem';
      container.style.right = '1.5rem';
      container.style.zIndex = '9999';
      container.style.display = 'flex';
      container.style.flexDirection = 'column';
      container.style.gap = '0.5rem';
      document.body.appendChild(container);
    }

    const el = document.createElement('div');
    el.textContent = message;
    el.style.background = 'rgba(0, 0, 0, 0.85)';
    el.style.color = '#fff';
    el.style.padding = '0.5rem 0.75rem';
    el.style.borderRadius = '4px';
    el.style.fontSize = '0.85rem';
    el.style.boxShadow = '0 2px 6px rgba(0, 0, 0, 0.35)';
    el.style.opacity = '0';
    el.style.transform = 'translateY(10px)';
    el.style.transition = 'opacity 150ms ease-out, transform 150ms ease-out';

    container.appendChild(el);

    requestAnimationFrame(() => {
      el.style.opacity = '1';
      el.style.transform = 'translateY(0)';
    });

    setTimeout(() => {
      el.style.opacity = '0';
      el.style.transform = 'translateY(10px)';
      setTimeout(() => {
        el.remove();
        if (!container.children.length) {
          container.remove();
        }
      }, 200);
    }, 3000);
  } catch (e) {
    console.error('toast error:', e);
  }
}

const DASH_TOKEN_KEY = 'DASHBOARD_TOKEN';

// Traducoes
const I18N = {
  pt: {
    // Topbar / layout
    app_subtitle: 'Painel de gestao e moderacao',
    select_guild: 'Selecione um servidor',
    badge_bot_online: '* Bot online',

    // Tabs
    tab_overview: 'Visao geral',
    tab_logs: 'Moderacao',
    tab_cases: 'Casos',
    tab_tickets: 'Tickets',
    tab_gamenews: 'GameNews',
    tab_user: 'Utilizadores',
    tab_config: 'Configuracao',

    // Overview
    overview_title: 'Visao geral',
    overview_hint: 'Resumo de alto nivel sobre o estado do bot, servidores ligados e atividade recente.',
    kpi_guilds: 'Servidores ligados',
    kpi_users: 'Utilizadores monitorizados',
    kpi_actions_24h: 'Acoes de moderacao (ultimas 24h)',

    // Logs
    logs_title: 'Hub de moderacao',
    logs_hint: 'Consulta centralizada de avisos, mutes, bans e restantes acoes de moderacao.',
    logs_search_placeholder: 'Procurar por utilizador, moderador ou detalhe do log',
    logs_filter_all: 'Todos os tipos',
    logs_reload: 'Recarregar',
    logs_empty: 'Nao existem registos para o filtro atual.',
    logs_loading: 'A carregar logs...',
    logs_error_generic: 'Nao foi possivel carregar os logs.',
    logs_error_http: 'Erro ao carregar logs.',
    logs_user_label: 'Utilizador',
    logs_executor_label: 'Moderador',
    logs_timestamp_label: 'Data',

    // Cases
    cases_title: 'Casos',
    cases_hint: 'Visao consolidada das infracoes de cada utilizador ao longo do tempo.',
    cases_empty: 'Ainda nao existem casos registados para este servidor.',
    cases_loading: 'A carregar casos...',
    cases_error_generic: 'Nao foi possivel carregar os casos.',
    cases_error_http: 'Erro ao carregar casos.',

    // Tickets
    tickets_title: 'Tickets',
    tickets_hint: 'Gestao de pedidos de suporte e tickets abertos nos servidores configurados.',
    tickets_empty: 'Nao foram encontrados tickets para o periodo selecionado.',
    tickets_loading: 'A carregar tickets...',
    tickets_error_generic: 'Nao foi possivel carregar os tickets.',
    tickets_error_http: 'Erro ao carregar tickets.',

    // GameNews
    gamenews_title: 'GameNews',
    gamenews_hint: 'Estado dos feeds de noticias, ultimos envios e potenciais falhas na publicacao.',
    gamenews_empty: 'Nenhum feed de GameNews se encontra configurado neste momento.',
    gamenews_loading: 'A carregar estado dos feeds...',
    gamenews_error_generic: 'Nao foi possivel carregar o estado dos feeds.',
    gamenews_error_http: 'Erro ao carregar GameNews.',

    gamenews_editor_title: 'Configuracao de feeds',
    gamenews_editor_hint: 'Adiciona, edita ou remove feeds e escolhe o canal onde as noticias serao enviadas.',
    gamenews_add_feed: 'Adicionar feed',
    gamenews_save_feeds: 'Guardar alteracoes',
    gamenews_feeds_loading: 'A carregar configuracao de feeds...',
    gamenews_feeds_empty: 'Ainda nao existem feeds configurados. Adiciona o primeiro feed para comecar.',
    gamenews_feeds_error_generic: 'Nao foi possivel carregar a configuracao de feeds.',
    gamenews_feeds_error_http: 'Erro ao carregar os feeds de GameNews.',

    // Users
    users_title: 'Utilizadores',
    users_hint: 'Consulta rapida de metricas e historico de casos de cada utilizador.',
    users_empty: 'Selecione um servidor para ver utilizadores.',

    // Config
    config_title: 'Configuracao do servidor',
    config_hint: 'Defina canais, cargos de staff e preferencias de registo para este servidor.',
    config_empty: 'Em breve: integracao direta com a API do OzarkBot para guardar estas definicoes.',

    // Mensagens auxiliares
    warn_select_guild: 'Selecione um servidor para aceder as restantes seccoes.',
    language_changed: 'Idioma alterado.',
  },

  en: {
    // Topbar / layout
    app_subtitle: 'Moderation and management dashboard',
    select_guild: 'Select a server',
    badge_bot_online: '* Bot online',

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
    logs_loading: 'Loading logs...',
    logs_error_generic: 'Could not load logs.',
    logs_error_http: 'Error loading logs.',
    logs_user_label: 'User',
    logs_executor_label: 'Moderator',
    logs_timestamp_label: 'Date',

    // Cases
    cases_title: 'Cases',
    cases_hint: 'Consolidated view of each user\'s infractions over time.',
    cases_empty: 'No cases have been registered for this server yet.',
    cases_loading: 'Loading cases...',
    cases_error_generic: 'Could not load cases.',
    cases_error_http: 'Error loading cases.',

    // Tickets
    tickets_title: 'Tickets',
    tickets_hint: 'Manage support requests and open tickets across your configured guilds.',
    tickets_empty: 'No tickets were found for the selected period.',
    tickets_loading: 'Loading tickets...',
    tickets_error_generic: 'Could not load tickets.',
    tickets_error_http: 'Error loading tickets.',

    // GameNews
    gamenews_title: 'GameNews',
    gamenews_hint: 'Status of news feeds, recent posts and any delivery failures.',
    gamenews_empty: 'No GameNews feeds are configured at the moment.',
    gamenews_loading: 'Loading feed status...',
    gamenews_error_generic: 'Could not load feed status.',
    gamenews_error_http: 'Error loading GameNews.',

    gamenews_editor_title: 'Feeds configuration',
    gamenews_editor_hint: 'Add, edit or remove feeds and choose which channel will receive each feed.',
    gamenews_add_feed: 'Add feed',
    gamenews_save_feeds: 'Save changes',
    gamenews_feeds_loading: 'Loading feed configuration...',
    gamenews_feeds_empty: 'No feeds have been configured yet. Add your first feed to get started.',
    gamenews_feeds_error_generic: 'Could not load feed configuration.',
    gamenews_feeds_error_http: 'Error loading GameNews feeds.',

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

// ==== TOKEN DASHBOARD (DASHBOARD_TOKEN) ====

// Le token, migrando da key antiga se existir
function getStoredToken() {
  let jwt = null;

  try {
    jwt = localStorage.getItem(DASH_TOKEN_KEY);
    if (!jwt) {
      const legacy = localStorage.getItem('OZARK_DASH_JWT');
      if (legacy) {
        jwt = legacy;
        localStorage.setItem(DASH_TOKEN_KEY, legacy);
        localStorage.removeItem('OZARK_DASH_JWT');
      }
    }
  } catch {
    jwt = null;
  }

  return jwt || null;
}

function setStoredToken(jwt) {
  try {
    if (!jwt) {
      localStorage.removeItem(DASH_TOKEN_KEY);
    } else {
      localStorage.setItem(DASH_TOKEN_KEY, jwt);
    }
  } catch {
    // ignore
  }
}

// Pede e guarda o token da dashboard (DASHBOARD_TOKEN)
function ensureDashToken() {
  let jwt = getStoredToken();
  if (!jwt) {
    const msgPt = 'Introduz o token da dashboard (DASHBOARD_TOKEN do .env):';
    const msgEn = 'Enter the dashboard token (DASHBOARD_TOKEN from .env):';
    const ask = state.lang === 'en' ? msgEn : msgPt;

    const input = window.prompt(ask, '');
    if (input) {
      jwt = input.trim();
      if (jwt) {
        setStoredToken(jwt);
      }
    }
  }
  return jwt || null;
}

function getAuthHeaders() {
  const headers = {};
  const jwt = ensureDashToken();
  if (jwt) {
    headers['Authorization'] = `Bearer ${jwt}`;
    headers['x-dashboard-token'] = jwt;
  }
  return headers;
}

// Sanitizacao simples de texto para evitar XSS
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

// Tabs
function setTab(name) {
  document.querySelectorAll('.tab').forEach((tab) => {
    tab.classList.toggle('active', tab.dataset.tab === name);
  });

  document.querySelectorAll('.section').forEach((sec) => {
    sec.classList.toggle('active', sec.id === `tab-${name}`);
  });
}

// Bloqueio de tabs sem servidor (versao simples + garantida)
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

    // se estivermos numa tab que exige guild, volta para overview
    const active = document.querySelector('.tab.active');
    const activeName = active?.dataset.tab;
    if (activeName && needsGuild.includes(activeName)) {
      setTab('overview');
    }
  } else {
    if (warning) warning.classList.remove('visible');
  }
}

// Carrega lista de servidores reais a partir da API
async function loadGuilds() {
  const guildPicker = document.getElementById('guildPicker');
  if (!guildPicker) return;

  const headers = getAuthHeaders();

  let resp;
  try {
    resp = await fetch('/api/guilds', { headers });
  } catch (err) {