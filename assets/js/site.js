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
  var film = $('[data-film-scroll]'), filmL = $$('.film-layer'), filmFill = $('[data-fill]'), filmYear = $('[data-year]');
  function smooth(x) { x = Math.max(0, Math.min(1, x)); return x * x * (3 - 2 * x); }
  var reduceMotion = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduceMotion) film = null;
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
    if (film) {
      var fb = film.getBoundingClientRect(), ftotal = fb.height - vh;
      if (fb.top < vh && fb.bottom > 0 && ftotal > 0) {
        var fp = Math.min(1, Math.max(0, -fb.top / ftotal)), ft = fp * (filmL.length - 1);
        if (filmFill) filmFill.style.width = (fp * 100).toFixed(1) + '%';
        if (filmYear) filmYear.textContent = Math.round(1983 + (2026 - 1983) * fp);
        filmL.forEach(function (l, k) {
          var img = l.firstChild, cap = l.querySelector('.film-cap');
          if (k > 0) {
            var rv = smooth((ft - (k - 1) - 0.1) / 0.8);
            l.style.clipPath = 'inset(0 ' + ((1 - rv) * 100) + '% 0 0)';
            img.style.transform = 'scale(' + (1.12 - rv * 0.08) + ') translateX(' + ((1 - rv) * -3) + '%)';
          } else { img.style.transform = 'scale(' + (1.04 + Math.min(ft, 1) * 0.06) + ')'; }
          var dd = Math.abs(ft - k), o = dd < 0.35 ? 1 : dd > 0.75 ? 0 : 1 - (dd - 0.35) / 0.4;
          cap.style.opacity = o; cap.style.transform = 'translateY(' + ((ft - k) * -26) + 'px)';
        });
      }
    }
  }
  if (hero2 || film || wordsEl) {
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
  markWish(); updateCounts(); renderBag(); heroVideo();
})();
