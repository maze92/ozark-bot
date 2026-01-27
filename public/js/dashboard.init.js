  document.addEventListener('DOMContentLoaded', function () {
    // i18n inicial
    applyI18n();

    // Lang picker
    var langPicker = document.getElementById('langPicker');
    if (langPicker) {
      langPicker.addEventListener('change', function () {
        setLang(langPicker.value);
      });
    }

    // Tabs
    document.querySelectorAll('.tabs button[data-tab]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var tab = btn.getAttribute('data-tab');
        if (!tab) return;
        setTab(tab);
      });
    });

    // Guild picker
    var guildPicker = document.getElementById('guildPicker');
    if (guildPicker) {
      guildPicker.addEventListener('change', function () {
        var v = guildPicker.value || '';
        state.guildId = v || null;
        updateTabAccess();

        // Se nenhum servidor estiver selecionado, volta sempre para a visão geral.
        if (!state.guildId) {
          setTab('overview');
          return;
        }

        if (state.currentTab !== 'overview') {
          // reload current tab data when guild changes
          if (state.currentTab === 'logs') {
            loadLogs().catch(function () {});
          } else if (state.currentTab === 'gamenews') {
            loadGameNews().catch(function () {});
          } else if (state.currentTab === 'user') {
            loadUsers().catch(function () {});
          } else if (state.currentTab === 'config') {
            loadGuildConfig().catch(function () {});
          }
        }
      });
    }

    // Logs controls
    var btnReloadLogs = document.getElementById('btnReloadLogs');
    if (btnReloadLogs) {
      btnReloadLogs.addEventListener('click', function () {
        loadLogs().catch(function () {});
      });
    }

    var logTypeSelect = document.getElementById('logType');
    if (logTypeSelect) {
      logTypeSelect.addEventListener('change', function () {
        loadLogs().catch(function () {});
      });
    }

    var logSearchInput = document.getElementById('logSearch');
    if (logSearchInput) {
      logSearchInput.addEventListener('keydown', function (ev) {
        if (ev.key === 'Enter') {
          loadLogs().catch(function () {});
        }
      });
    }

    // GameNews buttons
    var btnAddGameNewsFeed = document.getElementById('btnAddGameNewsFeed');
    if (btnAddGameNewsFeed) {
      btnAddGameNewsFeed.addEventListener('click', function () {
        var listEl = document.getElementById('gamenewsFeedsList');
        if (!listEl) return;
        var feeds = collectGameNewsEditorFeeds();
        feeds.push({
          name: '',
          feedUrl: '',
          channelId: '',
          enabled: true,
        });
        renderGameNewsEditor(feeds);
      });
    }

    var btnSaveGameNewsFeeds = document.getElementById('btnSaveGameNewsFeeds');
    if (btnSaveGameNewsFeeds) {
      btnSaveGameNewsFeeds.addEventListener('click', function () {
        saveGameNewsFeeds().catch(function () {});
      });
    }

    // Delegação para botões de cada linha de feed (remover)
    var feedsList = document.getElementById('gamenewsFeedsList');
    if (feedsList) {
      feedsList.addEventListener('click', function (ev) {
        var target = ev.target;
        if (!target || !target.classList) return;
        if (target.classList.contains('btn-remove-feed')) {
          var row = target.closest('.list-item');
          if (!row) return;
          row.remove();
        }
      });
    }

    // Tickets: delegação para responder / fechar / apagar
    var ticketsList = document.getElementById('ticketsList');
    if (ticketsList) {
      ticketsList.addEventListener('click', function (ev) {
        var target = ev.target;
        if (!target || !target.classList) return;
        var row = target.closest('.list-item');
        if (!row) return;
        var ticketId = row.dataset.ticketId;
        if (!ticketId) return;

        if (target.classList.contains('btn-ticket-reply')) {
          replyTicket(ticketId).catch(function () {});
        } else if (target.classList.contains('btn-ticket-close')) {
          closeTicket(ticketId).catch(function () {});
        } else if (target.classList.contains('btn-ticket-delete')) {
          deleteTicket(ticketId).catch(function () {});
        } else if (target.classList.contains('btn-ticket-reopen')) {
          reopenTicket(ticketId).catch(function () {});
        }
      });

    }

    // Config buttons
    var btnReloadGuildConfig = document.getElementById('btnReloadGuildConfig');
    if (btnReloadGuildConfig) {
      btnReloadGuildConfig.addEventListener('click', function () {
        loadGuildConfig().catch(function () {});
      });
    }

    var btnSaveGuildConfig = document.getElementById('btnSaveGuildConfig');
    if (btnSaveGuildConfig) {
      btnSaveGuildConfig.addEventListener('click', function () {
        saveGuildConfig().catch(function () {});
      });
    }

    // Carrega guilds e visão geral inicial
    loadGuilds().catch(function () {});
    setTab('overview');
  });
})();