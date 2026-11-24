#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""capture_token.py — spawn 目标 App，抓一条真实请求的 payload，打印 token/alias/device"""
import os, re, sys, time, json
import frida

HERE = os.path.dirname(os.path.abspath(__file__))
PKG = 'com.comingx.zanao'
HOST = '127.0.0.1:39999'

dev = frida.get_device_manager().add_remote_device(HOST)
pid = dev.spawn([PKG])
print('[+] spawned pid=%s' % pid)
session = dev.attach(pid)
captured = {}

def on_message(msg, data):
    if msg.get('type') != 'send':
        print('[frida]', msg)
        return
    p = msg['payload']
    print('[frida-payload]', {k: (v if k != 'body' else '<%d bytes>' % len(v)) for k, v in p.items()})
    if p.get('type') == 'payload':
        captured['body'] = p['body']

with open(os.path.join(HERE, 'capture.js'), 'r', encoding='utf-8') as f:
    src = f.read()
script = session.create_script(src)
script.on('message', on_message)
script.load()
dev.resume(pid)

for _ in range(40):
    if 'body' in captured:
        break
    time.sleep(0.5)

if 'body' not in captured:
    print('[-] 没抓到带 token 的请求；App 可能未登录或未发请求')
    sys.exit(1)

body = captured['body']
open(os.path.join(HERE, 'payload_sample.txt'), 'w', encoding='utf-8').write(body)
print('[+] payload saved, %d bytes' % len(body))

def find(key):
    m = re.search(re.escape(key) + r'\\?"\s*:\s*\\?"([^"\\]*)', body)
    return m.group(1) if m else None

print('TOKEN  =', find('X-Sc-Token'))
print('ALIAS  =', find('X-Sc-Alias'))
print('DEVICE =', find('X-Sc-Device'))
print('NT_V   =', find('X-Sc-Nt-V'))
print('VER    =', find('X-Sc-Version'))
m = re.search(r'(https?://[^"\\]+)', body)
print('URL    =', m.group(1) if m else None)
