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
import re
import sys
import time

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

    # 导入已有凭据（浏览器 / App WebView 导出），跳过登录
    def import_cookie(self, cookie_string='', account='', token=''):
        n = 0
        if token:
            self.s.cookies.set('user_token', token.strip(), domain='c.zanao.com')
            n += 1
        for part in re.split(r'[;\n]+', cookie_string or ''):
            part = part.strip()
            if not part or '=' not in part:
                continue
            k, v = part.split('=', 1)
            k, v = k.strip(), v.strip()
            if not k:
                continue
            if k.lower() in ('path', 'domain', 'expires', 'max-age', 'samesite',
                             'secure', 'httponly', 'priority'):
                continue
            self.s.cookies.set(k, v, domain='c.zanao.com')
            n += 1
        if n:
            self.persist(account)
        st = self.status()
        return {'imported': n, 'session': st, 'cookies': sorted(self.s.cookies.get_dict().keys())}


def pick(d, keys):
    out = {}
    for k in keys:
        if isinstance(d, dict) and k in d:
            out[k] = d[k]
    return out


# ---------------- 批量收割 + 无关信息过滤 ----------------

# 默认噪声：与信息检索无关的刷屏/活动类
NOISE_DEFAULT = r'抽奖|接龙|拼单|砍一刀|助力|投票|互赞|打卡签到|横幅|公告更新'

_PUNCT = re.compile(r'[\s\W_]+', re.U)


def norm_title(t):
    return _PUNCT.sub('', (t or '')).lower()


def score_text(title, body, terms):
    """标题命中 3 分，正文命中 1 分。返回 (score, hits)。"""
    tt, bb = (title or '').lower(), (body or '').lower()
    s, hits = 0, []
    for t in terms:
        tl = t.lower()
        if not tl:
            continue
        if tl in tt:
            s += 3
            hits.append(t)
        elif tl in bb:
            s += 1
            hits.append(t)
    return s, hits


def harvest(w, keyword='', pages=3, per_page=20, min_likes=0, min_comments=0,
            cate='', exclude='', fetch_detail=0, sleep_s=0.6, out='', since_days=0):
    terms = [t for t in re.split(r'[,，\s]+', keyword or '') if t]
    noise = re.compile(exclude or NOISE_DEFAULT)
    stats = {'pages': 0, 'scanned': 0, 'dropped_noise': 0, 'dropped_cate': 0,
             'dropped_threshold': 0, 'dropped_irrelevant': 0, 'dropped_dup': 0,
             'kept': 0}
    errs = []
    seen = {}
    pool = []
    cutoff = time.time() - since_days * 86400 if since_days else 0

    for p in range(1, pages + 1):
        r = w.call('/thread/v2/list', {'page': p, 'per_page': per_page})
        j = r.get('json') or {}
        if j.get('errno') != 0:
            errs.append({'page': p, 'errno': j.get('errno'), 'errmsg': j.get('errmsg')})
            break
        lst = ((j.get('data') or {}).get('list') or [])
        stats['pages'] += 1
        if not lst:
            break
        for it in lst:
            stats['scanned'] += 1
            title = it.get('title') or ''
            if noise.search(title):
                stats['dropped_noise'] += 1
                continue
            if cate and cate not in (it.get('cate_name') or ''):
                stats['dropped_cate'] += 1
                continue
            lc, cc = int(it.get('l_count') or 0), int(it.get('c_count') or 0)
            if lc < min_likes or cc < min_comments:
                stats['dropped_threshold'] += 1
                continue
            if cutoff:
                ct = it.get('create_time') or it.get('created_at') or 0
                ts = 0
                try:
                    ts = int(ct)
                except Exception:
                    ts = 0
                if ts > 1e12:
                    ts //= 1000
                if ts and ts < cutoff:
                    stats['dropped_irrelevant'] += 1
                    continue
            row = {'thread_id': str(it.get('thread_id') or ''), 'title': title,
                   'nickname': it.get('nickname'), 'is_anon': it.get('is_anon'),
                   'cate_name': it.get('cate_name'), 'l_count': lc, 'c_count': cc,
                   'create_time': it.get('create_time')}
            pool.append(row)
        if p < pages:
            time.sleep(sleep_s)

    # 标题去重（保留互动更高的一条）
    dedup = []
    for row in pool:
        k = norm_title(row['title'])
        if not k:
            stats['dropped_irrelevant'] += 1
            continue
        if k in seen:
            stats['dropped_dup'] += 1
            old = seen[k]
            if (row['l_count'] + row['c_count']) > (old['l_count'] + old['c_count']):
                dedup[dedup.index(old)] = row
                seen[k] = row
            continue
        seen[k] = row
        dedup.append(row)

    # 关键词相关性
    if terms:
        keep = []
        to_check = [r for r in dedup if score_text(r['title'], '', terms)[0] == 0]
        need_detail = to_check[:max(0, fetch_detail)] if fetch_detail else []
        body_map = {}
        for row in need_detail:
            d = w.call('/thread/info', {'id': row['thread_id']})
            dj = d.get('json') or {}
            det = ((dj.get('data') or {}).get('detail') or {})
            body_map[row['thread_id']] = (det.get('content') or '') + ' ' + (det.get('title') or '')
            time.sleep(sleep_s)
        for row in dedup:
            sc, hits = score_text(row['title'], body_map.get(row['thread_id'], ''), terms)
            row['score'] = sc
            row['hits'] = hits
            if sc > 0:
                keep.append(row)
            else:
                stats['dropped_irrelevant'] += 1
        dedup = keep

    dedup.sort(key=lambda r: (r.get('score', 0), r['l_count'] + r['c_count']), reverse=True)
    stats['kept'] = len(dedup)

    if errs and stats['pages'] == 0:
        first = errs[0]
        return {'ok': False, 'errno': first.get('errno'), 'errmsg': first.get('errmsg'),
                'needs_login': first.get('errno') == 20, 'keyword': keyword,
                'stats': stats, 'errors': errs, 'items': []}

    result = {'ok': True, 'keyword': keyword, 'stats': stats, 'errors': errs,
              'items': dedup}
    if out:
        with open(out, 'w', encoding='utf-8') as f:
            json.dump(result, f, ensure_ascii=False, indent=2)
        result['out'] = out
    return result



