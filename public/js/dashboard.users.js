  // Users tab: list & history
  // ==========================================

  async function loadUsers() {
    const listEl = document.querySelector('#tab-user .list');
    if (!listEl) return;

    listEl.innerHTML = '';

    // Update member count label (if we know it)
    var membersLabel = document.getElementById('usersMemberCount');
    if (membersLabel) {
      var guildInfo = Array.isArray(state.guilds)
        ? state.guilds.find(function (g) { return g && g.id === state.guildId; })
        : null;
      if (guildInfo && typeof guildInfo.memberCount === 'number') {
        if (state.lang === 'pt') {
          membersLabel.textContent = guildInfo.memberCount + ' membros';
        } else {
          membersLabel.textContent = guildInfo.memberCount + ' members';
        }
      } else {
        membersLabel.textContent = '';
      }
    }

    if (!state.guildId) {
      const div = document.createElement('div');
      div.className = 'empty';
      div.textContent = t('users_empty');
      listEl.appendChild(div);
      return;
    }

    const loading = document.createElement('div');
    loading.className = 'empty';
    loading.textContent = '...';
    listEl.appendChild(loading);

    try {
      const res = await apiGet('/guilds/' + encodeURIComponent(state.guildId) + '/users');
      const items = (res && res.items) || [];
      listEl.innerHTML = '';

      if (!items.length) {
        const empty = document.createElement('div');
        empty.className = 'empty';
        empty.textContent = t('users_empty');
        listEl.appendChild(empty);
        return;
      }

      const detailEl = document.getElementById('userDetailPanel');
      // Limpar painel de detalhe quando se recarrega a lista
      if (detailEl) {
        detailEl.innerHTML = `<div class="empty">${escapeHtml(t('users_detail_empty'))}</div>`;
      }

      items.forEach(function (u) {
        if (u && u.bot) return;
        const row = document.createElement('div');
        row.className = 'list-item';
        row.dataset.userId = u.id || '';
        row.dataset.username = u.username || u.tag || u.id || '';

        const name = u.username || u.tag || u.id;
        const roles = (u.roles || []).map(function (r) { return r.name; }).join(', ');

        const isBot = !!u.bot;

        row.innerHTML = `
          <div class="user-row-header">
            <div class="title">${escapeHtml(name)}</div>
            <div class="user-type-badge ${isBot ? 'bot' : 'human'}">
              ${escapeHtml(isBot ? 'BOT' : 'USER')}
            </div>
          </div>
          <div class="subtitle">
            ${escapeHtml(u.id)}${roles ? ' • ' + escapeHtml(roles) : ''}
          </div>
        `;

        row.addEventListener('click', function () {
          // Marcar seleção visual
          document.querySelectorAll('#tab-user .list .list-item').forEach(function (el) {
            el.classList.remove('active');
          });
          row.classList.add('active');

          loadUserHistory({
            id: u.id,
            username: u.username || u.tag || u.id || '',
            bot: !!u.bot
          }).catch(function (err) {
            console.error('Failed to load user history', err);
          });
        });

        listEl.appendChild(row);
      });
    } catch (err) {
      console.error('Failed to load users', err);
      listEl.innerHTML = '';
      const empty = document.createElement('div');
      empty.className = 'empty';
      empty.textContent = t('users_error_generic');
      listEl.appendChild(empty);
    }
  }


  async function loadUserHistory(user) {
    const detailEl = document.getElementById('userDetailPanel');
    if (!detailEl) return;

    if (!state.guildId || !user || !user.id) {
      detailEl.innerHTML = `<div class="empty">${escapeHtml(t('users_detail_empty'))}</div>`;
      return;
    }

    // Placeholder for bots
    if (user.bot) {
      detailEl.innerHTML = `
        <div class="title">${escapeHtml(t('users_history_title'))}</div>
        <div class="subtitle">${escapeHtml(user.username || user.id)} • BOT</div>
        <div class="empty">${escapeHtml(t('users_history_none'))}</div>
      `;
      return;
    }

    detailEl.innerHTML = `<div class="empty">${escapeHtml(t('loading'))}</div>`;

    try {
      const [historyRes, userRes] = await Promise.all([
        apiGet(
          '/guilds/' +
            encodeURIComponent(state.guildId) +
            '/users/' +
            encodeURIComponent(user.id) +
            '/history'
        ),
        apiGet(
          '/user?guildId=' +
            encodeURIComponent(state.guildId) +
            '&userId=' +
            encodeURIComponent(user.id)
        )
      ]);

      if (!historyRes || historyRes.ok === false) {
        console.error('User history error', historyRes && historyRes.error);
        detailEl.innerHTML = `<div class="empty">${escapeHtml(t('cases_error_generic'))}</div>`;
        return;
      }

      const infractions = historyRes.infractions || [];
      const counts = historyRes.counts || {};
      const tickets = historyRes.tickets || [];

      const dbInfo = userRes && userRes.db ? userRes.db : null;

      let html = '';

      html += `<div class="title">${escapeHtml(t('users_history_title'))}</div>`;
      html += `<div class="subtitle">${escapeHtml(user.username || user.id)} • ${escapeHtml(user.id)}</div>`;

      // Trust e próxima penalização
      if (dbInfo && typeof dbInfo.trust === 'number') {
        html += '<div class="history-section user-trust">';
        html += `<h3>${escapeHtml(t('users_trust_title'))}</h3>`;

        html += '<div class="user-trust-main">';

        // Badge para nível de trust (baixo / médio / alto)
        var trustVal = dbInfo.trust;
        var trustLabel = dbInfo.trustLabel ? String(dbInfo.trustLabel) : '';
        var trustLabelLower = trustLabel.toLowerCase();
        var trustLevelClass = 'neutral';

        if (trustLabelLower.includes('alto') || trustLabelLower.includes('high')) {
          trustLevelClass = 'high';
        } else if (
          trustLabelLower.includes('médio') ||
          trustLabelLower.includes('medio') ||
          trustLabelLower.includes('medium')
        ) {
          trustLevelClass = 'medium';
        } else if (trustLabelLower.includes('baixo') || trustLabelLower.includes('low')) {
          trustLevelClass = 'low';
        }

        html += '<div class="user-trust-header">';
        html +=
          '<div class="user-trust-score">' +
          escapeHtml(t('users_trust_score')) +
          ': ' +
          String(trustVal) +
          '</div>';

        if (trustLabel) {
          html +=
            '<span class="trust-badge trust-badge-' +
            trustLevelClass +
            '">' +
            escapeHtml(trustLabel) +
            '</span>';
        }

        html += '</div>';

        if (dbInfo.nextPenalty && dbInfo.nextPenalty.automationEnabled) {
          var np = dbInfo.nextPenalty;
          var remaining =
            typeof np.remaining === 'number' ? np.remaining : null;
          var mins =
            typeof np.estimatedMuteMinutes === 'number'
              ? np.estimatedMuteMinutes
              : null;

          // Número atual de WARNs (para mostrar no texto de limiar)
          var currentWarns =
            dbInfo && typeof dbInfo.warnings === 'number'
              ? dbInfo.warnings
              : (counts && counts.WARN) || 0;

          html += '<div class="user-trust-next">';
          if (mins !== null) {
            if (remaining !== null && remaining > 0) {
              html += `<span>${escapeHtml(t('users_trust_next_penalty_prefix'))} ${String(
                remaining
              )} warn(s); ${escapeHtml(t('users_trust_next_penalty_suffix'))} ~${String(mins)} min</span>`;
            } else {
              html += `<span>${escapeHtml(
                t('users_trust_next_penalty_at_threshold')
              )} ~${String(mins)} min (${String(currentWarns)} WARN(s) atuais)</span>`;
            }
          }
          html += '</div>';
        } else {
          html +=
            '<div class="user-trust-next-disabled">' +
            escapeHtml(t('users_trust_automation_disabled')) +
            '</div>';
        }

        html += '</div>'; // user-trust-main
        html += '</div>'; // history-section user-trust
      }

      // Badges de resumo
      html += '<div class="badge-row">';

      const warnCount =
        dbInfo && typeof dbInfo.warnings === 'number'
          ? dbInfo.warnings
          : (counts.WARN || 0);
      const muteCount = counts.MUTE || 0;

      if (warnCount || muteCount) {
        if (warnCount) {
          html += `<div class="badge badge-warn">WARN: ${String(warnCount)}</div>`;
        }
        if (muteCount) {
          html += `<div class="badge badge-mute">MUTE: ${String(muteCount)}</div>`;
        }
      } else {
        html += `<div class="badge">${escapeHtml(t('users_history_none'))}</div>`;
      }

      html += '</div>';

      // Ações rápidas de moderação
      html += '<div class="history-section user-actions">';
      html += `<h3>${escapeHtml(t('users_actions_title'))}</h3>`;

      html += '<div class="user-actions-fields">';
      html += `<input type="text" class="input xs user-actions-reason" placeholder="${escapeHtml(
        t('users_actions_reason_placeholder')
      )}">`;
      html += '</div>';

      html += '<div class="badge-row user-actions-buttons">';
      html += `<button type="button" class="btn xs btn-warn" data-action="warn">${escapeHtml(
        t('users_actions_warn')
      )}</button>`;
      html += `<button type="button" class="btn xs btn-unmute" data-action="unmute">${escapeHtml(
        t('users_actions_unmute')
      )}</button>`;
      html += `<button type="button" class="btn xs btn-reset" data-action="reset">${escapeHtml(
        t('users_actions_reset')
      )}</button>`;
      html += '</div>';
      html += '</div>';

      // Infrações recentes
      html += '<div class="history-section">';
      html += `<h3>${escapeHtml(t('users_history_infractions'))}</h3>`;
      html +=
        '<div class="history-hint">' +
        escapeHtml(t('users_history_click_to_remove')) +
        '</div>';

      if (!infractions.length) {
        html += `<div class="empty" style="margin-top:4px;">${escapeHtml(t('users_history_none'))}</div>`;
      } else {
        html += '<ul class="infractions-list">';
        infractions.forEach(function (inf) {
          const id = (inf._id || inf.id || '').toString();
          const when = inf.createdAt
            ? new Date(inf.createdAt).toLocaleString()
            : '';
          const reason = inf.reason || '';
          const line =
            '[' +
            (inf.type || 'UNK') +
            '] ' +
            (reason ? reason : '') +
            (when ? ' • ' + when : '');
          html += `<li class="infraction-item" data-infraction-id="${escapeHtml(id)}">${escapeHtml(line)}</li>`;
        });
        html += '</ul>';
      }
      html += '</div>';

      // Tickets recentes
      html += '<div class="history-section">';
      html += `<h3>${escapeHtml(t('users_history_tickets'))}</h3>`;

      if (!tickets.length) {
        html += `<div class="empty" style="margin-top:4px;">${escapeHtml(t('users_history_none'))}</div>`;
      } else {
        html += '<ul>';
        tickets.forEach(function (tkt) {
          const opened = tkt.createdAt
            ? new Date(tkt.createdAt).toLocaleString()
            : '';
          const status = tkt.closedAt ? 'Fechado' : 'Aberto';
          const line =
            '#' +
            String(tkt.ticketNumber).padStart(3, '0') +
            ' • ' +
            status +
            (opened ? ' • ' + opened : '');
          html += `<li>${escapeHtml(line)}</li>`;
        });
        html += '</ul>';
      }
      html += '</div>';

      detailEl.innerHTML = html;

      // Bind quick moderation actions
      try {
        const container = detailEl.querySelector('.user-actions');
        if (container) {
          container.querySelectorAll('button[data-action]').forEach(function (btn) {
            btn.addEventListener('click', function () {
              const action = btn.getAttribute('data-action');
              if (!state.guildId || !user || !user.id) return;

              const reasonInput =
                container.querySelector('.user-actions-reason') || null;

              const reasonRaw = reasonInput && reasonInput.value ? reasonInput.value : '';
              const reason = reasonRaw.trim() || null;

              if (action === 'reset-history') {
                apiPost('/mod/reset-history', {
                  guildId: state.guildId,
                  userId: user.id,
                  reason: reason
                })
                  .then(function (res) {
                    if (!res || res.ok === false) {
                      console.error('Reset history failed', res && res.error);
                      toast(res && res.error ? String(res.error) : t('cases_error_generic'));
                      return;
                    }
                    toast(t('users_actions_reset_history') + ' OK');
                    loadUserHistory(user).catch(function () {});
                  })
                  .catch(function (err) {
                    console.error('Reset history error', err);
                    toast(t('cases_error_generic'));
                  });
              } else if (action === 'warn') {
                apiPost('/mod/warn', {
                  guildId: state.guildId,
                  userId: user.id,
                  reason: reason
                })
                  .then(function (res) {
                    if (!res || res.ok === false) {
                      console.error('Warn failed', res && res.error);
                      toast(res && res.error ? String(res.error) : t('cases_error_generic'));
                      return;
                    }
                    toast(t('users_actions_warn') + ' OK');
                    // reload history to reflect new infraction
                    loadUserHistory(user).catch(function () {});
                  })
                  .catch(function (err) {
                    console.error('Warn error', err);
                    toast(t('cases_error_generic'));
                  });
              } else if (action === 'unmute') {
                apiPost('/mod/unmute', {
                  guildId: state.guildId,
                  userId: user.id,
                  reason: reason
                })
                  .then(function (res) {
                    if (!res || res.ok === false) {
                      console.error('Unmute failed', res && res.error);
                      toast(res && res.error ? String(res.error) : t('cases_error_generic'));
                      return;
                    }
                    toast(t('users_actions_unmute') + ' OK');
                    loadUserHistory(user).catch(function () {});
                  })
                  .catch(function (err) {
                    console.error('Unmute error', err);
                    toast(t('cases_error_generic'));
                  });
              } else if (action === 'reset') {
                apiPost('/mod/reset-trust', {
                  guildId: state.guildId,
                  userId: user.id,
                  reason: reason
                })
                  .then(function (res) {
                    if (!res || res.ok === false) {
                      console.error('Reset trust failed', res && res.error);
                      toast(res && res.error ? String(res.error) : t('cases_error_generic'));
                      return;
                    }
                    toast(t('users_actions_reset') + ' OK');
                    loadUserHistory(user).catch(function () {});
                  })
                  .catch(function (err) {
                    console.error('Reset trust error', err);
                    toast(t('cases_error_generic'));
                  });
              }
            });
          });
        }

        // Bind infractions click-to-remove
        const infraList = detailEl.querySelector('.infractions-list');
        if (infraList) {
          infraList.querySelectorAll('.infraction-item').forEach(function (li) {
            li.addEventListener('click', function () {
              const id = li.getAttribute('data-infraction-id');
              if (!id || !state.guildId || !user || !user.id) return;

              if (!window.confirm(t('users_history_remove_confirm'))) return;

              apiPost('/mod/remove-infraction', {
                guildId: state.guildId,
                userId: user.id,
                infractionId: id
              })
                .then(function (res) {
                  if (!res || res.ok === false) {
                    console.error('Remove infraction failed', res && res.error);
                    toast(res && res.error ? String(res.error) : t('cases_error_generic'));
                    return;
                  }
                  // Feedback visual e reload de histórico
                  li.classList.add('removing');
                  toast(t('users_history_remove_success'));
                  loadUserHistory(user).catch(function () {});
                })
                .catch(function (err) {
                  console.error('Remove infraction error', err);
                  toast(t('cases_error_generic'));
                });
            });
          });
        }
      } catch (err) {
        console.error('Failed to bind user quick actions', err);
      }
    } catch (err) {
      console.error('Failed to load user history', err);
      detailEl.innerHTML =
        '<div class="empty">Erro ao carregar histórico / error loading history.</div>';
    }
  }

  // -----------------------------
  // GameNews (status + editor)
  // -----------------------------

  function renderGameNewsStatus(items) {
    const listEl = document.getElementById('gamenewsStatusList');
    if (!listEl) return;
    listEl.innerHTML = '';

    if (!items || !items.length) {
      const empty = document.createElement('div');
      empty.className = 'empty';
      empty.textContent = t('gamenews_empty');
      listEl.appendChild(empty);
      return;
    }

    items.forEach(function (s) {
      const row = document.createElement('div');
      row.className = 'list-item';

      const lastSent = s.lastSentAt ? new Date(s.lastSentAt).toLocaleString() : '—';
      const fails = s.failCount != null ? String(s.failCount) : '0';

      let stateLabel;
      if (s.enabled === false) {
        stateLabel = t('gamenews_status_state_paused');
      } else if (s.paused) {
        stateLabel = t('gamenews_status_state_paused');
      } else if (s.failCount && s.failCount > 0) {
        stateLabel = t('gamenews_status_state_error');
      } else {
        stateLabel = t('gamenews_status_state_ok');
      }

      const statusText = stateLabel + ' • ' + 'Fails: ' + fails;

      row.innerHTML =
        '<div class="title">' +
        escapeHtml(s.feedName || s.source || 'Feed') +
        '</div>' +
        '<div class="subtitle">' +
        escapeHtml(s.feedUrl || '') +
        '</div>' +
        '<div class="meta">' +
        escapeHtml(statusText) +
        ' • ' + escapeHtml(t('gamenews_status_last_label')) + ': ' +
        escapeHtml(lastSent) +
        '</div>';

      listEl.appendChild(row);
    });
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

  function collectGameNewsEditorFeeds() {
    const listEl = document.getElementById('gamenewsFeedsList');
    if (!listEl) return [];
    const rows = Array.prototype.slice.call(listEl.querySelectorAll('.list-item'));
    return rows
      .map(function (row) {
        const name = row.querySelector('.feed-name').value.trim();
        const feedUrl = row.querySelector('.feed-url').value.trim();
        const channelId = row.querySelector('.feed-channel').value.trim();
        const enabled = row.querySelector('.feed-enabled').checked;
        if (!feedUrl || !channelId) return null;
        return { name: name || 'Feed', feedUrl: feedUrl, channelId: channelId, enabled: enabled };
      })
      .filter(function (x) { return !!x; });
  }

  // ==========================================