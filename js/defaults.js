/* المحتوى الافتراضي ومخططات الأقسام */

const SECTION_TYPES = {
  header:       { label: 'الترويسة (Header)', icon: 'fa-window-maximize', fields: ['brand', 'tagline'], single: true },
  hero:         { label: 'الواجهة الافتتاحية', icon: 'fa-sun', fields: ['badge', 'title', 'subtitle', 'body', 'button', 'button2'] },
  about:        { label: 'نص تعريفي', icon: 'fa-align-right', fields: ['nav', 'kicker', 'title', 'body'], items: ['icon', 'title', 'text'] },
  cards:        { label: 'بطاقات (مزايا / أهداف)', icon: 'fa-grip', fields: ['nav', 'kicker', 'title', 'subtitle'], items: ['icon', 'title', 'text'] },
  list:         { label: 'قائمة نقاط', icon: 'fa-list-check', fields: ['nav', 'kicker', 'title', 'subtitle'], items: ['text'] },
  stats:        { label: 'أرقام ومستهدفات', icon: 'fa-chart-simple', fields: ['nav', 'kicker', 'title', 'subtitle'], items: ['value', 'label'] },
  timeline:     { label: 'مسار زمني', icon: 'fa-timeline', fields: ['nav', 'kicker', 'title', 'subtitle', 'note'], items: ['title', 'text', 'current'] },
  steps:        { label: 'خطوات الرحلة', icon: 'fa-shoe-prints', fields: ['nav', 'kicker', 'title', 'subtitle'], items: ['icon', 'title', 'text'] },
  structure:    { label: 'الهيكل التنظيمي', icon: 'fa-sitemap', fields: ['nav', 'kicker', 'title', 'subtitle'], items: ['title', 'people'] },
  events:       { label: 'فعالية قادمة', icon: 'fa-person-chalkboard', fields: ['nav', 'kicker', 'title', 'subtitle', 'emptyTitle', 'emptyBody'], single: true },
  register:     { label: 'إعلان التسجيل', icon: 'fa-bullhorn', fields: ['nav', 'kicker', 'title', 'body', 'deadline', 'button'] },
  members:      { label: 'أعضاء الدفعات', icon: 'fa-users', fields: ['nav', 'kicker', 'title', 'body', 'button'] },
  news:         { label: 'أخبار', icon: 'fa-newspaper', fields: ['nav', 'kicker', 'title', 'subtitle'], single: true },
  testimonials: { label: 'آراء المشاركين', icon: 'fa-quote-right', fields: ['nav', 'kicker', 'title', 'subtitle'] },
  video:        { label: 'فيديو', icon: 'fa-circle-play', fields: ['nav', 'kicker', 'title', 'body', 'video'] },
  custom:       { label: 'قسم مخصص', icon: 'fa-pen-ruler', fields: ['nav', 'kicker', 'title', 'body', 'image', 'button', 'buttonLink'] },
  portals:      { label: 'أزرار الدخول', icon: 'fa-right-to-bracket', fields: ['title', 'body'], single: true },
  footer:       { label: 'التذييل (Footer)', icon: 'fa-shoe-prints', fields: ['body', 'copyright'], single: true, social: true }
};

const FIELD_META = {
  brand: ['اسم البرنامج', 'text'],
  tagline: ['العبارة المرافقة', 'text'],
  nav: ['الاسم في القائمة العلوية (اختياري)', 'text'],
  badge: ['شارة علوية', 'text'],
  kicker: ['عنوان صغير أعلى القسم', 'text'],
  title: ['العنوان', 'text'],
  subtitle: ['العنوان الفرعي', 'text'],
  body: ['المحتوى', 'textarea'],
  note: ['ملاحظة', 'text'],
  deadline: ['آخر موعد للتسجيل (اختياري)', 'text'],
  button: ['نص الزر (يفتح نموذج التسجيل)', 'text'],
  button2: ['نص الزر الثاني (صفحة الأعضاء)', 'text'],
  buttonLink: ['رابط الزر (اتركه فارغاً لفتح نموذج التسجيل)', 'url'],
  image: ['رابط صورة (Google Drive أو رابط مباشر)', 'url'],
  video: ['رابط المقطع (YouTube أو Google Drive)', 'url'],
  copyright: ['سطر الحقوق', 'text'],
  emptyTitle: ['العنوان عند عدم وجود فعالية منشورة', 'text'],
  emptyBody: ['النص عند عدم وجود فعالية منشورة', 'textarea']
};

const ITEM_META = {
  icon: ['أيقونة Font Awesome (مثال: fa-star)', 'text'],
  title: ['العنوان', 'text'],
  text: ['النص', 'textarea'],
  value: ['الرقم', 'text'],
  label: ['الوصف', 'text'],
  current: ['المرحلة الحالية', 'checkbox'],
  people: ['الأسماء (سطر لكل اسم)', 'textarea']
};

