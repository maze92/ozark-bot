  // GameNews tab: feeds & editor
  // ==========================================

  async function loadGameNews() {
    const statusList = document.getElementById('gamenewsStatusList');
    const feedsList = document.getElementById('gamenewsFeedsList');

    if (!state.guildId) {
      if (statusList) {
        statusList.innerHTML = '';
        const empty = document.createElement('div');
        empty.className = 'empty';
        empty.textContent = t('gamenews_select_guild');
        statusList.appendChild(empty);
      }
      if (feedsList) {
        feedsList.innerHTML = '';
        const empty2 = document.createElement('div');
        empty2.className = 'empty';
        empty2.textContent = t('gamenews_select_guild');
        feedsList.appendChild(empty2);
      }
      return;
    }

    if (statusList) {
      statusList.innerHTML = '';
      const loading = document.createElement('div');
      loading.className = 'empty';
      loading.textContent = t('gamenews_loading');
      statusList.appendChild(loading);
    }
    if (feedsList) {
      feedsList.innerHTML = '';
      const loading2 = document.createElement('div');
      loading2.className = 'empty';
      loading2.textContent = t('gamenews_loading');
      feedsList.appendChild(loading2);
    }

    const guildParam = '?guildId=' + encodeURIComponent(state.guildId);

    try {
      const status = await apiGet('/gamenews-status' + guildParam);
      renderGameNewsStatus((status && status.items) || []);
    } catch (err) {
      console.error('GameNews status error', err);
      if (statusList) {
        statusList.innerHTML = '';
        const div = document.createElement('div');
        div.className = 'empty';
        div.textContent = t('gamenews_error_generic');
        statusList.appendChild(div);
      }
    }

    try {
      const feeds = await apiGet('/gamenews/feeds' + guildParam);
      renderGameNewsEditor((feeds && feeds.items) || []);
    } catch (err) {
      console.error('GameNews feeds error', err);
      if (feedsList) {
        feedsList.innerHTML = '';
        const div = document.createElement('div');
        div.className = 'empty';
        div.textContent = t('gamenews_error_generic');
        feedsList.appendChild(div);
      }
    }
  }

  async function saveGameNewsFeeds() {
    if (!state.guildId) {
      toast(t('gamenews_select_guild'));
      return;
    }

    try {
      const feeds = collectGameNewsEditorFeeds();
      const guildParam = '?guildId=' + encodeURIComponent(state.guildId);
      await apiPost('/gamenews/feeds' + guildParam, { guildId: state.guildId, feeds: feeds });
      toast(t('gamenews_save_success'));
      await loadGameNews();
    } catch (err) {
      console.error('Failed to save GameNews feeds', err);
      toast(t('gamenews_error_generic'));
    }
  }

  
  // -----------------------------
  // Logs de moderação + Tickets
  // -----------------------------

  function renderLogs(items) {
    const listEl = document.getElementById('logsList');
    if (!listEl) return;

    listEl.innerHTML = '';

    if (!items || !items.length) {
      const empty = document.createElement('div');
      empty.className = 'empty';
      empty.textContent = t('logs_empty');
      listEl.appendChild(empty);
      return;
    }

    items.forEach(function (log) {
      const row = createLogRow(log);
      listEl.appendChild(row);
    });
  }

  // ==========================================