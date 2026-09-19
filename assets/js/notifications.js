/* ═══════════════════════════════════════════════════════════
   DigitalPay — Système de Notifications Utilisateur v2.1 FINAL
   Inclus dans : index.html, commande.html, wallet.html,
                 help.html, login.html, register.html, cart.html
   Expose : window.DPNotifications
   ═══════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  if (typeof firebase === 'undefined' || !firebase.apps || !firebase.apps.length) {
    return;
  }

  var db = firebase.firestore();
  var auth = firebase.auth();

  var MAX_FETCH = 50;
  var PAGE_SIZE = 10;

  var currentUid = null;
  var unsubNotifs = null;
  var notifs = [];
  var filter = 'all';
  var visibleCount = PAGE_SIZE;
  var initialized = false;

  /* ═══ HELPERS ═══ */
  function extractMillis(data) {
    if (!data) return 0;
    var v = data.createdAt;
    if (!v) return 0;
    if (typeof v.toMillis === 'function') return v.toMillis();
    if (v.seconds) return v.seconds * 1000;
    return 0;
  }

  function escapeHtml(str) {
    if (str === undefined || str === null) return '';
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function formatDate(ms) {
    var d = new Date(ms);
    var now = new Date();
    var diffDays = Math.floor((now - d) / 86400000);

    if (diffDays === 0 && d.getDate() === now.getDate()) {
      return d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
    }
    if (diffDays === 1 || (diffDays === 0 && d.getDate() !== now.getDate())) {
      return 'Hier · ' + d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
    }
    if (diffDays < 7) {
      return d.toLocaleDateString('fr-FR', { weekday: 'short', hour: '2-digit', minute: '2-digit' });
    }
    return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' });
  }

  function groupByDate(items) {
    var groups = {};
    var now = new Date();
    var todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    var yesterdayStart = todayStart - 86400000;
    var weekStart = todayStart - 7 * 86400000;

    items.forEach(function (n) {
      var ms = extractMillis(n);
      var key;
      if (ms >= todayStart) key = "Aujourd'hui";
      else if (ms >= yesterdayStart) key = 'Hier';
      else if (ms >= weekStart) key = 'Cette semaine';
      else key = 'Plus ancien';
      if (!groups[key]) groups[key] = [];
      groups[key].push(n);
    });
    return groups;
  }

  function getUnreadCount() {
    return notifs.filter(function (n) { return !n.read; }).length;
  }

  /* ═══ BADGE CLOCHE ═══ */
  function updateBadge() {
    var btn = document.getElementById('notif-btn');
    if (!btn) return;
    var count = getUnreadCount();
    var existing = btn.querySelector('.notif-count-badge');

    if (count > 0) {
      btn.classList.add('active');
      var badge = existing;
      if (!badge) {
        badge = document.createElement('span');
        badge.className = 'notif-count-badge';
        badge.style.cssText = 'position:absolute;top:-3px;right:-3px;background:var(--blue-gradient);color:#FFF;font-size:9px;font-weight:800;min-width:17px;height:17px;padding:0 4px;border-radius:9999px;display:flex;align-items:center;justify-content:center;box-shadow:0 0 0 2px var(--bg-page);line-height:1;';
        btn.appendChild(badge);
      }
      badge.textContent = count > 9 ? '9+' : count;
    } else {
      btn.classList.remove('active');
      if (existing) existing.remove();
    }
  }

  /* ═══ PANEL STRUCTURE ═══ */
  function ensurePanelStructure() {
    var panel = document.getElementById('notif-panel');
    if (!panel) return null;

    if (panel.dataset.dpEnhanced === '1') return panel;

    panel.innerHTML = '' +
      '<div class="notif-head" style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;gap:8px;">' +
        '<div style="display:flex;align-items:center;gap:8px;">' +
          '<span class="notif-head-title" style="font-size:12px;font-weight:800;text-transform:uppercase;letter-spacing:0.6px;color:var(--text-tertiary);">Annonces</span>' +
          '<span class="dp-notif-unread-pill" style="display:none;background:var(--blue-50);color:var(--blue-600);font-size:10px;font-weight:800;padding:2px 8px;border-radius:9999px;"></span>' +
        '</div>' +
        '<div style="display:flex;align-items:center;gap:6px;">' +
          '<button class="dp-notif-mark-all" title="Tout marquer comme lu" style="display:none;border:none;background:var(--bg-subtle);width:28px;height:28px;border-radius:50%;cursor:pointer;color:var(--text-secondary);font-family:inherit;align-items:center;justify-content:center;padding:0;">' +
            '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"/></svg>' +
          '</button>' +
          '<button class="notif-close" onclick="toggleNotifications()" style="border:none;background:var(--bg-subtle);width:28px;height:28px;border-radius:50%;cursor:pointer;font-weight:700;color:var(--text-secondary);font-family:inherit;">✕</button>' +
        '</div>' +
      '</div>' +

      '<div class="dp-notif-filters" style="display:flex;gap:6px;margin-bottom:10px;">' +
        '<button class="dp-notif-filter active" data-filter="all" style="flex:1;height:32px;border-radius:8px;border:1px solid var(--border-default);background:var(--text-primary);color:#FFF;font-size:11.5px;font-weight:800;cursor:pointer;font-family:inherit;">Toutes</button>' +
        '<button class="dp-notif-filter" data-filter="unread" style="flex:1;height:32px;border-radius:8px;border:1px solid var(--border-default);background:var(--bg-card);color:var(--text-secondary);font-size:11.5px;font-weight:800;cursor:pointer;font-family:inherit;">Non lues</button>' +
      '</div>' +

      '<div class="dp-notif-list" style="max-height:60vh;overflow-y:auto;-webkit-overflow-scrolling:touch;"></div>' +

      '<button class="dp-notif-load-more" style="display:none;width:100%;height:40px;margin-top:8px;border:1px dashed var(--border-default);background:var(--bg-subtle);color:var(--blue-600);font-size:12px;font-weight:800;border-radius:10px;cursor:pointer;font-family:inherit;">Charger plus</button>';

    var filters = panel.querySelectorAll('.dp-notif-filter');
    for (var f = 0; f < filters.length; f++) {
      (function (btn) {
        btn.addEventListener('click', function () {
          filter = btn.dataset.filter;
          visibleCount = PAGE_SIZE;
          for (var b = 0; b < filters.length; b++) {
            var isActive = filters[b].dataset.filter === filter;
            filters[b].style.background = isActive ? 'var(--text-primary)' : 'var(--bg-card)';
            filters[b].style.color = isActive ? '#FFF' : 'var(--text-secondary)';
            filters[b].style.borderColor = isActive ? 'var(--text-primary)' : 'var(--border-default)';
          }
          renderList();
        });
      })(filters[f]);
    }

    panel.querySelector('.dp-notif-mark-all').addEventListener('click', markAllRead);
    panel.querySelector('.dp-notif-load-more').addEventListener('click', function () {
      visibleCount += PAGE_SIZE;
      renderList();
    });

    panel.dataset.dpEnhanced = '1';
    return panel;
  }

  /* ═══ RENDER LIST ═══ */
  function renderList() {
    var panel = document.getElementById('notif-panel');
    if (!panel) return;

    var listEl = panel.querySelector('.dp-notif-list');
    var loadMoreEl = panel.querySelector('.dp-notif-load-more');
    var unreadPill = panel.querySelector('.dp-notif-unread-pill');
    var markAllBtn = panel.querySelector('.dp-notif-mark-all');

    if (!listEl) return;

    var filtered = filter === 'unread' ? notifs.filter(function (n) { return !n.read; }) : notifs.slice();

    var unread = getUnreadCount();
    if (unreadPill) {
      if (unread > 0) {
        unreadPill.style.display = 'inline-block';
        unreadPill.textContent = unread + ' non lue' + (unread > 1 ? 's' : '');
      } else {
        unreadPill.style.display = 'none';
      }
    }
    if (markAllBtn) {
      markAllBtn.style.display = unread > 0 ? 'flex' : 'none';
    }

    if (filtered.length === 0) {
      listEl.innerHTML = '' +
        '<div style="text-align:center;padding:32px 16px;color:var(--text-tertiary);">' +
          '<div style="width:56px;height:56px;border-radius:50%;background:var(--bg-subtle);display:flex;align-items:center;justify-content:center;margin:0 auto 12px;">' +
            '<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 01-3.46 0"/></svg>' +
          '</div>' +
          '<div style="font-size:13px;font-weight:800;color:var(--text-primary);margin-bottom:4px;">' +
            (filter === 'unread' ? 'Aucune annonce non lue' : 'Aucune annonce') +
          '</div>' +
          '<div style="font-size:12px;line-height:1.5;">Les nouvelles notifications apparaîtront ici.</div>' +
        '</div>';
      if (loadMoreEl) loadMoreEl.style.display = 'none';
      return;
    }

    var visible = filtered.slice(0, visibleCount);
    var hasMore = filtered.length > visibleCount;
    var groups = groupByDate(visible);

    var html = '';
    Object.keys(groups).forEach(function (groupKey) {
      html += '<div style="font-size:10.5px;font-weight:800;text-transform:uppercase;letter-spacing:0.6px;color:var(--text-tertiary);margin:14px 0 8px;padding:0 4px;">' + escapeHtml(groupKey) + '</div>';
      groups[groupKey].forEach(function (n, i) {
        var isRead = !!n.read;
        var bg = isRead ? 'var(--bg-card)' : 'var(--blue-50)';
        var borderColor = isRead ? 'var(--border-subtle)' : 'var(--blue-600)';
        var dot = isRead ? '' : '<span style="display:inline-block;width:6px;height:6px;border-radius:50%;background:var(--blue-600);margin-right:6px;vertical-align:middle;"></span>';
        html += '' +
          '<div class="dp-notif-item" data-id="' + escapeHtml(n._id) + '" style="animation:dpNotifFadeIn 0.35s ease ' + (i * 0.04) + 's both;padding:12px 14px;background:' + bg + ';border:1px solid ' + borderColor + ';border-left:3px solid ' + borderColor + ';border-radius:10px;margin-bottom:8px;cursor:pointer;transition:transform 0.15s ease;" onclick="DPNotifications.markRead(\'' + escapeHtml(n._id) + '\')">' +
            '<div style="font-size:12.5px;font-weight:800;color:var(--text-primary);margin-bottom:4px;display:flex;align-items:center;">' +
              dot + escapeHtml(n.title || 'DigitalPay') +
            '</div>' +
            '<div style="font-size:12px;color:var(--text-secondary);line-height:1.5;padding-left:' + (isRead ? '0' : '12px') + ';">' +
              escapeHtml(n.message || '') +
            '</div>' +
            '<div style="font-size:10px;color:var(--text-quaternary);margin-top:6px;font-weight:600;padding-left:' + (isRead ? '0' : '12px') + ';">' +
              escapeHtml(formatDate(extractMillis(n))) +
            '</div>' +
          '</div>';
      });
    });

    if (!document.getElementById('dp-notif-anim')) {
      var style = document.createElement('style');
      style.id = 'dp-notif-anim';
      style.textContent = '@keyframes dpNotifFadeIn{from{opacity:0;transform:translateY(6px);}to{opacity:1;transform:translateY(0);}}';
      document.head.appendChild(style);
    }

    listEl.innerHTML = html;
    if (loadMoreEl) {
      loadMoreEl.style.display = hasMore ? 'block' : 'none';
      loadMoreEl.textContent = 'Charger plus (' + (filtered.length - visibleCount) + ' restantes)';
    }
  }

  /* ═══ LISTENER FIRESTORE ═══ */
  function listenForUser(uid) {
    if (unsubNotifs) { unsubNotifs(); unsubNotifs = null; }
    currentUid = uid;

    if (!uid) {
      notifs = [];
      updateBadge();
      renderList();
      return;
    }

    unsubNotifs = db.collection('user_notifications')
      .where('userId', '==', uid)
      .orderBy('createdAt', 'desc')
      .limit(MAX_FETCH)
      .onSnapshot(function (snap) {
        notifs = [];
        snap.forEach(function (doc) {
          var data = doc.data();
          data._id = doc.id;
          notifs.push(data);
        });
        updateBadge();
        renderList();
      }, function (err) {
        console.warn('[DPNotifications]', err.code);
      });
  }

  /* ═══ ACTIONS ═══ */
  async function markRead(notifId) {
    if (!currentUid || !notifId) return;
    var n = null;
    for (var i = 0; i < notifs.length; i++) {
      if (notifs[i]._id === notifId) { n = notifs[i]; break; }
    }
    if (!n || n.read) return;
    try {
      await db.collection('user_notifications').doc(notifId).update({
        read: true,
        readAt: firebase.firestore.FieldValue.serverTimestamp()
      });
    } catch (e) { console.warn('[DPNotifications] markRead:', e); }
  }

  async function markAllRead() {
    if (!currentUid) return;
    var unread = notifs.filter(function (n) { return !n.read; });
    if (unread.length === 0) return;

    var batch = db.batch();
    unread.forEach(function (n) {
      batch.update(db.collection('user_notifications').doc(n._id), {
        read: true,
        readAt: firebase.firestore.FieldValue.serverTimestamp()
      });
    });

    try {
      await batch.commit();
      var container = document.getElementById('toast-container');
      if (container) {
        container.innerHTML = '';
        var toast = document.createElement('div');
        toast.className = 'toast info';
        toast.innerHTML = '<div class="toast-icon"><svg viewBox="0 0 24 24"><path d="M20 6L9 17l-5-5" stroke-linecap="round" stroke-linejoin="round"/></svg></div><div class="toast-msg">' + unread.length + ' annonce' + (unread.length > 1 ? 's' : '') + ' marquée' + (unread.length > 1 ? 's' : '') + ' comme lue' + (unread.length > 1 ? 's' : '') + '</div>';
        container.appendChild(toast);
        requestAnimationFrame(function () { toast.classList.add('show'); });
        setTimeout(function () { toast.classList.remove('show'); setTimeout(function () { toast.remove(); }, 350); }, 2400);
      }
    } catch (e) {
      console.warn('[DPNotifications] markAllRead:', e);
    }
  }

  function refresh() {
    if (currentUid) listenForUser(currentUid);
  }

  /* ═══ INIT ═══ */
  function init() {
    if (initialized) return;
    initialized = true;
    ensurePanelStructure();
    auth.onAuthStateChanged(function (user) {
      listenForUser(user ? user.uid : null);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  window.addEventListener('load', function () {
    setTimeout(ensurePanelStructure, 300);
  });

  /* ═══ EXPOSE ═══ */
  window.DPNotifications = {
    markRead: markRead,
    markAllRead: markAllRead,
    refresh: refresh,
    getUnreadCount: getUnreadCount
  };
})();