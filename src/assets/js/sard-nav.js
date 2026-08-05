/* ═══════════════════════════════════════════════════════════════════════════
   sard-nav — سلوكيات شريط «سرد»:
     ١) قائمة جانبية على **سطح المكتب** بكل أقسام المتجر
     ٢) إخفاء شارة السلة حين تكون فارغة

   لماذا درجٌ خاصّ بنا بدل درج رائد: مُبدِّل mmenu مشروط بـ‎(max-width:1024px)‎،
   فعلى سطح المكتب يُعيد القائمة إلى الشريط ويترك درجه فارغًا. محاولة إجباره
   على العمل خارج مداه تكسر سلوك الجوال المُختبَر. فالأنظف درجٌ مستقلّ لسطح
   المكتب، ودرج رائد يبقى للجوال كما هو.

   المحتوى يأتي من ‎salla.api.component.getMenus()‎ — نفس مصدر قائمة الشريط —
   فلا نخترع بيانات ولا نستنسخ ترميزًا محشوًّا بأصناف استجابة متعارضة.
   ═══════════════════════════════════════════════════════════════════════════ */

import { CFG, isOn, choice } from './sard-cfg';

const SOURCE = choice(CFG.desktopMenuSource, 'all');
const DESKTOP_MIN = 1024;

/* ── ١) شارة السلة الفارغة ──
   مكوّن سلة يصيّر ‎<span class="s-cart-summary-count">‎ دائمًا ويضع فيه العدد،
   حتى وهو صفر. وبالأرقام الهندية يُرسم الصفر «٠» — نقطةً — فتبدو الشارة بقعة
   بلا معنى فوق الأيقونة. لا يمكن للـCSS قراءة نصّ العنصر، فنراقبه هنا. */
function watchCartBadge() {
  const mark = (badge) => {
    const n = (badge.textContent || '').replace(/[\s‏‎]/g, '');
    const zero = n === '' || n === '0' || n === '٠' || n === '۰';
    badge.classList.toggle('is-empty', zero);
  };

  const attach = (badge) => {
    mark(badge);
    new MutationObserver(() => mark(badge))
      .observe(badge, { childList: true, characterData: true, subtree: true });
  };

  document.querySelectorAll('.s-cart-summary-count').forEach(attach);

  // المكوّن يُحقن بعد جهوز سلة، فنترقّب ظهوره مرّة واحدة
  const seen = new WeakSet();
  const watcher = new MutationObserver(() => {
    document.querySelectorAll('.s-cart-summary-count').forEach((b) => {
      if (seen.has(b)) return;
      seen.add(b); attach(b);
    });
  });
  watcher.observe(document.body, { childList: true, subtree: true });
}

/* ── ٢) القائمة الجانبية لسطح المكتب ── */
function buildList(menus, depth = 0) {
  return menus.map((m) => {
    const kids = SOURCE === 'top' ? [] : (m.children || []);
    const title = m.title || '';
    const link = `<a class="sard-drawer__link" href="${m.url || '#'}">${title}</a>`;
    if (!kids.length) return `<li class="sard-drawer__item">${link}</li>`;
    return `<li class="sard-drawer__item sard-drawer__item--parent">
        <div class="sard-drawer__row">
          ${link}
          <button class="sard-drawer__toggle" aria-expanded="false" aria-label="${title}">
            <span></span><span></span>
          </button>
        </div>
        <ul class="sard-drawer__sub" hidden>${buildList(kids, depth + 1)}</ul>
      </li>`;
  }).join('');
}

