/* إعدادات منصة إشراق
 * ---------------------------------------------------------------
 * firebase: إعدادات Firebase Realtime Database. اجعلها null للعمل محلياً
 *           (تُحفظ البيانات في متصفح الجهاز فقط).
 * dbRoot:   المسار الجذري للبيانات داخل قاعدة البيانات.
 * adminCode: الرمز السري لدخول لوحة الإدارة.
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
  adminCode: '2026',
  // رابط المنصة الذي يُرسل للأعضاء في رسالة معلومات الدخول
  siteUrl: 'https://hussain-al-hajji.github.io/Ishraq/'
};
