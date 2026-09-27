/* إطلاق الدفعة ونطاقات متابعة تعثر الجلسات
   يبدأ الحساب من لحظة «إطلاق الدفعة»: فترة الجلسة الأولى الأسابيع 1-4، والثانية 5-8، والثالثة 9-12.
   يُصنَّف المرشد حسب أسبوع إضافته لأول موعد للجلسة، أو حسب الأسبوع الحالي إن لم يُضفه بعد. */
const Bands = (() => {
  const WEEK = 7 * 864e5;
  const SESSIONS = [1, 2, 3];
  const LEVELS = [
    { k: 1, cls: 'band-1', color: 'أخضر داكن', period: 'الأسبوع الأول', rate: '100%', name: 'إنجاز مبكر', icon: 'fa-circle-check',
      action: 'إنجاز مبكر — إغلاق المؤشر وتوثيق الجلسة في النظام مباشرة.' },
    { k: 2, cls: 'band-2', color: 'أخضر فاتح', period: 'الأسبوع الثاني', rate: '80% - 85%+', name: 'أداء ممتاز', icon: 'fa-thumbs-up',
      action: 'أداء ممتاز ومطابق للخطة — متابعة روتينية من لجنة المتابعة.' },
    { k: 3, cls: 'band-3', color: 'أصفر / برتقالي', period: 'الأسبوع الثالث', rate: '60% - 80%', name: 'تنبيه وتذكير', icon: 'fa-bell',
      action: 'تنبيه وتذكير — إرسال تذكير للمرشد والمستفيد لجدولة الجلسة قبل نهاية الشهر.' },
    { k: 4, cls: 'band-4', color: 'أحمر', period: 'الأسبوع الرابع', rate: 'متأخرة عن موعدها', name: 'تحذير نهائي', icon: 'fa-triangle-exclamation',
      action: 'إشعار مباشر وعاجل بضرورة إتمام الجلسة خلال أيام الشهر المتبقية.' },
    { k: 5, cls: 'band-5', color: 'بنفسجي', period: 'تعدي شهر (الأسابيع 5 - 6)', rate: 'تعثر الجلسة الشهرية', name: 'تحقيق وتقصي', icon: 'fa-magnifying-glass',
      action: 'تواصل مباشر من لجنة التنسيق لمعرفة الفجوة والمسبب (ظروف، أوقات، عدم تجاوب).' },
    { k: 6, cls: 'band-6', color: 'أحمر داكن', period: 'تعدي شهر ونصف (+6 أسابيع)', rate: 'انقطاع وتوقف كامل', name: 'تصعيد تنفيذي', icon: 'fa-gavel',
      action: 'رفع الملف فوراً لمجلس الإدارة لاتخاذ قرار (معالجة / استبدال مرشد / إبعاد مستفيد).' }
  ];

  const launch = cohortId => Store.get(`launches/${cohortId}`) || null;
  const launchedAt = cohortId => launch(cohortId)?.ts || null;
  const windowStart = (ts, n) => ts + (n - 1) * 4 * WEEK;
  const weekOf = (t, start) => Math.max(1, Math.floor((t - start) / WEEK) + 1);
  const levelOf = week => LEVELS[week <= 4 ? Math.max(0, week - 1) : week <= 6 ? 4 : 5];

  // أول لحظة أضاف فيها المرشد موعداً لهذه الجلسة
  function addedAt(mentorId, n) {
    const times = Data.slots(mentorId).filter(s => s.session === n).map(s => s.ts || 0)
      .concat(Data.bookings({ mentorId }).filter(b => b.session === n).map(b => b.ts || 0));
    return times.length ? Math.min(...times) : null;
  }

  // حالة المرشد في جلسة: null قبل الإطلاق، أو {added, week, level, notStarted}
  function status(mentor, n, now = Date.now()) {
    const L = launchedAt(mentor.cohort);
    if (!L) return null;
    const start = windowStart(L, n);
    const at = addedAt(mentor.id, n);
    if (at != null) { const week = weekOf(at, start); return { n, added: true, at, week, level: levelOf(week), start }; }
    if (now < start) return { n, notStarted: true, start };
    const week = weekOf(now, start);
    return { n, added: false, week, level: levelOf(week), start };
  }

  // «مضى أسبوع / أسبوعان / 3 أسابيع / 11 أسبوعاً»
  function weeksText(k) {
    if (k === 1) return 'أسبوع واحد';
    if (k === 2) return 'أسبوعان';
    if (k >= 3 && k <= 10) return `${k} أسابيع`;
    return `${k} أسبوعاً`;
  }
  const passedText = k => `${k >= 3 && k <= 10 ? 'مضت' : 'مضى'} ${weeksText(k)}`;

  // الصياغة المقترحة لتذكير المرشد حسب النطاق
  function reminderText(mentor, st) {
    const s = sessionName(st.n);
    const passed = st.week - 1;
    const body = {
      1: `بدأت هذا الأسبوع فترة تحديد موعد ${s}. نأمل إضافة الموعد في صفحتك بالمنصة ليحجزه المستفيد في أقرب وقت.`,
      2: `${passedText(passed)} على بداية فترة ${s} ولم يُضَف موعدها بعد. نأمل المبادرة بتحديد الموعد هذا الأسبوع للبقاء ضمن الخطة.`,
      3: `تذكير: ${passedText(passed)} على بداية فترة ${s} دون إضافة موعدها. نرجو جدولة الجلسة مع المستفيد قبل نهاية الشهر.`,
      4: `تنبيه عاجل: ${passedText(passed)} على بداية فترة ${s} دون إضافة موعدها. يلزم تحديد الموعد وإتمام الجلسة خلال الأيام المتبقية من الشهر.`,
      5: `${passedText(passed)} على بداية فترة ${s} دون تحديد موعدها، وتجاوزت مدتها الشهرية. ستتواصل معك لجنة التنسيق لمعرفة الأسباب والمعوقات والمساعدة في تجاوزها، ونرجو إضافة الموعد فوراً.`,
      6: `${passedText(passed)} على بداية فترة ${s} دون تحديد موعدها، وسيُرفع الملف إلى إدارة البرنامج لاتخاذ القرار المناسب. نرجو التواصل مع الإدارة بشكل عاجل.`
    }[st.level.k];
    return `أهلاً ${mentor.name}،\n${body}\n\nمع التحية، برنامج إشراق`;
  }

  // تنبيه المرشد في صفحته عند تأخره (من الأسبوع الثاني فما بعد)
  function mentorAlertText(st) {
    const s = sessionName(st.n);
    const tail = { 2: 'نأمل المبادرة بإضافة الموعد هذا الأسبوع.', 3: 'نرجو جدولة الجلسة قبل نهاية الشهر.', 4: 'يلزم إضافة الموعد وإتمام الجلسة خلال أيام الشهر المتبقية.',
      5: 'تجاوزت الجلسة مدتها الشهرية، وستتواصل معك لجنة التنسيق.', 6: 'سيُرفع الملف إلى إدارة البرنامج، نرجو إضافة الموعد والتواصل مع الإدارة عاجلاً.' }[st.level.k] || '';
    return `${passedText(st.week - 1)} على بداية فترة إضافة موعد ${s} ولم تُضِف موعدها بعد. ${tail}`;
  }

  function doLaunch(cohortId) {
    const c = Data.cohort(cohortId);
    Store.set(`launches/${cohortId}`, { ts: Date.now(), by: Security.adminName() });
    Data.members('mentor', cohortId).forEach(m => Data.notify(m.id, 'تم إطلاق الدفعة رسمياً، سارع بتحديد مواعيد الجلسات', { icon: 'fa-rocket' }));
    Security.log('إطلاق الدفعة', c?.name || cohortId);
  }
  function undoLaunch(cohortId) {
    Store.remove(`launches/${cohortId}`);
    Security.log('إلغاء إطلاق الدفعة', Data.cohort(cohortId)?.name || cohortId);
  }

  return { WEEK, SESSIONS, LEVELS, launch, launchedAt, windowStart, weekOf, levelOf, addedAt, status, reminderText, mentorAlertText, passedText, doLaunch, undoLaunch };
})();
