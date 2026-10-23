/* =============================================
   NAVIGATION
   ============================================= */
/* =============================================
   SCROLL REVEAL — IntersectionObserver
   ============================================= */
const revealObserver = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.classList.add('reveal-visible');
    }
  });
}, { threshold: 0.07, rootMargin: '0px 0px -40px 0px' });

function initReveal(page) {
  page.querySelectorAll('.scroll-reveal').forEach(el => {
    el.classList.remove('reveal-visible');
    revealObserver.unobserve(el);
    revealObserver.observe(el);
  });
}

/* Chaque page du site est un fichier HTML distinct : on repère la page courante */
const PAGE_EL = document.querySelector('.page');
const PAGE_ID = PAGE_EL ? PAGE_EL.id.replace('page-', '') : '';

document.addEventListener('DOMContentLoaded', () => {
  (window.siteReady || (f => f()))(() => {
    if (PAGE_EL) initReveal(PAGE_EL);
    /* Arrivée depuis la recherche du site : ?q=mot */
    const m = /[?&]q=([^&]*)/.exec(location.search);
    if (m) {
      let q = '';
      try { q = decodeURIComponent(m[1].replace(/\+/g, ' ')); } catch (e) {}
      try { history.replaceState(null, '', location.pathname + location.hash); } catch (e) {}
      if (q) highlightPage(PAGE_ID, q);
    }
  });
});

/* =============================================
   FRISE FORMATION — clic sur le point ou le texte
   ============================================= */
function toggleNode(node) {
  const isOpen = node.classList.contains('open');
  // Fermer tous les autres dans la même frise
  const horiz = node.closest('.tl-horiz');
  horiz.querySelectorAll('.tl-node.open').forEach(n => n.classList.remove('open'));
  if (!isOpen) node.classList.add('open');
}

/* =============================================
   CARTES GROSSESSE
   ============================================= */
function toggleCard(face) {
  const detail = face.parentElement.querySelector('.gc-detail');
  const open = detail.classList.contains('open');
  document.querySelectorAll('.gc-detail.open').forEach(d => d.classList.remove('open'));
  if (!open) detail.classList.add('open');
}

/* =============================================
   RECHERCHE — scan du texte réel de chaque page
   ============================================= */
function normalize(s) {
  return s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');
}

/* L'index (liste des mots de chaque page) n'est chargé qu'à la première recherche */
var _indexQueue = null;
function withSearchIndex(cb, fail) {
  if (window.SITE_SEARCH) { cb(); return; }
  if (_indexQueue) { _indexQueue.push([cb, fail]); return; }
  _indexQueue = [[cb, fail]];
  var s = document.createElement('script');
  s.src = '/docs/recherche.js?v=15';
  s.onload = function() { var q = _indexQueue; _indexQueue = null; q.forEach(function(x) { x[0](); }); };
  s.onerror = function() { var q = _indexQueue; _indexQueue = null; q.forEach(function(x) { x[1](); }); };
  document.head.appendChild(s);
}

function doSearch(val) {
  const q = normalize(val.trim());
  const res = document.getElementById('search-results');
  if (q.length < 2) { res.style.display = 'none'; return; }
  const esc = t => String(t).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  withSearchIndex(function() {
    /* la saisie a pu changer pendant le chargement de l'index */
    if (normalize(document.getElementById('search-input').value.trim()) !== q) return;
    const hits = window.SITE_SEARCH.filter(page => {
      if (!page.set) page.set = new Set(page.words.split(' '));
      /* Correspondance si un mot de la page commence par la requête,
         ou si la requête est contenue dans un mot (pour les préfixes courts) */
      return [...page.set].some(w => w.startsWith(q) || (q.length >= 3 && w.includes(q)));
    });
    res.innerHTML = hits.length
      ? hits.map(h => `<div class="sr-item" data-id="${esc(h.id)}" data-q="${esc(q)}" onclick="goPage(this.dataset.id, this.dataset.q)">→ ${esc(h.label)}</div>`).join('')
      : `<div style="color:var(--muted);font-family:var(--f-body);font-size:13px;">Aucun résultat pour « ${esc(val)} »</div>`;
    res.style.display = 'block';
  }, function() {
    res.innerHTML = '<div style="color:var(--muted);font-family:var(--f-body);font-size:13px;">Recherche indisponible pour le moment.</div>';
    res.style.display = 'block';
  });
}