def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('cmd')
    ap.add_argument('--session', default=SESSION_PATH)
    ap.add_argument('--account')
    ap.add_argument('--password')
    ap.add_argument('--cookie')
    ap.add_argument('--token')
    ap.add_argument('--cookie-file')
    ap.add_argument('--id')
    ap.add_argument('--thread-id')
    ap.add_argument('--comment-id')
    ap.add_argument('--school-id')
    ap.add_argument('--keyword')
    ap.add_argument('--page', type=int, default=1)
    ap.add_argument('--per-page', type=int, default=10)
    ap.add_argument('--limit', type=int, default=20)
    ap.add_argument('--pages', type=int, default=3)
    ap.add_argument('--min-likes', type=int, default=0)
    ap.add_argument('--min-comments', type=int, default=0)
    ap.add_argument('--since-days', type=int, default=0)
    ap.add_argument('--cate', default='')
    ap.add_argument('--exclude', default='')
    ap.add_argument('--fetch-detail', type=int, default=0)
    ap.add_argument('--sleep', type=float, default=0.6)
    ap.add_argument('--out', default='')
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

    if a.cmd == 'import':
        raw = a.cookie or ''
        if a.cookie_file:
            with open(a.cookie_file, 'r', encoding='utf-8') as f:
                raw = f.read()
        if not raw and not a.token:
            sys.exit('import 需要 --cookie "k=v; k2=v2"、--cookie-file 文件，或 --token 值')
        print(json.dumps(w.import_cookie(raw, a.account or '', a.token or ''),
                         ensure_ascii=False, indent=2))
        return

    if a.cmd == 'diagnose':
        probes = ['/user/v1/profile', '/thread/v2/list', '/thread/search',
                  '/community/list', '/community/info', '/common/stp']
        rows = []
        for p in probes:
            r = w.call(p, {}, timeout=12)
            j = r.get('json') or {}
            rows.append({'path': p, 'http': r.get('http'), 'errno': j.get('errno'),
                         'errmsg': j.get('errmsg')})
        session = w.status()
        reachable = [r['path'] for r in rows if r.get('errno') == 0]
        print(json.dumps({
            'session': session,
            'anonymous_reachable': reachable,
            'probes': rows,
            'next': ('已有会话，可直接 harvest/search' if session.get('ok') else
                     '无会话：内容接口一律 errno 20。可用入口只有 '
                     '/user/loginpost（账号密码）或 zanao_import_cookie（导入 user_token）')
        }, ensure_ascii=False, indent=2))
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

    if a.cmd == 'search':
        if not a.keyword:
            sys.exit('search 需要 --keyword')
        last = {}
        for path in ('/thread/search', '/thread/v2/search'):
            r = w.call(path, {'keyword': a.keyword, 'page': a.page, 'per_page': a.per_page})
            j = r.get('json') or {}
            last = j
            if j.get('errno') == 0:
                items = ((j.get('data') or {}).get('list') or [])
                print(json.dumps({'ok': True, 'errno': 0, 'endpoint': path,
                                  'keyword': a.keyword,
                                  'items': [pick(x, ['thread_id', 'title', 'nickname',
                                                     'headimgurl', 'is_anon', 'cate_name',
                                                     'c_count', 'l_count', 'create_time'])
                                            for x in items]}, ensure_ascii=False, indent=2))
                return
        print(json.dumps({'ok': False, 'errno': last.get('errno'),
                          'errmsg': last.get('errmsg'), 'keyword': a.keyword},
                         ensure_ascii=False, indent=2))
        return

    if a.cmd == 'harvest':
        res = harvest(w, keyword=a.keyword or '', pages=a.pages, per_page=a.per_page,
                      min_likes=a.min_likes, min_comments=a.min_comments,
                      cate=a.cate, exclude=a.exclude, fetch_detail=a.fetch_detail,
                      sleep_s=a.sleep, out=a.out, since_days=a.since_days)
        res['items'] = res['items'][:a.limit] if a.limit else res['items']
        print(json.dumps(res, ensure_ascii=False, indent=2))
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
