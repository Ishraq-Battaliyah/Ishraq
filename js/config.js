/* إعدادات منصة إشراق
 * ---------------------------------------------------------------
 * firebase: إعدادات Firebase Realtime Database. اجعلها null للعمل محلياً
 *           (تُحفظ البيانات في متصفح الجهاز فقط).
 * dbRoot:   المسار الجذري للبيانات داخل قاعدة البيانات.
 * appCheckKey: مفتاح موقع reCAPTCHA v3 لتفعيل Firebase App Check (اختياري، يحدّ من الطلبات الآلية).
 */
window.ISHRAQ_CONFIG = {
  // إعدادات تطبيق الويب من Firebase Console (ليست سرية؛ الحماية عبر قواعد القاعدة وتسجيل الدخول)
  firebase: {
    apiKey: 'AIzaSyCDDxFEsDV9daVu6_RJrbkxNTeWh0CuU-k',
    authDomain: 'ishraq-c9328.firebaseapp.com',
    databaseURL: 'https://ishraq-c9328-default-rtdb.firebaseio.com',
    projectId: 'ishraq-c9328',
    storageBucket: 'ishraq-c9328.firebasestorage.app',
    messagingSenderId: '430318593977',
    appId: '1:430318593977:web:91c5330c59777a62aeb868'
  },
  dbRoot: 'ishraq',
  // الحسابات الرئيسية: صلاحية كاملة دائماً، وهي وحدها تدير المشرفين والصلاحيات (يجب أن تطابق tools/build_rules.py)
  ownerEmails: ['g.hussainalhajji@gmail.com', 'ishraq.battaliyah@gmail.com', 'hzzahmed4@gmail.com'],
  // يبقى المشرف مسجلاً على جهازه، ويُطلب منه الدخول من جديد بعد هذه المدة دون أي نشاط
  adminIdleHours: 72,
  // Firebase App Check (اختياري): ضع هنا مفتاح موقع reCAPTCHA v3 بعد إنشائه، ثم فعّل الإلزام من Firebase Console
  appCheckKey: '6LdVgtItAAAAAH5oPc8kIPaIRTVm8laqes23t8dY',
  // رابط المنصة الذي يُرسل للأعضاء في رسالة معلومات الدخول
  siteUrl: 'https://hussain-al-hajji.github.io/Ishraq/'
};
