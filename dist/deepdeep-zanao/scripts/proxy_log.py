#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
proxy_log.py — 极简 HTTP 记录代理（明文 HTTP 直接记录，HTTPS 走 CONNECT 隧道透传）

用途：让目标设备把 80 端口流量走这台机器，观察 api.app.zanao.com 的明文请求头/响应体。
      只记录，不改包、不注入。

用法:
    python tools/proxy_log.py 8899 tools/proxy.log
"""
import http.server
import socketserver
import socket
import select
import sys
import json
import threading
import time

import requests

LOG_PATH = None
INTEREST = ('api.app.zanao.com',)
lock = threading.Lock()


def log(line):
    with lock:
        ts = time.strftime('%H:%M:%S')
        msg = '[%s] %s' % (ts, line)
        print(msg, flush=True)
        if LOG_PATH:
            with open(LOG_PATH, 'a', encoding='utf-8') as f:
                f.write(msg + '\n')


class Handler(http.server.BaseHTTPRequestHandler):
    protocol_version = 'HTTP/1.1'
    server_version = 'proxylog'

    def log_message(self, fmt, *args):
        pass

    # ---------- 明文 http 转发 ----------
    def _forward(self):
        url = self.path
        length = int(self.headers.get('Content-Length') or 0)
        body = self.rfile.read(length) if length else b''
        host = self.headers.get('Host', '')
        interesting = any(h in url or h in host for h in INTEREST)

        if interesting:
            log('=== REQ %s %s' % (self.command, url))
            for k, v in self.headers.items():
                log('    %s: %s' % (k, v))
            if body:
                try:
                    log('    BODY: %s' % body.decode('utf-8', 'replace')[:2000])
                except Exception:
                    log('    BODY: <%d bytes>' % len(body))

        headers = {k: v for k, v in self.headers.items()
                   if k.lower() not in ('proxy-connection', 'connection', 'host',
                                        'content-length', 'accept-encoding')}
        try:
            r = requests.request(self.command, url, headers=headers, data=body if body else None,
                                 timeout=30, allow_redirects=False)
        except Exception as e:
            log('!!! upstream error %s: %s' % (url, e))
            self.send_error(502)
            return

        if interesting:
            txt = r.text[:3000] if r.content else ''
            log('=== RESP %s %s' % (r.status_code, url))
            if txt:
                log('    %s' % txt.replace('\n', ' '))

        self.send_response(r.status_code)
        for k, v in r.headers.items():
            if k.lower() in ('connection', 'transfer-encoding', 'content-length',
                             'content-encoding'):
                continue
            self.send_header(k, v)
        self.send_header('Content-Length', str(len(r.content)))
        self.end_headers()
        if r.content:
            self.wfile.write(r.content)

    do_GET = do_POST = do_PUT = do_DELETE = do_PATCH = do_HEAD = _forward

    # ---------- https 隧道透传 ----------
    def do_CONNECT(self):
        host, _, port = self.path.partition(':')
        port = int(port or 443)
        try:
            upstream = socket.create_connection((host, port), timeout=15)
        except Exception as e:
            log('!!! CONNECT fail %s: %s' % (self.path, e))
            self.send_error(502)
            return
        self.send_response(200, 'Connection Established')
        self.end_headers()
        conn = self.connection
        socks = [conn, upstream]
        try:
            while True:
                r, _, x = select.select(socks, [], socks, 30)
                if x:
                    break
                if conn in r:
                    d = conn.recv(65536)
                    if not d:
                        break
                    upstream.sendall(d)
                if upstream in r:
                    d = upstream.recv(65536)
                    if not d:
                        break
                    conn.sendall(d)
        except Exception:
            pass
        finally:
            try:
                upstream.close()
            except Exception:
                pass


class Server(socketserver.ThreadingTCPServer):
    allow_reuse_address = True
    daemon_threads = True


if __name__ == '__main__':
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8899
    LOG_PATH = sys.argv[2] if len(sys.argv) > 2 else None
    log('proxy listening on 0.0.0.0:%d (log=%s)' % (port, LOG_PATH))
    Server(('0.0.0.0', port), Handler).serve_forever()
