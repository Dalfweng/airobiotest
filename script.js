(function () {
  // ensure DOM is available (script is loaded with defer but safe-guard)
  const ready = () => {
    const nav = document.querySelector('.main-nav');
    if (!nav) return console.warn('nav element not found');

    const menuItems = Array.from(document.querySelectorAll('.menu .menu-item[data-dropdown]'));
    const dropdowns = Array.from(document.querySelectorAll('.dropdown'));
    const root = document.documentElement;
    if (!menuItems.length || !dropdowns.length) {
      // nothing to do
      return;
    }

    const dropdownMap = new Map(dropdowns.map(dd => [dd.dataset.for, dd]));

    function closeAll(exceptPinned = true) {
      dropdowns.forEach(d => { d.classList.remove('open'); d.setAttribute('aria-hidden', 'true'); });
      menuItems.forEach(btn => {
        if (exceptPinned && btn.dataset.pinned === 'true') {
          // keep visually expanded for pinned buttons
          btn.setAttribute('aria-expanded', 'true');
        } else {
          btn.setAttribute('aria-expanded', 'false');
          delete btn.dataset.pinned;
        }
      });
      root.style.setProperty('--dropdown-offset', '0px');
    }

    function setOffsetFor(dd) {
      const h = dd.getBoundingClientRect().height || 0;
      root.style.setProperty('--dropdown-offset', h + 'px');
    }

    function openFor(name, btn, { pinned = false } = {}) {
      const dd = dropdownMap.get(name);
      if (!dd) return;
      // close other dropdowns but preserve pinned if we are opening another pinned (rare)
      closeAll();
      // position relative to header using its height
      dd.style.position = 'absolute';
      dd.style.left = '0';
      dd.style.right = '0';
      dd.style.top = nav.offsetHeight + 'px';
      dd.classList.add('open');
      dd.setAttribute('aria-hidden', 'false');
      btn.setAttribute('aria-expanded', 'true');
      if (pinned) btn.dataset.pinned = 'true';
      else delete btn.dataset.pinned;
      // measure after paint
      requestAnimationFrame(() => requestAnimationFrame(() => setOffsetFor(dd)));
    }

    // mouse & keyboard handling per button
    menuItems.forEach(btn => {
      const name = btn.dataset.dropdown;
      if (!name) return;

      // click toggles (pin) the dropdown
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        const isOpen = btn.getAttribute('aria-expanded') === 'true';
        if (isOpen) {
          // close fully when user clicks again
          closeAll(false);
        } else {
          // open and pin; clear other pins when opening a new one
          openFor(name, btn, { pinned: true });
        }
      });

      // hover/focus opens but does not pin (so a click is required to pin)
      btn.addEventListener('mouseenter', () => {
        // if already pinned, keep it
        if (btn.dataset.pinned === 'true') return;
        openFor(name, btn, { pinned: false });
      });
      btn.addEventListener('focus', () => {
        if (btn.dataset.pinned === 'true') return;
        openFor(name, btn, { pinned: false });
      });

      // leave only closes when not pinned and dropdown not hovered/focused
      btn.addEventListener('mouseleave', () => {
        setTimeout(() => {
          const dd = dropdownMap.get(name);
          if (!dd) return;
          if (btn.dataset.pinned === 'true') return;
          if (!dd.matches(':hover') && document.activeElement !== btn) closeAll(true);
        }, 120);
      });

      btn.addEventListener('blur', () => {
        setTimeout(() => {
          const dd = dropdownMap.get(name);
          if (!dd) return;
          if (btn.dataset.pinned === 'true') return;
          if (!dd.contains(document.activeElement)) closeAll(true);
        }, 60);
      });

      btn.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') closeAll();
      });
    });

    // keep dropdown open while hovered / handle leave
    dropdowns.forEach(dd => {
      dd.addEventListener('mouseenter', () => {
        const name = dd.dataset.for;
        const btn = menuItems.find(b => b.dataset.dropdown === name);
        if (btn) {
          // if pinned keep pinned, otherwise open temporarily
          openFor(name, btn, { pinned: btn.dataset.pinned === 'true' });
        }
      });
      dd.addEventListener('mouseleave', () => {
        const name = dd.dataset.for;
        const btn = menuItems.find(b => b.dataset.dropdown === name);
        // if button is pinned, don't auto-close
        if (btn && btn.dataset.pinned === 'true') return;
        setTimeout(() => closeAll(true), 80);
      });
      dd.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeAll(false); });
    });
    menuItems.forEach(btn => btn.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeAll(false); }));

    // click outside nav closes everything (force)
    document.addEventListener('click', (e) => {
      if (!nav.contains(e.target)) closeAll(false);
    });

    // reposition dropdowns on resize/scroll if open
    function reposition() {
      // recalc top using header height (stable lors du scroll/redim)
      dropdowns.forEach(dd => {
        if (dd.classList.contains('open')) {
          dd.style.top = nav.offsetHeight + 'px';
          setOffsetFor(dd);
        }
      });
    }
    window.addEventListener('resize', reposition);
    window.addEventListener('scroll', reposition);

    // init year if present
    const yearEl = document.getElementById('year');
    if (yearEl) yearEl.textContent = new Date().getFullYear();
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', ready);
  } else {
    ready();
  }

  // contact images sync
  document.addEventListener('DOMContentLoaded', () => {
    const container = document.querySelector('.presentation-contact-inner');
    if (!container) return;

    const textEl = container.querySelector('.presentation-text');
    const imgs = Array.from(container.querySelectorAll('.contact-images img'));
    const imagesLoaded = () => imgs.every(img => img.complete);

    function syncImageHeight() {
      // compute height of text block
      const textRect = textEl.getBoundingClientRect();
      const textHeight = Math.round(textRect.height);

      // apply to container as CSS variable and explicit height for contact-images
      container.style.setProperty('--text-height', `${textHeight}px`);
      const imgCol = container.querySelector('.contact-images');
      if (imgCol) imgCol.style.height = `${textHeight}px`;
    }

    // wait for all images (if any) to load, then sync
    function trySync() {
      if (imagesLoaded()) {
        syncImageHeight();
      } else {
        // if images still loading, wait a bit, then try again
        const onImgLoad = () => {
          if (imagesLoaded()) {
            imgs.forEach(i => i.removeEventListener('load', onImgLoad));
            syncImageHeight();
          }
        };
        imgs.forEach(i => i.addEventListener('load', onImgLoad));
      }
    }

    // initial sync
    trySync();

    // keep in sync on window resize (debounced)
    let rAF;
    window.addEventListener('resize', () => {
      cancelAnimationFrame(rAF);
      rAF = requestAnimationFrame(syncImageHeight);
    });
  });

  (function () {
    const breakpoint = 900; // même valeur que le CSS pour mobile
    const syncHeight = () => {
      const textEl = document.querySelector('.presentation-text');
      const imagesCol = document.querySelector('.contact-images');
      if (!textEl || !imagesCol) return;

      // si écran petit, on supprime la hauteur forcée
      if (window.innerWidth <= breakpoint) {
        imagesCol.style.height = '';
        return;
      }

      // calculer la hauteur du bloc texte (incluant padding)
      const textRect = textEl.getBoundingClientRect();
      // appliquer la hauteur en pixels à la colonne d'images
      imagesCol.style.height = Math.round(textRect.height) + 'px';
    };

    // exécuter au chargement DOM et après chargement des images
    document.addEventListener('DOMContentLoaded', () => {
      syncHeight();

      // si des images mettent du temps à charger, resync après leurs load
      const imgs = document.querySelectorAll('.contact-images img');
      let remaining = imgs.length;
      if (remaining === 0) return;
      imgs.forEach(img => {
        if (img.complete) {
          remaining--;
        } else {
          img.addEventListener('load', () => {
            remaining--;
            if (remaining <= 0) syncHeight();
          });
          img.addEventListener('error', () => {
            remaining--;
            if (remaining <= 0) syncHeight();
          });
        }
      });
      // si toutes déjà chargées
      if (remaining <= 0) syncHeight();
    });

    // resync lors du redimensionnement (debounced)
    let resizeTimer;
    window.addEventListener('resize', () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(syncHeight, 120);
    });

    // observe les mutations de contenu du bloc texte (ex : fontes, changement de contenu)
    const textEl = document.querySelector('.presentation-text');
    if (textEl && window.MutationObserver) {
      const mo = new MutationObserver(() => syncHeight());
      mo.observe(textEl, { childList: true, subtree: true, characterData: true });
    }
  })();

  (function () {
    const gridsSelector = '.diogene-grid, .insalubre-grid';
    const breakpoint = 940;

    function isTextColumn(el) {
      if (!el) return false;
      // contient un paragraphe ou titre, et pas d'image
      if (el.querySelector('img')) return false;
      return !!el.querySelector('p, h1, h2, h3, .lead, ul, ol, .text') || (el.textContent || '').trim().length > 20;
    }

    function findPair(grid) {
      // préférer enfants directs
      const children = Array.from(grid.querySelectorAll(':scope > *'));
      let imgCol = children.find(c => c.querySelector && c.querySelector('img'));
      let textCol = children.find(c => isTextColumn(c) && c !== imgCol);

      // fallback : chercher dans tout le grid
      if (!imgCol) imgCol = grid.querySelector('figure, .diogene-figure, .insalubre-figure, img') || null;
      if (imgCol && imgCol.tagName === 'IMG') {
        // si l'élément trouvé est l'image elle-même, prendre son parent comme colonne
        imgCol = imgCol.parentElement || imgCol;
      }
      if (!textCol) textCol = grid.querySelector('.diogene-text, .insalubre-text, .presentation-text') || null;

      return { textCol, imgCol };
    }

    function measureHeight(el) {
      if (!el) return 0;
      // use scrollHeight to include wrapped content + padding
      const style = getComputedStyle(el);
      const scroll = Math.ceil(el.scrollHeight || el.getBoundingClientRect().height || 0);
      const bt = parseFloat(style.borderTopWidth) || 0;
      const bb = parseFloat(style.borderBottomWidth) || 0;
      return scroll + bt + bb;
    }

    function syncGrids() {
      const grids = Array.from(document.querySelectorAll(gridsSelector));
      if (!grids.length) return;

      // small screens -> remove forced heights
      if (window.innerWidth <= breakpoint) {
        grids.forEach(g => {
          const { imgCol } = findPair(g);
          if (!imgCol) return;
          imgCol.style.height = '';
          const img = imgCol.querySelector('img');
          if (img) {
            img.style.height = '';
            img.style.width = '';
            img.style.maxWidth = '';
          }
        });
        return;
      }

      grids.forEach(g => {
        const { textCol, imgCol } = findPair(g);
        if (!textCol || !imgCol) return;

        // reset temporaire pour mesurer correctement si nécessaire
        imgCol.style.height = 'auto';

        // mesurer la hauteur réelle du texte
        const h = Math.max(0, measureHeight(textCol), Math.round(textCol.getBoundingClientRect().height));

        // appliquer hauteur au conteneur d'image
        imgCol.style.height = h + 'px';

        // image : hauteur = 100%, largeur auto => ratio conservé
        const img = imgCol.querySelector('img');
        if (img) {
          img.style.display = 'block';
          img.style.height = '100%';
          img.style.width = 'auto';
          img.style.maxWidth = '100%';
          img.style.objectFit = 'cover';
        }
      });
    }

    // debounce
    let timer;
    window.addEventListener('resize', () => { clearTimeout(timer); timer = setTimeout(syncGrids, 120); });

    function start() {
      // initial sync
      syncGrids();

      // resync après chargement des images
      const imgs = Array.from(document.querySelectorAll(`${gridsSelector} img`));
      imgs.forEach(img => {
        if (!img.complete) {
          img.addEventListener('load', () => syncGrids(), { once: true });
          img.addEventListener('error', () => syncGrids(), { once: true });
        }
      });

      // observer modifications de texte (polices/texte dynamique)
      const textNodes = document.querySelectorAll('.diogene-text, .insalubre-text, .presentation-text');
      if (window.MutationObserver) {
        textNodes.forEach(el => {
          const mo = new MutationObserver(() => syncGrids());
          mo.observe(el, { childList: true, subtree: true, characterData: true });
        });
      }
    }

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', start);
    } else {
      start();
    }
  })();
})();