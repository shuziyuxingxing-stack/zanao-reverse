#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
server.py — zanao MCP server（stdio, JSON-RPC 2.0，零第三方依赖）

两种后端，用环境变量切换：
  ZANAO_MODE=web     （默认）走 https://c.zanao.com/sc-api ，只要账号密码，无需 root / 手机
  ZANAO_MODE=device  走 App 接口，需要 root 手机 + frida-server（签名在 App 内算）

环境变量：
  ZANAO_PY       python 解释器（默认 sys.executable）
  ZANAO_SESSION  web 模式会话文件（默认 ~/.zanao/session.json）
  ZANAO_FRIDA    device 模式的 frida 地址（默认 127.0.0.1:39999）
  ZANAO_PKG      目标包名（默认 com.comingx.zanao）
"""
import json
import os
import subprocess
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
WEB = os.path.join(ROOT, 'web', 'zanao_web.py')
DEV = os.path.join(ROOT, 'scripts', 'zanao_cli.py')

PY = os.environ.get('ZANAO_PY') or sys.executable
MODE = os.environ.get('ZANAO_MODE', 'web').lower()
SESSION = os.environ.get('ZANAO_SESSION', os.path.expanduser('~/.zanao/session.json'))
FRIDA = os.environ.get('ZANAO_FRIDA', '127.0.0.1:39999')
PKG = os.environ.get('ZANAO_PKG', 'com.comingx.zanao')

TOOLS = [
    {'name': 'zanao_login',
     'description': '用集市账号密码登录并保存会话（web 模式）。用户只有微信登录时，引导他先在 App「我的 → 账号」设置密码。',
     'inputSchema': {'type': 'object',
                     'properties': {'account': {'type': 'string'}, 'password': {'type': 'string'}},
                     'required': ['account', 'password']}},
    {'name': 'zanao_import_cookie',
     'description': ('导入已有网页会话：Cookie 字符串（k=v; k2=v2）或直接的 user_token 值，'
                     '写进会话文件并校验。账号没有密码、也不想输密码时用这个。'),
     'inputSchema': {'type': 'object',
                     'properties': {'cookie': {'type': 'string',
                                               'description': 'k=v; k2=v2 形式的 Cookie 头'},
                                    'token': {'type': 'string',
                                              'description': '只给 user_token 值时用它'},
                                    'account': {'type': 'string'}}}},
    {'name': 'zanao_diagnose',
     'description': ('没有会话时的能力体检：逐条探测内容接口，报告哪些匿名可达、'
                     '当前会话状态，以及下一步该做什么（登录/导入）。'),
     'inputSchema': {'type': 'object', 'properties': {}}},
    {'name': 'zanao_status',
     'description': '检查会话是否有效（web 模式 errno 20 表示需要登录）。',
     'inputSchema': {'type': 'object', 'properties': {}}},
    {'name': 'zanao_harvest',
     'description': ('批量收割 + 无关信息过滤：翻多页列表，按关键词相关性打分、去重、'
                     '过滤噪声与低互动帖，返回排序后的候选集（含命中词与统计）。'
                     'keyword 用空格或逗号分隔多个词。'),
     'inputSchema': {'type': 'object',
                     'properties': {'keyword': {'type': 'string', 'description': '关键词，空格/逗号分隔'},
                                    'pages': {'type': 'integer', 'default': 3},
                                    'per_page': {'type': 'integer', 'default': 20},
                                    'min_likes': {'type': 'integer', 'default': 0},
                                    'min_comments': {'type': 'integer', 'default': 0},
                                    'since_days': {'type': 'integer', 'default': 0},
                                    'cate': {'type': 'string'},
                                    'exclude': {'type': 'string', 'description': '额外的噪声正则'},
                                    'fetch_detail': {'type': 'integer', 'default': 5,
                                                     'description': '对标题未命中的候选再抓正文复判的条数'},
                                    'limit': {'type': 'integer', 'default': 20},
                                    'out': {'type': 'string', 'description': '可选：结果写入的 json 路径'}}}},
    {'name': 'zanao_thread_list',
     'description': '集市帖子列表：thread_id / 标题 / 作者昵称 / 头像 URL / 是否匿名 / 分类 / 互动数。',
     'inputSchema': {'type': 'object',
                     'properties': {'page': {'type': 'integer', 'default': 1},
                                    'per_page': {'type': 'integer', 'default': 10}}}},
    {'name': 'zanao_search',
     'description': '按关键词搜索集市帖子（标题/正文命中）：thread_id / 标题 / 作者昵称 / 头像 / 是否匿名 / 分类 / 互动数。',
     'inputSchema': {'type': 'object',
                     'properties': {'keyword': {'type': 'string'},
                                    'page': {'type': 'integer', 'default': 1},
                                    'per_page': {'type': 'integer', 'default': 10}},
                     'required': ['keyword']}},
    {'name': 'zanao_thread_info',
     'description': '帖子详情：标题、作者昵称/头像、是否匿名、联系方式字段。',
     'inputSchema': {'type': 'object', 'properties': {'id': {'type': 'string'}}, 'required': ['id']}},
    {'name': 'zanao_comments',
     'description': '某帖的评论列表：评论人昵称、头像、内容。',
     'inputSchema': {'type': 'object',
                     'properties': {'id': {'type': 'string'},
                                    'page': {'type': 'integer', 'default': 1},
                                    'limit': {'type': 'integer', 'default': 20}},
                     'required': ['id']}},
    {'name': 'zanao_user_show',
     'description': '按帖子或评论查作者公开画像：昵称、头像、学校、注册天数、等级。',
     'inputSchema': {'type': 'object',
                     'properties': {'thread_id': {'type': 'string'}, 'comment_id': {'type': 'string'}}}},
    {'name': 'zanao_whoami',
     'description': '当前登录账号：user_id、昵称、认证状态。',
     'inputSchema': {'type': 'object', 'properties': {}}},
    {'name': 'zanao_certinfo',
     'description': '自己在该校的校园认证字段存在性（不返回真实内容）。',
     'inputSchema': {'type': 'object',
                     'properties': {'school_id': {'type': 'string'}}, 'required': ['school_id']}},
    {'name': 'zanao_raw',
     'description': '以当前会话调用任意只读接口（高级）。',
     'inputSchema': {'type': 'object',
                     'properties': {'path': {'type': 'string'},
                                    'data': {'type': 'object'},
                                    'method': {'type': 'string', 'default': 'POST'}},
                     'required': ['path']}},
]

# name -> (cmd, {arg: flag})
MAP = {
    'zanao_login': ('login', {'account': '--account', 'password': '--password'}),
    'zanao_status': ('status', {}),
    'zanao_diagnose': ('diagnose', {}),
    'zanao_import_cookie': ('import', {'cookie': '--cookie', 'token': '--token'}),
    'zanao_thread_list': ('thread-list', {'page': '--page', 'per_page': '--per-page'}),
    'zanao_search': ('search', {'keyword': '--keyword', 'page': '--page', 'per_page': '--per-page'}),
    'zanao_harvest': ('harvest', {'keyword': '--keyword', 'pages': '--pages',
                                  'per_page': '--per-page', 'min_likes': '--min-likes',
                                  'min_comments': '--min-comments', 'since_days': '--since-days',
                                  'cate': '--cate', 'exclude': '--exclude',
                                  'fetch_detail': '--fetch-detail', 'limit': '--limit',
                                  'out': '--out'}),
    'zanao_thread_info': ('thread-info', {'id': '--id'}),
    'zanao_comments': ('comments', {'id': '--id', 'page': '--page', 'limit': '--limit'}),
    'zanao_user_show': ('user-show', {'thread_id': '--thread-id', 'comment_id': '--comment-id'}),
    'zanao_whoami': ('whoami', {}),
    'zanao_certinfo': ('certinfo', {'school_id': '--school-id'}),
    'zanao_raw': ('raw', {'path': '--path', 'method': '--method'}),
}

DEV_ONLY = {'zanao_thread_list', 'zanao_thread_info', 'zanao_comments',
            'zanao_user_show', 'zanao_certinfo', 'zanao_raw'}


def call_cli(name, args):
    cmd, mapping = MAP[name]
    if MODE == 'web':
        argv = [PY, WEB, '--session', SESSION, cmd]
    else:
        argv = [PY, DEV, '--frida', FRIDA, '--pkg', PKG, cmd]
    for k, flag in mapping.items():
        if args.get(k) is not None:
            argv += [flag, str(args[k])]
    if name == 'zanao_raw':
        argv += ['--data', json.dumps(args.get('data') or {}, ensure_ascii=False)]
    env = dict(os.environ, PYTHONIOENCODING='utf-8', PYTHONUTF8='1')
    try:
        p = subprocess.run(argv, capture_output=True, text=True, encoding='utf-8',
                           errors='replace', env=env, timeout=180)
    except subprocess.TimeoutExpired:
        return {'ok': False, 'error': 'timeout（web 模式检查网络；device 模式检查 frida 与设备）'}
    out = (p.stdout or '').strip()
    try:
        return json.loads(out)
    except Exception:
        return {'ok': False, 'error': 'cli failed', 'stdout': out[-600:],
                'stderr': (p.stderr or '')[-600:]}


def send(obj):
    sys.stdout.write(json.dumps(obj, ensure_ascii=False) + '\n')
    sys.stdout.flush()


def reply(mid, result):
    send({'jsonrpc': '2.0', 'id': mid, 'result': result})


def error(mid, code, message):
    send({'jsonrpc': '2.0', 'id': mid, 'error': {'code': code, 'message': message}})


def handle(msg):
    mid = msg.get('id')
    method = msg.get('method')
    if method == 'initialize':
        reply(mid, {'protocolVersion': '2024-11-05',
                    'capabilities': {'tools': {}},
                    'serverInfo': {'name': 'zanao', 'version': '1.1.0', 'mode': MODE}})
    elif method == 'notifications/initialized':
        return
    elif method == 'tools/list':
        reply(mid, {'tools': TOOLS})
    elif method == 'ping':
        reply(mid, {})
    elif method == 'tools/call':
        p = msg.get('params') or {}
        name, args = p.get('name'), p.get('arguments') or {}
        if name not in MAP:
            error(mid, -32601, 'unknown tool: %s' % name)
            return
        if MODE == 'web' and name in DEV_ONLY and name != 'zanao_raw':
            pass  # web 模式同样支持这些读接口
        res = call_cli(name, args)
        reply(mid, {'content': [{'type': 'text',
                                 'text': json.dumps(res, ensure_ascii=False, indent=2)}],
                    'isError': not res.get('ok', False)})
    else:
        if mid is not None:
            error(mid, -32601, 'unknown method: %s' % method)


def main():
    for line in sys.stdin:
        line = line.strip()
        if not line:
            continue
        try:
            msg = json.loads(line)
        except Exception:
            continue
        try:
            handle(msg)
        except Exception as e:
            if msg.get('id') is not None:
                error(msg['id'], -32603, str(e))


if __name__ == '__main__':
    main()
