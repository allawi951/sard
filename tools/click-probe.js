/* ═══════════════════════════════════════════════════════════════
   click-probe — يُلصق في كونسول المتصفّح لمعرفة ما التُقطت النقرة عليه.

   الاستعمال: افتح المعاينة، الصق هذا كلّه في الكونسول، اضغط Enter،
   ثم اضغط أيقونة الحساب. سيطبع تقريرًا واحدًا ثم يتوقّف من نفسه.

   لا يغيّر شيئًا في الصفحة — مراقبة فقط، ويزول بتحديث الصفحة.
   ═══════════════════════════════════════════════════════════════ */
document.addEventListener('click', function probe(e) {
  const t = e.target;

  const chain = (() => {
    let p = t, out = [];
    while (p && out.length < 7) {
      const c = typeof p.className === 'string' && p.className ? '.' + p.className.trim().split(/\s+/)[0] : '';
      out.push(p.tagName.toLowerCase() + c);
      p = p.parentElement;
    }
    return out.join('  ←  ');
  })();

  console.log('%c ── تشخيص سرد: أين وقعت النقرة ── ',
              'background:#C9A15A;color:#14132F;font-weight:bold;padding:3px 10px');
  console.log('1) العنصر المنقور  :', t.tagName.toLowerCase(),
              '|  الأصناف:', (typeof t.className === 'string' && t.className) || '(بلا أصناف)');
  console.log('2) أقرب رابط       :', t.closest('a')?.getAttribute('href') ?? '— لا يوجد رابط —');
  console.log('3) داخل مكوّن      :',
              t.closest('salla-user-menu, salla-login-modal, salla-modal, [class*=editor], [id*=editor], [class*=preview], [id*=preview]')
                ?.tagName.toLowerCase() ?? '— لا شيء —');
  console.log('4) سلسلة الآباء    :', chain);
  console.log('5) أعلى عنصر تحت المؤشّر :',
              document.elementFromPoint(e.clientX, e.clientY)?.tagName.toLowerCase());

  document.removeEventListener('click', probe, true);   // تقرير واحد ثم توقّف
  console.log('%c ── انتهى. أرسل هذه الأسطر كما هي ── ',
              'background:#14132F;color:#F8F0E9;padding:3px 10px');
}, true);

console.log('%c ✓ المراقب جاهز — اضغط الآن على أيقونة الحساب ',
            'background:#0F7B4F;color:#fff;padding:3px 10px');
