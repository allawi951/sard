/* ═══════════════════════════════════════════════════════════════════════════
   sard-quick — المعاينة السريعة: نافذة تعرض المنتج بلا مغادرة الصفحة.

   ⚠️ هذه ميزة **جديدة** لا مفقودة: تحقّقتُ من commit ثيم رائد الأصلي ومن
   مكتبة أصناف سلة ومن حزمة twilight-components — لا وجود لمعاينة سريعة في
   أيٍّ منها. الموجود عند سلة هو `salla-quick-buy` (شراء سريع) و
   `s-quick-order-*` (طلب سريع)، وكلاهما شيء آخر.

   مبدأ البناء (من مهارة salla-theme): **سلة تملك التجارة والثيم يملك الشكل.**
   فلا نجلب بيانات منتج بأنفسنا ولا نبني منطق خيارات ولا إضافة للسلة:

     • الاسم والسعر والصورة والرابط  → تُقرأ من **البطاقة المنقورة نفسها**،
       فهي معروضة أصلًا ولا تحتاج طلب شبكة إضافيًّا.
     • الخيارات والإضافة للسلة        → مكوّنا سلة الرسميّان بمعرّف المنتج:
       `<salla-product-options>` و `<salla-add-product-button>`.

   وبهذا تعمل النافذة مع بطاقات «سرد» وبطاقات سلة معًا، وتبقى صحيحة إذا غيّرت
   سلة منطق الخيارات غدًا.
   ═══════════════════════════════════════════════════════════════════════════ */

import { CFG, isOn } from './sard-cfg';

const SEL_CARDS = 'salla-product-card, .sard-card, .s-product-card-entry';

/* ── استخراج بيانات المنتج من بطاقته ── */
function readCard(card) {
  const idAttr = card.getAttribute?.('product-id')
    || card.dataset?.productId || card.dataset?.id
    || card.querySelector?.('[data-product-id]')?.dataset.productId
    || card.querySelector?.('salla-add-product-button')?.getAttribute('product-id');

  const link = card.querySelector('a[href]');
  const img = card.querySelector('img');
  const name = card.querySelector('.sard-card__name, .s-product-card-content-title, h3, h2')?.textContent?.trim();
  const price = card.querySelector('.sard-card__price, .s-product-card-price, .s-product-card-sale-price')?.textContent?.trim();

  return {
    id: idAttr && String(idAttr).replace(/\D/g, ''),
    url: link?.getAttribute('href') || '',
    image: img?.currentSrc || img?.getAttribute('src') || '',
    name: name || '',
    price: price || '',
  };
}

/* ── النافذة ── */
let modal = null;
function ensureModal() {
  if (modal) return modal;
  modal = document.createElement('div');
  modal.className = 'sard-quick';
  modal.hidden = true;
  modal.innerHTML = `
    <div class="sard-quick__backdrop"></div>
    <div class="sard-quick__box" role="dialog" aria-modal="true" aria-label="معاينة سريعة">
      <button class="sard-quick__close" aria-label="إغلاق">&times;</button>
      <div class="sard-quick__media"><img alt=""></div>
      <div class="sard-quick__info">
        <h3 class="sard-quick__name"></h3>
        <div class="sard-quick__price"></div>
        <div class="sard-quick__desc" aria-live="polite"></div>
        <div class="sard-quick__slot"></div>
        <a class="sard-quick__more btn btn-solid" href="#"></a>
      </div>
    </div>`;
  document.body.appendChild(modal);

  const close = () => {
    modal.classList.remove('is-open');
    document.documentElement.classList.remove('sard-quick-open');
    setTimeout(() => {
      modal.hidden = true;
      modal.querySelector('.sard-quick__slot').innerHTML = '';   // نُفرغ مكوّنات سلة
    }, 300);
  };
  modal.__close = close;
  modal.querySelector('.sard-quick__backdrop').addEventListener('click', close);
  modal.querySelector('.sard-quick__close').addEventListener('click', close);
  addEventListener('keydown', (e) => { if (e.key === 'Escape' && !modal.hidden) close(); });
  return modal;
}

function openQuick(data, labels) {
  const m = ensureModal();
  const img = m.querySelector('.sard-quick__media img');
  img.src = data.image || '';
  img.alt = data.name || '';
  m.querySelector('.sard-quick__name').textContent = data.name || '';
  m.querySelector('.sard-quick__price').textContent = data.price || '';

  const more = m.querySelector('.sard-quick__more');
  more.href = data.url || '#';
  more.textContent = labels.details;

  /* مكوّنات سلة تُنشأ عند كل فتح وتُزال عند الإغلاق: إبقاؤها معلّقة بمعرّف
     منتج قديم يجعلها تضيف المنتج الخطأ للسلة. */
  const slot = m.querySelector('.sard-quick__slot');
  slot.innerHTML = data.id ? `
    <salla-product-options product-id="${data.id}"></salla-product-options>
    <salla-add-product-button product-id="${data.id}" width="wide"
        class="sard-quick__add">${labels.add}</salla-add-product-button>` : '';

  m.hidden = false;
  requestAnimationFrame(() => m.classList.add('is-open'));
  document.documentElement.classList.add('sard-quick-open');
  m.querySelector('.sard-quick__close').focus();

  loadDescription(data.url, m.querySelector('.sard-quick__desc'), labels);
}

