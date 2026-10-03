#!/usr/bin/env python3
"""يولّد database.rules.json من تعريف واحد للصلاحيات.

التشغيل:  python3 tools/build_rules.py
قائمة الحسابات الرئيسية تُقرأ من js/config.js (ownerEmails) وقائمة الصلاحيات من js/security.js (PERMISSIONS)
حتى لا تتكرر يدوياً. بعد التوليد انشر الملف الناتج في Firebase.

المبدأ: القواعد تحدد مَن يقرأ ويكتب، وماذا يكتب (.validate): الحقول المسموحة وأنواعها وأطوالها،
وأي حقل غير معروف يُرفض ($other). الأعضاء يقرؤون سجلاتهم فقط عبر استعلامات (query.orderByChild).
"""
import json, pathlib, re

BASE = pathlib.Path(__file__).resolve().parent.parent
ROOT = 'ishraq'

cfg = (BASE / 'js/config.js').read_text(encoding='utf-8')
OWNERS = re.findall(r"'([^']+@[^']+)'", re.search(r"ownerEmails:\s*\[([^\]]*)\]", cfg).group(1))
sec = (BASE / 'js/security.js').read_text(encoding='utf-8')
PERMS = re.findall(r"\{ k: '(\w+)'", re.search(r"const PERMISSIONS = \[(.*?)\];", sec, re.S).group(1))
assert OWNERS and PERMS, 'تعذّر قراءة ownerEmails أو PERMISSIONS'

R = f"root.child('{ROOT}/"
UID = f"{R}uids/' + auth.uid)"
ME = f"{UID}.val()"
IS_MEMBER = f"(auth != null && {UID}.exists())"
PARTNER = f"{R}pairs/' + {ME})"          # طرف العضو المرتبط به: المستفيد = نص رقم مرشده، والمرشد = نص (مستفيد واحد) أو كائن {رقم المستفيد: true} لعدة مستفيدين
# x طرف مرتبط بالعضو الحالي: مرشد المستفيد، أو أحد مستفيدي المرشد
IS_PARTNER = lambda x: f"({PARTNER}.val() === {x} || {R}pairs/' + {ME} + '/' + {x}).val() === true)"

# الجلسات الإضافية: مفتوحة لكل المستفيدين حين تفعّلها الإدارة (extraConfig/enabled)
EXTRA_ON = f"{R}extraConfig/enabled').val() === true"
# علاقة المستفيد بالمرشد في جلسة إضافية: يسجّلها المستفيد عند الحجز (extraPairs/{المستفيد}_{المرشد})
REL_TO = lambda who: f"({R}extraPairs/' + {ME} + '_' + {who}).exists() || {R}extraPairs/' + {who} + '_' + {ME}).exists())"


MY_ROLE = f"{R}members/' + {ME} + '/role').val()"
# دفعة العضو «فعّالة» بعد إطلاقها وقبل أرشفتها: لا يضيف العضو مواعيد ولا يحجز ولا يقيّم قبل الإطلاق أو بعد الأرشفة (يبقى له الدخول وقراءة بياناته)
MY_COHORT = f"{R}members/' + {ME} + '/cohort').val()"
LIVE = f"({R}launches/' + {MY_COHORT} + '/ts').exists() && !{R}launches/' + {MY_COHORT} + '/archivedAt').exists())"
OWNER = "(auth != null && auth.token.email_verified === true && (" + " || ".join(f"auth.token.email === '{e}'" for e in OWNERS) + "))"
ADMIN_REC = f"{R}admins/' + auth.uid)"
IS_ADMIN = f"({OWNER} || (auth != null && {ADMIN_REC}.exists()))"
# صلاحية كاملة: حساب رئيسي، أو مشرف role=full، أو مشرف قديم بلا role
IS_FULL = f"({OWNER} || (auth != null && {ADMIN_REC}.exists() && ({ADMIN_REC}.child('role').val() === 'full' || !{ADMIN_REC}.child('role').exists())))"


def can(*perms):
    return "(" + " || ".join([IS_FULL] + [f"(auth != null && {ADMIN_REC}.child('perms/{p}').val() === true)" for p in perms]) + ")"


