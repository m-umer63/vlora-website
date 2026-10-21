/* VLORÁ storefront behaviour: bag, wishlist, search, quick view, filters, hero, forms. No external libraries. */
(function () {
  'use strict';
  var D = window.VL || { products: [] };
  var ROOT = document.documentElement.getAttribute('data-root') || './';
  var SUF = document.documentElement.getAttribute('data-suf') || '';
  var $ = function (s, c) { return (c || document).querySelector(s); };
  var $$ = function (s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); };
  var BY = {}; D.products.forEach(function (p) { BY[p.sku] = p; });
  document.documentElement.classList.remove('no-js');

  function store(key, val) {
    try { if (val === undefined) return JSON.parse(localStorage.getItem(key) || 'null'); localStorage.setItem(key, JSON.stringify(val)); } catch (e) { mem[key] = val === undefined ? mem[key] : val; return mem[key] || null; }
    return val;
  }
  var mem = {};
  var money = function (n) { return 'AED ' + Math.round(n).toLocaleString('en-US'); };
  var esc = function (s) { return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var href = function (p) { return ROOT + 'products/' + p.slug + '/' + SUF; };
  var img = function (p) { return ROOT + 'assets/img/products/' + p.img; };
  var page = function (path) { return ROOT + path + SUF; };

  /* ---------- panels ---------- */
  var openName = null;
  function setOpen(name) {
    var b = document.body;
    ['menu', 'bag', 'search', 'quick'].forEach(function (n) { b.classList.toggle('is-open-' + n, n === name); });
    var map = { menu: '#menu-drawer', bag: '#bag-drawer', search: '#search-panel', quick: '#quick' };
    Object.keys(map).forEach(function (n) { var el = $(map[n]); if (el) el.setAttribute('aria-hidden', n === name ? 'false' : 'true'); });
    openName = name;
    b.style.overflow = name ? 'hidden' : '';
    if (name === 'search') setTimeout(function () { var i = $('#search-input'); if (i) i.focus(); }, 120);
    if (name === 'bag') renderBag();
  }
  document.addEventListener('click', function (e) {
    var t = e.target.closest('[data-open],[data-close],[data-add],[data-quick],[data-wish],[data-q],[data-thumb],[data-hero],[data-dot],[data-rail]');
    if (e.target.classList && e.target.classList.contains('modal')) return setOpen(null);
    if (!t) return;
    if (t.hasAttribute('data-open')) return setOpen(t.getAttribute('data-open'));
    if (t.hasAttribute('data-close')) return setOpen(null);
    if (t.hasAttribute('data-add')) {
      var q = 1; var from = t.getAttribute('data-qty-from');
      if (from) q = Math.max(1, parseInt($(from).value, 10) || 1);
      addToBag(t.getAttribute('data-add'), q); return;
    }
    if (t.hasAttribute('data-quick')) return quickView(t.getAttribute('data-quick'));
    if (t.hasAttribute('data-wish')) return toggleWish(t.getAttribute('data-wish'));
    if (t.hasAttribute('data-q')) {
      var wrap = t.closest('[data-qty]'); var inp = $('input', wrap);
      inp.value = Math.max(1, (parseInt(inp.value, 10) || 1) + parseInt(t.getAttribute('data-q'), 10)); return;
    }
    if (t.hasAttribute('data-thumb')) return showPic(parseInt(t.getAttribute('data-thumb'), 10));
    if (t.hasAttribute('data-hero')) return heroGo(heroI + parseInt(t.getAttribute('data-hero'), 10), true);
    if (t.hasAttribute('data-dot')) return heroGo(parseInt(t.getAttribute('data-dot'), 10), true);
    if (t.hasAttribute('data-rail')) {
      var tr = $('[data-rail-track]', t.closest('.rail-wrap')); tr.scrollBy({ left: tr.clientWidth * 0.8 * parseInt(t.getAttribute('data-rail'), 10), behavior: 'smooth' });
    }
  });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && openName) setOpen(null); });

  /* ---------- bag ---------- */
  function getBag() { return store('vl_bag') || []; }
  function setBag(b) { store('vl_bag', b); updateCounts(); renderBag(); renderSummary(); }
  function addToBag(sku, q) {
    if (!BY[sku]) return;
    var b = getBag(); var f = b.filter(function (i) { return i.sku === sku; })[0];
    if (f) f.qty += q; else b.push({ sku: sku, qty: q });
    setBag(b); setOpen('bag');
  }
  function updateCounts() {
    var n = getBag().reduce(function (a, i) { return a + i.qty; }, 0);
    $$('[data-bag-count]').forEach(function (e) { e.textContent = n; e.hidden = !n; });
    var w = getWish().length;
    $$('[data-wish-count]').forEach(function (e) { e.textContent = w; e.hidden = !w; });
  }
  function bagTotal(b) { return b.reduce(function (a, i) { return a + (BY[i.sku] ? BY[i.sku].price * i.qty : 0); }, 0); }
  function renderBag() {
    var body = $('#bag-body'), foot = $('#bag-foot'); if (!body) return;
    var b = getBag().filter(function (i) { return BY[i.sku]; });
    if (!b.length) {
      body.innerHTML = '<div class="bag-empty"><p>Your bag is empty.</p><a class="btn" href="' + page('collections/all/') + '">Start shopping</a></div>';
      foot.innerHTML = ''; return;
    }
    body.innerHTML = b.map(function (i) {
      var p = BY[i.sku];
      return '<div class="bag-item"><a href="' + href(p) + '"><img src="' + img(p) + '" alt="" width="84" height="84"></a><div><h4>' + esc(p.name) + '</h4><p class="sub">' + esc(p.sub) + '</p>' +
        '<div class="bag-row"><div class="qty"><button data-bagq="-1" data-sku="' + p.sku + '" aria-label="Decrease">&minus;</button><input value="' + i.qty + '" readonly aria-label="Quantity"><button data-bagq="1" data-sku="' + p.sku + '" aria-label="Increase">+</button></div>' +
        '<span class="price">' + money(p.price * i.qty) + '</span></div><button class="bag-remove" data-bagrm="' + p.sku + '">Remove</button></div></div>';
    }).join('') + pairWith(b);
    var note = store('vl_note') || {};
    foot.innerHTML = '<label><input type="checkbox" id="gift-chk"' + (note.gift ? ' checked' : '') + '> This is a gift</label>' +
      '<textarea id="gift-msg" placeholder="Leave a message or gift note" aria-label="Message">' + esc(note.msg || '') + '</textarea>' +
      '<div class="subtotal"><span>Subtotal</span><span>' + money(bagTotal(b)) + '</span></div>' +
      '<a class="btn btn-primary" href="' + page('checkout/') + '">Request order</a>' +
      '<p class="fine" style="margin:12px 0 0">Nothing is charged now. We confirm availability, VAT and delivery with you first.</p>';
  }
  function pairWith(b) {
    var inBag = {}; b.forEach(function (i) { inBag[i.sku] = 1; });
    var cats = {}; b.forEach(function (i) { cats[BY[i.sku].cat] = 1; });
    var pick = D.products.filter(function (p) { return !inBag[p.sku] && !cats[p.cat]; }).slice(0, 5);
    if (pick.length < 3) pick = D.products.filter(function (p) { return !inBag[p.sku]; }).slice(0, 5);
    if (!pick.length) return '';
    return '<div class="pair"><h5>Pair with</h5><div class="pair-row">' + pick.map(function (p) {
      return '<a href="' + href(p) + '"><img src="' + img(p) + '" alt="" width="96" height="96" loading="lazy">' + esc(p.name) + '</a>';
    }).join('') + '</div></div>';
  }
  document.addEventListener('click', function (e) {
    var q = e.target.closest('[data-bagq]'), r = e.target.closest('[data-bagrm]');
    if (q) { var b = getBag(); b.forEach(function (i) { if (i.sku === q.getAttribute('data-sku')) i.qty = Math.max(1, i.qty + parseInt(q.getAttribute('data-bagq'), 10)); }); setBag(b); }
    if (r) setBag(getBag().filter(function (i) { return i.sku !== r.getAttribute('data-bagrm'); }));
  });
  document.addEventListener('input', function (e) {
    if (e.target.id === 'gift-msg' || e.target.id === 'gift-chk') store('vl_note', { gift: $('#gift-chk').checked, msg: $('#gift-msg').value });
  });

  /* ---------- wishlist ---------- */
  function getWish() { return store('vl_wish') || []; }
  function toggleWish(sku) {
    var w = getWish(), i = w.indexOf(sku); if (i > -1) w.splice(i, 1); else w.push(sku);
    store('vl_wish', w); markWish(); updateCounts(); if ($('#wish-grid')) renderWishPage();
  }
  function markWish() {
    var w = getWish();
    $$('[data-wish]').forEach(function (b) { b.setAttribute('aria-pressed', w.indexOf(b.getAttribute('data-wish')) > -1 ? 'true' : 'false'); });
  }
  function cardHTML(p) {
    return '<article class="card" data-sku="' + p.sku + '"><a class="card-media" href="' + href(p) + '"><img src="' + img(p) + '" alt="' + esc(p.name) + '" width="400" height="400" loading="lazy"></a>' +
      '<button class="heart" data-wish="' + p.sku + '" aria-label="Save to wishlist" aria-pressed="false"><svg viewBox="0 0 24 24" width="20" height="20"><path d="M12 20.5s-7.5-4.6-7.5-10.2A4.3 4.3 0 0 1 12 7.6a4.3 4.3 0 0 1 7.5 2.7c0 5.6-7.5 10.2-7.5 10.2z" fill="none" stroke="currentColor" stroke-width="1.5"/></svg></button>' +
      (p.sample ? '<span class="tag tag-sample">Sample</span>' : '') +
      '<div class="card-body"><h3><a href="' + href(p) + '">' + esc(p.name) + '</a></h3><p class="sub">' + esc(p.sub) + '</p><p class="price">' + money(p.price) + '</p></div>' +
      '<div class="card-actions"><button class="btn btn-small" data-add="' + p.sku + '">Add to bag</button><button class="btn btn-small btn-ghost" data-quick="' + p.sku + '">Quick view</button></div></article>';
  }
  function renderWishPage() {
    var g = $('#wish-grid'), e = $('#wish-empty'); var list = getWish().map(function (s) { return BY[s]; }).filter(Boolean);
    g.innerHTML = list.map(cardHTML).join(''); e.hidden = list.length > 0; markWish();
  }

  /* ---------- search ---------- */
  var si = $('#search-input');
  if (si) si.addEventListener('input', function () {
    var q = si.value.trim().toLowerCase(), out = $('#search-results');
    if (q.length < 2) { out.innerHTML = ''; return; }
    var terms = q.split(/\s+/);
    var hits = D.products.filter(function (p) {
      var hay = (p.name + ' ' + p.sku + ' ' + p.metal + ' ' + p.cat + ' ' + p.sub).toLowerCase();
      return terms.every(function (t) { return hay.indexOf(t) > -1; });
    }).slice(0, 12);
    out.innerHTML = hits.length ? hits.map(function (p) {
      return '<a class="sr" href="' + href(p) + '"><img src="' + img(p) + '" alt="" width="200" height="200"><b>' + esc(p.name) + '</b><span>' + money(p.price) + '</span></a>';
    }).join('') : '<p class="sr-none">Nothing found for &ldquo;' + esc(si.value) + '&rdquo;. Try another word, or message us on WhatsApp.</p>';
  });

  /* ---------- quick view ---------- */
  function quickView(sku) {
    var p = BY[sku]; if (!p) return;
    $('#quick-box').innerHTML = '<button class="icon-btn modal-close" data-close aria-label="Close">&#10005;</button><img src="' + img(p) + '" alt="' + esc(p.name) + '" width="400" height="400">' +
      '<div class="modal-info"><p class="eyebrow">' + esc(p.cat) + '</p><h2 class="h-lg">' + esc(p.name) + '</h2><p class="sub big">' + esc(p.sub) + '</p><p class="price big">' + money(p.price) + '</p>' +
      '<div class="buy"><button class="btn btn-primary" data-add="' + p.sku + '">Add to bag</button><a class="btn btn-ghost" href="' + href(p) + '">Full details</a></div></div>';
    setOpen('quick');
  }

  /* ---------- product gallery ---------- */
  function showPic(i) {
    $$('.pic').forEach(function (e, n) { e.classList.toggle('is-on', n === i); });
    $$('.thumb').forEach(function (e, n) { e.classList.toggle('is-on', n === i); });
  }

  /* ---------- hero ---------- */
  var heroI = 0, heroT, slides = $$('.slide');
  function heroGo(n, manual) {
    if (!slides.length) return;
    heroI = (n + slides.length) % slides.length;
    slides.forEach(function (s, i) { s.classList.toggle('is-active', i === heroI); });
    $$('.dot').forEach(function (d, i) { d.classList.toggle('is-active', i === heroI); });
    clearInterval(heroT); heroT = setInterval(function () { heroGo(heroI + 1); }, 7000);
  }
  if (slides.length && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) heroGo(0);

  /* ---------- scroll reveal ---------- */
  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (es) { es.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }); }, { threshold: .08 });
    $$('.reveal').forEach(function (el) { io.observe(el); });
  } else $$('.reveal').forEach(function (el) { el.classList.add('in'); });

  /* ---------- collection filters ---------- */
  var grid = $('#grid');
  if (grid) {
    var cards = $$('.card', grid), size = parseInt(grid.getAttribute('data-page-size'), 10) || 24, shown = size;
    var orig = cards.slice();
    var fMetal = $$('input[name=metal]'), fPrice = $('#f-price'), fSort = $('#f-sort'), fQ = $('#f-q');
    var apply = function (reset) {
      if (reset) shown = size;
      var metals = fMetal.filter(function (c) { return c.checked; }).map(function (c) { return c.value; });
      var pr = fPrice.value ? fPrice.value.split('-').map(Number) : null, q = fQ.value.trim().toLowerCase();
      var list = orig.filter(function (c) {
        var price = +c.getAttribute('data-price');
        return (!metals.length || metals.indexOf(c.getAttribute('data-metal')) > -1) && (!pr || (price >= pr[0] && price < pr[1])) && (!q || c.getAttribute('data-name').indexOf(q) > -1);
      });
      var s = fSort.value;
      if (s) list = list.slice().sort(function (a, b) {
        if (s === 'asc') return a.getAttribute('data-price') - b.getAttribute('data-price');
        if (s === 'desc') return b.getAttribute('data-price') - a.getAttribute('data-price');
        if (s === 'new') return b.getAttribute('data-new') - a.getAttribute('data-new');
        return a.getAttribute('data-name') < b.getAttribute('data-name') ? -1 : 1;
      });
      orig.forEach(function (c) { c.hidden = true; });
      list.forEach(function (c, i) { grid.appendChild(c); c.hidden = i >= shown; });
      $('#result-count').textContent = list.length + (list.length === 1 ? ' piece' : ' pieces');
      $('#no-results').hidden = list.length > 0;
      var lm = $('#load-more'); lm.hidden = list.length <= shown;
    };
    [].concat(fMetal, [fPrice, fSort]).forEach(function (e) { e.addEventListener('change', function () { apply(true); }); });
    fQ.addEventListener('input', function () { apply(true); });
    var reset = function () { fMetal.forEach(function (c) { c.checked = false; }); fPrice.value = ''; fSort.value = ''; fQ.value = ''; apply(true); };
    $('#f-reset').addEventListener('click', reset); $('#f-reset2').addEventListener('click', reset);
    $('#load-more').addEventListener('click', function () { shown += size; apply(false); });
    var ft = $('#filter-toggle');
    ft.addEventListener('click', function () { var o = $('#filters').classList.toggle('open'); ft.setAttribute('aria-expanded', o); });
    apply(true);
  }

  /* ---------- checkout and forms ---------- */
  function renderSummary() {
    var s = $('#summary'); if (!s) return;
    var b = getBag().filter(function (i) { return BY[i.sku]; });
    if (!b.length) { s.innerHTML = '<h2>Your bag</h2><p>Your bag is empty. <a href="' + page('collections/all/') + '">Browse the collection</a>.</p>'; return; }
    s.innerHTML = '<h2>Your bag</h2>' + b.map(function (i) { var p = BY[i.sku]; return '<div class="sum-row"><span>' + esc(p.name) + ' &times; ' + i.qty + '<br><small class="muted">' + esc(p.sku) + '</small></span><span>' + money(p.price * i.qty) + '</span></div>'; }).join('') +
      '<div class="sum-row sum-total"><span>Subtotal</span><span>' + money(bagTotal(b)) + '</span></div><p class="fine" style="margin-top:12px">VAT and delivery are confirmed when we confirm your order.</p>';
  }
  function send(form, text, subject, via) {
    if (via === 'wa') window.open('https://wa.me/' + form.getAttribute('data-wa') + '?text=' + encodeURIComponent(text), '_blank', 'noopener');
    else window.location.href = 'mailto:' + form.getAttribute('data-email') + '?subject=' + encodeURIComponent(subject) + '&body=' + encodeURIComponent(text);
  }
  var via = 'wa';
  document.addEventListener('click', function (e) { var b = e.target.closest('button[data-via]'); if (b) via = b.getAttribute('data-via'); });
  var cf = $('#contact-form');
  if (cf) cf.addEventListener('submit', function (e) {
    e.preventDefault(); var f = new FormData(cf);
    send(cf, 'Hello VLORÁ,\n\n' + f.get('msg') + '\n\n' + f.get('name') + '\n' + f.get('phone'), 'Website enquiry', via);
  });
  var ck = $('#checkout-form');
  if (ck) {
    renderSummary();
    ck.addEventListener('submit', function (e) {
      e.preventDefault();
      var b = getBag().filter(function (i) { return BY[i.sku]; });
      if (!b.length) { alert('Your bag is empty.'); return; }
      var f = new FormData(ck), note = store('vl_note') || {};
      var ref = 'VL-' + new Date().toISOString().slice(2, 10).replace(/-/g, '') + '-' + Math.random().toString(36).slice(2, 6).toUpperCase();
      var lines = b.map(function (i) { var p = BY[i.sku]; return '- ' + p.name + ' (' + p.sku + ') x ' + i.qty + ' = ' + money(p.price * i.qty); }).join('\n');
      var text = 'New order request ' + ref + '\n\n' + lines + '\n\nSubtotal: ' + money(bagTotal(b)) + '\n\nName: ' + f.get('name') + '\nPhone: ' + f.get('phone') + '\nEmail: ' + f.get('email') +
        '\nCity: ' + f.get('city') + '\nDelivery: ' + f.get('mode') + '\nAddress: ' + (f.get('address') || '-') + '\nNotes: ' + (f.get('notes') || '-') +
        (note.gift ? '\nGift: yes. Message: ' + (note.msg || '-') : '');
      send(ck, text, 'Order request ' + ref, via);
      ck.innerHTML = '<div class="done"><h2 class="h-lg">Thank you</h2><p>Your request <strong>' + ref + '</strong> is ready to send. If WhatsApp or your email app did not open, message us and quote this reference.</p><a class="btn" href="' + page('') + '">Back to home</a></div>';
      store('vl_bag', []); updateCounts(); renderBag(); renderSummary();
    });
  }


  /* ---------- landing page: scroll effects ---------- */
  var hero2 = $('[data-hero2]'), wordsEl = $('[data-words]');
  var wordNodes = [];
  if (wordsEl) {
    var hl = { reflects: 1, you: 1 };
    wordsEl.innerHTML = wordsEl.textContent.trim().split(/\s+/).map(function (w) {
      return '<span class="w' + (hl[w.toLowerCase().replace(/[^a-z]/g, '')] ? ' hl' : '') + '">' + esc(w) + '</span>';
    }).join(' ');
    wordNodes = $$('.w', wordsEl);
    wordsEl.classList.add('js-words');
    document.documentElement.classList.add('js-words');
  }
  var ticking = false;
  function onScroll() {
    ticking = false;
    var vh = window.innerHeight, y = window.scrollY;
    if (hero2 && y < vh * 1.4) hero2.style.setProperty('--py', y);
    if (wordNodes.length) {
      var r = wordsEl.getBoundingClientRect();
      var p = Math.min(1, Math.max(0, (vh * 0.85 - r.top) / (vh * 0.4 + r.height * 0.6)));
      var n = Math.round(p * wordNodes.length * 1.05);
      wordNodes.forEach(function (w, i) { w.classList.toggle('lit', i < n); });
      var qf = wordsEl.closest('.statement'); if (qf) qf.classList.toggle('done', n >= wordNodes.length);
    }
  }
  if (hero2 || wordsEl) {
    window.addEventListener('scroll', function () { if (!ticking) { ticking = true; requestAnimationFrame(onScroll); } }, { passive: true });
    window.addEventListener('resize', onScroll); onScroll();
  }

  /* ---------- hero video ---------- */
