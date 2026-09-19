/* ═══════════════════════════════════════════════════════════
   DigitalPay Haiti — Design System JS v8.0 FINAL
   Dark mode · Cookie banner · PWA · Logo swap
   FIX : Force body visible si le JS rencontre une erreur
   Expose : window.DPTheme · window.DPCookie
   ═══════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  var STORAGE_THEME = 'dp_theme';
  var STORAGE_COOKIE = 'dp_cookie_consent';
  var THEME_LIGHT = 'light';
  var THEME_DARK = 'dark';

  /* ═══════════════════════════════════════════════════════════
     FIX CRITIQUE — FORCE BODY VISIBLE
     Ajoute une garantie absolue : si ce script s'exécute sans
     crash, on s'assure que body devient visible quoi qu'il arrive
     ═══════════════════════════════════════════════════════════ */
  function forceBodyVisible() {
    try {
      if (!document.body) return;
      if (!document.body.classList.contains('ready')) {
        // Attendre 2.5s pour laisser une chance au script principal
        setTimeout(function () {
          if (!document.body.classList.contains('ready')) {
            document.body.classList.add('ready');
            document.body.setAttribute('data-dp-force-visible', '1');
          }
        }, 2500);
      }
      // Admin : forcer immédiatement
      if (
        window.location.pathname.indexOf('/admin/') !== -1 ||
        document.querySelector('.twofa-screen') ||
        document.getElementById('admin-shell') ||
        document.getElementById('pins-shell')
      ) {
        document.body.classList.add('ready');
        document.body.setAttribute('data-dp-force-visible', '1');
      }
    } catch (e) {
      // Fallback absolu : si tout échoue, forcer visible
      try { document.body.style.opacity = '1'; } catch (e2) {}
    }
  }

  /* ═══ THEME ═══ */
  function getStoredTheme() {
    try { return localStorage.getItem(STORAGE_THEME); } catch (e) { return null; }
  }

  function getSystemTheme() {
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      return THEME_DARK;
    }
    return THEME_LIGHT;
  }

  function getEffectiveTheme() {
    return getStoredTheme() || getSystemTheme();
  }

  function applyTheme(theme, animate) {
    var root = document.documentElement;
    if (animate) {
      root.classList.add('dp-theme-transition');
      setTimeout(function () {
        root.classList.remove('dp-theme-transition');
      }, 350);
    }
    root.setAttribute('data-theme', theme);
    var metaTheme = document.querySelector('meta[name="theme-color"]');
    if (metaTheme) {
      metaTheme.setAttribute('content', theme === THEME_DARK ? '#060A14' : '#00B4FF');
    }
    swapLogo(theme);
  }

  function setTheme(theme) {
    try { localStorage.setItem(STORAGE_THEME, theme); } catch (e) {}
    applyTheme(theme, true);
    updateToggleUI();
  }

  function toggleTheme() {
    var current = getEffectiveTheme();
    setTheme(current === THEME_DARK ? THEME_LIGHT : THEME_DARK);
  }

  function updateToggleUI() {
    var current = getEffectiveTheme();
    var isDark = current === THEME_DARK;

    var buttons = document.querySelectorAll('.dp-theme-toggle');
    for (var i = 0; i < buttons.length; i++) {
      var btn = buttons[i];
      var label = btn.querySelector('.dp-theme-toggle-label');
      if (label) {
        label.textContent = isDark ? 'Mode clair' : 'Mode sombre';
      }
      btn.setAttribute('aria-pressed', isDark ? 'true' : 'false');
    }
  }

  /* ═══ LOGO SWAP ═══ */
  function computeDarkSrc(lightSrc) {
    if (!lightSrc) return '';
    if (/logo-dark\.png$/i.test(lightSrc)) return lightSrc;
    if (/logo\.png$/i.test(lightSrc)) {
      return lightSrc.replace(/logo\.png$/i, 'logo-dark.png');
    }
    return lightSrc.replace(/(\.[a-zA-Z0-9]+)$/, '-dark$1');
  }

  function computeLightSrc(currentSrc) {
    if (!currentSrc) return '';
    if (/logo-dark\.png$/i.test(currentSrc)) {
      return currentSrc.replace(/logo-dark\.png$/i, 'logo.png');
    }
    return currentSrc;
  }

  function swapLogo(theme) {
    var images = document.querySelectorAll('.brand-logo, .sidebar-logo-wrap img');
    if (!images.length) return;

    var isDark = theme === THEME_DARK;

    for (var i = 0; i < images.length; i++) {
      var img = images[i];

      if (!img.dataset.dpLightSrc) {
        var current = img.getAttribute('src') || '';
        img.dataset.dpLightSrc = computeLightSrc(current);
      }

      var lightSrc = img.dataset.dpLightSrc;
      if (!lightSrc) continue;

      var darkSrc = computeDarkSrc(lightSrc);
      var target = isDark ? darkSrc : lightSrc;

      if (img.getAttribute('src') !== target) {
        if (!img.dataset.dpFallbackBound) {
          img.dataset.dpFallbackBound = '1';
          img.addEventListener('error', function () {
            var self = this;
            if (!self.dataset.dpLightSrc) return;
            if (self.getAttribute('src') === self.dataset.dpLightSrc) return;
            self.setAttribute('src', self.dataset.dpLightSrc);
          });
        }
        img.setAttribute('src', target);
      }
    }
  }

  /* ═══ THEME TOGGLE INJECTION ═══ */
  function injectThemeToggle() {
    var sidebarContents = document.querySelectorAll('.sidebar-content');
    if (!sidebarContents.length) return;

    for (var i = 0; i < sidebarContents.length; i++) {
      var content = sidebarContents[i];
      if (content.querySelector('.dp-theme-toggle')) continue;

      var anchor = content.querySelector('.lang-grid');
      var section = document.createElement('div');
      section.className = 'dp-theme-section';

      section.innerHTML = '' +
        '<div class="sidebar-label">Apparence</div>' +
        '<button type="button" class="dp-theme-toggle" aria-pressed="false">' +
          '<svg viewBox="0 0 24 24" aria-hidden="true">' +
            '<path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" stroke-linecap="round" stroke-linejoin="round"/>' +
          '</svg>' +
          '<span class="dp-theme-toggle-label">Mode sombre</span>' +
          '<span class="dp-theme-switch" aria-hidden="true"><span class="dp-theme-knob"></span></span>' +
        '</button>';

      if (anchor && anchor.parentNode) {
        anchor.parentNode.insertBefore(section, anchor.nextSibling);
      } else {
        content.appendChild(section);
      }

      var btn = section.querySelector('.dp-theme-toggle');
      if (btn) {
        btn.addEventListener('click', function (e) {
          e.preventDefault();
          e.stopPropagation();
          toggleTheme();
        });
      }
    }

    updateToggleUI();
  }

  /* ═══ COOKIE BANNER ═══ */
  function hasCookieConsent() {
    try { return !!localStorage.getItem(STORAGE_COOKIE); } catch (e) { return true; }
  }

  function setCookieConsent(value) {
    try { localStorage.setItem(STORAGE_COOKIE, value); } catch (e) {}
  }

  function isAdminPage() {
    return window.location.pathname.indexOf('/admin/') !== -1;
  }

  function injectCookieBanner() {
    if (isAdminPage()) return;
    if (hasCookieConsent()) return;
    if (document.querySelector('.dp-cookie-banner')) return;

    var banner = document.createElement('div');
    banner.className = 'dp-cookie-banner';
    banner.setAttribute('role', 'dialog');
    banner.setAttribute('aria-live', 'polite');

    banner.innerHTML = '' +
      '<div class="dp-cookie-title">' +
        '<svg viewBox="0 0 24 24" aria-hidden="true">' +
          '<path d="M12 2a10 10 0 1010 10 4 4 0 01-5-5 4 4 0 01-5-5z"/>' +
          '<circle cx="9" cy="9" r="1" fill="currentColor" stroke="none"/>' +
          '<circle cx="14" cy="14" r="1" fill="currentColor" stroke="none"/>' +
          '<circle cx="9" cy="15" r="1" fill="currentColor" stroke="none"/>' +
        '</svg>' +
        '<span>Cookies & confidentialite</span>' +
      '</div>' +
      '<div class="dp-cookie-text">' +
        'DigitalPay utilise uniquement des cookies essentiels pour le fonctionnement du service : session, panier, langue et theme. Aucun tracking publicitaire. ' +
        '<a href="legal.html">En savoir plus</a>' +
      '</div>' +
      '<div class="dp-cookie-actions">' +
        '<button type="button" class="dp-cookie-btn dp-cookie-btn-reject">Essentiels uniquement</button>' +
        '<button type="button" class="dp-cookie-btn dp-cookie-btn-accept">Accepter</button>' +
      '</div>';

    document.body.appendChild(banner);

    requestAnimationFrame(function () {
      banner.classList.add('visible');
    });

    var acceptBtn = banner.querySelector('.dp-cookie-btn-accept');
    var rejectBtn = banner.querySelector('.dp-cookie-btn-reject');

    function dismiss(value) {
      setCookieConsent(value);
      banner.classList.remove('visible');
      setTimeout(function () {
        if (banner.parentNode) banner.parentNode.removeChild(banner);
      }, 400);
    }

    if (acceptBtn) acceptBtn.addEventListener('click', function () { dismiss('accepted'); });
    if (rejectBtn) rejectBtn.addEventListener('click', function () { dismiss('essential'); });
  }

  /* ═══ PWA SERVICE WORKER ═══ */
  function registerServiceWorker() {
    if (!('serviceWorker' in navigator)) return;
    if (window.location.protocol !== 'https:' && window.location.hostname !== 'localhost') return;

    navigator.serviceWorker.register('/sw.js', { scope: '/' })
      .then(function (registration) {
        registration.addEventListener('updatefound', function () {
          var newWorker = registration.installing;
          if (!newWorker) return;
          newWorker.addEventListener('statechange', function () {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              showUpdateToast();
            }
          });
        });
      })
      .catch(function (err) {
        console.warn('[DP Design] SW registration failed:', err && err.message);
      });
  }

  function showUpdateToast() {
    var container = document.getElementById('toast-container');
    if (!container) return;

    var toast = document.createElement('div');
    toast.className = 'toast info';
    toast.style.pointerEvents = 'auto';
    toast.innerHTML = '' +
      '<div class="toast-icon"><svg viewBox="0 0 24 24"><path d="M12 4v16m8-8H4" stroke-linecap="round"/></svg></div>' +
      '<div class="toast-msg">Nouvelle version disponible. <button type="button" id="dp-sw-refresh" style="background:none;border:none;color:#93C5FD;font-weight:800;cursor:pointer;text-decoration:underline;font-family:inherit;padding:0;margin-left:4px;">Actualiser</button></div>';

    container.appendChild(toast);
    requestAnimationFrame(function () { toast.classList.add('show'); });

    setTimeout(function () {
      toast.classList.remove('show');
      setTimeout(function () {
        if (toast.parentNode) toast.parentNode.removeChild(toast);
      }, 350);
    }, 8000);

    var refreshBtn = toast.querySelector('#dp-sw-refresh');
    if (refreshBtn) {
      refreshBtn.addEventListener('click', function () {
        if (navigator.serviceWorker.controller) {
          navigator.serviceWorker.controller.postMessage({ type: 'SKIP_WAITING' });
        }
        setTimeout(function () { window.location.reload(); }, 300);
      });
    }
  }

  /* ═══ SYSTEM THEME LISTENER ═══ */
  function watchSystemTheme() {
    if (!window.matchMedia) return;
    var mq = window.matchMedia('(prefers-color-scheme: dark)');
    var listener = function () {
      if (getStoredTheme()) return;
      applyTheme(getSystemTheme(), true);
      updateToggleUI();
    };
    if (mq.addEventListener) {
      mq.addEventListener('change', listener);
    } else if (mq.addListener) {
      mq.addListener(listener);
    }
  }

  /* ═══ BOTTOM NAV DETECTION ═══ */
  function detectBottomNav() {
    if (document.querySelector('.bottom-nav')) {
      document.body.classList.add('dp-has-bottom-nav');
    }
  }

  /* ═══ SIDEBAR WATCHER ═══ */
  function watchSidebar() {
    if (!window.MutationObserver) return;
    var observer = new MutationObserver(function () {
      var contents = document.querySelectorAll('.sidebar-content');
      for (var i = 0; i < contents.length; i++) {
        if (!contents[i].querySelector('.dp-theme-toggle')) {
          injectThemeToggle();
          break;
        }
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }

  /* ═══ BOOT ═══ */
  function boot() {
    detectBottomNav();
    injectThemeToggle();
    injectCookieBanner();
    registerServiceWorker();
    watchSystemTheme();
    watchSidebar();

    swapLogo(getEffectiveTheme());
  }

  /* ═══════════════════════════════════════════════════════════
     SÉQUENCE D'INITIALISATION
     ═══════════════════════════════════════════════════════════ */

  // 1. Force body visible le plus tôt possible
  if (document.body) {
    forceBodyVisible();
  } else if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', forceBodyVisible, { once: true });
  }

  // 2. Applique le thème immédiatement (avant même DOMContentLoaded)
  try {
    applyTheme(getEffectiveTheme(), false);
  } catch (e) {
    console.warn('[DP Design] applyTheme error:', e);
  }

  // 3. Boot complet quand le DOM est prêt
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }

  // 4. Réinjection tardive (assets qui se chargent après)
  window.addEventListener('load', function () {
    setTimeout(function () {
      injectThemeToggle();
      swapLogo(getEffectiveTheme());
      forceBodyVisible();
    }, 400);
  });

  // 5. Safety net final : forcer body visible après 3s quoi qu'il arrive
  setTimeout(forceBodyVisible, 3000);

  /* ═══ RACCOURCI CLAVIER ═══ */
  document.addEventListener('keydown', function (e) {
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'L' || e.key === 'l')) {
      e.preventDefault();
      toggleTheme();
    }
  });

  /* ═══ EXPOSE ═══ */
  window.DPTheme = {
    toggle: toggleTheme,
    set: setTheme,
    get: getEffectiveTheme,
    refresh: injectThemeToggle,
    swapLogo: function () { swapLogo(getEffectiveTheme()); }
  };

  window.DPCookie = {
    show: injectCookieBanner,
    reset: function () {
      try { localStorage.removeItem(STORAGE_COOKIE); } catch (e) {}
      injectCookieBanner();
    }
  };
})();