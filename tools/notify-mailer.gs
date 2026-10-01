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
 *     للتشخيص: شغّل diagnose ثم افتح «سجل التنفيذ»، وللتأكد من الإرسال شغّل testEmail.
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
  if (db('notifyMail/enabled') !== true) { Logger.log('الإشعارات البريدية معطّلة من لوحة الإدارة (notifyMail/enabled ليست true)'); return; }
  const queue = db('mailQueue', 'get', `orderBy=${encodeURIComponent('"$key"')}&limitToFirst=${MAX_PER_RUN}`) || {};
  const keys = Object.keys(queue);
  Logger.log(`رسائل في الطابور: ${keys.length}`);
  const cache = {};
  let sent = 0, skipped = 0, failed = 0;
  keys.forEach(key => {
    const item = queue[key] || {};
    try {
      const c = cache[item.to] || (cache[item.to] = db(`contacts/${item.to}`) || {});
      const ok = c.emailNotify !== false && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(c.email || '');
      if (ok) {
        const name = (db(`members/${item.to}/name`) || '').toString();
        const text = String(item.text || '');
        // MailApp (وليس GmailApp): نطاقه script.send_mail مذكور في appsscript.json؛ وGmailApp يحتاج نطاق Gmail غير مذكور فيفشل
        MailApp.sendEmail({
          to: c.email.trim(),
          subject: 'إشعار جديد من برنامج إشراق',
          body: `${name ? 'عزيزي ' + name + '،\n\n' : ''}${text}\n\nللدخول إلى المنصة: ${SITE_URL}\n\nلإيقاف إشعارات البريد: ادخل إلى صفحتك في المنصة وعطّل «إشعارات البريد الإلكتروني».`,
          name: SENDER_NAME
        });
        sent++;
      } else { skipped++; Logger.log(`تخطّي ${item.to}: ${c.emailNotify === false ? 'عطّل الإشعارات' : 'لا يوجد بريد صحيح في بطاقته'}`); }
      db(`mailQueue/${key}`, 'delete');
    } catch (err) {
      failed++;
      console.error(err); Logger.log(`✗ فشل إرسال ${key}: ${err}`);
      if (item.ts && Date.now() - item.ts > DROP_AFTER_MS) db(`mailQueue/${key}`, 'delete');   // لا تتراكم الرسائل المعطوبة
    }
  });
  Logger.log(`أُرسلت ${sent} · تخطّي ${skipped} · فشل ${failed}`);
}

// شغّلها يدوياً (زر «تشغيل») لتعرف أين المشكلة: تطبع في «سجل التنفيذ» نتيجة كل فحص
function diagnose() {
  const step = (name, fn) => { try { Logger.log(`✓ ${name}: ${fn()}`); } catch (e) { Logger.log(`✗ ${name}: ${e}`); } };
  step('الحساب الذي يرسل', () => Session.getEffectiveUser().getEmail());
  step('الإشعارات مفعّلة في لوحة الإدارة', () => JSON.stringify(db('notifyMail')));
  step('قراءة الطابور (تحتاج صلاحية Firebase للحساب)', () => { const q = db('mailQueue', 'get', 'shallow=true'); return `${q ? Object.keys(q).length : 0} رسالة في الطابور`; });
  step('المهام المجدولة', () => ScriptApp.getProjectTriggers().map(t => t.getHandlerFunction()).join(', ') || 'لا توجد! شغّل setup');
  step('الحصة المتبقية للإرسال اليوم', () => MailApp.getRemainingDailyQuota());
}

// يرسل رسالة تجريبية إلى بريد الحساب نفسه للتأكد من صلاحية الإرسال
function testEmail() {
  const me = Session.getEffectiveUser().getEmail();
  MailApp.sendEmail({ to: me, subject: 'تجربة إشعارات إشراق', body: 'إذا وصلتك هذه الرسالة فصلاحية الإرسال سليمة.', name: SENDER_NAME });
  Logger.log('أُرسلت رسالة تجريبية إلى ' + me);
}
