/* ═══════════════════════════════════════════════════════════════════════════
   sard-logo — يختار معالجة شعار المتجر تلقائيًّا على الشريط الداكن.

   لماذا: «سرد» ثيمٌ يُباع لعدّة متاجر، وشريطه داكن بينما شعار كل متجر مختلف.
   لا توجد معالجة واحدة صحيحة دائمًا (جرّبناها فكانت سبب رفض سلة):

     • شعار داكن ملوّن  → يحتاج لوحةً فاتحة خلفه
     • شعار أحاديّ داكن → يُفتَّح إلى أبيض نظيف
     • شعار فاتح/أبيض  → يُترك كما هو، وأي لوحة فاتحة تبتلعه

   فبدل فرض واحدةٍ على الجميع، نقيس بكسلات الشعار نفسه ونختار. الإعداد
   ‎logo_treatment = auto‎ (الافتراضي) يشغّل هذا الملف؛ وأي قيمة صريحة أخرى
   يختارها التاجر تتجاوزه ولا يعمل أصلًا.

   يُحمَّل في مدخل ‎app‎ لأن الشريط يظهر في كل الصفحات، لا في ‎home‎ وحده.
   ‎sard-trace‎ بلا تبعيات، فلا يجرّ هذا الاستيراد GSAP ولا غيرها.
   ═══════════════════════════════════════════════════════════════════════════ */

import { loadForTrace } from './sard-trace';

/* الشعار «فاتح» فوق هذه العتبة فيقرأ على الحبر الداكن بلا معالجة.
   قِست على شعارات اختبار: الأبيض الخالص ≈ 1.0، والرماديّ الفاتح ≈ .72،
   والكحليّ الداكن ≈ .12. العتبة عند .55 تفصلها بأمان. */
const LIGHT_ENOUGH = 0.55;

/* «أحاديّ اللون» = يُقلَب إلى أبيض بلا خسارة. التنعيم يُبقي اللون ثابتًا
   ويحرّك الشفافية وحدها، فالشعار ذو اللون الواحد يعطي دلوًا أو اثنين. */
const MONO_MAX_COLORS = 2;
const SAMPLE_W = 160;

/* ⚠️ لا نستعمل ‎inkStats‎ من ‎sard-trace‎ رغم قربها: هي مكتوبة لسؤال آخر
   (استخراج كفاف للرسم)، فتُسقط البكسل الأبيض الخالص بوصفه **خلفية** —
   وهو في سؤالنا **الشعار نفسه**، فيخرج الشعار الأبيض بلا عيّنة إطلاقًا.
   ومعيار ‎mono‎ عندها «≤ ٢٤ لونًا» فيَعدّ شعارًا رباعيّ الألوان أحاديًّا
   فيُبيّضه ويمحو ألوانه. القياس هنا مستقلّ، وتعديل ‎inkStats‎ كان سيكسر
   الرسم الذاتي المعتمِد عليها. */
function toneOf(img) {
  const nw = img.naturalWidth || img.width;
  const nh = img.naturalHeight || img.height;
  if (!nw || !nh) return null;

  const w = Math.min(nw, SAMPLE_W);
  const h = Math.max(1, Math.round((nh / nw) * w));
  const canvas = document.createElement('canvas');
  canvas.width = w; canvas.height = h;

  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return null;
  ctx.drawImage(img, 0, 0, w, h);

  let data;
  try { data = ctx.getImageData(0, 0, w, h).data; } catch { return null; }  // canvas مُلوَّثة

  const colors = new Set();
  let sum = 0, n = 0;
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] < 40) continue;                  // شفّاف — ليس من الشعار
    const r = data[i], g = data[i + 1], b = data[i + 2];
    sum += (r * 0.2126 + g * 0.7152 + b * 0.0722) / 255;
    n++;
    if (data[i + 3] > 200 && colors.size <= 64) {
      colors.add(((r >> 5) << 10) | ((g >> 5) << 5) | (b >> 5));
    }
  }
  return n ? { luma: sum / n, mono: colors.size <= MONO_MAX_COLORS } : null;
}

async function resolveTreatment() {
  const body = document.body;
  if (!body || !body.classList.contains('sard-logo-auto')) return;

  const img = document.querySelector('.navbar-brand img');
  if (!img) return;                                   // متجر بلا شعار — البديل نصّي

  // ننتظر جهوز الصورة قبل القياس، وإلا قرأنا canvas فارغة
  if (!img.complete || !img.naturalWidth) {
    await new Promise((r) => {
      img.addEventListener('load', r, { once: true });
      img.addEventListener('error', r, { once: true });
      setTimeout(r, 3000);                            // لا ننتظر إلى الأبد
    });
  }

  const probe = await loadForTrace(img);              // نسخة موازية بـ crossOrigin
  const tone = probe && toneOf(probe);

  /* أي إخفاق (نطاق بلا CORS، canvas مُلوَّثة، صورة فارغة) يُبقي اللوحة
     الفاتحة — وهي الآمنة للحالة الغالبة: شعار داكن أو ملوّن. */
  let mode = 'plate';
  if (tone) {
    if (tone.luma >= LIGHT_ENOUGH) mode = 'as-is';    // فاتح أصلًا — يقرأ على الداكن
    else if (tone.mono) mode = 'lighten';             // داكن أحاديّ اللون — يُقلَب نظيفًا
    // ما عدا ذلك: داكن ملوّن أو مفصّل → تبقى اللوحة الفاتحة
  }

  body.classList.remove('sard-logo-auto');
  body.classList.add(`sard-logo-${mode}`);
}

resolveTreatment().catch(() => {
  /* الفشل الصامت مقصود: صنف ‎sard-logo-auto‎ يحمل أصلًا مظهر اللوحة الفاتحة
     في CSS، فبقاؤه كما هو نتيجةٌ صحيحة لا شاشة مكسورة. */
});
