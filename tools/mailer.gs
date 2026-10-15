/**
 * إرسال الشهادات مباشرة من بريد الجمعية (Google Apps Script) مع الملف مرفقاً تلقائياً.
 * الإعداد: script.google.com ← مشروع جديد ← الصق هذا الكود ← غيّر SECRET ← نشر ← تطبيق ويب
 *   (تنفيذ باسم: أنا — من يملك الوصول: أي شخص) ← انسخ رابط التطبيق ← أدخله مع SECRET في «إعداد الإرسال المباشر» بتبويب الشهادات.
 */
const SECRET = 'غيّر-هذه-الكلمة-إلى-سر-طويل';   // يجب أن يطابق السر المدخل في المنصة
const SENDER_NAME = 'برنامج إشراق';
const VERSION = 2;   // 2: يدعم الرسائل بلا مرفق (القبول والاعتذار ومعلومات الدخول)

function doPost(e) {
  try {
    const d = JSON.parse(e.postData.contents);
    if (d.secret !== SECRET) return out({ ok: false, error: 'auth' });
    if (d.ping) return out({ ok: true, v: VERSION });   // المنصة تتحقق من أن النسخة المنشورة حديثة
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(d.to || '')) return out({ ok: false, error: 'bad address' });
    // المرفق اختياري: الشهادات بملف PDF، ورسائل القبول والاعتذار بلا مرفق
    const attachments = d.pdf ? [Utilities.newBlob(Utilities.base64Decode(d.pdf), 'application/pdf', d.filename || 'certificate.pdf')] : [];
    GmailApp.sendEmail(d.to, d.subject || '', d.body || '', { attachments, name: d.senderName || SENDER_NAME });
    return out({ ok: true });
  } catch (err) {
    return out({ ok: false, error: String(err) });
  }
}

function out(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}