/* Résultat de recherche : même page = surlignage sur place ; autre page = on s'y rend */
function goPage(id, query) {
  document.getElementById('search-results').style.display = 'none';
  document.getElementById('search-input').value = '';
  toggleSearch(false);
  if (id === PAGE_ID) { if (query) highlightPage(id, query); return; }
  const page = (window.SITE_SEARCH || []).find(p => p.id === id);
  if (page) location.href = page.url + (query ? '?q=' + encodeURIComponent(query) : '');
}

/* =============================================
   SURLIGNAGE
   ============================================= */
function highlightPage(pageId, query) {
  // Nettoyer les anciens surlignages
  clearHighlights();

  const page = document.getElementById('page-' + pageId);
  if (!page || query.length < 2) return;

  const q = normalize(query);

  // Walker sur les nœuds texte uniquement
  const walker = document.createTreeWalker(page, NodeFilter.SHOW_TEXT, {
    acceptNode: n => {
      const tag = n.parentElement && n.parentElement.tagName;
      // Ignorer les scripts, styles, balises highlight déjà posées
      if (['SCRIPT','STYLE','MARK'].includes(tag)) return NodeFilter.FILTER_REJECT;
      return normalize(n.nodeValue).includes(q) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
    }
  });

  const nodes = [];
  while (walker.nextNode()) nodes.push(walker.currentNode);

  // Ouvrir automatiquement les conteneurs repliés qui contiennent un résultat
  nodes.forEach(node => {
    const el = node.parentElement;
    if (!el) return;
    // .home-card (accueil)
    const homeCard = el.closest('.home-card');
    if (homeCard && !homeCard.classList.contains('open')) homeCard.classList.add('open');
    // .gc-detail (grossesse)
    const gcDetail = el.closest('.gc-detail');
    if (gcDetail && !gcDetail.classList.contains('open')) gcDetail.classList.add('open');
    // .tl-node (formation — on ouvre le nœud, pas besoin de fermer les voisins ici)
    const tlNode = el.closest('.tl-node');
    if (tlNode && !tlNode.classList.contains('open')) tlNode.classList.add('open');
  });

  let firstMark = null;
  nodes.forEach(node => {
    const text = node.nodeValue;
    const normText = normalize(text);
    const parts = [];
    let cursor = 0;

    // Trouver toutes les occurrences (insensible aux accents)
    let idx;
    while ((idx = normText.indexOf(q, cursor)) !== -1) {
      if (idx > cursor) parts.push(document.createTextNode(text.slice(cursor, idx)));
      const mark = document.createElement('mark');
      mark.className = 'search-highlight';
      mark.textContent = text.slice(idx, idx + q.length);
      parts.push(mark);
      if (!firstMark) firstMark = mark;
      cursor = idx + q.length;
    }
    if (cursor < text.length) parts.push(document.createTextNode(text.slice(cursor)));

    if (parts.length > 0) {
      const frag = document.createDocumentFragment();
      parts.forEach(p => frag.appendChild(p));
      node.parentNode.replaceChild(frag, node);
    }
  });

  // Scroller jusqu'au premier résultat
  if (firstMark) {
    setTimeout(() => firstMark.scrollIntoView({ behavior: 'smooth', block: 'center' }), 300);
  }

  // Retirer le surlignage après 4 secondes (fondu)
  setTimeout(() => clearHighlights(), 4000);
}

function clearHighlights() {
  document.querySelectorAll('mark.search-highlight').forEach(mark => {
    const parent = mark.parentNode;
    parent.replaceChild(document.createTextNode(mark.textContent), mark);
    parent.normalize();
  });
}

/* =============================================
   MODALES LÉGALES
   ============================================= */
function openModal(id) {
  document.getElementById(id).classList.add('open');
  document.body.style.overflow = 'hidden';
}
function closeModal(id) {
  document.getElementById(id).classList.remove('open');
  document.body.style.overflow = '';
}
// Fermer en cliquant sur l'overlay
document.querySelectorAll('.modal-overlay').forEach(overlay => {
  overlay.addEventListener('click', function(e) {
    if (e.target === this) closeModal(this.id);
  });
});
// Fermer avec Échap
document.addEventListener('keydown', function(e) {
  if (e.key === 'Escape') {
    document.querySelectorAll('.modal-overlay.open').forEach(m => closeModal(m.id));
  }
});


