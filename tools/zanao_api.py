#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
zanao_api.py — 校园集市 API 客户端（签名走 Frida oracle，不还原 native 算法）

协议事实（来源: jadx + assets/prod 反混淆）
  URL      = CONST_API_HOST + pathname + url
  headers  = X-Sc-Token / X-Sc-Client:app / X-Sc-Device / X-Sc-Platform /
             X-Sc-Hb-V / X-Sc-Nt-V / X-Sc-Version / X-Sc-Nd(20位随机) /
             X-Sc-Td(10位秒时间戳) / X-Sc-Alias(社区别名) / X-Sc-Ah(签名)
  签名输入 = TreeMap{ timestamp__:X-Sc-Td, randnum__:X-Sc-Nd, ...data }
  响应加密 = header X-Data-Encrypt:1 或 body {__encrypt__:1,__data__:...}
             -> JniUtils.unhashAppResult()

用法:
  python zanao_api.py --token <X-Sc-Token> [--alias <alias_name>] [--school-id 1]
         [--device <deviceId>] <command> [args...]

命令:
  ping
  avatar-threads  --page 1
  avatar-comments --thread-id 123
  usershow        --thread-id 123 | --comment-id 456
  mx-usershow     --uid 9999
  mx-userinfo     --uid 9999
  thread-userinfo --uid 9999
  thread-user     --uid 9999
  certinfo
  certinfo-probe  --uid 9999
  raw --method POST --path /sc-api/xxx --data '{"k":"v"}'
