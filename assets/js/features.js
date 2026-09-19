/* ═══════════════════════════════════════════════════════════
   DigitalPay Haiti — Business Features v1.5 FINAL
   Notes · Avis · Alertes stock · Multi-devise (1$ = 145 HTG)
   Multi-panier · Stats perso · Cadeau · Rate-limit · Retry
   Sans codes promo
   Expose : window.DPFeatures
   ═══════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  if (typeof firebase === 'undefined' || !firebase.apps || !firebase.apps.length) return;

  var db = firebase.firestore();
  var auth = firebase.auth();
  var currentUser = null;

  /* ═══ CONFIG ═══ */
  var USD_RATE = 145; /* 1 USD = 145 HTG — affichage uniquement */
  var RATE_LIMIT_DEPOSIT_MS = 60000;
  var RATE_LIMIT_ORDER_MS = 30000;
  var MAX_RETRIES = 3;

  var STATE = {
    page: '',
    giftMode: false,
    lastSubmitAt: 0
  };

  function detectPage() {
    var p = window.location.pathname || '/';
    if (p.indexOf('/cart') !== -1) return 'cart';
    if (p.indexOf('/commande') !== -1) return 'commande';
    if (p.indexOf('/wallet') !== -1) return 'wallet';
    if (p.indexOf('/index') !== -1 || p === '/' || p === '') return 'index';
    return '';
  }

  function escapeHtml(s) {
    if (s === undefined || s === null) return '';
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function showToast(msg, type) {
    if (typeof window.showToast === 'function') {
      window.showToast(msg, type || 'info');
    }
  }

  /* ═══════════════════════════════════════════════════════════
     1. NOTES PERSONNELLES (commande.html)
     ═══════════════════════════════════════════════════════════ */
  function initOrderNotes() {
    if (STATE.page !== 'commande') return;

    var list = document.getElementById('orders-list');
    if (!list) return;

    var observer = new MutationObserver(function () {
      var cards = list.querySelectorAll('.order-card');
      for (var i = 0; i < cards.length; i++) injectNoteBox(cards[i]);
    });
    observer.observe(list, { childList: true, subtree: true });

    var existing = list.querySelectorAll('.order-card');
    for (var k = 0; k < existing.length; k++) injectNoteBox(existing[k]);
  }

  function injectNoteBox(card) {
    if (card.querySelector('.dp-note-box')) return;
    var orderId = extractOrderId(card);
    if (!orderId) return;

    var box = document.createElement('div');
    box.className = 'dp-note-box';
    box.dataset.orderId = orderId;
    box.innerHTML =
      '<div class="dp-note-box-head">' +
        '<div class="dp-note-box-title">' +
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>' +
          'Note personnelle' +
        '</div>' +
        '<button type="button" class="dp-note-edit-btn">Modifier</button>' +
      '</div>' +
      '<div class="dp-note-text dp-note-empty">Aucune note</div>';

    var existing = loadNoteFromCache(orderId);
    if (existing) {
      var textEl = box.querySelector('.dp-note-text');
      textEl.classList.remove('dp-note-empty');
      textEl.textContent = existing;
    }

    var details = card.querySelector('.order-details');
    if (details && details.parentNode) {
      details.parentNode.insertBefore(box, details.nextSibling);
    } else {
      card.appendChild(box);
    }

    box.querySelector('.dp-note-edit-btn').addEventListener('click', function () {
      editNote(box, orderId);
    });
  }

  function loadNoteFromCache(orderId) {
    try {
      var cache = JSON.parse(localStorage.getItem('dp_order_notes') || '{}');
      return cache[orderId] || '';
    } catch (e) { return ''; }
  }

  function saveNoteToCache(orderId, text) {
    try {
      var cache = JSON.parse(localStorage.getItem('dp_order_notes') || '{}');
      if (text) cache[orderId] = text;
      else delete cache[orderId];
      localStorage.setItem('dp_order_notes', JSON.stringify(cache));
    } catch (e) {}
  }

  function editNote(box, orderId) {
    var current = loadNoteFromCache(orderId);
    var textEl = box.querySelector('.dp-note-text');
    textEl.style.display = 'none';

    var editor = document.createElement('div');
    editor.innerHTML =
      '<textarea class="dp-note-textarea" maxlength="300" placeholder="Ex: pour mon frère, livrer avant 18h...">' + escapeHtml(current) + '</textarea>' +
      '<button type="button" class="dp-note-save">Enregistrer</button>';
    box.appendChild(editor);

    var ta = editor.querySelector('textarea');
    ta.focus();

    editor.querySelector('.dp-note-save').addEventListener('click', function () {
      var val = ta.value.trim().slice(0, 300);
      saveNoteToCache(orderId, val);
      textEl.textContent = val || 'Aucune note';
      textEl.classList.toggle('dp-note-empty', !val);
      textEl.style.display = '';
      editor.remove();
      showToast('Note enregistrée', 'success');
    });
  }

  function extractOrderId(card) {
    var refEl = card.querySelector('.order-detail-row .order-detail-val');
    if (refEl) return refEl.textContent.trim();
    return null;
  }

  /* ═══════════════════════════════════════════════════════════
     2. NOTATION PRODUITS POST-LIVRAISON
     ═══════════════════════════════════════════════════════════ */
  function initRatings() {
    if (STATE.page !== 'commande') return;

    var list = document.getElementById('orders-list');
    if (!list) return;

    var observer = new MutationObserver(function () {
      var cards = list.querySelectorAll('.order-card');
      for (var i = 0; i < cards.length; i++) checkAndShowRating(cards[i]);
    });
    observer.observe(list, { childList: true, subtree: true });

    var existing = list.querySelectorAll('.order-card');
    for (var k = 0; k < existing.length; k++) checkAndShowRating(existing[k]);

    setTimeout(autoPopupRating, 1200);
  }

  function checkAndShowRating(card) {
    var statusPill = card.querySelector('.order-status-pill');
    if (!statusPill || !statusPill.classList.contains('livre')) return;

    var orderId = extractOrderId(card);
    if (!orderId) return;

    if (isRated(orderId)) return;
    if (card.querySelector('.dp-rate-cta')) return;

    var details = card.querySelector('.order-details');
    if (!details) return;

    var cta = document.createElement('button');
    cta.type = 'button';
    cta.className = 'dp-share-btn dp-rate-cta';
    cta.style.background = 'var(--blue-50)';
    cta.style.borderColor = 'var(--blue-200)';
    cta.style.color = 'var(--blue-700)';
    cta.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg> <span>Noter ce produit</span>';
    cta.addEventListener('click', function () {
      openRatingModal(orderId, card);
    });

    details.parentNode.insertBefore(cta, details.nextSibling);
  }

  function autoPopupRating() {
    var cards = document.querySelectorAll('.order-card');
    for (var i = 0; i < cards.length; i++) {
      var s = cards[i].querySelector('.order-status-pill');
      if (!s || !s.classList.contains('livre')) continue;
      var oid = extractOrderId(cards[i]);
      if (!oid || isRated(oid)) continue;
      try {
        if (sessionStorage.getItem('dp_rated_auto') === '1') return;
        sessionStorage.setItem('dp_rated_auto', '1');
      } catch (e) {}
      openRatingModal(oid, cards[i]);
      return;
    }
  }

  function isRated(orderId) {
    try {
      var cache = JSON.parse(localStorage.getItem('dp_rated_orders') || '{}');
      return !!cache[orderId];
    } catch (e) { return false; }
  }

  function markRated(orderId) {
    try {
      var cache = JSON.parse(localStorage.getItem('dp_rated_orders') || '{}');
      cache[orderId] = Date.now();
      localStorage.setItem('dp_rated_orders', JSON.stringify(cache));
    } catch (e) {}
  }

  function openRatingModal(orderId, card) {
    var existing = document.querySelector('.dp-rating-modal');
    if (existing) existing.remove();

    var titleEl = card.querySelector('.order-title');
    var prodTitle = titleEl ? titleEl.textContent.trim() : 'Produit';
    var prodId = extractProductIdFromOrder(card);

    var modal = document.createElement('div');
    modal.className = 'dp-rating-modal';
    modal.innerHTML =
      '<div class="dp-rating-card">' +
        '<div class="dp-rating-title">Notez votre commande</div>' +
        '<div class="dp-rating-sub">' + escapeHtml(prodTitle) + ' — Votre avis nous aide à améliorer le service.</div>' +
        '<div class="dp-rating-stars" id="dp-rating-stars">' +
          '<button type="button" class="dp-rating-star" data-v="1"><svg viewBox="0 0 24 24"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg></button>' +
          '<button type="button" class="dp-rating-star" data-v="2"><svg viewBox="0 0 24 24"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg></button>' +
          '<button type="button" class="dp-rating-star" data-v="3"><svg viewBox="0 0 24 24"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg></button>' +
          '<button type="button" class="dp-rating-star" data-v="4"><svg viewBox="0 0 24 24"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg></button>' +
          '<button type="button" class="dp-rating-star" data-v="5"><svg viewBox="0 0 24 24"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg></button>' +
        '</div>' +
        '<textarea class="dp-rating-textarea" id="dp-rating-text" maxlength="300" placeholder="Commentaire (optionnel)..."></textarea>' +
        '<div class="dp-rating-actions">' +
          '<button type="button" class="dp-rating-btn dp-rating-cancel">Plus tard</button>' +
          '<button type="button" class="dp-rating-btn dp-rating-submit" disabled>Envoyer</button>' +
        '</div>' +
      '</div>';

    document.body.appendChild(modal);
    requestAnimationFrame(function () { modal.classList.add('active'); });

    var chosen = 0;
    var stars = modal.querySelectorAll('.dp-rating-star');
    var submitBtn = modal.querySelector('.dp-rating-submit');

    function paint(v) {
      for (var i = 0; i < stars.length; i++) {
        stars[i].classList.toggle('active', i < v);
      }
    }

    for (var s = 0; s < stars.length; s++) {
      (function (star) {
        star.addEventListener('click', function () {
          chosen = parseInt(star.getAttribute('data-v'), 10);
          paint(chosen);
          submitBtn.disabled = false;
        });
        star.addEventListener('mouseenter', function () {
          paint(parseInt(star.getAttribute('data-v'), 10));
        });
      })(stars[s]);
    }

    var starsWrap = modal.querySelector('#dp-rating-stars');
    starsWrap.addEventListener('mouseleave', function () { paint(chosen); });

    modal.querySelector('.dp-rating-cancel').addEventListener('click', function () {
      modal.classList.remove('active');
      setTimeout(function () { modal.remove(); }, 300);
    });

    submitBtn.addEventListener('click', async function () {
      if (chosen < 1) return;
      submitBtn.disabled = true;
      submitBtn.textContent = 'Envoi...';

      var text = (modal.querySelector('#dp-rating-text').value || '').trim().slice(0, 300);

      try {
        if (currentUser) {
          await db.collection('reviews').add({
            userId: currentUser.uid,
            userEmail: currentUser.email || '',
            userName: currentUser.displayName || 'Client',
            orderId: orderId,
            productId: prodId || 'unknown',
            rating: chosen,
            text: text,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
          });

          try {
            await db.collection('orders').doc(orderId).set({
              rating: chosen,
              reviewed: true
            }, { merge: true });
          } catch (e) {}
        }
        markRated(orderId);
        showToast('Merci pour votre avis !', 'success');
        modal.classList.remove('active');
        setTimeout(function () { modal.remove(); }, 300);

        if (card) {
          var cta = card.querySelector('.dp-rate-cta');
          if (cta) cta.remove();
        }
      } catch (e) {
        console.warn('[Rating]', e);
        showToast('Erreur d\'envoi', 'danger');
        submitBtn.disabled = false;
        submitBtn.textContent = 'Envoyer';
      }
    });
  }

  function extractProductIdFromOrder(card) {
    var titleEl = card.querySelector('.order-title');
    if (!titleEl) return null;
    var t = titleEl.textContent.toLowerCase().trim();
    var map = {
      'free fire': 'freefire',
      'netflix': 'netflix',
      'disney': 'disney',
      'prime': 'primevideo',
      'crunchyroll': 'crunchyroll',
      'pubg': 'pubg',
      'roblox': 'roblox',
      'minecraft': 'minecraft',
      'call of duty': 'callofduty',
      'wise': 'wise',
      'meru': 'meru',
      'binance': 'binance'
    };
    for (var key in map) {
      if (t.indexOf(key) !== -1) return map[key];
    }
    return null;
  }

  /* ═══════════════════════════════════════════════════════════
     3. ALERTES STOCK
     ═══════════════════════════════════════════════════════════ */
  function initStockAlerts() {
    if (STATE.page !== 'index') return;

    var orig = window.openProductModal;
    if (typeof orig !== 'function') { setTimeout(initStockAlerts, 300); return; }
    if (window.__dpStockHooked) return;
    window.__dpStockHooked = true;

    window.openProductModal = function (id, silent) {
      orig.apply(this, arguments);
      var prod = null;
      if (typeof window.PRODUCTS !== 'undefined') {
        for (var i = 0; i < window.PRODUCTS.length; i++) {
          if (window.PRODUCTS[i].id === id) { prod = window.PRODUCTS[i]; break; }
        }
      }
      if (!prod) return;
      injectStockAlertButton(prod);
    };
  }

  function injectStockAlertButton(prod) {
    var body = document.getElementById('modal-offers-body');
    if (!body) return;
    var existing = body.querySelector('.dp-stock-alert-btn');
    if (existing) existing.remove();

    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'dp-stock-alert-btn';
    btn.innerHTML =
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
      '<path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 01-3.46 0"/>' +
      '</svg> <span>Me prévenir en cas de rupture</span>';

    checkAlertExists(prod.id).then(function (exists) {
      if (exists) {
        btn.classList.add('active');
        btn.querySelector('span').textContent = 'Alerte activée';
      }
    });

    btn.addEventListener('click', async function () {
      if (!currentUser) {
        showToast('Connectez-vous pour activer les alertes', 'warning');
        return;
      }
      var already = btn.classList.contains('active');
      if (already) {
        await removeAlert(prod.id);
        btn.classList.remove('active');
        btn.querySelector('span').textContent = 'Me prévenir en cas de rupture';
        showToast('Alerte désactivée', 'info');
      } else {
        await createAlert(prod.id);
        btn.classList.add('active');
        btn.querySelector('span').textContent = 'Alerte activée';
        showToast('Vous serez prévenu', 'success');
      }
    });

    body.appendChild(btn);
  }

  async function checkAlertExists(productId) {
    if (!currentUser) return false;
    try {
      var snap = await db.collection('stock_alerts')
        .where('userId', '==', currentUser.uid)
        .where('packId', '==', productId)
        .limit(1)
        .get();
      return !snap.empty;
    } catch (e) { return false; }
  }

  async function createAlert(productId) {
    if (!currentUser) return;
    try {
      await db.collection('stock_alerts').add({
        userId: currentUser.uid,
        userEmail: currentUser.email || '',
        packId: productId,
        active: true,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      });
    } catch (e) { console.warn('[StockAlert]', e); }
  }

  async function removeAlert(productId) {
    if (!currentUser) return;
    try {
      var snap = await db.collection('stock_alerts')
        .where('userId', '==', currentUser.uid)
        .where('packId', '==', productId)
        .get();
      snap.forEach(function (d) { d.ref.delete(); });
    } catch (e) {}
  }

  /* ═══════════════════════════════════════════════════════════
     4. MULTI-DEVISE AFFICHAGE (1$ = 145 HTG)
     ═══════════════════════════════════════════════════════════ */
  function initMultiCurrency() {
    if (STATE.page !== 'index') return;

    var observer = new MutationObserver(function () {
      var priceEls = document.querySelectorAll('.product-price-value, .offer-chip-price');
      for (var i = 0; i < priceEls.length; i++) {
        var el = priceEls[i];
        if (el.dataset.dpUsdDone === '1') continue;
        addUsdHint(el);
        el.dataset.dpUsdDone = '1';
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });

    setTimeout(function () {
      var priceEls = document.querySelectorAll('.product-price-value');
      for (var i = 0; i < priceEls.length; i++) {
        addUsdHint(priceEls[i]);
        priceEls[i].dataset.dpUsdDone = '1';
      }
    }, 800);
  }

  function addUsdHint(el) {
    /* Évite les doublons */
    if (el.querySelector('.dp-usd-badge')) return;

    var text = el.textContent;
    var m = text.match(/([\d,]+)\s*HTG/);
    if (!m) return;
    var htg = parseInt(m[1].replace(/,/g, ''), 10);
    if (!htg || htg < 100) return;
    var usd = (htg / USD_RATE).toFixed(2);
    var span = document.createElement('span');
    span.className = 'dp-usd-badge';
    span.textContent = '≈ $' + usd;
    el.appendChild(span);
  }

  /* ═══════════════════════════════════════════════════════════
     5. MULTI-PANIER (sauvegarde / chargement)
     ═══════════════════════════════════════════════════════════ */
  function initMultiCart() {
    if (STATE.page !== 'cart') return;

    var main = document.querySelector('.cart-main');
    var pageHead = document.querySelector('.page-head');
    if (!pageHead || !main) return;

    if (pageHead.querySelector('.dp-cart-menu-btn')) return;

    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'dp-cart-menu-btn';
    btn.setAttribute('aria-label', 'Options panier');
    btn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><circle cx="12" cy="12" r="1.5"/><circle cx="12" cy="5" r="1.5"/><circle cx="12" cy="19" r="1.5"/></svg>';
    pageHead.appendChild(btn);

    var menu = document.createElement('div');
    menu.className = 'dp-cart-menu';
    menu.innerHTML =
      '<button type="button" class="dp-cart-menu-item" data-act="save">' +
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>' +
        '<span>Sauvegarder le panier</span>' +
      '</button>' +
      '<button type="button" class="dp-cart-menu-item" data-act="load">' +
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>' +
        '<span>Charger un panier sauvegardé</span>' +
      '</button>' +
      '<button type="button" class="dp-cart-menu-item" data-act="clear">' +
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>' +
        '<span>Vider le panier</span>' +
      '</button>';
    document.body.appendChild(menu);

    btn.addEventListener('click', function (e) {
      e.stopPropagation();
      menu.classList.toggle('visible');
    });

    document.addEventListener('click', function () { menu.classList.remove('visible'); });

    menu.addEventListener('click', function (e) {
      e.stopPropagation();
      var item = e.target.closest('.dp-cart-menu-item');
      if (!item) return;
      var act = item.getAttribute('data-act');
      menu.classList.remove('visible');

      if (act === 'save') {
        try {
          var cart = JSON.parse(localStorage.getItem('dp_cart') || '[]');
          localStorage.setItem('dp_cart_saved', JSON.stringify(cart));
          showToast('Panier sauvegardé', 'success');
        } catch (err) {}
      } else if (act === 'load') {
        try {
          var saved = JSON.parse(localStorage.getItem('dp_cart_saved') || '[]');
          if (saved.length === 0) { showToast('Aucun panier sauvegardé', 'warning'); return; }
          localStorage.setItem('dp_cart', JSON.stringify(saved));
          showToast('Panier chargé', 'success');
          setTimeout(function () { window.location.reload(); }, 500);
        } catch (err) {}
      } else if (act === 'clear') {
        if (!confirm('Vider le panier ?')) return;
        localStorage.removeItem('dp_cart');
        window.location.reload();
      }
    });
  }

  /* ═══════════════════════════════════════════════════════════
     6. STATS PERSONNELLES (wallet)
     ═══════════════════════════════════════════════════════════ */
  function initWalletStats() {
    if (STATE.page !== 'wallet') return;

    var main = document.querySelector('.wallet-main');
    if (!main) return;
    if (main.querySelector('.dp-stats-card')) return;

    var card = document.createElement('div');
    card.className = 'dp-stats-card';
    card.innerHTML =
      '<div class="dp-stats-title">' +
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M18 20V10M12 20V4M6 20v-6"/></svg>' +
        'Mon activité' +
      '</div>' +
      '<div class="dp-stats-sub">Votre résumé depuis votre inscription</div>' +
      '<div class="dp-stats-grid">' +
        '<div class="dp-stat-box"><div class="dp-stat-box-label">Total dépensé</div><div class="dp-stat-box-value blue" id="dp-stat-spent">0 HTG</div></div>' +
        '<div class="dp-stat-box"><div class="dp-stat-box-label">Total rechargé</div><div class="dp-stat-box-value green" id="dp-stat-deposited">0 HTG</div></div>' +
        '<div class="dp-stat-box"><div class="dp-stat-box-label">Commandes</div><div class="dp-stat-box-value" id="dp-stat-orders">0</div></div>' +
        '<div class="dp-stat-box"><div class="dp-stat-box-label">Top produit</div><div class="dp-stat-box-value" id="dp-stat-top" style="font-size:13px;">—</div></div>' +
      '</div>';

    var anchor = main.querySelector('.quick-actions');
    if (anchor && anchor.nextSibling) main.insertBefore(card, anchor.nextSibling);
    else main.appendChild(card);

    loadStats();
  }

  async function loadStats() {
    if (!currentUser) return;
    try {
      var ordersSnap = await db.collection('orders').where('userId', '==', currentUser.uid).get();
      var depositsSnap = await db.collection('deposits').where('userId', '==', currentUser.uid).get();

      var spent = 0;
      var orderCount = 0;
      var productMap = {};

      ordersSnap.forEach(function (d) {
        var o = d.data();
        if (o.status === 'rejete') return;
        var price = Number((o.item && o.item.price) || 0);
        spent += price;
        orderCount++;
        var title = (o.item && o.item.title) || 'Autre';
        productMap[title] = (productMap[title] || 0) + 1;
      });

      var deposited = 0;
      depositsSnap.forEach(function (d) {
        var dep = d.data();
        if (dep.status === 'valide') deposited += Number(dep.creditHTG || 0);
      });

      var topProd = '—';
      var topCount = 0;
      for (var k in productMap) {
        if (productMap[k] > topCount) { topCount = productMap[k]; topProd = k; }
      }

      var spentEl = document.getElementById('dp-stat-spent');
      var depEl = document.getElementById('dp-stat-deposited');
      var ordEl = document.getElementById('dp-stat-orders');
      var topEl = document.getElementById('dp-stat-top');

      if (spentEl) spentEl.textContent = spent.toLocaleString('fr-FR') + ' HTG';
      if (depEl) depEl.textContent = deposited.toLocaleString('fr-FR') + ' HTG';
      if (ordEl) ordEl.textContent = orderCount;
      if (topEl) topEl.textContent = topProd;
    } catch (e) { console.warn('[Stats]', e); }
  }

  /* ═══════════════════════════════════════════════════════════
     7. CADEAU À UN AMI (toggle dans cart)
     ═══════════════════════════════════════════════════════════ */
  function initGiftToggle() {
    if (STATE.page !== 'cart') return;

    var checkout = document.getElementById('checkout-zone');
    if (!checkout) return;

    var observer = new MutationObserver(function () {
      var summaryCard = checkout.querySelector('.section-card:last-child');
      if (!summaryCard) return;
      if (summaryCard.querySelector('.dp-gift-toggle')) return;
      injectGiftToggle(summaryCard);
    });
    observer.observe(checkout, { childList: true, subtree: true });
  }

  function injectGiftToggle(card) {
    var box = document.createElement('button');
    box.type = 'button';
    box.className = 'dp-gift-toggle';
    box.innerHTML =
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
      '<polyline points="20 12 20 22 4 22 4 12"/><rect x="2" y="7" width="20" height="5"/><line x1="12" y1="22" x2="12" y2="7"/>' +
      '<path d="M12 7H7.5a2.5 2.5 0 010-5C11 2 12 7 12 7z"/>' +
      '<path d="M12 7h4.5a2.5 2.5 0 000-5C13 2 12 7 12 7z"/></svg>' +
      '<span>C\'est un cadeau pour un ami</span>' +
      '<span class="dp-gift-check"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg></span>';

    var insertAfter = card.querySelector('.section-title');
    if (insertAfter && insertAfter.parentNode === card) {
      insertAfter.parentNode.insertBefore(box, insertAfter.nextSibling);
    } else {
      card.insertBefore(box, card.firstChild);
    }

    box.addEventListener('click', function () {
      STATE.giftMode = !STATE.giftMode;
      box.classList.toggle('active', STATE.giftMode);
      try { localStorage.setItem('dp_gift_mode', STATE.giftMode ? '1' : '0'); } catch (e) {}
      if (STATE.giftMode) showToast('Ajoutez les infos du destinataire à la commande', 'info');
    });

    try {
      if (localStorage.getItem('dp_gift_mode') === '1') {
        STATE.giftMode = true;
        box.classList.add('active');
      }
    } catch (e) {}
  }

  /* ═══════════════════════════════════════════════════════════
     8. RATE-LIMIT DÉPÔTS (wallet)
     ═══════════════════════════════════════════════════════════ */
  function initRateLimitDeposit() {
    if (STATE.page !== 'wallet') return;

    var orig = window.submitDeposit;
    if (typeof orig !== 'function') { setTimeout(initRateLimitDeposit, 300); return; }
    if (window.__dpRateLimitHooked) return;
    window.__dpRateLimitHooked = true;

    window.submitDeposit = async function (e) {
      var now = Date.now();
      if (now - STATE.lastSubmitAt < RATE_LIMIT_DEPOSIT_MS) {
        var wait = Math.ceil((RATE_LIMIT_DEPOSIT_MS - (now - STATE.lastSubmitAt)) / 1000);
        showToast('Patientez ' + wait + 's avant un nouveau dépôt', 'warning');
        return;
      }
      STATE.lastSubmitAt = now;
      return orig.call(this, e);
    };
  }

  /* ═══════════════════════════════════════════════════════════
     9. RETRY ASSIGN-PIN (cart)
     ═══════════════════════════════════════════════════════════ */
  function initRetryAssignPin() {
    if (STATE.page !== 'cart') return;

    if (!window.fetch) return;
    if (window.__dpFetchPatched) return;
    window.__dpFetchPatched = true;

    var origFetch = window.fetch.bind(window);
    window.fetch = function (url, options) {
      var isAssignPin = typeof url === 'string' && url.indexOf('/api/assign-pin') !== -1;
      if (!isAssignPin) return origFetch(url, options);

      var attempt = 0;
      var maxAttempts = MAX_RETRIES;

      function run() {
        attempt++;
        return origFetch(url, options).then(function (resp) {
          if (!resp.ok && attempt < maxAttempts) {
            return new Promise(function (resolve) {
              setTimeout(function () { resolve(run()); }, 400 * attempt);
            });
          }
          return resp;
        }).catch(function (err) {
          if (attempt < maxAttempts) {
            return new Promise(function (resolve) {
              setTimeout(function () { resolve(run()); }, 400 * attempt);
            });
          }
          throw err;
        });
      }

      return run();
    };
  }

  /* ═══════════════════════════════════════════════════════════
     10. RATE-LIMIT COMMANDES (cart)
     ═══════════════════════════════════════════════════════════ */
  function initOrderRateLimit() {
    if (STATE.page !== 'cart') return;

    var orig = window.submitOrder;
    if (typeof orig !== 'function') { setTimeout(initOrderRateLimit, 300); return; }
    if (window.__dpOrderRateHooked) return;
    window.__dpOrderRateHooked = true;

    window.submitOrder = async function (e) {
      var now = Date.now();
      if (now - STATE.lastSubmitAt < RATE_LIMIT_ORDER_MS) {
        showToast('Veuillez patienter avant de soumettre à nouveau', 'warning');
        return;
      }
      STATE.lastSubmitAt = now;
      return orig.call(this, e);
    };
  }

  /* ═══════════════════════════════════════════════════════════
     BOOT
     ═══════════════════════════════════════════════════════════ */
  auth.onAuthStateChanged(function (user) {
    currentUser = user;
  });

  function boot() {
    STATE.page = detectPage();

    if (STATE.page === 'cart') {
      initMultiCart();
      initGiftToggle();
      initRetryAssignPin();
      initOrderRateLimit();
    }
    if (STATE.page === 'commande') {
      initOrderNotes();
      initRatings();
    }
    if (STATE.page === 'wallet') {
      initWalletStats();
      initRateLimitDeposit();
    }
    if (STATE.page === 'index') {
      initStockAlerts();
      initMultiCurrency();
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }

  window.addEventListener('load', function () {
    if (STATE.page === 'index') {
      setTimeout(function () {
        var priceEls = document.querySelectorAll('.product-price-value');
        for (var i = 0; i < priceEls.length; i++) {
          if (priceEls[i].dataset.dpUsdDone !== '1') {
            addUsdHint(priceEls[i]);
            priceEls[i].dataset.dpUsdDone = '1';
          }
        }
      }, 600);
    }
  });

  /* ═══ EXPOSE ═══ */
  window.DPFeatures = {
    getPage: function () { return STATE.page; },
    getGiftMode: function () { return STATE.giftMode; },
    getRate: function () { return USD_RATE; }
  };
})();