def any_of(*exprs):
    return "(" + " || ".join(exprs) + ")"


def w(expr):
    return {".write": expr}


def query(child, *equal_to):
    return f"(query.orderByChild === '{child}' && (" + " || ".join(f"query.equalTo === {v}" for v in equal_to) + "))"


# ===== أدوات التحقق من الحقول =====
def s(n=500):
    return {".validate": f"newData.isString() && newData.val().length <= {n}"}


def one_of(*vals):
    return {".validate": "newData.isString() && (" + " || ".join(f"newData.val() === '{v}'" for v in vals) + ")"}


def fields(spec, required=()):
    """قائمة حقول مسموحة، وأي حقل آخر مرفوض."""
    out = dict(spec)
    out["$other"] = {".validate": False}
    if required:
        out[".validate"] = "newData.hasChildren([" + ", ".join(f"'{r}'" for r in required) + "])"
    return out


NUM = {".validate": "newData.isNumber()"}
BOOL = {".validate": "newData.isBoolean()"}
NUM_OR_BOOL = {".validate": "newData.isNumber() || newData.isBoolean()"}
TIME = {".validate": "newData.isString() && newData.val().matches(/^([01][0-9]|2[0-3]):[0-5][0-9]$/)"}
DATE = {".validate": "newData.isString() && newData.val().matches(/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/)"}
SESSION = {".validate": "newData.isNumber() && (newData.val() === 1 || newData.val() === 2 || newData.val() === 3)"}
ICON = {".validate": "newData.isString() && newData.val().matches(/^fa-[a-z0-9-]{1,40}$/)"}
ID = {".validate": "newData.isString() && newData.val().length <= 60"}

INV = f"{R}adminInvites/' + auth.token.email.toLowerCase().replace('.', ','))"

# ===== مخططات السجلات =====
NOTIF = fields({"id": ID, "to": ID, "text": s(2000), "ts": NUM, "read": BOOL, "icon": ICON, "kind": one_of('reminder'),
                "session": SESSION, "band": NUM, "week": NUM, "dismissed": BOOL}, required=('text',))

BOOKING = fields({
    "id": ID, "mentorId": ID, "menteeId": ID, "cohort": ID, "slotId": ID, "session": SESSION,
    "date": DATE, "start": TIME, "end": TIME, "mode": one_of('inperson', 'online', 'both'), "summary": s(1000),
    "status": one_of('upcoming', 'done', 'absent_mentor', 'absent_mentee', 'cancelled'), "ts": NUM,
    "doneByMentor": NUM_OR_BOOL, "doneByMentee": NUM_OR_BOOL, "statusTs": NUM, "statusBy": one_of('mentor', 'mentee', 'both', 'admin'),
    "changedBy": one_of('mentor', 'mentee', 'admin'), "extra": BOOL,
    # إلغاء الموعد بعد الحجز، وموعد بديل مقترح بانتظار موافقة الطرف الآخر، والجلسة الناتجة عن موعد مقترح من المستفيد
    "cancelledBy": one_of('mentor', 'mentee'), "cancelTs": NUM, "cancelReason": s(300), "wishId": ID,
    "proposal": fields({"date": DATE, "start": TIME, "end": TIME, "slotId": ID, "by": one_of('mentor', 'mentee'), "ts": NUM},
                       required=('date', 'start', 'end', 'by')),
    "history": {"$i": fields({"date": DATE, "start": TIME, "end": TIME, "by": one_of('mentor', 'mentee', 'admin'), "ts": NUM})},
}, required=('mentorId', 'menteeId', 'status'))

SLOT = fields({"id": ID, "mentorId": ID, "session": SESSION, "date": DATE, "start": TIME, "end": TIME,
               "mode": one_of('inperson', 'online', 'both'), "summary": s(1000), "ts": NUM, "extra": BOOL},
              required=('mentorId', 'date'))

# مواعيد يقترحها المستفيد لكل جلسة (أساسية أو إضافية) ويعتمد المرشد أحدها فتتحول إلى جلسة مجدولة
WISH = fields({"id": ID, "menteeId": ID, "mentorId": ID, "session": SESSION, "extra": BOOL, "date": DATE, "start": TIME, "end": TIME,
               "mode": one_of('inperson', 'online', 'both'), "note": s(500),
               "status": one_of('open', 'accepted', 'declined', 'withdrawn'), "ts": NUM, "decidedAt": NUM, "bookingId": ID},
              required=('menteeId', 'mentorId', 'date', 'start', 'end', 'status'))