var MAPS_SRC = "https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d2625.5!2d2.3063!3d48.8558!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x47e6700be7a8cc73%3A0x1!2s21%20Rue%20Chevert%2C%2075007%20Paris%2C%20France!5e0!3m2!1sfr!2sfr!4v1";
function loadMap() {
  var container = document.getElementById('mapContainer');
  var ph = document.getElementById('mapPlaceholder');
  if (!container || document.getElementById('mapsIframe')) return;
  var iframe = document.createElement('iframe');
  iframe.id = 'mapsIframe';
  iframe.src = MAPS_SRC;
  iframe.allowFullscreen = true;
  iframe.loading = 'lazy';
  iframe.referrerPolicy = 'no-referrer-when-downgrade';
  iframe.setAttribute('style', 'width:100%;height:100%;border:none;min-height:340px;display:block;');
  container.insertBefore(iframe, ph);
  if (ph) ph.style.display = 'none';
}
function acceptCookies() {
  var b = document.getElementById('cookieBanner');
  if (b) b.classList.add('hidden');
  try { localStorage.setItem('cookies_ok','1'); } catch(e) {}
  loadMap();
}
function acceptCookiesAndLoadMap() {
  acceptCookies();
}
function refuseCookies() {
  var b = document.getElementById('cookieBanner');
  if (b) b.classList.add('hidden');
  try { localStorage.setItem('cookies_ok','refused'); } catch(e) {}
}
(function() {
  try {
    var ck = localStorage.getItem('cookies_ok');
    if (ck === '1' || ck === 'refused') {
      var b = document.getElementById('cookieBanner');
      if (b) b.classList.add('hidden');
    }
    if (ck === '1') {
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', loadMap);
      } else {
        loadMap();
      }
    }
  } catch(e) {}
})();

/* =============================================
   FOOTER SCROLL DOTS
   ============================================= */
(function() {
  var grid = document.querySelector('.footer-grid');
  var dots = document.querySelectorAll('#footerDots span');
  if (!grid || !dots.length) return;
  function updateDots() {
    var total = grid.scrollWidth - grid.clientWidth;
    var idx = total > 0 ? Math.round((grid.scrollLeft / total) * (dots.length - 1)) : 0;
    dots.forEach(function(d, i) {
      d.style.width = i === idx ? '22px' : '14px';
      d.style.background = i === idx ? 'rgba(255,255,255,0.8)' : 'rgba(255,255,255,0.25)';
    });
  }
  grid.addEventListener('scroll', updateDots, {passive:true});
  updateDots();
})();

/* =============================================
   ANTI PINCH-ZOOM SNAP-BACK
   Quand l'utilisateur dézoom sous 1×, on remet le viewport à 1×
   ============================================= */
(function() {
  if (!window.visualViewport) return;
  var resetTimer = null;
  function resetZoom() {
    if (window.visualViewport.scale < 0.98) {
      // Remettre à 1 en remplaçant la meta viewport momentanément
      var meta = document.querySelector('meta[name="viewport"]');
      if (!meta) return;
      meta.content = 'width=device-width, initial-scale=1.0, maximum-scale=1.0';
      setTimeout(function() {
        meta.content = 'width=device-width, initial-scale=1.0';
      }, 300);
    }
  }
  window.visualViewport.addEventListener('resize', function() {
    clearTimeout(resetTimer);
    resetTimer = setTimeout(resetZoom, 150);
  });
})();

/* =============================================
   MENU, RECHERCHE ET BANDE FIXE (mobile + ordinateur)
   ============================================= */
function toggleMenu(force) {
  var open = document.body.classList.toggle('menu-open', force);
  if (open) document.body.classList.remove('search-open');
}
function toggleSearch(force) {
  var open = document.body.classList.toggle('search-open', force);
  if (open) {
    document.body.classList.remove('menu-open');
    var i = document.getElementById('search-input');
    if (i) setTimeout(function() { i.focus(); }, 50);
  } else {
    var r = document.getElementById('search-results');
    if (r) r.style.display = 'none';
  }
}
/* Bande du haut : s'affine quand on descend */
(function() {
  var ticking = false;
  function update() {
    ticking = false;
    var y = window.scrollY;
    var b = document.body.classList;
    if (y > 70) b.add('is-scrolled'); else if (y < 20) b.remove('is-scrolled');
  }
  window.addEventListener('scroll', function() {
    if (!ticking) { ticking = true; requestAnimationFrame(update); }
  }, {passive: true});
  update();
  function brandH() {
    var r = document.querySelector('.brand-row');
    if (r) document.documentElement.style.setProperty('--brand-h', r.offsetHeight + 'px');
  }
  window.addEventListener('resize', brandH);
  window.addEventListener('load', brandH);
  brandH();
})();
