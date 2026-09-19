/* ═══════════════════════════════════════════════════════════
   DigitalPay Haiti — Wishlist v1.4 FINAL
   Favoris par utilisateur · sync Firestore · lien sidebar
   Coeur caché au repos · révélé au survol/tap
   Expose : window.DPWishlist
   ═══════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  if (typeof firebase === 'undefined' || !firebase.apps || !firebase.apps.length) return;

  var db = firebase.firestore();
  var auth = firebase.auth();
  var currentUser = null;
  var unsubDoc = null;
  var items = [];
  var injectTimer = null;

  function getProducts() {
    if (typeof window.PRODUCTS !== 'undefined' && Array.isArray(window.PRODUCTS)) {
      return window.PRODUCTS;
    }
    return null;
  }

  function escapeHtml(s) {
    if (s === undefined || s === null) return '';
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  /* ═══ FIRESTORE SYNC ═══ */
  function listenWishlist() {
    if (unsubDoc) { unsubDoc(); unsubDoc = null; }
    if (!currentUser) { items = []; updateUI(); return; }

    unsubDoc = db.collection('wishlists').doc(currentUser.uid)
      .onSnapshot(function (doc) {
        items = (doc.exists && Array.isArray(doc.data().productIds)) ? doc.data().productIds.slice() : [];
        updateUI();
      }, function (err) {
        console.warn('[DPWishlist]', err.code);
      });
  }

  async function toggle(prodId) {
    if (!currentUser) {
      showToast('Connectez-vous pour ajouter aux favoris', 'warning');
      setTimeout(function () { window.location.href = 'authentification/login.html'; }, 1200);
      return;
    }
    var idx = items.indexOf(prodId);
    var next = items.slice();
    if (idx >= 0) next.splice(idx, 1);
    else next.push(prodId);

    items = next;
    updateUI();

    try {
      await db.collection('wishlists').doc(currentUser.uid).set({
        userId: currentUser.uid,
        productIds: next,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      }, { merge: true });
      showToast(idx >= 0 ? 'Retiré des favoris' : 'Ajouté aux favoris', 'info');
    } catch (e) {
      console.warn('[DPWishlist] toggle:', e);
    }
  }

  async function remove(prodId) {
    if (!currentUser) return;
    var next = items.filter(function (id) { return id !== prodId; });
    items = next;
    updateUI();
    try {
      await db.collection('wishlists').doc(currentUser.uid).set({
        userId: currentUser.uid,
        productIds: next,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      }, { merge: true });
    } catch (e) {}
  }

  function isWished(prodId) {
    return items.indexOf(prodId) !== -1;
  }

  /* ═══════════════════════════════════════════════════════════
     DÉTECTION DE L'ID PRODUIT (4 stratégies en cascade)
     ═══════════════════════════════════════════════════════════ */
  function detectProductIdFromCard(card) {
    if (card.dataset.prodId) return card.dataset.prodId;

    var onclick = card.getAttribute('onclick') || '';
    if (onclick) {
      var m = onclick.match(/openProductModal\(['"]([^'"]+)['"]/);
      if (m && m[1]) return m[1];
    }

    var titleEl = card.querySelector('.product-name');
    if (titleEl) {
      var title = titleEl.textContent.trim().toLowerCase();
      var prods = getProducts();
      if (prods) {
        for (var i = 0; i < prods.length; i++) {
          if ((prods[i].title || '').toLowerCase() === title) {
            return prods[i].id;
          }
        }
      }
    }

    var img = card.querySelector('.product-visual img');
    if (img) {
      var src = (img.getAttribute('src') || '').toLowerCase();
      var prods2 = getProducts();
      if (prods2) {
        for (var k = 0; k < prods2.length; k++) {
          var logo = (prods2[k].logo || '').toLowerCase();
          if (logo && src.indexOf(logo.replace('assets/', '')) !== -1) {
            return prods2[k].id;
          }
        }
      }
    }

    return null;
  }

  /* ═══════════════════════════════════════════════════════════
     INJECTION DU BOUTON COEUR
     ═══════════════════════════════════════════════════════════ */
  function injectWishButtons() {
    var cards = document.querySelectorAll('.product-card');
    for (var i = 0; i < cards.length; i++) {
      var card = cards[i];
      if (card.dataset.dpWishBound === '1') continue;

      var prodId = detectProductIdFromCard(card);
      if (!prodId) continue;

      var visual = card.querySelector('.product-visual');
      if (!visual) continue;

      card.dataset.dpWishBound = '1';
      card.dataset.prodId = prodId;

      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'dp-wish-btn' + (isWished(prodId) ? ' active' : '');
      btn.setAttribute('aria-label', 'Favori');
      btn.dataset.prodId = prodId;
      btn.innerHTML = '<svg viewBox="0 0 24 24"><path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"/></svg>';

      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        e.preventDefault();
        var pid = this.dataset.prodId;
        toggle(pid);
      });

      visual.appendChild(btn);
    }
  }

  function scheduleInject() {
    if (injectTimer) clearTimeout(injectTimer);
    injectTimer = setTimeout(injectWishButtons, 80);
  }

  /* ═══ HOOK buildProductCard (index.html) ═══ */
  function hookBuildProductCard() {
    var orig = window.buildProductCard;
    if (typeof orig !== 'function') { setTimeout(hookBuildProductCard, 300); return; }
    if (window.__dpBuildCardHooked) return;
    window.__dpBuildCardHooked = true;

    window.buildProductCard = function (prod) {
      var card = orig.call(this, prod);
      if (card && prod && prod.id) {
        card.dataset.prodId = prod.id;
      }
      scheduleInject();
      return card;
    };
  }

  /* ═══ HOOK openProductModal (coeur dans le modal) ═══ */
  function hookOpenProductModal() {
    var orig = window.openProductModal;
    if (typeof orig !== 'function') { setTimeout(hookOpenProductModal, 300); return; }
    if (window.__dpOpenModalHooked) return;
    window.__dpOpenModalHooked = true;

    window.openProductModal = function (prodId, silent) {
      orig.apply(this, arguments);
      injectModalWishButton(prodId);
    };
  }

  function injectModalWishButton(prodId) {
    var head = document.querySelector('.sheet-head');
    if (!head) return;
    var existing = head.querySelector('.dp-modal-wish');
    if (existing) existing.remove();

    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'icon-btn dp-modal-wish';
    btn.style.position = 'relative';
    btn.style.width = '36px';
    btn.style.height = '36px';
    btn.style.flexShrink = '0';
    btn.setAttribute('aria-label', 'Favori');
    btn.innerHTML = '<svg viewBox="0 0 24 24" style="width:17px;height:17px;"><path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"/></svg>';

    if (isWished(prodId)) {
      var svg = btn.querySelector('svg');
      svg.style.fill = '#E11D48';
      svg.style.stroke = '#E11D48';
    }

    btn.addEventListener('click', function (e) {
      e.stopPropagation();
      toggle(prodId).then(function () {
        var s = btn.querySelector('svg');
        if (isWished(prodId)) {
          s.style.fill = '#E11D48';
          s.style.stroke = '#E11D48';
        } else {
          s.style.fill = '';
          s.style.stroke = 'currentColor';
        }
      });
    });

    var closeBtn = head.querySelector('.sheet-close');
    if (closeBtn) head.insertBefore(btn, closeBtn);
    else head.appendChild(btn);
  }

  /* ═══════════════════════════════════════════════════════════
     LIEN "MES FAVORIS" DANS LA SIDEBAR
     ═══════════════════════════════════════════════════════════ */
  function ensureWishlistSidebarLink() {
    var sidebarNav = document.querySelector('.sidebar-nav');
    if (!sidebarNav) return;
    if (sidebarNav.querySelector('.dp-wishlist-fab-sidebar')) return;

    var wrap = document.createElement('button');
    wrap.type = 'button';
    wrap.className = 'sidebar-nav-link dp-wishlist-fab-sidebar';

    wrap.innerHTML =
      '<svg viewBox="0 0 24 24">' +
        '<path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"/>' +
      '</svg>' +
      '<span>Mes favoris</span>' +
      '<span class="dp-wishlist-count" style="display:none;"></span>';

    /* Insérer avant le lien "Support" si trouvé, sinon à la fin */
    var supportLink = null;
    var links = sidebarNav.querySelectorAll('.sidebar-nav-link');
    for (var i = 0; i < links.length; i++) {
      var txt = (links[i].textContent || '').toLowerCase();
      if (txt.indexOf('support') !== -1 || txt.indexOf('sipò') !== -1 || txt.indexOf('soporte') !== -1) {
        supportLink = links[i];
        break;
      }
    }

    if (supportLink && supportLink.parentNode === sidebarNav) {
      sidebarNav.insertBefore(wrap, supportLink);
    } else {
      sidebarNav.appendChild(wrap);
    }

    wrap.addEventListener('click', function (e) {
      e.preventDefault();
      closeSidebarIfPossible();
      setTimeout(openDrawer, 250);
    });

    updateFabBadge();
  }

  function closeSidebarIfPossible() {
    var overlay = document.getElementById('sidebar-overlay');
    if (overlay) {
      overlay.classList.remove('active');
      document.body.style.overflow = '';
    } else if (typeof window.closeSidebar === 'function') {
      try { window.closeSidebar(); } catch (e) {}
    }
  }

  function updateFabBadge() {
    var fab = document.querySelector('.dp-wishlist-fab-sidebar');
    if (!fab) return;
    var existing = fab.querySelector('.dp-wishlist-count');
    if (items.length > 0) {
      if (!existing) {
        existing = document.createElement('span');
        existing.className = 'dp-wishlist-count';
        fab.appendChild(existing);
      }
      existing.textContent = items.length > 99 ? '99+' : items.length;
      existing.style.display = 'flex';
    } else if (existing) {
      existing.style.display = 'none';
    }
  }

  /* ═══ DRAWER ═══ */
  function ensureDrawer() {
    if (document.querySelector('.dp-wishlist-drawer')) return;
    var drawer = document.createElement('div');
    drawer.className = 'dp-wishlist-drawer';
    drawer.innerHTML =
      '<div class="dp-wishlist-sheet" onclick="event.stopPropagation()">' +
        '<div class="dp-wishlist-head">' +
          '<div class="dp-wishlist-title">' +
            '<svg viewBox="0 0 24 24"><path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"/></svg>' +
            'Mes favoris' +
          '</div>' +
          '<button type="button" class="dp-wishlist-close" aria-label="Fermer">' +
            '<svg viewBox="0 0 24 24"><path d="M18 6L6 18M6 6l12 12" stroke-linecap="round"/></svg>' +
          '</button>' +
        '</div>' +
        '<div class="dp-wishlist-body"></div>' +
      '</div>';
    document.body.appendChild(drawer);

    drawer.addEventListener('click', function (e) {
      if (e.target === drawer) closeDrawer();
    });
    drawer.querySelector('.dp-wishlist-close').addEventListener('click', closeDrawer);
  }

  function openDrawer() {
    ensureDrawer();
    renderDrawer();
    document.querySelector('.dp-wishlist-drawer').classList.add('active');
    document.body.style.overflow = 'hidden';
  }

  function closeDrawer() {
    var d = document.querySelector('.dp-wishlist-drawer');
    if (d) d.classList.remove('active');
    document.body.style.overflow = '';
  }

  function renderDrawer() {
    var body = document.querySelector('.dp-wishlist-body');
    if (!body) return;

    var prods = getProducts();
    if (!prods) {
      body.innerHTML = '<div class="dp-wishlist-empty">Catalogue en cours de chargement...<br>Réessayez dans quelques secondes.</div>';
      return;
    }

    if (items.length === 0) {
      body.innerHTML = '<div class="dp-wishlist-empty">Aucun favori pour le moment.<br>Touchez le coeur sur un produit pour l\'ajouter.</div>';
      return;
    }

    var html = '';
    for (var i = 0; i < items.length; i++) {
      var pid = items[i];
      var prod = null;
      for (var j = 0; j < prods.length; j++) {
        if (prods[j].id === pid) { prod = prods[j]; break; }
      }
      if (!prod) continue;
      var initials = (prod.title || '?').substring(0, 2).toUpperCase();
      var priceText = prod.isDynamic ? ('1$ = ' + prod.rate + ' HTG') : ('Dès ' + (prod.minPrice || 0).toLocaleString() + ' HTG');

      html +=
        '<div class="dp-wishlist-item">' +
          '<div class="dp-wishlist-thumb">' +
            '<span>' + escapeHtml(initials) + '</span>' +
            '<img src="' + escapeHtml(prod.logo) + '" alt="" onerror="this.style.display=\'none\';">' +
          '</div>' +
          '<div class="dp-wishlist-info">' +
            '<div class="dp-wishlist-name">' + escapeHtml(prod.title) + '</div>' +
            '<div class="dp-wishlist-price">' + escapeHtml(priceText) + '</div>' +
          '</div>' +
          '<div class="dp-wishlist-actions">' +
            '<button type="button" class="dp-wishlist-open" data-open="' + escapeHtml(pid) + '" aria-label="Ouvrir">' +
              '<svg viewBox="0 0 24 24"><path d="M9 18l6-6-6-6" stroke-linecap="round" stroke-linejoin="round"/></svg>' +
            '</button>' +
            '<button type="button" class="dp-wishlist-remove" data-remove="' + escapeHtml(pid) + '" aria-label="Retirer">' +
              '<svg viewBox="0 0 24 24"><path d="M18 6L6 18M6 6l12 12" stroke-linecap="round"/></svg>' +
            '</button>' +
          '</div>' +
        '</div>';
    }
    body.innerHTML = html;

    var openBtns = body.querySelectorAll('[data-open]');
    for (var k = 0; k < openBtns.length; k++) {
      openBtns[k].addEventListener('click', function () {
        closeDrawer();
        var pid = this.getAttribute('data-open');
        if (typeof window.openProductModal === 'function') {
          setTimeout(function () { window.openProductModal(pid); }, 350);
        }
      });
    }

    var removeBtns = body.querySelectorAll('[data-remove]');
    for (var m = 0; m < removeBtns.length; m++) {
      removeBtns[m].addEventListener('click', function () {
        var pid = this.getAttribute('data-remove');
        remove(pid).then(renderDrawer);
      });
    }
  }

  /* ═══ UI UPDATE GLOBAL ═══ */
  function updateUI() {
    var btns = document.querySelectorAll('.dp-wish-btn');
    for (var i = 0; i < btns.length; i++) {
      var b = btns[i];
      b.classList.toggle('active', isWished(b.dataset.prodId));
    }
    updateFabBadge();
    if (document.querySelector('.dp-wishlist-drawer.active')) renderDrawer();
  }

  /* ═══ TOAST FALLBACK ═══ */
  function showToast(msg, type) {
    if (typeof window.showToast === 'function') {
      window.showToast(msg, type || 'info');
      return;
    }
    var container = document.getElementById('toast-container');
    if (!container) return;
    container.innerHTML = '';
    var toast = document.createElement('div');
    toast.className = 'toast ' + (type || 'info');
    toast.innerHTML = '<div class="toast-msg">' + msg + '</div>';
    container.appendChild(toast);
    requestAnimationFrame(function () { toast.classList.add('show'); });
    setTimeout(function () { toast.remove(); }, 2600);
  }

  /* ═══ MUTATION OBSERVER ═══ */
  function watchProductCards() {
    if (!window.MutationObserver) return;
    var observer = new MutationObserver(function (mutations) {
      var shouldInject = false;
      for (var i = 0; i < mutations.length; i++) {
        var added = mutations[i].addedNodes;
        for (var j = 0; j < added.length; j++) {
          var n = added[j];
          if (n.nodeType !== 1) continue;
          if (n.classList && n.classList.contains('product-card')) { shouldInject = true; break; }
          if (n.querySelector && n.querySelector('.product-card')) { shouldInject = true; break; }
        }
        if (shouldInject) break;
      }
      if (shouldInject) scheduleInject();
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }

  /* ═══ RÉVÉLER LE COEUR AU TAP SUR LA CARTE (mobile) ═══ */
  function initCardTapReveal() {
    var REVEAL_CLASS = 'dp-wish-revealed';
    var lastRevealed = null;

    function revealCard(card) {
      if (!card) return;
      card.classList.add(REVEAL_CLASS);
      if (lastRevealed && lastRevealed !== card) {
        lastRevealed.classList.remove(REVEAL_CLASS);
      }
      lastRevealed = card;

      clearTimeout(card._dpRevealTimer);
      card._dpRevealTimer = setTimeout(function () {
        if (!card.querySelector('.dp-wish-btn.active')) {
          card.classList.remove(REVEAL_CLASS);
        }
        if (lastRevealed === card) lastRevealed = null;
      }, 3000);
    }

    document.addEventListener('touchstart', function (e) {
      var card = e.target.closest('.product-card');
      if (!card) return;
      if (e.target.closest('.dp-wish-btn')) return;
      revealCard(card);
    }, { passive: true });

    document.addEventListener('click', function (e) {
      if (window.matchMedia && window.matchMedia('(hover: hover)').matches) return;
      var card = e.target.closest('.product-card');
      if (!card) return;
      if (e.target.closest('.dp-wish-btn')) return;
      revealCard(card);
    });
  }

  /* ═══ AUTH ═══ */
  auth.onAuthStateChanged(function (user) {
    currentUser = user;
    listenWishlist();
  });

  /* ═══ BOOT ═══ */
  function boot() {
    ensureWishlistSidebarLink();
    injectWishButtons();
    hookBuildProductCard();
    hookOpenProductModal();
    watchProductCards();
    initCardTapReveal();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }

  window.addEventListener('load', function () {
    setTimeout(function () {
      ensureWishlistSidebarLink();
      injectWishButtons();
    }, 400);
    setTimeout(injectWishButtons, 1200);
    setTimeout(injectWishButtons, 2500);
  });

  /* ═══ EXPOSE ═══ */
  window.DPWishlist = {
    toggle: toggle,
    remove: remove,
    isWished: isWished,
    openDrawer: openDrawer,
    closeDrawer: closeDrawer,
    refresh: updateUI,
    getItems: function () { return items.slice(); }
  };
})();