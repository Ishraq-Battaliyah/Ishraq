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
PARTNER = f"{R}pairs/' + {ME})"          # طرف العضو المرتبط به
MY_ROLE = f"{R}members/' + {ME} + '/role').val()"
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
    "status": one_of('upcoming', 'done', 'absent_mentor', 'absent_mentee'), "ts": NUM,
    "doneByMentor": NUM_OR_BOOL, "doneByMentee": NUM_OR_BOOL, "statusTs": NUM, "statusBy": one_of('mentor', 'mentee', 'both', 'admin'),
    "changedBy": one_of('mentor', 'mentee', 'admin'),
    "history": {"$i": fields({"date": DATE, "start": TIME, "end": TIME, "by": one_of('mentor', 'mentee', 'admin'), "ts": NUM})},
}, required=('mentorId', 'menteeId', 'session', 'status'))

SLOT = fields({"id": ID, "mentorId": ID, "session": SESSION, "date": DATE, "start": TIME, "end": TIME,
               "mode": one_of('inperson', 'online', 'both'), "summary": s(1000), "ts": NUM},
              required=('mentorId', 'session', 'date'))

REVIEW = fields({
    "id": ID, "type": one_of('session', 'final', 'program'), "from": one_of('mentor', 'mentee'),
    "authorId": ID, "authorName": s(120), "targetId": {".validate": "newData.isString() && newData.val().length <= 60"},
    "mentorId": ID, "menteeId": ID, "bookingId": ID,
    "session": SESSION, "text": s(3000), "extra": s(3000), "status": one_of('pending', 'approved', 'rejected'),
    "featured": BOOL, "ts": NUM, "decidedAt": NUM,
}, required=('type', 'authorId', 'text', 'status'))

INTEREST = fields({"id": ID, "role": one_of('mentor', 'mentee'), "answers": {"$f": s(3000)}, "ts": NUM,
                   "source": s(200), "seen": BOOL}, required=('role',))

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
         "templates": {"$kind": {**CERT_TPL}},
         "names": {"$k": s(120)},
         "issued": {"$k": fields({"ts": NUM, "by": s(120), "via": s(20)})}}

CONTACT = fields({k: s(300) for k in ['whatsapp', 'email', 'linkedin', 'website', 'twitter', 'instagram']})

# ===== قواعد كتابة العضو =====
d = lambda k: f"data.child('{k}').val()"
n = lambda k: f"newData.child('{k}').val()"
BOOKING_CREATE = (f"!data.exists() && {n('menteeId')} === {ME} && {n('mentorId')} === {PARTNER}.val() && {n('status')} === 'upcoming'"
                  " && !newData.child('doneByMentor').exists() && !newData.child('doneByMentee').exists()")
BOOKING_UPDATE = (f"data.exists() && newData.exists() && {d('status')} === 'upcoming' && ({d('mentorId')} === {ME} || {d('menteeId')} === {ME})"
                  f" && {n('mentorId')} === {d('mentorId')} && {n('menteeId')} === {d('menteeId')} && {n('session')} === {d('session')}"
                  # كل طرف يؤكد عن نفسه فقط
                  f" && ({n('doneByMentor')} === {d('doneByMentor')} || {d('mentorId')} === {ME})"
                  f" && ({n('doneByMentee')} === {d('doneByMentee')} || {d('menteeId')} === {ME})"
                  # «منجزة» بتأكيد الطرفين فقط، وكل طرف يسجّل غياب الطرف الآخر فقط
                  f" && ({n('status')} === 'upcoming' || ({n('status')} === 'done' && newData.child('doneByMentor').exists() && newData.child('doneByMentee').exists())"
                  f" || ({n('status')} === 'absent_mentee' && {d('mentorId')} === {ME}) || ({n('status')} === 'absent_mentor' && {d('menteeId')} === {ME}))")
REVIEW_CREATE = (f"!data.exists() && {n('authorId')} === {ME}"
                 f" && ({n('targetId')} === 'admin' || {n('targetId')} === '' || {n('targetId')} === {PARTNER}.val())"
                 f" && ({n('status')} === 'pending' || ({n('type')} === 'program' && {n('status')} === 'approved' && {n('featured')} === false))")

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
            ".read": f"{IS_MEMBER} && ({ME} === $mid || {PARTNER}.val() === $mid)",
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
              "$mid": {".read": f"auth != null && {ME} === $mid", ".validate": "newData.isString() && newData.val().length <= 60"}},
    "messages": {
        ".read": any_of(can('messages'), f"({IS_MEMBER} && {query('aud', repr('all'), ME, MY_ROLE)})"),
        **w(can('messages')), ".indexOn": ["aud"],
    },
    "inbox": {".read": can('messages'), **w(can('messages')),
              "$id": {**w(f"{IS_MEMBER} && !data.exists() && {n('fromId')} === {ME}"), **INBOX}},
    "slots": {
        ".read": any_of(can('sessions', 'cohorts'), f"({IS_MEMBER} && {query('mentorId', ME, PARTNER + '.val()')})"),
        **w(can('sessions')), ".indexOn": ["mentorId"],
        "$sid": {**w(f"{IS_MEMBER} && ((data.exists() && {d('mentorId')} === {ME}) || (!data.exists() && {n('mentorId')} === {ME}))"), **SLOT},
    },
    "bookings": {
        ".read": any_of(can('sessions', 'cohorts', 'reviews'), f"({IS_MEMBER} && ({query('mentorId', ME)} || {query('menteeId', ME)}))"),
        **w(can('sessions')), ".indexOn": ["mentorId", "menteeId"],
        "$bid": {**w(f"{IS_MEMBER} && (({BOOKING_CREATE}) || ({BOOKING_UPDATE}))"), **BOOKING},
    },
    "reviews": {
        ".read": any_of(can('reviews'), f"({IS_MEMBER} && {query('authorId', ME)})"),
        **w(can('reviews')), ".indexOn": ["authorId"],
        "$rid": {**w(f"{IS_MEMBER} && {REVIEW_CREATE}"), **REVIEW},
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
                ".write": f"(!data.exists() && newData.child('text').isString() && newData.child('text').val().length <= 500 && ($to === 'admin' || ({IS_MEMBER} && {PARTNER}.val() === $to))) || (auth != null && {ME} === $to)",
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
    "interests": {".read": can('interests'), **w(can('interests')), "$id": {**w("!data.exists()"), **INTEREST}},
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
