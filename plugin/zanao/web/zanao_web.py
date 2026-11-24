#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
zanao_web.py — 校园集市 **网页网关**客户端（无 root、无 frida、不碰手机）

关键事实（已实测）：
  · 网页网关 base = https://c.zanao.com/sc-api
  · 只认 **Cookie 会话** + `X-Sc-Client: h5`，**不需要 X-Sc-Ah 签名**
    （未登录时统一返回 {"errno":20,"errmsg":"登录中..."}）
  · 登录入口：POST /user/loginpost {"account","password"}（账号密码）
  · 未认证访问 /thread/info、/comment/list、/user/usershow、/user/certinfo 都是 20 → 登录即可用

因此普通用户可以：装插件 → 填账号密码（或用已有的网页会话 cookie）→ 以自己身份读集市。

用法：
  python zanao_web.py login --account 手机号 --password 密码
  python zanao_web.py status
  python zanao_web.py whoami
  python zanao_web.py thread-list --per-page 10
  python zanao_web.py thread-info --id 2185836881
  python zanao_web.py comments --id 2185836881
  python zanao_web.py user-show --thread-id 2185836881
  python zanao_web.py certinfo --school-id z0A9
  python zanao_web.py raw --path /thread/v2/list --data '{"page":1}'

会话文件默认 ~/.zanao/session.json（cookie + 账号尾号），可用 --session 指定。
"""
import argparse
import json
import os
import sys

import requests

BASE = 'https://c.zanao.com/sc-api'
SESSION_PATH = os.path.expanduser('~/.zanao/session.json')
UA = ('Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) '
      'Chrome/120.0.0.0 Mobile Safari/537.36')

HDRS = {
    'X-Sc-Client': 'h5',
    'X-Requested-With': 'XMLHttpRequest',
    'Origin': 'https://c.zanao.com',
    'Referer': 'https://c.zanao.com/',
    'Accept': 'application/json, text/plain, */*',
}


def load(path):
    try:
        with open(path, 'r', encoding='utf-8') as f:
            return json.load(f)
    except Exception:
        return {}


def save(path, data):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    try:
        os.chmod(path, 0o600)
    except Exception:
        pass


class Web:
    def __init__(self, path=SESSION_PATH):
        self.path = path
        self.s = requests.Session()
        self.s.headers.update(HDRS)
        self.s.headers['User-Agent'] = UA
        st = load(path)
        for k, v in (st.get('cookies') or {}).items():
            self.s.cookies.set(k, v, domain='c.zanao.com')

    def persist(self, account=''):
        save(self.path, {'cookies': self.s.cookies.get_dict(), 'account': account})

    def call(self, path, data=None, method='POST', timeout=20):
        url = BASE + path
        if method == 'GET':
            r = self.s.get(url, params=data or {}, timeout=timeout)
        else:
            r = self.s.post(url, json=data or {}, timeout=timeout)
        try:
            j = r.json()
        except Exception:
            return {'http': r.status_code, 'json': None, 'raw': r.text[:300]}
        return {'http': r.status_code, 'json': j}

    # ---- 命令 ----
    def login(self, account, password):
        r = self.call('/user/loginpost', {'account': account, 'password': password})
        j = r.get('json') or {}
        ok = j.get('errno') == 0
        if ok:
            self.persist(account)
        return {'ok': ok, 'errno': j.get('errno'), 'errmsg': j.get('errmsg'),
                'cookies': sorted(self.s.cookies.get_dict().keys())}

    def status(self):
        r = self.call('/user/v1/profile', {})
        j = r.get('json') or {}
        errno = j.get('errno')
        return {'ok': errno == 0, 'errno': errno, 'errmsg': j.get('errmsg'),
                'needs_login': errno == 20}


def pick(d, keys):
    out = {}
    for k in keys:
        if isinstance(d, dict) and k in d:
            out[k] = d[k]
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('cmd')
    ap.add_argument('--session', default=SESSION_PATH)
    ap.add_argument('--account')
    ap.add_argument('--password')
    ap.add_argument('--id')
    ap.add_argument('--thread-id')
    ap.add_argument('--comment-id')
    ap.add_argument('--school-id')
    ap.add_argument('--page', type=int, default=1)
    ap.add_argument('--per-page', type=int, default=10)
    ap.add_argument('--limit', type=int, default=20)
    ap.add_argument('--path')
    ap.add_argument('--method', default='POST')
    ap.add_argument('--data', default='{}')
    a = ap.parse_args()

    w = Web(a.session)

    if a.cmd == 'login':
        if not (a.account and a.password):
            sys.exit('login 需要 --account 与 --password')
        print(json.dumps(w.login(a.account, a.password), ensure_ascii=False, indent=2))
        return

    if a.cmd == 'status':
        print(json.dumps(w.status(), ensure_ascii=False, indent=2))
        return

    if a.cmd == 'whoami':
        r = w.call('/user/v1/profile', {})
        j = r.get('json') or {}
        u = ((j.get('data') or {}).get('user_info') or {})
        print(json.dumps({'ok': j.get('errno') == 0, 'errno': j.get('errno'),
                          'user_id': u.get('user_id'), 'nickname': u.get('nickname'),
                          'cert_status': u.get('cert_status')}, ensure_ascii=False, indent=2))
        return

    if a.cmd == 'thread-list':
        r = w.call('/thread/v2/list', {'page': a.page, 'per_page': a.per_page})
        j = r.get('json') or {}
        items = ((j.get('data') or {}).get('list') or [])
        print(json.dumps({'ok': j.get('errno') == 0, 'errno': j.get('errno'),
                          'items': [pick(x, ['thread_id', 'title', 'nickname', 'headimgurl',
                                             'is_anon', 'cate_name', 'c_count', 'l_count'])
                                    for x in items]}, ensure_ascii=False, indent=2))
        return

    if a.cmd == 'thread-info':
        r = w.call('/thread/info', {'id': a.id})
        j = r.get('json') or {}
        d = ((j.get('data') or {}).get('detail') or {})
        print(json.dumps({'ok': j.get('errno') == 0, 'errno': j.get('errno'),
                          'detail': pick(d, ['thread_id', 'title', 'nickname', 'headimgurl',
                                             'is_anon', 'contact_person', 'contact_phone', 'contact_qq'])},
                         ensure_ascii=False, indent=2))
        return

    if a.cmd == 'comments':
        r = w.call('/comment/list', {'id': a.id, 'page': a.page})
        j = r.get('json') or {}
        lst = ((j.get('data') or {}).get('list') or [])[:a.limit]
        print(json.dumps({'ok': j.get('errno') == 0, 'errno': j.get('errno'),
                          'total': (j.get('data') or {}).get('total'),
                          'items': [pick(x, ['comment_id', 'nickname', 'headimgurl', 'content', 'is_author'])
                                    for x in lst]}, ensure_ascii=False, indent=2))
        return

    if a.cmd == 'user-show':
        d = {'comment_id': a.comment_id} if a.comment_id else {'thread_id': a.thread_id}
        r = w.call('/user/usershow', d)
        j = r.get('json') or {}
        u = ((j.get('data') or {}).get('user_info') or {})
        print(json.dumps({'ok': j.get('errno') == 0, 'errno': j.get('errno'),
                          'user': pick(u, ['nickname', 'headimgurl', 'school_name', 'reg_days',
                                           'user_level', 'user_level_title'])},
                         ensure_ascii=False, indent=2))
        return

    if a.cmd == 'certinfo':
        r = w.call('/user/certinfo', {'school_id': a.school_id}, method='GET')
        j = r.get('json') or {}
        ci = ((j.get('data') or {}).get('cert_info') or {})
        print(json.dumps({'ok': j.get('errno') == 0, 'errno': j.get('errno'),
                          'keys': sorted(ci.keys()),
                          'realname_present': bool(ci.get('realname')),
                          'student_no_present': bool(ci.get('student_no')),
                          'has_cert_img': bool(ci.get('cert_img')),
                          'school_name': ci.get('school_name')}, ensure_ascii=False, indent=2))
        return

    if a.cmd == 'raw':
        r = w.call(a.path, json.loads(a.data), method=a.method)
        print(json.dumps({'http': r['http'], 'json': r['json'], 'raw': r.get('raw')},
                         ensure_ascii=False, indent=2)[:4000])
        return

    sys.exit('未知命令: ' + a.cmd)


if __name__ == '__main__':
    main()
