/**
 * إرسال إشعارات المنصة إلى بريد الأعضاء (Google Apps Script).
 *
 * كيف يعمل: التطبيق يضيف كل إشعار لعضو إلى طابور في قاعدة البيانات (ishraq/mailQueue) حين تفعّل الإدارة
 * «الإشعارات البريدية». يقرأ هذا السكربت الطابور كل 5 دقائق بحساب مالك مشروع Firebase، ويرسل لكل عضو
 * على بريده المسجل في بطاقته (إلا من عطّل الإشعارات من صفحته)، ثم يحذف الرسالة من الطابور.
 *
 * الإعداد (مرة واحدة):
 *  1) script.google.com ← مشروع جديد بحساب Gmail الذي هو مالك/محرّر لمشروع Firebase (سيكون المرسِل).
 *  2) الصق هذا الكود في Code.gs.
 *  3) ⚙ إعدادات المشروع ← فعّل «إظهار ملف appsscript.json»، ثم افتحه واستبدل محتواه بما يلي:
 *     {
 *       "timeZone": "Asia/Riyadh",
 *       "exceptionLogging": "STACKDRIVER",
 *       "runtimeVersion": "V8",
 *       "oauthScopes": [
 *         "https://www.googleapis.com/auth/script.external_request",
 *         "https://www.googleapis.com/auth/script.scriptapp",
 *         "https://www.googleapis.com/auth/script.send_mail",
 *         "https://www.googleapis.com/auth/firebase.database",
 *         "https://www.googleapis.com/auth/userinfo.email"
 *       ]
 *     }
 *  4) شغّل الدالة setup مرة واحدة ووافق على الصلاحيات (تنشئ مهمة كل 5 دقائق).
 *  5) في المنصة: لوحة الإدارة ← الرسائل ← «تفعيل الإشعارات البريدية».
 */
const DB_URL = 'https://ishraq-c9328-default-rtdb.firebaseio.com';   // databaseURL من js/config.js
const DB_ROOT = 'ishraq';                                           // dbRoot من js/config.js
const SITE_URL = 'https://ishraqbattaliyah.org/';
const SENDER_NAME = 'برنامج إشراق';
const MAX_PER_RUN = 40;                       // حماية من تجاوز حد الإرسال اليومي
const DROP_AFTER_MS = 3 * 24 * 3600 * 1000;   // تُحذف الرسالة التي تعذّر إرسالها بعد 3 أيام

function setup() {
  ScriptApp.getProjectTriggers().filter(t => t.getHandlerFunction() === 'sendPending').forEach(t => ScriptApp.deleteTrigger(t));
  ScriptApp.newTrigger('sendPending').timeBased().everyMinutes(5).create();
  sendPending();
}

function db(path, method, query) {
  const url = `${DB_URL}/${DB_ROOT}/${path}.json?access_token=${ScriptApp.getOAuthToken()}${query ? '&' + query : ''}`;
  const res = UrlFetchApp.fetch(url, { method: method || 'get', muteHttpExceptions: true });
  if (res.getResponseCode() >= 300) throw new Error(`${method || 'GET'} ${path}: ${res.getResponseCode()} ${res.getContentText().slice(0, 200)}`);
  const body = res.getContentText();
  return body ? JSON.parse(body) : null;
}

function sendPending() {
  if (db('notifyMail/enabled') !== true) return;          // الإدارة أوقفت الإرسال
  const queue = db('mailQueue', 'get', `orderBy=${encodeURIComponent('"$key"')}&limitToFirst=${MAX_PER_RUN}`) || {};
  const cache = {};
  Object.keys(queue).forEach(key => {
    const item = queue[key] || {};
    try {
      const c = cache[item.to] || (cache[item.to] = db(`contacts/${item.to}`) || {});
      const ok = c.emailNotify !== false && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(c.email || '');
      if (ok) {
        const name = (db(`members/${item.to}/name`) || '').toString();
        const text = String(item.text || '');
        GmailApp.sendEmail(c.email.trim(), 'إشعار جديد من برنامج إشراق',
          `${name ? 'عزيزي ' + name + '،\n\n' : ''}${text}\n\nللدخول إلى المنصة: ${SITE_URL}\n\nلإيقاف إشعارات البريد: ادخل إلى صفحتك في المنصة وعطّل «إشعارات البريد الإلكتروني».`,
          { name: SENDER_NAME });
      }
      db(`mailQueue/${key}`, 'delete');
    } catch (err) {
      console.error(err);
      if (item.ts && Date.now() - item.ts > DROP_AFTER_MS) db(`mailQueue/${key}`, 'delete');   // لا تتراكم الرسائل المعطوبة
    }
  });
}
