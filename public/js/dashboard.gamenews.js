// GameNews module extension for OzarkDashboard
// Lógica da tab GameNews extraída para este módulo.

(function () {
  if (!window.OzarkDashboard) return;

  const D = window.OzarkDashboard;
  const state = D.state;
  const apiGet = D.apiGet;
  const apiPost = D.apiPost;
  const toast = D.toast;
  const t = D.t;
  const escapeHtml = D.escapeHtml;
  const createGameNewsFeedRow = D.createGameNewsFeedRow;
  const renderGameNewsStatus = D.renderGameNewsStatus;

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

  function renderGameNewsEditor(feeds) {
      const listEl = document.getElementById('gamenewsFeedsList');
      if (!listEl) return;
      listEl.innerHTML = '';

      if (!feeds || !feeds.length) {
        const empty = document.createElement('div');
        empty.className = 'empty';
        empty.textContent = t('gamenews_editor_empty');
        listEl.appendChild(empty);
        return;
      }

      feeds.forEach(function (f, idx) {
        const row = createGameNewsFeedRow(f, idx);
        listEl.appendChild(row);
      });
    }

  // Substituir as funções no namespace pela versão deste módulo
  D.loadGameNews = loadGameNews;
  D.renderGameNewsEditor = renderGameNewsEditor;
})();