async function desktopDrawer() {
  if (!isOn(CFG.desktopMenu, true)) return;
  if (!window.salla || !salla.api?.component?.getMenus) return;

  let menus = [];
  try {
    await salla.onReady();
    const res = await salla.api.component.getMenus();
    menus = (res && res.data) || [];
  } catch { return; }
  if (!menus.length) return;                    // متجر بلا أقسام: لا زرّ بلا محتوى

  const host = document.querySelector('.store-header .main-nav-container .flex.items-center')
            || document.querySelector('.store-header .navbar-brand')?.parentElement;
  if (!host) return;

  const toggle = document.createElement('button');
  toggle.type = 'button';
  toggle.className = 'sard-nav-toggle';
  toggle.setAttribute('aria-expanded', 'false');
  toggle.setAttribute('aria-label', (salla.lang && salla.lang.get('blocks.header.main_menu')) || 'القائمة');
  toggle.innerHTML = '<span></span><span></span><span></span>';
  host.insertBefore(toggle, host.firstChild);

  const drawer = document.createElement('div');
  drawer.className = 'sard-drawer';
  drawer.hidden = true;
  drawer.innerHTML = `
    <div class="sard-drawer__backdrop"></div>
    <aside class="sard-drawer__panel" role="dialog" aria-modal="true">
      <div class="sard-drawer__head">
        <span class="sard-drawer__title">${(salla.lang && salla.lang.get('blocks.header.main_menu')) || 'أقسام المتجر'}</span>
        <button class="sard-drawer__close" aria-label="إغلاق">&times;</button>
      </div>
      <nav class="sard-drawer__nav"><ul class="sard-drawer__list">${buildList(menus)}</ul></nav>
    </aside>`;
  document.body.appendChild(drawer);

  let lastFocus = null;
  const open = () => {
    lastFocus = document.activeElement;
    drawer.hidden = false;
    requestAnimationFrame(() => drawer.classList.add('is-open'));
    toggle.setAttribute('aria-expanded', 'true');
    document.documentElement.classList.add('sard-drawer-open');
    drawer.querySelector('.sard-drawer__close')?.focus();
  };
  const close = () => {
    drawer.classList.remove('is-open');
    toggle.setAttribute('aria-expanded', 'false');
    document.documentElement.classList.remove('sard-drawer-open');
    setTimeout(() => { drawer.hidden = true; }, 320);   // بعد انتهاء الانتقال
    lastFocus?.focus();
  };

  toggle.addEventListener('click', () => (drawer.hidden ? open() : close()));
  drawer.querySelector('.sard-drawer__backdrop').addEventListener('click', close);
  drawer.querySelector('.sard-drawer__close').addEventListener('click', close);
  addEventListener('keydown', (e) => { if (e.key === 'Escape' && !drawer.hidden) close(); });

  // فتح/طيّ الأقسام الفرعية
  drawer.addEventListener('click', (e) => {
    const btn = e.target.closest('.sard-drawer__toggle');
    if (!btn) return;
    const sub = btn.closest('.sard-drawer__item').querySelector('.sard-drawer__sub');
    const openNow = btn.getAttribute('aria-expanded') === 'true';
    btn.setAttribute('aria-expanded', String(!openNow));
    sub.hidden = openNow;
  });

  /* الزرّ لسطح المكتب وحده: زرّ رائد يتكفّل بالجوال، وإظهار الاثنين معًا
     يعطي زرّين متجاورين يفعلان الشيء نفسه. */
  const mq = matchMedia(`(min-width: ${DESKTOP_MIN}px)`);
  const sync = () => {
    toggle.style.display = mq.matches ? '' : 'none';
    if (!mq.matches && !drawer.hidden) close();
  };
  sync();
  mq.addEventListener ? mq.addEventListener('change', sync) : mq.addListener(sync);
}

watchCartBadge();
desktopDrawer();

/* ═══ ٣) معاينة السلة ═══
   الضغط على أيقونة السلة كان ينقل مباشرةً إلى صفحة السلة. الآن يفتح درجًا
   فيه محتوى السلة وزرّان: «متابعة التسوّق» يغلق، و«إتمام الطلب» ينقل للسلة.

   المحتوى من `salla.api.cart.details()` — الواجهة الرسمية الوحيدة المعلنة
   لمحتوى السلة في SDK سلة. ولا نبني هنا حذفًا ولا تعديل كمية: ذاك عمل صفحة
   السلة، والمعاينة نافذةٌ لا بديل عنها. */
