/**
 * إرسال معلومات الدخول للمرشدين والمستفيدين من بريد الجمعية (Google Apps Script).
 * سكربت مستقل عن سكربت الشهادات (mailer.gs): يُنشر كتطبيق ويب منفصل برابط وسر مختلفين.
 * الإعداد: script.google.com ← مشروع جديد ← الصق هذا الكود ← غيّر SECRET ← نشر ← نشر جديد ← تطبيق ويب
 *   (تنفيذ باسم: أنا — من يملك الوصول: أي شخص) ← انسخ الرابط الذي ينتهي بـ /exec
 *   ← أدخله مع SECRET في زر «إعداد سكربت معلومات الدخول» بتبويب الدفعات (صفحة المرشدين أو المستفيدين).
 */
const SECRET = 'غيّر-هذه-الكلمة-إلى-سر-طويل';   // يجب أن يطابق السر المدخل في المنصة
const SENDER_NAME = 'برنامج إشراق';

function doPost(e) {
  try {
    const d = JSON.parse(e.postData.contents);
    if (d.secret !== SECRET) return out({ ok: false, error: 'auth' });
    if (d.ping) return out({ ok: true, ping: true });
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(d.to || '')) return out({ ok: false, error: 'bad address' });
    MailApp.sendEmail({ to: d.to, subject: d.subject || '', body: d.body || '', name: d.senderName || SENDER_NAME });
    return out({ ok: true });
  } catch (err) {
    return out({ ok: false, error: String(err) });
  }
}

function out(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}
