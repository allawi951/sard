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

const CFG = window.SARD_CFG || {};

/* الإعداد قد يصل نصًّا (سلوك سلة) أو مصفوفة كائن الخيار المحدَّد (بعض المحاكيات) */
function readChoice(raw, fallback) {
  const v = Array.isArray(raw) ? (raw[0] && raw[0].value) : (raw && raw.value) || raw;
  return typeof v === 'string' ? v : fallback;
}

const SOURCE = readChoice(CFG.desktopMenuSource, 'all');
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
  if (CFG.desktopMenu === false) return;
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
