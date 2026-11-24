#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
zanao_cli.py — 校园集市（com.comingx.zanao）只读查询 CLI

签名在目标 App 进程里完成（JniUtils.makeSign），所以本工具依赖：
  · 一台已登录校园集市的 Android 设备（建议 root + frida-server）
  · PC 侧 frida CLI（frida 17 只有 CLI 带 Java bridge）
  · adb forward <host 端口> 到设备上的 frida-server

用法：
  python zanao_cli.py thread-list --per-page 10
  python zanao_cli.py thread-info --id 2185825382
  python zanao_cli.py comments --id 2185825382
  python zanao_cli.py user-show --thread-id 2185825382
  python zanao_cli.py self
  python zanao_cli.py certinfo --school-id z0A9
  python zanao_cli.py schools --keyword 中山
  python zanao_cli.py session                 # 只打印当前会话（alias/device，token 打码）
  python zanao_cli.py raw --path /thread/v2/list --data '{"page":1,"per_page":5}'

通用参数：
  --frida 127.0.0.1:39999   frida-server 地址（默认这个）
  --token / --alias / --device   手工指定会话（默认从 App 自身请求里抓）
  --timeout 60              等待结果秒数
  --json                    输出原始 JSON（默认也是 JSON，此开关仅显式声明）
"""
import argparse
import json
import os
import re
import subprocess
import sys
import tempfile

HERE = os.path.dirname(os.path.abspath(__file__))
DRIVER = os.path.join(HERE, '_driver.js')


def render(cfg: dict) -> str:
    with open(DRIVER, 'r', encoding='utf-8-sig') as f:
        src = f.read().lstrip('\ufeff')
    return src.replace('__CFG__', json.dumps(cfg, ensure_ascii=False))


def find_frida() -> str:
    for cand in ('frida', 'frida.exe'):
        from shutil import which
        p = which(cand)
        if p:
            return p
    # 常见安装位置兜底
    for p in (r'D:\rea environments needed\python-venv\Scripts\frida.exe',
              os.path.expanduser('~/.local/bin/frida')):
        if os.path.exists(p):
            return p
    raise SystemExit('找不到 frida CLI，请先 pip install frida-tools')


def run(cfg: dict, host: str, timeout: int, pkg: str) -> dict:
    src = render(cfg)
    fd, path = tempfile.mkstemp(suffix='.js', text=True)
    os.close(fd)
    with open(path, 'w', encoding='utf-8') as f:
        f.write(src)
    cmd = [find_frida(), '-H', host, '-f', pkg, '-l', path]
    env = dict(os.environ, PYTHONIOENCODING='utf-8', PYTHONUTF8='1')
    proc = subprocess.Popen(cmd, stdin=subprocess.PIPE, stdout=subprocess.PIPE,
                            stderr=subprocess.STDOUT, text=True, encoding='utf-8',
                            errors='replace', env=env)
    result, session, buffer = None, None, []
    try:
        while True:
            line = proc.stdout.readline()
            if not line:
                break
            buffer.append(line)
            if '__Z_SESSION__' in line:
                session = json.loads(line.split('__Z_SESSION__', 1)[1].strip())
            if '__Z__' in line and '__Z_DONE__' not in line:
                payload = line.split('__Z__', 1)[1].strip()
                try:
                    result = json.loads(payload)
                except Exception:
                    result = {'ok': False, 'error': 'unparsable output: ' + payload[:200]}
            if '__Z_DONE__' in line:
                break
    except KeyboardInterrupt:
        pass
    finally:
        try:
            proc.wait(timeout=3)
        except Exception:
            proc.kill()
        try:
            os.remove(path)
        except Exception:
            pass
    if result is None:
        tail = ''.join(buffer[-12:])[-1500:]
        return {'ok': False, 'error': 'no result from device', 'log': tail}
    if session:
        result['session'] = session
    return result


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('cmd', help='thread-list | thread-info | comments | user-show | self | certinfo | schools | session | raw')
    ap.add_argument('--frida', default='127.0.0.1:39999')
    ap.add_argument('--pkg', default='com.comingx.zanao')
    ap.add_argument('--token', default=None)
    ap.add_argument('--session-file', default=os.path.expanduser('~/.zanao/app_session.json'))
    ap.add_argument('--alias', default=None)
    ap.add_argument('--device', default=None)
    ap.add_argument('--timeout', type=int, default=60)
    ap.add_argument('--json', action='store_true')
    # 各命令参数
    ap.add_argument('--id', default=None)
    ap.add_argument('--thread-id', default=None)
    ap.add_argument('--comment-id', default=None)
    ap.add_argument('--school-id', default=None)
    ap.add_argument('--keyword', default=None)
    ap.add_argument('--page', default=1, type=int)
    ap.add_argument('--per-page', default=10, type=int)
    ap.add_argument('--limit', default=20, type=int)
    ap.add_argument('--pages', default=3, type=int)
    ap.add_argument('--min-likes', default=0, type=int, dest='min_likes')
    ap.add_argument('--min-comments', default=0, type=int, dest='min_comments')
    ap.add_argument('--cate', default=None)
    ap.add_argument('--exclude', default=None)
    ap.add_argument('--path', default=None)
    ap.add_argument('--method', default='POST')
    ap.add_argument('--data', default='{}')
    a = ap.parse_args()
    if a.cmd == 'whoami':
        a.cmd = 'self'

    # 认证号会话：未显式传参时从 --session-file 读取
    try:
        with open(a.session_file, encoding='utf-8') as f:
            sf = json.load(f)
    except Exception:
        sf = {}
    if not a.token:
        a.token = sf.get('token')
    if not a.alias:
        a.alias = sf.get('alias')
    if not a.device:
        a.device = sf.get('device')

    args = {}
    if a.cmd == 'thread-list':
        args = {'page': a.page, 'per_page': a.per_page}
    elif a.cmd == 'thread-info':
        if not a.id:
            raise SystemExit('thread-info 需要 --id')
        args = {'id': a.id}
    elif a.cmd == 'comments':
        if not a.id:
            raise SystemExit('comments 需要 --id')
        args = {'id': a.id, 'page': a.page, 'limit': a.limit}
    elif a.cmd == 'user-show':
        if not (a.thread_id or a.comment_id):
            raise SystemExit('user-show 需要 --thread-id 或 --comment-id')
        args = {'thread_id': a.thread_id, 'comment_id': a.comment_id}
    elif a.cmd == 'certinfo':
        if not a.school_id:
            raise SystemExit('certinfo 需要 --school-id（可用 schools 命令查）')
        args = {'school_id': a.school_id}
    elif a.cmd == 'schools':
        args = {'keyword': a.keyword}
    elif a.cmd == 'search':
        if not a.keyword:
            raise SystemExit('search 需要 --keyword')
        args = {'keyword': a.keyword, 'page': a.page, 'per_page': a.per_page}
    elif a.cmd == 'harvest':
        args = {'keyword': a.keyword or '', 'pages': a.pages, 'per_page': a.per_page,
                'min_likes': a.min_likes, 'min_comments': a.min_comments,
                'cate': a.cate, 'exclude': a.exclude, 'limit': a.limit}
    elif a.cmd == 'raw':
        if not a.path:
            raise SystemExit('raw 需要 --path')
        args = {'path': a.path, 'method': a.method, 'data': json.loads(a.data)}
    elif a.cmd in ('self', 'session'):
        args = {}
    else:
        raise SystemExit('未知命令: ' + a.cmd)

    cfg = {
        'cmd': 'self' if a.cmd == 'session' else a.cmd,
        'args': args,
        'token': a.token, 'alias': a.alias, 'device': a.device,
        'base': 'http://api.app.zanao.com',
    }
    res = run(cfg, a.frida, a.timeout, a.pkg)

    if a.cmd == 'session':
        s = res.get('session') or {}
        print(json.dumps({'alias': s.get('alias'), 'device': s.get('device'),
                          'token_available': bool(s.get('alias'))}, ensure_ascii=False, indent=2))
        return

    print(json.dumps(res, ensure_ascii=False, indent=2))
    if not res.get('ok', False):
        sys.exit(2)


if __name__ == '__main__':
    main()
