#!/usr/bin/env python3
"""يولّد database.rules.json من تعريف واحد للصلاحيات.

التشغيل:  python3 tools/build_rules.py
عدّل OWNERS أو PERM_NODES هنا ثم أعد التوليد وانشر الملف الناتج في Firebase.
يجب أن تطابق OWNERS قائمة ownerEmails في js/config.js.
"""
import json, pathlib

ROOT = 'ishraq'
OWNERS = ['g.hussainalhajji@gmail.com', 'ishraq.battaliyah@gmail.com', 'hzzahmed4@gmail.com']

UID = f"root.child('{ROOT}/uids/' + auth.uid)"
ME = f"{UID}.val()"
IS_MEMBER = f"auth != null && {UID}.exists()"
OWNER = "(auth != null && auth.token.email_verified === true && (" + " || ".join(f"auth.token.email === '{e}'" for e in OWNERS) + "))"
ADMIN_REC = f"root.child('{ROOT}/admins/' + auth.uid)"
IS_ADMIN = f"({OWNER} || (auth != null && {ADMIN_REC}.exists()))"
# صلاحية كاملة: حساب رئيسي، أو مشرف role=full، أو مشرف قديم بلا role (توافق مع ما قبل نظام الصلاحيات)
IS_FULL = f"({OWNER} || (auth != null && {ADMIN_REC}.exists() && ({ADMIN_REC}.child('role').val() === 'full' || !{ADMIN_REC}.child('role').exists())))"

# الصلاحيات الجزئية (يجب أن تطابق PERMISSIONS في js/security.js)
PERMS = ['content', 'cohorts', 'sessions', 'reviews', 'messages', 'announce', 'events', 'interests']

def can(*perms):
    parts = [IS_FULL] + [f"(auth != null && {ADMIN_REC}.child('perms/{p}').val() === true)" for p in perms]
    return "(" + " || ".join(parts) + ")"

def w(expr):
    return {".write": expr}

INV = f"root.child('{ROOT}/adminInvites/' + auth.token.email.toLowerCase().replace('.', ','))"

rules = {
    ".read": IS_ADMIN,
    "content": {".read": True, **w(can('content'))},
    "form": {".read": True, **w(can('content'))},
    "announcement": {".read": True, **w(can('announce'))},
    "events": {".read": True, **w(can('events'))},
    "featured": {".read": True, **w(can('reviews'))},
    "cohorts": {".read": True, **w(can('cohorts'))},
    # إطلاق الدفعة: يبدأ منه حساب نطاقات متابعة الجلسات
    "launches": {".read": True, **w(can('sessions'))},
    "meta": {
        ".read": True, **w(IS_FULL),
        "lastBackup": w(IS_ADMIN),
    },
    "members": {
        ".read": True, **w(can('cohorts')),
        "$mid": w(f"auth != null && {ME} === $mid && newData.exists() && newData.child('code').val() === data.child('code').val() && newData.child('role').val() === data.child('role').val() && newData.child('cohort').val() === data.child('cohort').val() && newData.child('seq').val() === data.child('seq').val() && newData.child('uid').val() === data.child('uid').val()"),
    },
    "contacts": {
        **w(can('cohorts')),
        "$mid": {
            ".read": f"{IS_MEMBER} && ({ME} === $mid || root.child('{ROOT}/network/' + root.child('{ROOT}/members/' + $mid + '/cohort').val() + '/' + {ME}).val() === $mid || root.child('{ROOT}/network/' + root.child('{ROOT}/members/' + $mid + '/cohort').val() + '/' + $mid).val() === {ME})",
            ".write": f"auth != null && {ME} === $mid",
        },
    },
    "secrets": w(can('cohorts')),
    "counters": w(can('cohorts')),
    "uids": {**w(can('cohorts')), "$uid": {".read": "auth != null && auth.uid === $uid"}},
    "network": {".read": IS_MEMBER, **w(can('cohorts'))},
    "messages": {".read": IS_MEMBER, **w(can('messages'))},
    "inbox": {**w(can('messages')), "$id": w(f"{IS_MEMBER} && !data.exists() && newData.child('fromId').val() === {ME}")},
    "slots": {".read": IS_MEMBER, **w(can('sessions')),
              "$sid": w(f"{IS_MEMBER} && ((data.exists() && data.child('mentorId').val() === {ME}) || (!data.exists() && newData.child('mentorId').val() === {ME}))")},
    "bookings": {".read": IS_MEMBER, **w(can('sessions')),
                 "$bid": w(f"{IS_MEMBER} && ((data.exists() && (data.child('mentorId').val() === {ME} || data.child('menteeId').val() === {ME})) || (!data.exists() && newData.child('menteeId').val() === {ME}))")},
    "reviews": {".read": IS_MEMBER, **w(can('reviews')),
                "$rid": w(f"{IS_MEMBER} && !data.exists() && newData.child('authorId').val() === {ME}")},
    "notifications": {
        **w(IS_ADMIN),
        "$to": {
            ".read": f"auth != null && {ME} === $to",
            "$nid": w(f"(!data.exists() && newData.child('text').isString() && newData.child('text').val().length <= 500) || (auth != null && {ME} === $to)"),
        },
    },
    "interests": {**w(can('interests')), "$id": w("!data.exists() && newData.child('role').isString()")},
    "eventRegs": {**w(can('events')),
                  "$rid": w(f"(!data.exists() && newData.child('eventId').isString() && (!newData.child('memberId').exists() || (auth != null && {ME} === newData.child('memberId').val()))) || (data.exists() && !newData.exists() && auth != null && {ME} === data.child('memberId').val())")},
    "myRegs": {**w(can('events', 'cohorts')),
               "$mid": {".read": f"auth != null && {ME} === $mid", ".write": f"auth != null && {ME} === $mid"}},
    # إدارة المشرفين والصلاحيات: للحسابات الرئيسية فقط
    "admins": {
        **w(OWNER),
        "$uid": {
            ".read": "auth != null && auth.uid === $uid",
            # تفعيل دعوة Google: البريد مدعو ومُتحقَّق منه، والدور والصلاحيات مطابقة للدعوة تماماً
            ".write": f"auth != null && auth.uid === $uid && !data.exists() && newData.exists() && auth.token.email_verified === true && {INV}.exists() && newData.child('role').val() === {INV}.child('role').val() && " + " && ".join(f"newData.child('perms/{p}').val() === {INV}.child('perms/{p}').val()" for p in PERMS),
        },
    },
    "adminInvites": {
        **w(OWNER),
        # المدعو يقرأ دعوته (ليأخذ منها الدور والصلاحيات) ويحذفها بعد التفعيل
        "$key": {
            ".read": "auth != null && auth.token.email_verified === true && auth.token.email.toLowerCase().replace('.', ',') === $key",
            ".write": "auth != null && auth.token.email_verified === true && auth.token.email.toLowerCase().replace('.', ',') === $key && !newData.exists() && root.child('ishraq/admins/' + auth.uid).exists()",
        },
    },
    # سجل إجراءات المشرفين: يضيف إليه أي مشرف ولا يُعدَّل
    "adminLog": {"$id": w(f"{IS_ADMIN} && !data.exists() && newData.child('by/uid').val() === auth.uid")},
}

out = {"rules": {ROOT: rules}}
path = pathlib.Path(__file__).resolve().parent.parent / 'database.rules.json'
path.write_text(json.dumps(out, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
print('written', path)