const SOCIALS = [
  { k: 'linkedin', label: 'لينكدإن', icon: 'fa-brands fa-linkedin-in' },
  { k: 'twitter', label: 'تويتر / X', icon: 'fa-brands fa-x-twitter' },
  { k: 'instagram', label: 'أنستقرام', icon: 'fa-brands fa-instagram' },
  { k: 'website', label: 'الموقع الرسمي', icon: 'fa-solid fa-globe' },
  { k: 'whatsapp', label: 'واتساب', icon: 'fa-brands fa-whatsapp' },
  { k: 'email', label: 'الإيميل', icon: 'fa-solid fa-envelope' },
  { k: 'tiktok', label: 'تيك توك', icon: 'fa-brands fa-tiktok' },
  { k: 'snapchat', label: 'سناب شات', icon: 'fa-brands fa-snapchat' }
];

const PROFILE_FIELDS = [
  { k: 'name', label: 'الاسم', required: true },
  { k: 'tagline', label: 'السطر التعريفي (المسمى الوظيفي أو المجال)' },
  { k: 'photo', label: 'رابط الصورة من Google Drive', type: 'url' },
  { k: 'bio', label: 'النبذة التعريفية', type: 'textarea' },
  { k: 'areas', label: { mentor: 'مجالات الإرشاد', mentee: 'مجالات الاهتمام' } },
  { k: 'whatsapp', label: 'واتساب', type: 'tel', contact: true },
  { k: 'email', label: 'الإيميل', type: 'email', contact: true },
  { k: 'linkedin', label: 'لينكدإن', type: 'url', contact: true },
  { k: 'website', label: 'الموقع الشخصي', type: 'url', contact: true },
  { k: 'twitter', label: 'تويتر / X', type: 'url', contact: true },
  { k: 'instagram', label: 'أنستقرام', type: 'url', contact: true }
];

const DEFAULT_FORM_FIELDS = [
  { id: 'f_name', label: 'الاسم', type: 'text', required: true, order: 1 },
  { id: 'f_phone', label: 'الجوال', type: 'tel', required: true, order: 2 },
  { id: 'f_email', label: 'الإيميل', type: 'email', required: true, order: 3 },
  { id: 'f_bio', label: 'نبذة تعريفية موجزة', type: 'textarea', required: true, order: 4 }
];