# طابور رسائل البريد: يملؤه التطبيق ويرسله سكربت tools/notify-mailer.gs ثم يحذفه
MAILQ = fields({"id": ID, "to": ID, "text": s(500), "ts": NUM}, required=('to', 'text'))

REVIEW = fields({
    "id": ID, "type": one_of('session', 'final', 'program'), "from": one_of('mentor', 'mentee'),
    "authorId": ID, "authorName": s(120), "targetId": {".validate": "newData.isString() && newData.val().length <= 60"},
    "mentorId": ID, "menteeId": ID, "bookingId": ID,
    "session": SESSION, "text": s(3000), "extra": s(3000), "status": one_of('pending', 'approved', 'rejected'),
    "featured": BOOL, "ts": NUM, "decidedAt": NUM, "extraSession": BOOL,
}, required=('type', 'authorId', 'text', 'status'))

INTEREST = fields({"id": ID, "role": one_of('mentor', 'mentee'), "answers": {"$f": s(3000)}, "ts": NUM,
                   "source": s(200), "seen": BOOL}, required=('role',))

# التسجيل في الدفعة المعلنة (منفصل عن المهتمين): الزائر ينشئ السجل دون حقول القرار، والإدارة تقبله أو تعتذر وتسجّل قرارها فيه
REGISTRATION = fields({"id": ID, "role": one_of('mentor', 'mentee'), "answers": {"$f": s(3000)}, "ts": NUM, "seen": BOOL,
                       "cohort": ID, "prev": BOOL, "prevCode": s(30),
                       "status": one_of('accepted', 'declined'), "memberId": ID, "decidedAt": NUM, "mailedAt": NUM}, required=('role',))
# حقول نموذج التسجيل في الدفعة المعلنة (منفصلة عن حقول نموذج المهتمين form/fields)
REG_FIELD = fields({"id": ID, "label": s(1000), "type": one_of('text', 'textarea', 'tel', 'email', 'url', 'select', 'number', 'date', 'info'),
                    "options": s(2000), "placeholder": s(200), "required": BOOL, "order": NUM})

EVENT_REG = fields({"id": ID, "eventId": ID, "memberId": ID, "role": one_of('mentor', 'mentee'), "code": s(20),
                    "name": s(120), "phone": s(30), "email": s(120),
                    "interest": {".validate": "newData.isString() && (newData.val() === '' || newData.val() === 'mentor' || newData.val() === 'mentee')"},
                    "ts": NUM, "seen": BOOL}, required=('eventId',))

INBOX = fields({"id": ID, "fromId": ID, "fromName": s(120), "role": one_of('mentor', 'mentee'), "body": s(3000), "ts": NUM},
               required=('fromId', 'body'))

LOG = fields({"id": ID, "ts": NUM, "action": s(200), "target": s(300), "details": s(500),
              "by": fields({"uid": ID, "email": s(200), "name": s(200)})}, required=('action', 'by'))

NEWS = fields({"id": ID, "title": s(200), "html": s(20000), "images": {"$i": s(500)}, "published": BOOL, "ticker": BOOL,
               "ts": NUM, "updatedAt": NUM}, required=('title', 'html'))

MSG = fields({"id": ID, "from": one_of('member', 'admin'), "by": s(120), "text": s(3000), "ts": NUM}, required=('from', 'text', 'ts'))
TICKET = fields({"id": ID, "memberId": ID, "memberName": s(120), "role": one_of('mentor', 'mentee'), "subject": s(150),
                 "status": one_of('open', 'answered', 'closed'), "ts": NUM, "updatedAt": NUM, "lastFrom": one_of('member', 'admin'),
                 "unreadAdmin": BOOL, "unreadMember": BOOL, "messages": {"$mid": MSG}}, required=('memberId', 'subject', 'status'))