function heroVideo(){
  var v=document.querySelector('.hero2-video'); if(!v) return;
  try{
    if(window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    var c=navigator.connection; if(c&&(c.saveData||/2g/.test(c.effectiveType||''))) return;
    var m=window.matchMedia('(max-width: 860px)').matches;
    var mp4=v.canPlayType('video/mp4; codecs="avc1.640028"');
    v.src=!mp4&&v.canPlayType('video/webm; codecs="vp9"')?v.dataset.src.replace('.mp4','.webm'):((m&&v.dataset.srcM)||v.dataset.src);
    v.addEventListener('playing',function(){v.classList.add('is-playing')});
    var p=v.play(); if(p&&p.catch) p.catch(function(){});
    document.addEventListener('visibilitychange',function(){ if(document.hidden) v.pause(); else v.play().catch(function(){}); });
  }catch(e){}
}

/* ---------- init ---------- */
  if ($('#wish-grid')) renderWishPage();

  /* ---------- years story: numerals roll 1983 -> 2026, photographs live inside the digits ---------- */
  function initYears() {
    var sec = $('[data-yrs]'); if (!sec) return;
    var rm = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
    var cv = $('[data-yrs-canvas]', sec), ctx = cv && cv.getContext && cv.getContext('2d');
    if (rm || !ctx) return;                       // static stacked photos stay visible
    var Y = sec.getAttribute('data-years').split(',').map(Number), SRC = sec.getAttribute('data-srcs').split(',');
    var N = Y.length, caps = $$('[data-yrs-cap]', sec), idx = $('[data-yrs-idx]', sec), fin = $('[data-yrs-final]', sec), hint = $('[data-yrs-hint]', sec), stage = $('.yrs-stage', sec);
    sec.classList.add('yrs-on');
    var IM = SRC.map(function (s, i) { var im = new Image(); im.decoding = 'async'; if (i < 2) im.src = s; return im; });
    var lateLoad = function () { IM.forEach(function (im, i) { if (!im.src) im.src = SRC[i]; }); };
    if ('IntersectionObserver' in window) { var io = new IntersectionObserver(function (en) { if (en[0].isIntersecting) { lateLoad(); io.disconnect(); } }, { rootMargin: '1800px 0px' }); io.observe(sec); } else lateLoad();
    var mk = function () { var c = document.createElement('canvas'); return [c, c.getContext('2d')]; };
    var A = mk(), B = mk(), M = mk(), G = mk(), pc = A[0], px = A[1], tc = B[0], tx = B[1], mc = M[0], mx = M[1], gc = G[0], gx = G[1];
    var TR = 'dissolve', hasFilter = 'filter' in ctx;
    var W = 0, H = 0, dpr = 1, need = true, fontOK = false, ps = 0, tgt = 0;
    var HOLD = .55, WH = 1, WT = 2.6, SEG = HOLD * WH + (1 - HOLD) * WT, ZOOM = 1.7, UNITS = (N - 1) * SEG, TOTAL = UNITS + ZOOM;
    function smooth(x) { x = Math.max(0, Math.min(1, x)); return x * x * (3 - 2 * x); }
    function clamp(x) { return Math.max(0, Math.min(1, x)); }
    function size() {
      dpr = Math.min(window.devicePixelRatio || 1, W < 760 ? 1.5 : 2);
      var r = stage.getBoundingClientRect(); W = r.width || innerWidth; H = r.height || innerHeight;
      [cv, pc, tc, mc, gc].forEach(function (c) { c.width = Math.round(W * dpr); c.height = Math.round(H * dpr); });
      sec.style.height = Math.round(innerHeight * (.4 * TOTAL) + (innerHeight - (r.top > 0 ? 0 : 0))) + 'px';
      need = true;
    }
    // scroll progress (0..1) -> stop position c (0..N-1) with extra scroll spent on the photo changes, plus zoom q (0..1)
    function mapProgress(p) {
      var u = p * TOTAL, q = 0, c;
      if (u >= UNITS) { c = N - 1; q = clamp((u - UNITS) / ZOOM); return { c: c, q: q }; }
      var seg = Math.min(N - 2, Math.floor(u / SEG)), r = u - seg * SEG, hl = HOLD * WH;
      c = seg + (r <= hl ? (r / hl) * HOLD : HOLD + ((r - hl) / (SEG - hl)) * (1 - HOLD));
      return { c: c, q: 0 };
    }
    function yearAt(c) { var i = Math.min(N - 2, Math.floor(c)), f = c - i; return Y[i] + (Y[i + 1] - Y[i]) * f; }
    function coverDraw(g, img, sc, ox, oy) {
      if (!img.complete || !img.naturalWidth) return false;
      var cw = g.canvas.width, ch = g.canvas.height, s = Math.max(cw / img.naturalWidth, ch / img.naturalHeight) * sc, w = img.naturalWidth * s, h = img.naturalHeight * s;
      g.drawImage(img, (cw - w) / 2 + ox * cw, (ch - h) / 2 + oy * ch, w, h); return true;
    }
    // push is the base zoom drift shared by every style, so a change of photo is just the same slow motion carrying on
    function compose(g, target, k, e, fr) {
      var cw = target.width, ch = target.height, drift = 1.06 + .05 * Math.min(1, fr), nxt = IM[k + 1], ok = nxt && nxt.complete && nxt.naturalWidth;
      g.setTransform(1, 0, 0, 1, 0, 0); g.globalAlpha = 1; g.globalCompositeOperation = 'source-over'; g.filter = 'none'; g.clearRect(0, 0, cw, ch);
      if (e <= 0 || !ok) { coverDraw(g, IM[k], drift, 0, 0); return; }
      if (TR === 'push') {                       // both photos travel upward, the way the digits roll
        coverDraw(g, IM[k], drift, 0, -.07 * e); g.globalAlpha = e; coverDraw(g, nxt, 1.1, 0, .07 * (1 - e)); g.globalAlpha = 1; return;
      }
      if (TR === 'rack' && hasFilter) {          // focus pulls from one photo to the next
        var b1 = e * 16 * dpr, b2 = (1 - e) * 16 * dpr;
        g.filter = 'blur(' + b1.toFixed(1) + 'px)'; coverDraw(g, IM[k], drift + .04 * e, 0, 0);
        g.globalAlpha = Math.min(1, e * 1.6); g.filter = 'blur(' + b2.toFixed(1) + 'px)'; coverDraw(g, nxt, 1.1 - .04 * e, 0, 0);
        g.filter = 'none'; g.globalAlpha = 1; return;
      }
      coverDraw(g, IM[k], drift + .03 * e, 0, 0);   // dissolve (also light / digit)
      g.globalAlpha = e; coverDraw(g, nxt, 1.09 - .03 * e, 0, 0); g.globalAlpha = 1;
      if (TR === 'light') { var bl = Math.sin(Math.PI * e) * .24; g.globalCompositeOperation = 'lighter'; g.fillStyle = 'rgba(244,227,170,' + bl.toFixed(3) + ')'; g.fillRect(0, 0, cw, ch); g.globalCompositeOperation = 'source-over'; }
    }
    function layout() {
      var mob = W < 760; ctx.font = '700 100px Cinzel';
      var cw0 = ctx.measureText('0').width, cols = mob ? 2 : 4, rows = mob ? 2 : 1;
      var fs = Math.min((W * (mob ? .8 : .92)) / (cols * cw0 / 100), (H * (mob ? .4 : .66)) / (rows * .82));
      var cw = cw0 * fs / 100, lh = fs * .82, gx = (W - cols * cw) / 2, gy = (H - rows * lh) / 2 - (mob ? H * .075 : H * .05);
      return { fs: fs, cw: cw, lh: lh, pos: function (i) { var r = mob ? Math.floor(i / 2) : 0, c = mob ? i % 2 : i; return { x: gx + c * cw, y: gy + r * lh, base: gy + r * lh + lh * .95 }; } };
    }
    function digits(g, L, v, mode, S, An) {
      g.save(); g.setTransform(dpr, 0, 0, dpr, 0, 0);
      if (S !== 1) { g.translate(An.x, An.y); g.scale(S, S); g.translate(-An.x, -An.y); }
      g.font = '700 ' + L.fs + 'px Cinzel'; g.textAlign = 'center'; g.textBaseline = 'alphabetic'; g.lineJoin = 'round';
      if (mode === 'halo') { g.lineWidth = L.fs * .11; g.strokeStyle = 'rgba(6,13,34,.5)'; } else if (mode === 'stroke') { g.lineWidth = 1.3 / S; g.strokeStyle = 'rgba(211,175,55,.7)'; } else { g.fillStyle = '#fff'; }
      for (var i = 0; i < 4; i++) {
        var p = L.pos(i), pw = Math.pow(10, 3 - i), q = v / pw, fl = Math.floor(q), fr = q - fl;
        var roll = i === 3 ? fr : clamp((v % pw) - (pw - 1)); roll = smooth(roll);
        var d0 = ((fl % 10) + 10) % 10, d1 = (d0 + 1) % 10, off = roll * L.lh * 1.15, cx = p.x + L.cw / 2;
        g.save(); g.beginPath(); g.rect(p.x - 2, p.y + L.lh * .02, L.cw + 4, L.lh * .98); g.clip();
        if (mode === 'stroke' || mode === 'halo') { g.strokeText(d0, cx, p.base - off); g.strokeText(d1, cx, p.base + L.lh * 1.15 - off); }
        else { g.fillText(d0, cx, p.base - off); g.fillText(d1, cx, p.base + L.lh * 1.15 - off); }
        g.restore();
      }
      g.restore();
    }
    function render() {
      var m = mapProgress(ps), c = m.c, q = m.q, k = Math.min(N - 2, Math.floor(c)), fr = c - k;
      var e = smooth((fr - HOLD) / (1 - HOLD)); if (c >= N - 1) { k = N - 2; e = 1; }
      var v = yearAt(c), L = layout(), cw = pc.width, ch = pc.height;
      // 1) compose photo k -> k+1 for the chosen transition style
      var eg = e, ew = e;
      if (TR === 'digit') { var span = 1 - HOLD; ew = smooth((fr - HOLD) / (span * .62)); eg = smooth((fr - HOLD - span * .38) / (span * .62)); if (c >= N - 1) { ew = 1; eg = 1; } }
      compose(px, pc, k, ew, fr);
      var pg = pc; if (TR === 'digit') { compose(gx, gc, k, eg, fr); pg = gc; }
      // 2) base: navy + photo as a clear (not heavily tinted) backdrop
      ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1; ctx.fillStyle = '#0c193b'; ctx.fillRect(0, 0, cv.width, cv.height);
      ctx.globalAlpha = .36 + q * .64; ctx.drawImage(pg, 0, 0); ctx.globalAlpha = 1;
      // 3) numerals filled with the same photograph at full strength
      var S = 1 + Math.pow(q, 2.4) * 70, a0 = L.pos(1), An = { x: a0.x + L.cw / 2, y: a0.y + L.lh * .5 };
      mx.setTransform(1, 0, 0, 1, 0, 0); mx.clearRect(0, 0, cw, ch); mx.globalCompositeOperation = 'source-over';
      digits(mx, L, v, 'fill', S, An); mx.globalCompositeOperation = 'source-in'; mx.drawImage(pc, 0, 0); mx.globalCompositeOperation = 'source-over';
      ctx.drawImage(mc, 0, 0);
      // 4) soft shade under the caption only
      var sh = ctx.createLinearGradient(0, ch * .6, 0, ch); sh.addColorStop(0, 'rgba(12,25,59,0)'); sh.addColorStop(1, 'rgba(12,25,59,' + (.62 * (1 - q)) + ')'); ctx.fillStyle = sh; ctx.fillRect(0, 0, cw, ch);
      var ci = Math.min(N - 1, Math.round(c));
      caps.forEach(function (el, i) { el.classList.toggle('is-on', i === ci && q < .15); });
      if (idx) idx.textContent = q < .15 ? ('0' + (ci + 1)).slice(-2) + ' / 0' + N : '';
      if (fin) fin.classList.toggle('is-on', q > .85); if (hint) hint.style.opacity = ps < .01 ? 1 : 0;
    }
    function loop() {
      var r = sec.getBoundingClientRect(), tot = r.height - innerHeight;
      if (r.bottom > -50 && r.top < innerHeight + 50 && tot > 0) {
        tgt = clamp(-r.top / tot); var d = tgt - ps;
        if (Math.abs(d) > .00004) { ps += d * .09; need = true; } else if (ps !== tgt) { ps = tgt; need = true; }
        if (need && fontOK && IM[0].complete && IM[0].naturalWidth) { need = false; render(); }
      }
      requestAnimationFrame(loop);
    }
    size(); window.addEventListener('resize', function () { size(); });
    var go = function () { fontOK = true; need = true; };
    if (document.fonts && document.fonts.load) document.fonts.load('700 100px Cinzel').then(go, go); else go();
    var lab = $('[data-trans-lab]', sec);
    if (lab) { [['dissolve', 'Soft dissolve'], ['rack', 'Focus pull'], ['push', 'Rising push'], ['light', 'Light bloom'], ['digit', 'Follow the digits']].forEach(function (o) { var bt = document.createElement('button'); bt.type = 'button'; bt.textContent = o[1]; if (o[0] === TR) bt.className = 'on'; bt.addEventListener('click', function () { TR = o[0]; $$('button', lab).forEach(function (x) { x.classList.toggle('on', x === bt); }); need = true; }); lab.appendChild(bt); }); }
    requestAnimationFrame(loop);
  }

  markWish(); updateCounts(); renderBag(); heroVideo(); initYears();
})();
