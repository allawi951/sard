// postcss.config.js
module.exports = {
  plugins: {
    'postcss-import': {},
    'tailwindcss/nesting': 'postcss-nesting',
    tailwindcss: {},
    'postcss-preset-env': {
      features: {
        'nesting-rules': true,

        /* 🔴 لا تُحوِّل الخصائص المنطقية إلى فيزيائية.
           postcss-preset-env يُرقّع `inset-inline-start` و`padding-inline-*`
           و`margin-inline-*` و`border-inline-*` إلى `left/right` **بافتراض
           LTR دائمًا**، فتنقلب كل اتجاهات الثيم في RTL بلا أي تحذير.

           قِسته: صفر خاصية منطقية كانت تنجو إلى public/app.css، ومنها
             padding-inline-start: 2.6rem  →  padding-left: 2.6rem
             inset-inline-start: 0         →  left: 0   (درج ينفتح يسارًا)

           ثيم رائد لا يتأثّر لأنه يستعمل صيغ tailwind (rtl:/ltr:) لا الخصائص
           المنطقية، أمّا طبقة «سرد» فتعتمد عليها في نحو خمسين موضعًا.
           والمتصفّحات الحديثة تدعمها أصلًا (Chrome 87+، Safari 14.1+،
           Firefox 66+) فلا حاجة للترقيع. */
        'logical-properties-and-values': false,
      },
    },
  }
}