CERT_TPL = fields({**{k: s(3000) for k in ['title', 'intro', 'body', 'org', 'signerName', 'signerTitle', 'footer', 'emailSubject', 'emailBody']},
                   "signature": s(600), "stamp": s(600), "showSignature": BOOL, "showStamp": BOOL, "showDate": BOOL})
CERTS = {".read": can('certificates'), **w(can('certificates')),
         "templates": {"$kind": {".read": f"{IS_MEMBER} && $kind === {MY_ROLE}", **CERT_TPL}},
         "names": {"$k": {".read": f"{IS_MEMBER} && $k === {ME}", **s(120)}},
         "mailer": fields({"url": s(400), "secret": s(120), "name": s(120)}),
         "issued": {"$k": {".read": f"{IS_MEMBER} && $k === {ME}", **fields({"ts": NUM, "by": s(120), "via": s(20), "date": s(10)})}}}

CONTACT = fields({**{k: s(300) for k in ['whatsapp', 'email', 'linkedin', 'website', 'twitter', 'instagram']}, "emailNotify": BOOL})

# ===== قواعد كتابة العضو =====
d = lambda k: f"data.child('{k}').val()"
n = lambda k: f"newData.child('{k}').val()"
# الجلسة الأساسية: مع المرشد المرتبط به. الجلسة الإضافية: مع مرشد ربطته الإدارة به (extraLinks)
EXTRA_LINK_NEW = (f"{EXTRA_ON} && $bid === 'x_' + {n('slotId')} && {R}slots/' + {n('slotId')} + '/extra').val() === true"
                  f" && {R}slots/' + {n('slotId')} + '/mentorId').val() === {n('mentorId')}")
BOOKING_CREATE = (f"!data.exists() && {n('menteeId')} === {ME} && {n('status')} === 'upcoming'"
                  " && !newData.child('doneByMentor').exists() && !newData.child('doneByMentee').exists()"
                  f" && (({n('mentorId')} === {PARTNER}.val() && newData.child('session').exists() && !newData.child('extra').exists())"
                  f" || ({n('extra')} === true && {EXTRA_LINK_NEW}))")
# موعد بديل: يقترحه أي طرف (دون تغيير الموعد الحالي)، ولا يتغير الموعد إلا بموافقة الطرف الآخر على الاقتراح نفسه
WISH_REF = f"{R}wishes/' + {n('wishId')})"
BOOKING_FROM_WISH = (f"!data.exists() && {n('mentorId')} === {ME} && {n('status')} === 'upcoming' && newData.child('wishId').exists()"
                     " && !newData.child('doneByMentor').exists() && !newData.child('doneByMentee').exists()"
                     f" && {WISH_REF}.child('mentorId').val() === {ME} && {WISH_REF}.child('menteeId').val() === {n('menteeId')} && {WISH_REF}.child('status').val() === 'open'"
                     f" && {n('date')} === {WISH_REF}.child('date').val() && {n('start')} === {WISH_REF}.child('start').val() && {n('end')} === {WISH_REF}.child('end').val()"
                     f" && (({n('extra')} === true && {EXTRA_ON} && {WISH_REF}.child('extra').val() === true && $bid === 'xw_' + {n('wishId')})"
                     f" || (!newData.child('extra').exists() && newData.child('session').exists() && {n('session')} === {WISH_REF}.child('session').val()))")
TIME_SAME = f"{n('date')} === {d('date')} && {n('start')} === {d('start')} && {n('end')} === {d('end')} && {n('slotId')} === {d('slotId')}"
MY_SIDE = f"({d('mentorId')} === {ME} ? 'mentor' : 'mentee')"
OTHER_SIDE = f"({d('mentorId')} === {ME} ? 'mentee' : 'mentor')"
PROP = "data.child('proposal/%s').val()"
TIME_ACCEPT = (f"data.child('proposal').exists() && data.child('proposal/by').val() === {OTHER_SIDE} && !newData.child('proposal').exists()"
               f" && {n('date')} === {PROP % 'date'} && {n('start')} === {PROP % 'start'} && {n('end')} === {PROP % 'end'} && {n('slotId')} === {PROP % 'slotId'}")