/* ── وصف المنتج الحقيقي ──
   البطاقة لا تحمل الوصف، وSDK سلة لا يُعلن دالةً لجلب تفاصيل منتج. لكن صفحة
   المنتج مُصيَّرة على الخادم وعلى **نفس النطاق**، فجلبها وقراءة الوصف منها
   عمليةٌ مشروعة بلا CORS ولا واجهة غير موثّقة — والنصّ يخرج مطابقًا لما في
   صفحة المنتج حرفيًّا، وهو ما طلبه المالك.

   يُجلب بعد الفتح لا قبله: النافذة تظهر فورًا بما لدينا، والوصف يلتحق. */
const descCache = new Map();
async function loadDescription(url, slot, labels) {
  if (!slot) return;
  if (!url || /^https?:\/\//i.test(url) && !url.startsWith(location.origin)) { slot.textContent = ''; return; }

  if (descCache.has(url)) { slot.innerHTML = descCache.get(url); return; }
  slot.textContent = labels.loading;

  try {
    const res = await fetch(url, { credentials: 'same-origin' });
    if (!res.ok) throw new Error(String(res.status));
    const doc = new DOMParser().parseFromString(await res.text(), 'text/html');

    const node = doc.querySelector('.sard-product__desc, .product__description, [class*="product-description"], #description');
    let html = '';
    if (node) {
      /* نصّ فقط: حقن HTML من صفحة أخرى قد يجرّ سكربتات أو تخطيطًا يكسر
         النافذة. الوصف نصّيّ في جوهره فلا نخسر شيئًا. */
      const text = (node.textContent || '').replace(/\s+/g, ' ').trim();
      if (text) html = text.length > 600 ? text.slice(0, 600).trim() + '…' : text;
    }
    descCache.set(url, html);
    slot.innerHTML = html;
  } catch {
    slot.textContent = '';        // تعذّر الجلب: نُخفيه بلا رسالة خطأ للزائر
  }
}

/* ── زرّ المعاينة على البطاقات ── */
function decorate(card, label) {
  if (card.dataset.sardQuickReady) return;
  card.dataset.sardQuickReady = '1';
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'sard-quick-btn';
  btn.setAttribute('data-sard-quick', '');
  btn.setAttribute('aria-label', label);
  btn.innerHTML = '<span class="sard-quick-btn__eye"></span>';
  /* البطاقة قد تكون غير مُموضَعة، وبلا `relative` يقفز الزرّ إلى أقرب أب
     مُموضَع فيظهر في مكان لا علاقة له بالبطاقة. */
  if (getComputedStyle(card).position === 'static') card.style.position = 'relative';
  card.appendChild(btn);
}

function boot() {
  if (!isOn(CFG.quickView, true)) return;

  /* ⚠️ `salla.lang.get(key)` يُعيد **المفتاح نفسه** حين لا توجد ترجمة، لا null.
     فكتابة `salla.lang.get(k) || fallback` لا تسقط أبدًا إلى البديل، فيظهر
     للزائر نصٌّ خام مثل `pages.products.add_to_cart` — وهو ما رصده المالك في
     نافذة المعاينة. نعتبر أي ناتجٍ يساوي المفتاح أو يحوي نقطةً بلا مسافة
     ترجمةً مفقودة. */
  const t = (key, fallback) => {
    let v = null;
    try { v = window.salla?.lang?.get ? salla.lang.get(key) : null; } catch { v = null; }
    if (!v || v === key || (/\./.test(v) && !/\s/.test(v))) return fallback;
    return v;
  };
  const labels = {
    quick: t('blocks.home.quick_view', 'معاينة سريعة'),
    add: t('pages.products.add_to_cart', 'إضافة للسلة'),
    details: t('pages.products.details', 'الانتقال لصفحة المنتج'),
    loading: t('common.elements.loading', 'جارٍ التحميل…'),
  };

  const scan = () => document.querySelectorAll(SEL_CARDS).forEach((c) => decorate(c, labels.quick));
  scan();
  /* بطاقات سلة تُحقن بعد الجلب (قوائم منتجات، سلايدرات، فلاتر) فنترقّبها */
  new MutationObserver(scan).observe(document.body, { childList: true, subtree: true });

  document.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-sard-quick]');
    if (!btn) return;
    e.preventDefault();
    e.stopPropagation();                       // لا نتبع رابط البطاقة تحته
    const card = btn.closest(SEL_CARDS);
    if (!card) return;
    openQuick(readCard(card), labels);
  }, true);
}

if (document.readyState === 'loading') addEventListener('DOMContentLoaded', boot);
else boot();