function cartPreview() {
  if (!isOn(CFG.cartPreview, true)) return;

  const T = (k, fb) => {
    let v = null;
    try { v = window.salla && salla.lang && salla.lang.get ? salla.lang.get(k) : null; } catch (e) { v = null; }
    return (!v || v === k || (/\./.test(v) && !/\s/.test(v))) ? fb : v;
  };
  const L = {
    title: T('pages.cart.title', 'سلّة المشتريات'),
    keep: T('blocks.cart.continue_shopping', 'متابعة التسوّق'),
    checkout: T('pages.cart.complete_order', 'إتمام الطلب'),
    empty: T('pages.cart.empty', 'سلّتك فارغة'),
    loading: T('common.elements.loading', 'جارٍ التحميل…'),
    total: T('pages.cart.total', 'الإجمالي'),
  };

  let box = null;
  function build() {
    if (box) return box;
    box = document.createElement('div');
    box.className = 'sard-cartview';
    box.hidden = true;
    box.innerHTML =
      '<div class="sard-cartview__backdrop"></div>' +
      '<aside class="sard-cartview__panel" role="dialog" aria-modal="true">' +
        '<div class="sard-cartview__head">' +
          '<span class="sard-cartview__title">' + L.title + '</span>' +
          '<button class="sard-cartview__close" aria-label="إغلاق">&#215;</button>' +
        '</div>' +
        '<div class="sard-cartview__body"></div>' +
        '<div class="sard-cartview__foot">' +
          '<button class="sard-cartview__keep">' + L.keep + '</button>' +
          '<a class="sard-cartview__checkout" href="/cart">' + L.checkout + '</a>' +
        '</div>' +
      '</aside>';
    document.body.appendChild(box);

    const close = () => {
      box.classList.remove('is-open');
      document.documentElement.classList.remove('sard-cartview-open');
      setTimeout(() => { box.hidden = true; }, 320);
    };
    box.querySelector('.sard-cartview__backdrop').addEventListener('click', close);
    box.querySelector('.sard-cartview__close').addEventListener('click', close);
    box.querySelector('.sard-cartview__keep').addEventListener('click', close);
    addEventListener('keydown', (e) => { if (e.key === 'Escape' && !box.hidden) close(); });
    return box;
  }

  const money = (v) => {
    try { return window.salla && salla.money ? salla.money(v) : String(v); } catch (e) { return String(v); }
  };
  const esc = (s) => String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

  async function open(cartHref) {
    const b = build();
    if (cartHref) b.querySelector('.sard-cartview__checkout').href = cartHref;
    const body = b.querySelector('.sard-cartview__body');
    body.innerHTML = '<p class="sard-cartview__note">' + L.loading + '</p>';
    b.hidden = false;
    requestAnimationFrame(() => b.classList.add('is-open'));
    document.documentElement.classList.add('sard-cartview-open');
    b.querySelector('.sard-cartview__close').focus();

    let cart = null;
    try {
      const res = await salla.api.cart.details();
      cart = (res && res.data && (res.data.cart || res.data)) || null;
    } catch (e) { cart = null; }

    const items = (cart && (cart.items || cart.products)) || [];
    if (!items.length) {
      body.innerHTML = '<p class="sard-cartview__note">' + L.empty + '</p>';
      return;
    }

    /* كل قيمة تمرّ عبر esc: أسماء المنتجات من بيانات المتجر، وحقنها خامًا
       يفتح ثغرة XSS في ثيمٍ يُركَّب على متاجر لا نتحكّم بمحتواها. */
    const rows = items.map((it) => {
      const img = (it.image && (it.image.url || it.image)) || (it.product && it.product.image && it.product.image.url) || '';
      const name = it.name || (it.product && it.product.name) || '';
      const qty = it.quantity == null ? 1 : it.quantity;
      const price = it.total != null ? it.total : (it.price != null ? it.price : '');
      return '<li class="sard-cartview__item">' +
        (img ? '<img src="' + esc(img) + '" alt="" loading="lazy">' : '<span class="sard-cartview__ph"></span>') +
        '<div class="sard-cartview__meta">' +
          '<span class="sard-cartview__name">' + esc(name) + '</span>' +
          '<span class="sard-cartview__qty">&#215;' + esc(qty) + '</span>' +
        '</div>' +
        '<span class="sard-cartview__price">' + esc(money(price)) + '</span>' +
      '</li>';
    }).join('');

    body.innerHTML = '<ul class="sard-cartview__list">' + rows + '</ul>' +
      (cart.total != null
        ? '<div class="sard-cartview__total"><span>' + L.total + '</span><b>' + esc(money(cart.total)) + '</b></div>'
        : '');
  }

  /* الالتقاط في مرحلة النزول: مكوّن سلة يضع رابطًا لصفحة السلة، ولو تركنا
     النقرة تكمل لانتقل المتصفّح قبل أن تُفتح المعاينة. */
  document.addEventListener('click', (e) => {
    const hit = e.target.closest('salla-cart-summary, .s-cart-summary-wrapper');
    if (!hit) return;
    const link = hit.matches('a') ? hit : hit.querySelector('a');
    const href = (link && link.getAttribute('href')) || '/cart';
    e.preventDefault();
    e.stopPropagation();
    open(href);
  }, true);
}

cartPreview();