TIME_OK = f"(({TIME_SAME} && (!newData.child('proposal').exists() || newData.child('proposal/by').val() === {MY_SIDE})) || ({TIME_ACCEPT}))"
NOT_DONE = f"!data.child('doneByMentor').exists() && !data.child('doneByMentee').exists()"
BOOKING_UPDATE = (f"data.exists() && newData.exists() && {d('status')} === 'upcoming' && ({d('mentorId')} === {ME} || {d('menteeId')} === {ME})"
                  f" && {n('mentorId')} === {d('mentorId')} && {n('menteeId')} === {d('menteeId')} && {n('session')} === {d('session')}"
                  f" && {TIME_OK}"
                  # كل طرف يؤكد عن نفسه فقط
                  f" && ({n('doneByMentor')} === {d('doneByMentor')} || {d('mentorId')} === {ME})"
                  f" && ({n('doneByMentee')} === {d('doneByMentee')} || {d('menteeId')} === {ME})"
                  # «منجزة» بتأكيد الطرفين فقط، وكل طرف يسجّل غياب الطرف الآخر فقط، ويلغي أي طرف الموعد ما لم يؤكد أحد إنجازه
                  f" && ({n('status')} === 'upcoming' || ({n('status')} === 'done' && newData.child('doneByMentor').exists() && newData.child('doneByMentee').exists())"
                  f" || ({n('status')} === 'absent_mentee' && {d('mentorId')} === {ME}) || ({n('status')} === 'absent_mentor' && {d('menteeId')} === {ME})"
                  f" || ({n('status')} === 'cancelled' && {NOT_DONE} && {n('cancelledBy')} === {MY_SIDE}))")
# تقييم جلسة إضافية: بعد إنجاز الجلسة، وبين طرفيها فقط (المرشد والمستفيد المحجوز له)
_BK = f"{R}bookings/' + {n('bookingId')})"
EXTRA_REVIEW_OK = (f"{n('extraSession')} === true && {_BK}.child('extra').val() === true && {_BK}.child('status').val() === 'done'"
                   f" && (({_BK}.child('menteeId').val() === {ME} && {n('targetId')} === {_BK}.child('mentorId').val())"
                   f" || ({_BK}.child('mentorId').val() === {ME} && {n('targetId')} === {_BK}.child('menteeId').val()))")
REVIEW_CREATE = (f"!data.exists() && {n('authorId')} === {ME}"
                 f" && ({n('targetId')} === 'admin' || {n('targetId')} === '' || ({IS_PARTNER(n('targetId'))} && !newData.child('extraSession').exists()) || ({EXTRA_REVIEW_OK}))"
                 f" && ({n('status')} === 'pending' || ({n('type')} === 'program' && {n('status')} === 'approved' && {n('featured')} === false))")

SLOT_MENTOR = f"{R}slots/' + $sid + '/mentorId').val()"
OWN_TICKET = f"{R}tickets/' + $tid + '/memberId').val() === {ME}"