"""
import argparse
import json
import os
import random
import string
import sys
import time

import requests
from requests.adapters import HTTPAdapter

try:
    import frida
except ImportError:
    frida = None

HOST_HTTP = "http://api.app.zanao.com"
HOST_HTTPS = "https://api.app.zanao.com"
UA = "okhttp/4.9.3"


class Oracle:
    """通过 Frida 调用 App 内 JniUtils.makeSign / unhashAppResult"""

    def __init__(self, host="127.0.0.1:39999", pid=None, spawn=None):
        if frida is None:
            raise RuntimeError("需要 frida: pip install frida")
        self.dev = frida.get_device_manager().add_remote_device(host)
        if pid is not None:
            self.session = self.dev.attach(int(pid))
        elif spawn:
            p = self.dev.spawn([spawn])
            self.session = self.dev.attach(p)
            try:
                self.dev.resume(p)
            except Exception:
                pass
        else:
            self.session = self.dev.attach("com.comingx.zanao")
        js = os.path.join(os.path.dirname(os.path.abspath(__file__)), "zanao_oracle.js")
        with open(js, "r", encoding="utf-8") as f:
            src = f.read()
        self.script = self.session.create_script(src)
        self.script.on("message", lambda m, d: print("[frida] %s" % (m,), file=sys.stderr))
        self.script.load()

    def sign(self, fields):
        return self.script.exports_sync.sign(fields)

    def unhash_app(self, s):
        return self.script.exports_sync.unhash_app(s)


def rand_num(n=20):
    return "".join(random.choice(string.digits) for _ in range(n))


class Zanao:
    def __init__(self, oracle, token, alias="", device="", platform="android",
                 nt_v="310", ver="3.1.0", hb_v="2.0.0", scheme="https"):
        self.o = oracle
        self.token = token
        self.alias = alias
        self.device = device
        self.platform = platform
        self.nt_v = nt_v
        self.ver = ver
        self.hb_v = hb_v
        self.base = HOST_HTTPS if scheme == "https" else HOST_HTTP
        self.s = requests.Session()
        self.s.mount("http://", HTTPAdapter(max_retries=1))
        self.s.mount("https://", HTTPAdapter(max_retries=1))

    def call(self, pathname, url, data=None, method="POST", timeout=15):
        data = data or {}
        nd = rand_num(20)
        td = str(int(time.time()))
        sign_input = {"timestamp__": td, "randnum__": nd}
        sign_input.update({k: v for k, v in data.items()})
        ah = self.o.sign(sign_input)

        headers = {
            "X-Sc-Alias": self.alias,
            "X-Sc-Token": self.token,
            "X-Sc-Client": "app",
            "X-Sc-Device": self.device,
            "X-Sc-Platform": self.platform,
            "X-Sc-Hb-V": self.hb_v,
            "X-Sc-Nt-V": self.nt_v,
            "X-Sc-Version": self.ver,
            "X-Sc-Nd": nd,
            "X-Sc-Td": td,
            "X-Sc-Ah": ah,
            "X-Requested-With": "XMLHttpRequest",
            "User-Agent": UA,
            "Content-Type": "application/json; charset=utf-8",
        }
        full = self.base + pathname + url
        if method.upper() == "GET":
            r = self.s.get(full, params=data, headers=headers, timeout=timeout)
        else:
            r = self.s.post(full, data=json.dumps(data, ensure_ascii=False).encode(),
                            headers=headers, timeout=timeout)
        return r

    @staticmethod
    def body(resp, oracle):
        raw = resp.text
        if (resp.headers.get("X-Data-Encrypt") == "1"
                or resp.headers.get("x-sc-encrypt") == "1"):
            raw = oracle.unhash_app(raw)
        try:
            j = json.loads(raw)
        except Exception:
            return {"_raw": raw[:2000], "_status": resp.status_code}
        if isinstance(j, dict) and j.get("__encrypt__") and j.get("__data__"):
            try:
                j = json.loads(oracle.unhash_app(j["__data__"]))
            except Exception as e:
                j["_decrypt_error"] = str(e)
        j["_status"] = resp.status_code
        return j


def show(title, obj):
    print("\n=== %s ===" % title)
    print(json.dumps(obj, ensure_ascii=False, indent=2)[:6000])


def pick_user_info(obj):
    """从响应里捞出与身份相关的字段（含可能出现的实名/学号）"""
    keys = {"nickname", "headimgurl", "realname", "student_no", "cert_img",
            "cert_img_url", "uid", "user_id", "reg_days", "school_id", "cert_valid"}
    found = {}

    def walk(o, path=""):
        if isinstance(o, dict):
            for k, v in o.items():
                if k in keys and not isinstance(v, (dict, list)):
                    found[path + "." + k] = v
                walk(v, path + "." + k)
        elif isinstance(o, list):
            for i, v in enumerate(o[:3]):
                walk(v, path + "[%d]" % i)

    walk(obj)
    return found


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--token", required=True)
    ap.add_argument("--alias", default="")
    ap.add_argument("--device", default="")
    ap.add_argument("--school-id", default="1")
    ap.add_argument("--scheme", default="https", choices=["http", "https"])
    ap.add_argument("--frida-host", default="127.0.0.1:39999")
    ap.add_argument("--pid", default=None)
    ap.add_argument("--spawn", default=None)
    ap.add_argument("cmd")
    ap.add_argument("--page", default=1, type=int)
    ap.add_argument("--uid")
    ap.add_argument("--thread-id")
    ap.add_argument("--comment-id")
    ap.add_argument("--method", default="POST")
    ap.add_argument("--path", default="")
    ap.add_argument("--data", default="{}")
    a = ap.parse_args()

    o = Oracle(a.frida_host, pid=a.pid, spawn=a.spawn)
    c = Zanao(o, a.token, alias=a.alias, device=a.device, scheme=a.scheme)

    if a.cmd == "ping":
        show("makeSign oracle", {"sign": o.sign({"timestamp__": "1700000000",
                                                 "randnum__": "1" * 20})})
        return

    if a.cmd == "avatar-threads":
        r = c.call("/sc-api", "/thread/v2/list", {"page": a.page, "per_page": 20})
        show("POST /sc-api/thread/v2/list", pick_user_info(c.body(r, o)))

    elif a.cmd == "avatar-comments":
        r = c.call("/sc-api", "/comment/list", {"thread_id": a.thread_id, "page": a.page})
        show("POST /sc-api/comment/list", pick_user_info(c.body(r, o)))

    elif a.cmd == "usershow":
        d = {"comment_id": a.comment_id} if a.comment_id else {"thread_id": a.thread_id}
        r = c.call("/sc-api", "/user/usershow", d)
        show("POST /sc-api/user/usershow %s" % d, pick_user_info(c.body(r, o)))

    elif a.cmd == "mx-usershow":
        r = c.call("/sc-api", "/mx/user/usershow", {"uid": a.uid})
        show("POST /sc-api/mx/user/usershow uid=%s" % a.uid, pick_user_info(c.body(r, o)))

    elif a.cmd == "mx-userinfo":
        r = c.call("/sc-api", "/mx/admin/userinfo", {"uid": a.uid})
        show("POST /sc-api/mx/admin/userinfo uid=%s" % a.uid, pick_user_info(c.body(r, o)))

    elif a.cmd == "thread-userinfo":
        r = c.call("/sc-api", "/thread/admin/userinfo", {"uid": a.uid})
        show("POST /sc-api/thread/admin/userinfo uid=%s" % a.uid, pick_user_info(c.body(r, o)))

    elif a.cmd == "thread-user":
        r = c.call("/sc-api", "/thread/admin/userthread", {"uid": a.uid})
        show("POST /sc-api/thread/admin/userthread uid=%s" % a.uid, pick_user_info(c.body(r, o)))

    elif a.cmd == "certinfo":
        r = c.call("/sc-api", "/user/certinfo", {"school_id": a.school_id}, method="GET")
        show("GET /sc-api/user/certinfo (本人)", c.body(r, o))

    elif a.cmd == "certinfo-probe":
        base = {"school_id": a.school_id}
        variants = [
            dict(base, uid=a.uid), dict(base, user_id=a.uid), dict(base, id=a.uid),
            dict(base, target_uid=a.uid), {"uid": a.uid},
        ]
        for v in variants:
            r = c.call("/sc-api", "/user/certinfo", v, method="GET")
            j = c.body(r, o)
            ci = j.get("cert_info") or {}
            print("\n--- data=%s status=%s realname=%r student_no=%r" %
                  (v, j.get("_status"), ci.get("realname"), ci.get("student_no")))
            print(json.dumps(ci, ensure_ascii=False)[:800])

    elif a.cmd == "raw":
        r = c.call("", a.path, json.loads(a.data), method=a.method)
        show("%s %s" % (a.method, a.path), c.body(r, o))

    else:
        ap.error("unknown cmd")


if __name__ == "__main__":
    main()