function defaultSections() {
  const s = [
    { type: 'header', brand: 'إشراق', tagline: 'معك لمستقبل طموح' },
    {
      type: 'hero',
      badge: 'الدفعة الثانية 2026 · الإرشاد المتميز',
      title: 'إشراق',
      subtitle: 'معك لمستقبل طموح',
      body: 'برنامج إرشادي تابع لجمعية البطالية الخيرية، يخلق مساحة تواصل بين ذوي الخبرات في البلدة والطلاب والجامعيين والخريجين الباحثين عن العمل والمبتعثين.',
      button: 'سجّل اهتمامك بالدفعة القادمة',
      button2: 'تعرّف على أعضاء دفعات إشراق'
    },
    {
      type: 'about', nav: 'عن إشراق', kicker: 'الأهداف العليا',
      title: 'مساحة تواصل بين الخبرة والطموح',
      body: 'نؤمن أن الخبرة حين تلتقي بالطموح تصنع أثراً يمتد. يجمع إشراق ذوي الخبرات في البلدة مع الطلاب والجامعيين والخريجين والمبتعثين في رحلة إرشادية منظمة تبني المهارات وتفتح الآفاق.',
      items: [
        { icon: 'fa-people-arrows', title: 'مساحة تواصل', text: 'خلق مساحة تواصل بين ذوي الخبرات في البلدة مع الطلاب والجامعيين والخريجين الباحثين عن العمل أو المبتعثين.' },
        { icon: 'fa-seedling', title: 'تطوير مهارات أبناء البلدة', text: 'بناء العلامة الشخصية والمهنية، ومهارات التواصل الأساسية «الذاتية والعملية»، وبقية المهارات المطلوبة في سوق العمل.' }
      ]
    },
    {
      type: 'cards', nav: 'المزايا', kicker: 'لماذا إشراق؟', title: 'مزايا وفوائد البرنامج',
      subtitle: 'تجربة إرشادية متكاملة مصممة لتصنع فرقاً حقيقياً في مسيرتك.',
      items: [
        { icon: 'fa-user-tie', title: 'إرشاد شخصي فردي', text: 'ثلاث جلسات إرشادية مع مرشد متخصص في مجالك، مبنية على أهدافك وأولوياتك.' },
        { icon: 'fa-id-badge', title: 'علامة شخصية ومهنية', text: 'تعلّم كيف تقدّم نفسك بثقة وتبني حضوراً مهنياً يليق بطموحك.' },
        { icon: 'fa-comments', title: 'مهارات التواصل', text: 'تطوير مهارات التواصل الذاتي والعملي التي يحتاجها كل محترف.' },
        { icon: 'fa-briefcase', title: 'جاهزية لسوق العمل', text: 'توجيه أكاديمي ومهني يقرّبك من متطلبات سوق العمل وفرصه.' },
        { icon: 'fa-diagram-project', title: 'شبكة علاقات', text: 'تواصل مباشر مع نخبة من ذوي الخبرة من أبناء البلدة.' },
        { icon: 'fa-chart-line', title: 'متابعة وتقييم', text: 'نظام متابعة مستمر للجلسات وتقييم متبادل يضمن جودة التجربة.' }
      ]
    },
    {
      type: 'steps', nav: 'الرحلة', kicker: 'كيف تعمل؟', title: 'رحلتك في إشراق',
      items: [
        { icon: 'fa-pen-to-square', title: 'التسجيل', text: 'سجّل اهتمامك كمرشد أو مستفيد عبر النموذج.' },
        { icon: 'fa-filter', title: 'الفرز والمواءمة', text: 'نربط كل مستفيد بمرشد مختص يناسب مجاله وأهدافه.' },
        { icon: 'fa-calendar-check', title: 'ثلاث جلسات', text: 'جلسات حضورية أو إلكترونية، بفاصل ثلاثة أسابيع على الأقل بين كل جلسة وأخرى.' },
        { icon: 'fa-star-half-stroke', title: 'التقييم والتوصيات', text: 'تقييم متبادل وتوصيات عملية بعد كل جلسة منجزة.' },
        { icon: 'fa-award', title: 'التكريم', text: 'حفل ختامي لتكريم المرشدين والمستفيدين والمساهمين.' }
      ]
    },
    {
      type: 'stats', nav: 'المستهدفات', kicker: 'الأهداف طويلة المدى', title: 'طموحنا خلال خمس سنوات',
      items: [
        { value: '5000+', label: 'مستفيد من الورش والإرشاد العام' },
        { value: '400', label: 'مستفيد من الإرشاد الشخصي' },
        { value: '100+', label: 'مرشد متخصص' },
        { value: '30+', label: 'لقاءً وورشة عمل' },
        { value: '3', label: 'جوائز معتبرة في المنطقة' }
      ]
    },
    {
      type: 'timeline', kicker: 'مسار خمس سنوات', title: 'أهداف السنوات',
      note: 'المرحلة الثانية «الإرشاد التميزي» هي محور الدفعة الحالية.',
      items: [
        { title: 'السنة الأولى', text: 'التجربة والاختبار' },
        { title: 'السنة الثانية', text: 'الإرشاد التميزي', current: true },
        { title: 'السنة الثالثة', text: 'الانتشار في الورش والإرشاد العام' },
        { title: 'السنة الرابعة', text: 'الكفاءة والنمو' },
        { title: 'السنة الخامسة', text: 'الاستدامة' }
      ]
    },
    {
      type: 'list', kicker: 'الدفعة الثانية', title: 'الإرشاد المتميز — غربلة ومتابعة',
      subtitle: 'أهداف السنة الثانية',
      items: [
        { text: 'التركيز على اختيار المرشدين.' },
        { text: 'وضع نظام تقييم للمرشدين.' },
        { text: 'نظام متابعة للإرشاد الشخصي بشكل مستمر.' },
        { text: 'وضع خطة للورش والإرشاد العام.' },
        { text: 'تطوير نظام متابعة للمنجزات والقصص الملهمة للمستفيدين.' },
        { text: 'مشاركة القصص ونشر محتوى تثقيفي في مواقع التواصل الخاصة بالبرنامج.' }
      ]
    },
    {
      type: 'structure', nav: 'فريق العمل', kicker: 'الهيكل التنظيمي', title: 'فريق إشراق',
      items: [
        { title: 'رئيس البرنامج', people: 'الأستاذ / مؤيد الياسين' },
        { title: 'أمين عام البرنامج', people: 'المهندس / إبراهيم الحاجي' },
        { title: 'المشرف العام', people: 'المهندس / أحمد الحاجي' },
        { title: 'مجلس إدارة البرنامج', people: 'المهندس / أحمد الحاجي\nالمهندس / إبراهيم الحاجي\nالأستاذ / محمد سعيد العمار\nالمهندس / حسن طالب العمار\nالمهندس / محمد جواد العبد الله\nالأستاذ / علي الدريس' },
        { title: 'المسار الصحي', people: 'د. جواد العمار' },
        { title: 'لجنة الإعلام والتسويق', people: 'م. محمد جواد العبد الله\nأ. ناصر باقر الحاجي\nأ. أحمد الشيخ' },
        { title: 'لجنة التنسيق والعلاقات العامة', people: 'أ. محمد سعيد العمار\nم. حسن طالب العمار\nأ. أحمد الشيخ' },
        { title: 'لجنة المتابعة والتقييم', people: 'أ. علي الدريس\nم. حسن طالب العمار\nم. محمد جواد الحاجي\nأ. محمد سعيد العمار\nم. محمد جواد العبد الله' },
        { title: 'لجنة التطوير التقني والأتمتة', people: 'حسن يحيى المسلم\nم. أحمد الحاجي\nم. محمد جواد العبد الله\nسيد علي إدريس' }
      ]
    },
    { type: 'events', nav: 'الفعاليات', kicker: 'الفعاليات وورش العمل', title: 'فعالية قادمة' },
    {
      type: 'register', nav: 'التسجيل', kicker: 'الدفعة القادمة', title: 'كن جزءاً من الدفعة القادمة',
      body: 'سواء كنت صاحب خبرة ترغب بمشاركتها كمرشد، أو طالباً وخريجاً تبحث عن توجيه يختصر طريقك كمستفيد، سجّل اهتمامك الآن وسنتواصل معك عند فتح التسجيل.',
      button: 'سجّل اهتمامك'
    },
    {
      type: 'members', kicker: 'مجتمع إشراق', title: 'تعرّف على أعضاء دفعات إشراق',
      body: 'مرشدون ومستفيدون يصنعون معاً قصص نجاح ملهمة.', button: 'استعرض الأعضاء'
    },
    { type: 'testimonials', kicker: 'بأقلامهم', title: 'آراء المشاركين' },
    { type: 'portals', title: 'بوابات المنصة', body: 'ادخل إلى لوحتك الخاصة باستخدام الرمز المرسل إليك من إدارة البرنامج.' },
    {
      type: 'footer',
      body: 'برنامج إشراق — أحد برامج جمعية البطالية الخيرية.',
      copyright: 'جميع الحقوق محفوظة © 2026 إشراق',
      social: {}
    }
  ];
  return s.map((x, i) => ({ visible: true, order: i + 1, ...x }));
}