rules = {
    ".read": IS_FULL,
    "content": {".read": True, **w(can('content'))},
    "form": {".read": True, **w(can('content'))},
    "announcement": {".read": True, **w(can('announce'))},
    "events": {".read": True, **w(can('events'))},
    "featured": {".read": True, **w(can('reviews'))},
    "cohorts": {".read": True, **w(can('cohorts'))},
    # الشهادات: قوالب الشهادات والأسماء المعدّلة وسجل الإصدار
    "certs": CERTS,
    # الأخبار: قراءة عامة، والكتابة لصلاحية محتوى الصفحة
    "news": {".read": True, **w(can('content')), "$id": NEWS},
    # إطلاق الدفعة: يبدأ منه حساب نطاقات متابعة الجلسات
    "launches": {".read": True, **w(can('sessions'))},
    "meta": {".read": True, **w(IS_FULL), "lastBackup": w(IS_ADMIN)},
    "members": {
        ".read": True, **w(can('cohorts')),
        "$mid": w(f"auth != null && {ME} === $mid && newData.exists() && {n('code')} === {d('code')} && {n('role')} === {d('role')} && {n('cohort')} === {d('cohort')} && {n('seq')} === {d('seq')} && {n('uid')} === {d('uid')}"),
    },
    "contacts": {
        ".read": can('cohorts', 'sessions', 'certificates'), **w(can('cohorts')),
        "$mid": {
            ".read": f"{IS_MEMBER} && ({ME} === $mid || {IS_PARTNER('$mid')})",
            ".write": f"auth != null && {ME} === $mid",
            **CONTACT,
        },
    },
    # رموز الدخول: تقرؤها الصلاحية الكاملة فقط (عبر قراءة الجذر)، ويكتبها من يضيف الأعضاء
    "secrets": w(can('cohorts')),
    "counters": {".read": can('cohorts'), **w(can('cohorts'))},
    "uids": {".read": can('cohorts'), **w(can('cohorts')), "$uid": {".read": "auth != null && auth.uid === $uid"}},
    # الشبكة للمشرفين فقط؛ العضو يعرف طرفه من pairs/{رقمه}
    "network": {".read": can('cohorts', 'sessions', 'reviews', 'messages'), **w(can('cohorts'))},
    "pairs": {".read": can('cohorts', 'sessions', 'reviews', 'messages'), **w(can('cohorts')),
              "$mid": {".read": f"auth != null && {ME} === $mid", ".validate": "(newData.isString() && newData.val().length <= 60) || newData.hasChildren()",
                       "$m": {".validate": "newData.val() === true"}}},
    "messages": {
        ".read": any_of(can('messages'), f"({IS_MEMBER} && {query('aud', repr('all'), ME, MY_ROLE)})"),
        **w(can('messages')), ".indexOn": ["aud"],
    },
    "inbox": {".read": can('messages'), **w(can('messages')),
              "$id": {**w(f"{IS_MEMBER} && !data.exists() && {n('fromId')} === {ME}"), **INBOX}},
    "slots": {
        ".read": any_of(can('sessions', 'cohorts'), f"({IS_MEMBER} && ((query.orderByChild === 'mentorId' && (query.equalTo === {ME} || query.equalTo === {PARTNER}.val())) || (query.orderByChild === 'extra' && query.equalTo === true && {EXTRA_ON})))"),
        **w(can('sessions')), ".indexOn": ["mentorId", "extra"],
        "$sid": {**w(f"{IS_MEMBER} && {LIVE} && ((data.exists() && {d('mentorId')} === {ME}) || (!data.exists() && {n('mentorId')} === {ME}"
                     f" && (({n('extra')} === true && {EXTRA_ON} && {R}members/' + {ME} + '/role').val() === 'mentor') || newData.child('session').exists())))"), **SLOT},
    },
    "bookings": {
        ".read": any_of(can('sessions', 'cohorts', 'reviews'), f"({IS_MEMBER} && ({query('mentorId', ME)} || {query('menteeId', ME)}))"),
        **w(can('sessions')), ".indexOn": ["mentorId", "menteeId"],
        "$bid": {**w(f"{IS_MEMBER} && {LIVE} && (({BOOKING_CREATE}) || ({BOOKING_FROM_WISH}) || ({BOOKING_UPDATE}))"), **BOOKING},
    },
    "wishes": {
        ".read": any_of(can('sessions'), f"({IS_MEMBER} && ({query('mentorId', ME)} || {query('menteeId', ME)}))"),
        **w(can('sessions')), ".indexOn": ["mentorId", "menteeId"],
        "$wid": {**w(f"{IS_MEMBER} && {LIVE} && ((!data.exists() && {n('menteeId')} === {ME} && {n('status')} === 'open'"
                     f" && (({n('mentorId')} === {PARTNER}.val() && newData.child('session').exists() && !newData.child('extra').exists())"
                     f" || ({n('extra')} === true && !newData.child('session').exists() && {EXTRA_ON} && {MY_ROLE} === 'mentee' && {REL_TO(n('mentorId'))})))"
                     f" || (data.exists() && {d('status')} === 'open' && {n('menteeId')} === {d('menteeId')} && {n('mentorId')} === {d('mentorId')}"
                     f" && {n('date')} === {d('date')} && {n('start')} === {d('start')} && {n('end')} === {d('end')}"
                     f" && (({d('menteeId')} === {ME} && {n('status')} === 'withdrawn') || ({d('mentorId')} === {ME} && ({n('status')} === 'accepted' || {n('status')} === 'declined')))))"), **WISH},
    },
    # إشعارات البريد: تفعّلها الإدارة، والعضو يعطّلها لنفسه من contacts/{id}/emailNotify
    "notifyMail": {".read": True, **w(can('messages')), "enabled": BOOL, "ts": NUM, "by": s(120)},
    # طابور البريد: لا يقرؤه أحد من الأعضاء؛ يضيف إليه العضو لطرفه المرتبط فقط، ويقرؤه ويحذفه سكربت الإرسال بحساب مالك المشروع
    "mailQueue": {".read": IS_FULL, **w(IS_ADMIN),
                  "$qid": {**w(f"{IS_MEMBER} && !data.exists() && ({IS_PARTNER(n('to'))} || {REL_TO(n('to'))})"), **MAILQ}},
    "reviews": {
        ".read": any_of(can('reviews'), f"({IS_MEMBER} && {query('authorId', ME)})"),
        **w(can('reviews')), ".indexOn": ["authorId"],
        "$rid": {**w(f"{IS_MEMBER} && {LIVE} && {REVIEW_CREATE}"), **REVIEW},
    },
    # نسخة التقييم المعتمد لدى الطرف المستهدف: يقرأ كل عضو ما اعتُمد له فقط
    "approvedReviews": {".read": can('reviews'), **w(can('reviews')),
                        "$mid": {".read": f"auth != null && {ME} === $mid", "$rid": REVIEW}},
    "notifications": {
        ".read": IS_ADMIN, **w(IS_ADMIN),
        "$to": {
            ".read": f"auth != null && {ME} === $to",
            "$nid": {
                # الإنشاء: الزائر للإدارة فقط، والعضو للإدارة أو لطرفه المرتبط؛ ويعدّل العضو إشعاراته هو
                ".write": f"(!data.exists() && newData.child('text').isString() && newData.child('text').val().length <= 500 && ($to === 'admin' || ({IS_MEMBER} && ({IS_PARTNER('$to')} || {REL_TO('$to')})))) || (auth != null && {ME} === $to)",
                **NOTIF,
            },
        },
    },
    # الدعم الفني والإداري: العضو يقرأ محادثاته فقط ويضيف رسائله، والإدارة (صلاحية الرسائل) تقرأ وتردّ
    "tickets": {
        ".read": any_of(can('messages'), f"({IS_MEMBER} && {query('memberId', ME)})"), **w(can('messages')), ".indexOn": ["memberId"],
        "$tid": {
            **TICKET,
            # العضو ينشئ محادثته دون رسائل، ثم يضيف رسائله واحدة واحدة (كلها «من العضو»)
            ".write": f"{IS_MEMBER} && !data.exists() && {n('memberId')} === {ME} && {n('status')} === 'open' && !newData.child('messages').exists()",
            "messages": {"$mid": {**MSG, ".write": f"{IS_MEMBER} && !data.exists() && {n('from')} === 'member' && {OWN_TICKET} && {R}tickets/' + $tid + '/status').val() !== 'closed'"}},
            "updatedAt": {**NUM, ".write": f"{IS_MEMBER} && {OWN_TICKET}"},
            "lastFrom": {**one_of('member', 'admin'), ".write": f"{IS_MEMBER} && {OWN_TICKET} && newData.val() === 'member'"},
            # العضو يعيد فتح المحادثة عند رده فقط، ولا يكتب في محادثة مغلقة
            "status": {**one_of('open', 'answered', 'closed'), ".write": f"{IS_MEMBER} && {OWN_TICKET} && newData.val() === 'open' && data.val() !== 'closed'"},
            "unreadAdmin": {**BOOL, ".write": f"{IS_MEMBER} && {OWN_TICKET} && newData.val() === true"},
            "unreadMember": {**BOOL, ".write": f"{IS_MEMBER} && {OWN_TICKET} && newData.val() === false"},
        },
    },
    # اسم المشرف الذي ردّ على المحادثة: للإدارة فقط (لا يراه العضو)
    "ticketStaff": {".read": can('messages'), **w(can('messages')), "$tid": {"$mid": s(120)}},
    # الجلسات الإضافية: تفعّلها الإدارة، وبعدها يضيف كل مرشد مواعيده ويحجز منها أي مستفيد
    "extraConfig": {".read": True, **w(can('sessions')), "enabled": BOOL, "ts": NUM, "by": s(120)},
    # موعد إضافي محجوز (يُكتب عند الحجز فيراه بقية المستفيدين محجوزاً)
    "extraTaken": {".read": f"{IS_MEMBER} || {IS_ADMIN}", **w(can('sessions')),
                   "$sid": {".write": (f"{IS_MEMBER} && !data.exists() && newData.val() === true && {EXTRA_ON} && ({R}bookings/x_' + $sid + '/menteeId').val() === {ME}"
                                 f" || {SLOT_MENTOR} === {ME} || {REL_TO(SLOT_MENTOR)})"),
                            ".validate": "newData.val() === true"}},
    # علاقة مستفيد بمرشد (تسمح بتبادل الإشعارات بينهما بعد حجز جلسة إضافية)
    "extraPairs": {".read": can('sessions'), **w(can('sessions')),
                   "$k": {".write": f"{IS_MEMBER} && newData.val() === true && {EXTRA_ON} && {R}members/' + {ME} + '/role').val() === 'mentee' && $k.beginsWith({ME} + '_')",
                          ".validate": "newData.val() === true"}},
    "interests": {".read": can('interests'), **w(can('interests')), "$id": {**w("!data.exists()"), **INTEREST}},
    "regform": {".read": True, **w(can('announce')), "fields": {"$fid": REG_FIELD}, "seeded": BOOL},
    "registrations": {".read": can('announce'), **w(can('announce')), ".indexOn": ["cohort"],
                      "$id": {**w("!data.exists() && !newData.child('status').exists() && !newData.child('memberId').exists()"), **REGISTRATION}},
    "eventRegs": {".read": can('events', 'certificates'), **w(can('events')),
                  "$rid": {**w(f"(!data.exists() && newData.child('eventId').isString() && (!newData.child('memberId').exists() || (auth != null && {ME} === {n('memberId')}))) || (data.exists() && !newData.exists() && auth != null && {ME} === {d('memberId')})"),
                           **EVENT_REG}},
    "myRegs": {".read": can('events', 'cohorts'), **w(can('events', 'cohorts')),
               "$mid": {".read": f"auth != null && {ME} === $mid", ".write": f"auth != null && {ME} === $mid",
                        "$eid": fields({"regId": ID, "ts": NUM})}},
    # إدارة المشرفين والصلاحيات: للحسابات الرئيسية فقط
    "admins": {
        ".read": OWNER, **w(OWNER),
        "$uid": {
            ".read": "auth != null && auth.uid === $uid",
            # تفعيل دعوة Google: البريد مدعو ومُتحقَّق منه، والدور والصلاحيات مطابقة للدعوة تماماً
            ".write": f"auth != null && auth.uid === $uid && !data.exists() && newData.exists() && auth.token.email_verified === true && {INV}.exists() && {n('role')} === {INV}.child('role').val() && " + " && ".join(f"newData.child('perms/{p}').val() === {INV}.child('perms/{p}').val()" for p in PERMS),
        },
    },
    "adminInvites": {
        ".read": OWNER, **w(OWNER),
        # المدعو يقرأ دعوته (ليأخذ منها الدور والصلاحيات) ويحذفها بعد التفعيل
        "$key": {
            ".read": "auth != null && auth.token.email_verified === true && auth.token.email.toLowerCase().replace('.', ',') === $key",
            ".write": f"auth != null && auth.token.email_verified === true && auth.token.email.toLowerCase().replace('.', ',') === $key && !newData.exists() && {R}admins/' + auth.uid).exists()",
        },
    },
    # سجل إجراءات المشرفين: يضيف إليه أي مشرف ولا يُعدَّل
    "adminLog": {"$id": {**w(f"{IS_ADMIN} && !data.exists() && newData.child('by/uid').val() === auth.uid"), **LOG}},
}

out = {"rules": {ROOT: rules}}
path = BASE / 'database.rules.json'
path.write_text(json.dumps(out, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
print('written', path, '| owners', len(OWNERS), '| perms', PERMS)
