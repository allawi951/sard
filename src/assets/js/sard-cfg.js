/* ═══════════════════════════════════════════════════════════════════════════
   sard-cfg — قراءة إعدادات الثيم بأمان مهما كان شكل ما تُرجعه سلة.

   الدرس الذي كلّفنا جولات: `theme.settings.get()` **لا يعيد شكلًا واحدًا**.

     • إعداد boolean/switch  → قد يصل ‎true/false‎ منطقيًّا، وقد يصل ‎"1"‎/‎""‎
       نصًّا (وهذا ما يفترضه ثيم رائد نفسه: يكتبها بين علامتَي تنصيص
       ‎window.header_is_sticky = "{{ … }}"‎ ويفحصها بصدقٍ عامّ).
     • إعداد items/dropdown-list → قد يصل نصًّا ‎"perfume"‎، وقد يصل **مصفوفة
       كائنات** الخيار المحدَّد ‎[{value:"perfume",…}]‎.

   وكتابة ‎CFG.x !== false‎ تبدو سليمة لكنها تنكسر مع النصّ الفارغ:
   ‎"" !== false‎ ⇒ ‎true‎ — فيبقى المؤشّر يعمل مهما أطفأه التاجر. وهو بالضبط
   ما رصده المالك: «مهما عدّلت من إعدادات الثيم يبقى موجود».

   فكل قراءة إعداد تمرّ من هنا، ولا تُقارَن بـ‎=== false‎ مباشرةً.
   ═══════════════════════════════════════════════════════════════════════════ */

const OFF = new Set(['false', '0', '', 'no', 'off', 'null', 'undefined']);

/** هل الإعداد مُفعَّل؟ يقبل المنطقيّ والنصّ والرقم. */
export function isOn(value, fallback = true) {
  if (value === undefined || value === null) return fallback;
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;
  if (typeof value === 'string') return !OFF.has(value.trim().toLowerCase());
  return Boolean(value);
}

/** قيمة إعداد منسدل نصًّا، سواء وصل نصًّا أو مصفوفة كائنات أو كائنًا. */
export function choice(value, fallback = null) {
  const v = Array.isArray(value)
    ? (value[0] && value[0].value)
    : (value && typeof value === 'object' ? value.value : value);
  return typeof v === 'string' && v !== '' ? v : fallback;
}

export const CFG = window.SARD_CFG || {};
