/* ═══════════════════════════════════════════════════════════
   DigitalPay Haiti — UX Enhancements v8.0 FINAL
   Fly-to-cart · Swipe · Pull-refresh · Fuzzy · Onboarding
   Confetti · Progress bar · Web Share · Bottom-sheet drag
   Auto-detects page context · Expose window.DPConfetti + DPFuzzyMatch
   ═══════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  var STATE = {
    currentPage: null,
    searchTimer: null
  };

  /* ═══════════════════════════════════════════════════════════
     PAGE DETECTION
     ═══════════════════════════════════════════════════════════ */
  function detectPage() {
    var path = window.location.pathname || '/';
    if (path.indexOf('/admin/') !== -1) return 'admin';
    if (path.indexOf('/authentification/') !== -1) {
      if (path.indexOf('login') !== -1) return 'login';
      if (path.indexOf('register') !== -1) return 'register';
    }
    if (path.indexOf('/cart') !== -1) return 'cart';
    if (path.indexOf('/commande') !== -1) return 'commande';
    if (path.indexOf('/wallet') !== -1) return 'wallet';
    if (path.indexOf('/help') !== -1) return 'help';
    if (path.indexOf('/legal') !== -1) return 'legal';
    if (path.indexOf('/404') !== -1) return '404';
    return 'index';
  }

  /* ═══════════════════════════════════════════════════════════
     1. FLY-TO-CART
     ═══════════════════════════════════════════════════════════ */
  function initFlyToCart() {
    document.addEventListener('click', function (e) {
      var btn = e.target.closest('.btn-add-cart');
      if (!btn || btn.disabled) return;

      var card = btn.closest('.sheet-modal, .product-card');
      if (!card) return;

      var img = card.querySelector('.product-visual img, .sheet-thumb img, .product-thumb img');
      var target = document.getElementById('cart-btn') ||
                   document.querySelector('[data-nav="cart"] .nav-icon-wrap') ||
                   document.getElementById('cart-badge');
      if (!target) return;

      flyElement(img || btn, target);
    });
  }

  function flyElement(source, target) {
    var srcRect = source.getBoundingClientRect();
    var tgtRect = target.getBoundingClientRect();
    if (srcRect.width === 0 || srcRect.height === 0) return;

    var clone = document.createElement('div');
    clone.style.cssText = 'position:fixed;left:' + srcRect.left + 'px;top:' + srcRect.top + 'px;' +
      'width:' + srcRect.width + 'px;height:' + srcRect.height + 'px;border-radius:14px;' +
      'background:url(' + (source.src || '') + ') center/cover no-repeat, var(--blue-50);' +
      'z-index:9999;pointer-events:none;box-shadow:0 8px 24px rgba(0,85,255,0.4);' +
      'transition:all 0.75s cubic-bezier(0.5,-0.4,0.4,1);transform:rotate(0deg);';
    document.body.appendChild(clone);

    requestAnimationFrame(function () {
      clone.style.left = (tgtRect.left + tgtRect.width / 2 - 15) + 'px';
      clone.style.top = (tgtRect.top + tgtRect.height / 2 - 15) + 'px';
      clone.style.width = '30px';
      clone.style.height = '30px';
      clone.style.borderRadius = '50%';
      clone.style.opacity = '0.2';
      clone.style.transform = 'rotate(720deg)';
    });

    setTimeout(function () {
      if (clone.parentNode) clone.parentNode.removeChild(clone);
      if (target.animate) {
        target.animate(
          [{ transform: 'scale(1)' }, { transform: 'scale(1.35)' }, { transform: 'scale(1)' }],
          { duration: 400, easing: 'cubic-bezier(0.34, 1.56, 0.64, 1)' }
        );
      }
    }, 780);
  }

  /* ═══════════════════════════════════════════════════════════
     2. SWIPE-TO-DELETE (cart)
     ═══════════════════════════════════════════════════════════ */
  function initSwipeToDelete() {
    if (STATE.currentPage !== 'cart') return;

    var startX = 0, startY = 0, currentCard = null, currentOffset = 0;
    var THRESHOLD = 80;

    document.addEventListener('touchstart', function (e) {
      var card = e.target.closest('.cart-card');
      if (!card || e.target.closest('.cart-remove')) return;
      startX = e.touches[0].clientX;
      startY = e.touches[0].clientY;
      currentCard = card;
      currentOffset = 0;
      card.style.transition = 'none';
    }, { passive: true });

    document.addEventListener('touchmove', function (e) {
      if (!currentCard) return;
      var dx = e.touches[0].clientX - startX;
      var dy = e.touches[0].clientY - startY;
      if (Math.abs(dy) > Math.abs(dx)) { currentCard = null; return; }
      if (dx < 0) {
        currentOffset = Math.max(dx, -140);
        currentCard.style.transform = 'translateX(' + currentOffset + 'px)';
        currentCard.style.background = 'linear-gradient(90deg, var(--bg-card) ' +
          (100 + (currentOffset / 3)) + '%, var(--danger-bg) 100%)';
      }
    }, { passive: true });

    document.addEventListener('touchend', function () {
      if (!currentCard) return;
      var card = currentCard;
      currentCard = null;
      card.style.transition = 'transform 0.3s ease, opacity 0.3s ease';

      if (currentOffset < -THRESHOLD) {
        card.style.transform = 'translateX(-100%)';
        card.style.opacity = '0';
        setTimeout(function () {
          var removeBtn = card.querySelector('.cart-remove');
          if (removeBtn) removeBtn.click();
        }, 280);
      } else {
        card.style.transform = '';
        card.style.background = '';
      }
      currentOffset = 0;
    }, { passive: true });
  }

  /* ═══════════════════════════════════════════════════════════
     3. PULL-TO-REFRESH
     ═══════════════════════════════════════════════════════════ */
  function initPullToRefresh() {
    var pagesWithRefresh = ['index', 'commande', 'wallet'];
    if (pagesWithRefresh.indexOf(STATE.currentPage) === -1) return;

    var startY = 0, pulling = false, indicator = null, triggered = false;

    function ensureIndicator() {
      if (indicator) return indicator;
      indicator = document.createElement('div');
      indicator.className = 'dp-ptr-indicator';
      indicator.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14M5 12l7 7 7-7"/></svg>';
      document.body.appendChild(indicator);
      return indicator;
    }

    document.addEventListener('touchstart', function (e) {
      if (window.scrollY > 5) return;
      startY = e.touches[0].clientY;
      pulling = true;
      triggered = false;
    }, { passive: true });

    document.addEventListener('touchmove', function (e) {
      if (!pulling) return;
      var dy = e.touches[0].clientY - startY;
      if (dy > 90 && window.scrollY <= 5) {
        var ind = ensureIndicator();
        ind.classList.add('visible');
        ind.style.transform = 'translateX(-50%) scale(' + Math.min(dy / 120, 1.15) + ')';
        if (dy > 160) ind.classList.add('spinning');
      }
    }, { passive: true });

    document.addEventListener('touchend', function () {
      if (!pulling) return;
      pulling = false;
      if (indicator && indicator.classList.contains('visible')) {
        if (indicator.classList.contains('spinning') && !triggered) {
          triggered = true;
          setTimeout(function () { window.location.reload(); }, 200);
        } else {
          indicator.classList.remove('visible', 'spinning');
        }
      }
    }, { passive: true });
  }

  /* ═══════════════════════════════════════════════════════════
     4. FUZZY MATCH
     ═══════════════════════════════════════════════════════════ */
  function levenshtein(a, b) {
    if (a.length === 0) return b.length;
    if (b.length === 0) return a.length;
    var m = [];
    for (var i = 0; i <= b.length; i++) m[i] = [i];
    for (var j = 0; j <= a.length; j++) m[0][j] = j;
    for (var x = 1; x <= b.length; x++) {
      for (var y = 1; y <= a.length; y++) {
        m[x][y] = b.charAt(x - 1) === a.charAt(y - 1)
          ? m[x - 1][y - 1]
          : Math.min(m[x - 1][y - 1] + 1, m[x][y - 1] + 1, m[x - 1][y] + 1);
      }
    }
    return m[b.length][a.length];
  }

  function fuzzyMatch(query, target) {
    query = (query || '').toLowerCase().trim();
    target = (target || '').toLowerCase().trim();
    if (!query) return true;
    if (target.indexOf(query) !== -1) return true;
    var maxDist = Math.max(1, Math.floor(query.length / 4));
    if (levenshtein(query, target) <= maxDist) return true;
    var words = target.split(/\s+/);
    for (var i = 0; i < words.length; i++) {
      if (levenshtein(query, words[i]) <= maxDist) return true;
    }
    return false;
  }

  /* ═══════════════════════════════════════════════════════════
     5. SEARCH HISTORY
     ═══════════════════════════════════════════════════════════ */
  function initSearchHistory() {
    if (STATE.currentPage !== 'index') return;

    var input = document.getElementById('search-bar');
    if (!input) return;
    var wrapper = input.closest('.search-wrapper');
    if (!wrapper) return;

    var dropdown = document.createElement('div');
    dropdown.className = 'dp-search-history';
    wrapper.appendChild(dropdown);

    function getHistory() {
      try { return JSON.parse(localStorage.getItem('dp_search_history') || '[]'); }
      catch (e) { return []; }
    }

    function saveSearch(q) {
      if (!q || q.length < 2) return;
      var h = getHistory().filter(function (x) {
        return x.toLowerCase() !== q.toLowerCase();
      });
      h.unshift(q);
      h = h.slice(0, 5);
      try { localStorage.setItem('dp_search_history', JSON.stringify(h)); }
      catch (e) {}
    }

    function show() {
      var h = getHistory();
      if (h.length === 0) { dropdown.classList.remove('visible'); return; }

      var html = '<div class="dp-search-history-head">' +
        '<span>Recherches récentes</span>' +
        '<button type="button" class="dp-search-history-clear">Effacer</button>' +
        '</div>';

      for (var i = 0; i < h.length; i++) {
        html += '<button type="button" class="dp-search-history-item" data-idx="' + i + '">' +
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>' +
          '<span>' + h[i].replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;') + '</span>' +
          '</button>';
      }
      dropdown.innerHTML = html;
      dropdown.classList.add('visible');

      var items = dropdown.querySelectorAll('.dp-search-history-item');
      for (var k = 0; k < items.length; k++) {
        (function (item) {
          item.addEventListener('mousedown', function (e) {
            e.preventDefault();
            var idx = parseInt(item.getAttribute('data-idx'), 10);
            input.value = h[idx];
            dropdown.classList.remove('visible');
            if (typeof window.handleSearchDebounced === 'function') {
              window.handleSearchDebounced(h[idx]);
            }
          });
        })(items[k]);
      }

      var clearBtn = dropdown.querySelector('.dp-search-history-clear');
      if (clearBtn) {
        clearBtn.addEventListener('mousedown', function (e) {
          e.preventDefault();
          try { localStorage.removeItem('dp_search_history'); } catch (err) {}
          dropdown.classList.remove('visible');
        });
      }
    }

    input.addEventListener('focus', show);
    input.addEventListener('blur', function () {
      setTimeout(function () { dropdown.classList.remove('visible'); }, 200);
    });
    input.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') {
        var q = input.value.trim();
        if (q) saveSearch(q);
      }
    });
    input.addEventListener('input', function () {
      var q = input.value.trim();
      if (q && q.length >= 3) saveSearch(q);
    });
  }

  /* ═══════════════════════════════════════════════════════════
     6. ONBOARDING
     ═══════════════════════════════════════════════════════════ */
  function initOnboarding() {
    if (STATE.currentPage !== 'index') return;
    try {
      if (localStorage.getItem('dp_onboarded') === '1') return;
    } catch (e) { return; }

    var slides = [
      {
        icon: '<path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" stroke-linecap="round" stroke-linejoin="round"/>',
        title: 'Livraison instantanée',
        desc: 'Vos recharges de jeux et abonnements livrés en quelques secondes, 24h/24.'
      },
      {
        icon: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="M9 12l2 2 4-4" stroke-linecap="round" stroke-linejoin="round"/>',
        title: 'Paiements sécurisés',
        desc: 'MonCash, NatCash, Meru ou portefeuille DigitalPay. Chaque transaction est protégée.'
      },
      {
        icon: '<path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/>',
        title: 'Support 24/7',
        desc: 'Notre équipe et notre assistant intelligent répondent à toutes vos questions.'
      }
    ];

    var current = 0;
    var overlay = document.createElement('div');
    overlay.className = 'dp-onboarding';

    var slidesHtml = '';
    for (var i = 0; i < slides.length; i++) {
      slidesHtml += '<div class="dp-onboarding-slide' + (i === 0 ? ' active' : '') + '" data-idx="' + i + '">' +
        '<div class="dp-onboarding-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">' + slides[i].icon + '</svg></div>' +
        '<h3>' + slides[i].title + '</h3>' +
        '<p>' + slides[i].desc + '</p>' +
        '</div>';
    }

    var dotsHtml = '';
    for (var j = 0; j < slides.length; j++) {
      dotsHtml += '<span class="dp-onboarding-dot' + (j === 0 ? ' active' : '') + '" data-idx="' + j + '"></span>';
    }

    overlay.innerHTML = '<div class="dp-onboarding-card">' +
      '<button type="button" class="dp-onboarding-skip">Passer</button>' +
      '<div class="dp-onboarding-slides">' + slidesHtml + '</div>' +
      '<div class="dp-onboarding-dots">' + dotsHtml + '</div>' +
      '<button type="button" class="dp-onboarding-next">Suivant</button>' +
      '</div>';

    document.body.appendChild(overlay);
    requestAnimationFrame(function () { overlay.classList.add('visible'); });

    var slidesEl = overlay.querySelectorAll('.dp-onboarding-slide');
    var dotsEl = overlay.querySelectorAll('.dp-onboarding-dot');
    var nextBtn = overlay.querySelector('.dp-onboarding-next');
    var skipBtn = overlay.querySelector('.dp-onboarding-skip');

    function goTo(idx) {
      current = idx;
      for (var k = 0; k < slidesEl.length; k++) {
        slidesEl[k].classList.toggle('active', k === idx);
        dotsEl[k].classList.toggle('active', k === idx);
      }
      nextBtn.textContent = (idx === slides.length - 1) ? 'Commencer' : 'Suivant';
    }

    nextBtn.addEventListener('click', function () {
      if (current < slides.length - 1) goTo(current + 1);
      else close();
    });
    skipBtn.addEventListener('click', close);

    for (var d = 0; d < dotsEl.length; d++) {
      (function (dot) {
        dot.addEventListener('click', function () {
          goTo(parseInt(dot.getAttribute('data-idx'), 10));
        });
      })(dotsEl[d]);
    }

    function close() {
      overlay.classList.remove('visible');
      try { localStorage.setItem('dp_onboarded', '1'); } catch (e) {}
      setTimeout(function () {
        if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
      }, 400);
    }
  }

  /* ═══════════════════════════════════════════════════════════
     7. CONFETTI
     ═══════════════════════════════════════════════════════════ */
  function fireConfetti() {
    var colors = ['#00B4FF', '#0055FF', '#10B981', '#F59E0B', '#DC2626', '#7C3AED', '#38BDF8'];
    var pieces = 70;
    for (var i = 0; i < pieces; i++) {
      (function (idx) {
        var p = document.createElement('div');
        p.className = 'confetti-piece';
        p.style.background = colors[Math.floor(Math.random() * colors.length)];
        p.style.left = (Math.random() * 100) + '%';
        p.style.top = '-20px';
        p.style.width = (6 + Math.random() * 8) + 'px';
        p.style.height = (6 + Math.random() * 10) + 'px';
        p.style.borderRadius = Math.random() > 0.5 ? '50%' : '2px';
        document.body.appendChild(p);

        var duration = 2500 + Math.random() * 1500;
        var driftX = (Math.random() - 0.5) * 240;
        var rotate = Math.random() * 720 - 360;
        var vh = window.innerHeight + 60;

        if (p.animate) {
          p.animate([
            { transform: 'translate(0, 0) rotate(0deg)', opacity: 1 },
            { transform: 'translate(' + driftX + 'px, ' + vh + 'px) rotate(' + rotate + 'deg)', opacity: 0.2 }
          ], { duration: duration, easing: 'cubic-bezier(0.4, 0, 0.6, 1)' });
        } else {
          p.style.transition = 'transform ' + duration + 'ms ease, opacity ' + duration + 'ms ease';
          p.style.transform = 'translate(' + driftX + 'px, ' + vh + 'px) rotate(' + rotate + 'deg)';
          p.style.opacity = '0.2';
        }
        setTimeout(function () { if (p.parentNode) p.parentNode.removeChild(p); }, duration + 100);
      })(i);
    }
  }

  /* ═══════════════════════════════════════════════════════════
     8. ORDER PROGRESS + WEB SHARE (commande)
     ═══════════════════════════════════════════════════════════ */
  function initCommandeEnhancements() {
    if (STATE.currentPage !== 'commande') return;

    var list = document.getElementById('orders-list');
    if (!list) return;

    var observer = new MutationObserver(function (mutations) {
      for (var i = 0; i < mutations.length; i++) {
        var added = mutations[i].addedNodes;
        for (var j = 0; j < added.length; j++) {
          var node = added[j];
          if (node.nodeType === 1 && node.classList && node.classList.contains('order-card')) {
            addProgressToCard(node);
            addShareButton(node);
          }
        }
      }
    });
    observer.observe(list, { childList: true, subtree: true });

    var existing = list.querySelectorAll('.order-card');
    for (var k = 0; k < existing.length; k++) {
      addProgressToCard(existing[k]);
      addShareButton(existing[k]);
    }
  }

  function addProgressToCard(card) {
    if (card.querySelector('.dp-order-progress')) return;
    var statusPill = card.querySelector('.order-status-pill');
    if (!statusPill) return;

    var s = 'en_attente';
    if (statusPill.classList.contains('livre')) s = 'livre';
    else if (statusPill.classList.contains('en_attente_stock')) s = 'en_attente_stock';
    else if (statusPill.classList.contains('rejete')) s = 'rejete';
    else if (statusPill.classList.contains('en_attente')) s = 'en_attente';

    if (s === 'rejete') return;

    var step = 1;
    if (s === 'livre') step = 3;
    else if (s === 'en_attente' || s === 'en_attente_stock') step = 2;

    var progress = document.createElement('div');
    progress.className = 'dp-order-progress';
    progress.innerHTML =
      '<div class="dp-order-progress-step ' + (step >= 1 ? 'active' : '') + '">' +
        '<div class="dp-order-progress-dot"></div><span>Reçue</span></div>' +
      '<div class="dp-order-progress-line ' + (step >= 2 ? 'active' : '') + '"></div>' +
      '<div class="dp-order-progress-step ' + (step >= 2 ? 'active' : '') + '">' +
        '<div class="dp-order-progress-dot"></div><span>En cours</span></div>' +
      '<div class="dp-order-progress-line ' + (step >= 3 ? 'active' : '') + '"></div>' +
      '<div class="dp-order-progress-step ' + (step >= 3 ? 'active' : '') + '">' +
        '<div class="dp-order-progress-dot"></div><span>Livrée</span></div>';

    var head = card.querySelector('.order-head');
    if (head && head.parentNode) {
      head.parentNode.insertBefore(progress, head.nextSibling);
    } else {
      card.insertBefore(progress, card.firstChild);
    }
  }

  function addShareButton(card) {
    if (card.querySelector('.dp-share-btn')) return;
    if (!navigator.share) return;

    var details = card.querySelector('.order-details');
    if (!details) return;

    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'dp-share-btn';
    btn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
      '<circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/>' +
      '<line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/>' +
      '<line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>' +
      '<span>Partager cette commande</span>';

    btn.addEventListener('click', function () {
      var refEl = card.querySelector('.order-detail-val');
      var titleEl = card.querySelector('.order-title');
      var ref = refEl ? refEl.textContent : '';
      var title = titleEl ? titleEl.textContent : 'Commande';
      navigator.share({
        title: 'Ma commande DigitalPay',
        text: 'Commande ' + ref + ' — ' + title + ' sur DigitalPay Haiti',
        url: window.location.origin
      }).catch(function () {});
    });

    details.parentNode.insertBefore(btn, details.nextSibling);
  }

  /* ═══════════════════════════════════════════════════════════
     9. OPTIMISTIC UI — badge feedback
     ═══════════════════════════════════════════════════════════ */
  function initOptimisticFeedback() {
    document.addEventListener('click', function (e) {
      var btn = e.target.closest('.btn-add-cart');
      if (!btn || btn.disabled) return;
      var badge = document.getElementById('cart-badge');
      var navBadge = document.getElementById('nav-cart-badge');
      [badge, navBadge].forEach(function (b) {
        if (!b) return;
        b.classList.add('visible');
        b.style.transition = 'transform 0.25s cubic-bezier(0.34, 1.56, 0.64, 1)';
        b.style.transform = 'scale(1.5)';
        setTimeout(function () { b.style.transform = ''; }, 280);
      });
    });
  }

  /* ═══════════════════════════════════════════════════════════
     10. DRAG HANDLE (bottom sheets)
     ═══════════════════════════════════════════════════════════ */
  function initDraggableSheets() {
    var grabbers = document.querySelectorAll('.sheet-grabber, .modal-grabber');
    for (var i = 0; i < grabbers.length; i++) {
      attachDrag(grabbers[i]);
    }
  }

  function attachDrag(grabber) {
    if (grabber.dataset.dpDragBound === '1') return;
    grabber.dataset.dpDragBound = '1';

    var sheet = grabber.closest('.sheet-modal, .modal-sheet');
    if (!sheet) return;

    var startY = 0, currentY = 0, dragging = false;
    grabber.style.cursor = 'grab';
    grabber.style.touchAction = 'none';
    grabber.style.paddingBottom = '6px';

    grabber.addEventListener('touchstart', function (e) {
      startY = e.touches[0].clientY;
      dragging = true;
      sheet.style.transition = 'none';
    }, { passive: true });

    grabber.addEventListener('touchmove', function (e) {
      if (!dragging) return;
      currentY = e.touches[0].clientY - startY;
      if (currentY > 0) {
        sheet.style.transform = 'translateY(' + currentY + 'px)';
      }
    }, { passive: true });

    grabber.addEventListener('touchend', function () {
      if (!dragging) return;
      dragging = false;
      sheet.style.transition = '';
      if (currentY > 110) {
        var backdrop = sheet.closest('.sheet-backdrop, .modal-backdrop');
        if (backdrop) backdrop.classList.remove('active');
        sheet.style.transform = '';
        document.body.style.overflow = '';
      } else {
        sheet.style.transform = '';
      }
      currentY = 0;
    }, { passive: true });
  }

  /* ═══════════════════════════════════════════════════════════
     11. ENHANCE EMPTY STATES
     ═══════════════════════════════════════════════════════════ */
  function enhanceEmptyStates() {
    function mark(el) {
      if (!el || el.dataset.dpEmptyMark === '1') return;
      el.dataset.dpEmptyMark = '1';
      el.classList.add('dp-empty-enhanced');
    }
    var observer = new MutationObserver(function (mutations) {
      for (var i = 0; i < mutations.length; i++) {
        var added = mutations[i].addedNodes;
        for (var j = 0; j < added.length; j++) {
          var n = added[j];
          if (n.nodeType !== 1) continue;
          if (n.classList && (
            n.classList.contains('empty-cart') ||
            n.classList.contains('empty-orders') ||
            n.classList.contains('empty-tx') ||
            n.classList.contains('empty-state')
          )) {
            mark(n);
          }
          var inner = n.querySelectorAll && n.querySelectorAll('.empty-cart, .empty-orders, .empty-tx, .empty-state');
          if (inner) for (var k = 0; k < inner.length; k++) mark(inner[k]);
        }
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }

  /* ═══════════════════════════════════════════════════════════
     12. AUTO-CELEBRATE (Free Fire auto-delivery)
     ═══════════════════════════════════════════════════════════ */
  function checkAutoCelebrate() {
    var flag = null;
    try { flag = sessionStorage.getItem('dp_celebrate'); } catch (e) {}
    if (flag === '1') {
      try { sessionStorage.removeItem('dp_celebrate'); } catch (e) {}
      setTimeout(function () { fireConfetti(); }, 400);
    }
  }

  /* ═══════════════════════════════════════════════════════════
     BOOT
     ═══════════════════════════════════════════════════════════ */
  function boot() {
    STATE.currentPage = detectPage();

    initFlyToCart();
    initSwipeToDelete();
    initPullToRefresh();
    initSearchHistory();
    initOnboarding();
    initCommandeEnhancements();
    initOptimisticFeedback();
    enhanceEmptyStates();
    initDraggableSheets();
    checkAutoCelebrate();

    window.addEventListener('load', function () {
      setTimeout(initDraggableSheets, 500);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }

  /* ═══ EXPOSE ═══ */
  window.DPConfetti = fireConfetti;
  window.DPFuzzyMatch = fuzzyMatch;
  window.DPUX = {
    celebrate: fireConfetti,
    fuzzy: fuzzyMatch,
    version: '8.0'
  };
})();