const ORDINALS = ['الأولى', 'الثانية', 'الثالثة', 'الرابعة', 'الخامسة', 'السادسة', 'السابعة', 'الثامنة', 'التاسعة', 'العاشرة'];

// إضافة قسم «فعالية قادمة» للمواقع التي أُنشئت قبل ميزة الفعاليات (مرة واحدة فقط)
function migrateEventsSection() {
  if (Store.get('meta/eventsSection')) return;
  const secs = Store.list('content/sections').sort(byOrder);
  if (secs.length && !secs.some(x => x.type === 'events')) {
    const before = secs.find(x => x.type === 'register') || secs.find(x => x.type === 'portals') || secs.find(x => x.type === 'footer');
    const id = Store.newId();
    const upd = {};
    let order = 1;
    secs.forEach(x => {
      if (before && x.id === before.id) upd[id] = { id, type: 'events', visible: true, nav: 'الفعاليات', kicker: 'الفعاليات وورش العمل', title: 'فعالية قادمة', order: order++ };
      upd[`${x.id}/order`] = order++;
    });
    if (!before) upd[id] = { id, type: 'events', visible: true, nav: 'الفعاليات', kicker: 'الفعاليات وورش العمل', title: 'فعالية قادمة', order: order++ };
    Store.update('content/sections', upd);
  }
  Store.set('meta/eventsSection', true);
}

// المحتوى الافتراضي لقاعدة بيانات جديدة فارغة (يُكتب مرة واحدة فقط ولا يكتب فوق بيانات موجودة)
function defaultData() {
  const sections = {};
  defaultSections().forEach(s => { const id = Store.newId(); sections[id] = { ...s, id }; });
  const form = {};
  DEFAULT_FORM_FIELDS.forEach(f => { form[f.id] = f; });
  return {
    content: { sections },
    form: { fields: form },
    cohorts: {
      c1: { id: 'c1', num: 1, name: 'الدفعة الأولى', year: 2025 },
      c2: { id: 'c2', num: 2, name: 'الدفعة الثانية', year: 2026 }
    },
    announcement: {
      enabled: false, title: 'التسجيل مفتوح!',
      body: 'باب التسجيل في الدفعة القادمة من إشراق مفتوح الآن.',
      button: 'سجّل اهتمامك', frequency: 'session'
    },
    meta: { eventsSection: true }
  };
}
