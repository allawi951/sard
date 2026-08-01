/* ستّ صيغ لشعار «سرد» — كلّها خطّية بالكامل (fill:none) لتُرسَم بحركة
   stroke-dashoffset، وكلّها تتكلّم لغة زخرفة الثيم: قوس، معيّن، مسطرة، موجة.
   viewBox موحّد 0 0 100 100 كما توصي مهارة logo-generator. */

export const VARIANTS = [
  {
    id: 'seen-void',
    name: 'س داخل الفراغ',
    rationale: 'حرف «س» مُجرَّدًا إلى أسنانه الثلاثة وذيله، داخل قوس مفتوح لا دائرة '
      + 'مغلقة. بؤرة واحدة، وفراغ سالب يتجاوز النصف. الأسنان تتدرّج في الارتفاع '
      + 'فتكسر التناظر وتمنح توتّرًا بصريًّا.',
    svg: `
  <g fill="none" stroke="currentColor" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round">
    <path d="M22 34 A 32 32 0 1 0 78 34"/>
    <path d="M34 56 V 46"/>
    <path d="M45 56 V 41"/>
    <path d="M56 56 V 46"/>
    <path d="M30 56 H 60 A 10 10 0 0 1 70 66"/>
  </g>`,
  },
  {
    id: 'seen-diamond',
    name: 'س في المعيّن',
    rationale: 'المعيّن المركزي — أوضح علامات الزخرفة — يحتضن الحرف. عنصران '
      + 'اثنان لا أكثر، والمعيّن يمنح الثبات البنيوي بينما الحرف يبقى البؤرة.',
    svg: `
  <g fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round">
    <path d="M50 12 L 88 50 L 50 88 L 12 50 Z"/>
    <path d="M34 52 V 44"/>
    <path d="M44 52 V 38"/>
    <path d="M54 52 V 44"/>
    <path d="M30 52 H 58 A 8 8 0 0 1 66 60"/>
  </g>`,
  },
  {
    id: 'sard-word',
    name: 'سرد — كلمة (خطّ أميري)',
    viewBox: '126.0 78.0 129.0 78.0',
    rationale: 'الكلمة كاملةً بخطّ أميري — خطّ الثيم نفسه — مُتتبَّعة إلى حدودٍ '
      + 'خطّية بالأداة التي بنيناها للثيم. الحروف صحيحة لأن مصدرها الخطّ لا يدي، '
      + 'ويُرسم كفافها خطًّا خطًّا كأن قلمًا يكتبها.',
    svg: `
    <g fill="none" stroke="currentColor" stroke-width="1.5"
       stroke-linecap="round" stroke-linejoin="round" vector-effect="non-scaling-stroke">
      <path d="M249 94L251 96L251 108L246 116L239 115L233 111L230 116L225 120L217 119L215 116L208 116L201 118L198 120L197 130L192 140L183 150L179 152L171 152L159 146L159 145L163 147L174 147L186 140L191 135L195 128L195 124L192 119L195 111L212 106L217 106L218 109L222 112L228 111L233 107L238 96L238 104L247 108L248 106L246 102L249 95Z"/>
      <path d="M142 82L148 84L155 91L159 99L158 115L150 119L137 121L132 120L130 118L131 110L135 112L140 112L151 110L157 107L154 99L149 94L139 89L141 83Z"/>
    </g>`,
  },
  {
    id: 'arc-seen',
    name: 'القوس والحرف',
    rationale: 'القوس المزدوج منقولًا حرفيًّا من الزخرفة، والحرف تحته. أقرب '
      + 'الصيغ نسبًا للثيم — من رآه في الواجهة عرفه في متجر الثيمات.',
    svg: `
  <g fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round">
    <path d="M14 44 C 34 20 66 20 86 44"/>
    <path d="M22 48 C 38 30 62 30 78 48"/>
    <path d="M36 74 V 64"/>
    <path d="M46 74 V 59"/>
    <path d="M56 74 V 64"/>
    <path d="M32 74 H 60 A 8 8 0 0 1 68 82"/>
  </g>`,
  },
  {
    id: 'seen-wave',
    name: 'س والموجة',
    rationale: 'الحرف يقف على موجة الزخرفة بدل سطر مستقيم — السرد جريان لا '
      + 'سكون. عنصران، وعدم تناظر مقصود في ميل الموجة.',
    svg: `
  <g fill="none" stroke="currentColor" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round">
    <path d="M34 52 V 40"/>
    <path d="M46 52 V 34"/>
    <path d="M58 52 V 40"/>
    <path d="M28 52 H 64 A 10 10 0 0 1 74 62"/>
    <path d="M14 74 C 30 68 46 80 62 74 C 74 69 82 72 88 76"/>
  </g>`,
  },
  {
    id: 'seen-lines',
    name: 'س من نظام خطوط',
    rationale: 'كتلة من ثمانية خطوط أفقية متدرّجة الطول ترسم كتفَ الحرف بالسالب '
      + 'لا بالموجب. تكرار كثيف يمنح الثقل البنيوي الذي توصي به المهارة للأنظمة '
      + 'الخطّية، والحرف يظهر بالتعرّف لا بالرسم الصريح.',
    svg: `
  <g fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round">
    <path d="M20 30 H 80"/>
    <path d="M20 38 H 72"/>
    <path d="M20 46 H 58"/>
    <path d="M20 54 H 46"/>
    <path d="M20 62 H 58"/>
    <path d="M20 70 H 72"/>
    <path d="M20 78 H 80"/>
    <path d="M86 26 V 82"/>
  </g>`,
  },
];

export const wrap = (v, extra = '') =>
  `<svg viewBox="${v.viewBox || '0 0 100 100'}" xmlns="http://www.w3.org/2000/svg" ${extra}>${v.svg}\n</svg>`;
