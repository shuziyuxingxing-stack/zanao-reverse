#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
fetch-alpine-apks.py — 在 PC 上把 Alpine 包及其依赖下载下来，供手机离线安装。

用法:
    python fetch-alpine-apks.py --out D:\\tmp\\apks --repo https://mirrors.ustc.edu.cn/alpine/v3.24 \
        bash coreutils curl wget git nodejs npm python3 ffmpeg ...

依赖: 只解析 APKINDEX 的 P/V/D/p 字段，够用即可。
"""
import argparse
import io
import os
import re
import sys
import tarfile
import urllib.request

UA = {'User-Agent': 'curl/8'}


def fetch(url, timeout=60):
    req = urllib.request.Request(url, headers=UA)
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return r.read()


def load_index(repo, branch='v3.24', arch='aarch64'):
    idx = {}
    for comp in ('main', 'community'):
        url = '%s/%s/%s/APKINDEX.tar.gz' % (repo, branch, arch) if False else \
              '%s/%s/%s/APKINDEX.tar.gz' % (repo.rstrip('/'), branch, arch)
        # repo 形如 https://mirrors.ustc.edu.cn/alpine/v3.24
        base = repo.rstrip('/')
        url = '%s/%s/APKINDEX.tar.gz' % (base, arch)
        comp_url = url  # main 与 community 各自一个 repo base
        try:
            data = fetch(comp_url if comp == 'main' else comp_url)
        except Exception:
            data = None
        if data is None:
            continue
        break
    return idx


def parse_index_bytes(blob):
    """解析 APKINDEX.tar.gz → {pkg: {...}}"""
    out = {}
    with tarfile.open(fileobj=io.BytesIO(blob), mode='r:gz') as tf:
        for m in tf.getmembers():
            if m.name != 'APKINDEX':
                continue
            text = tf.extractfile(m).read().decode('utf-8', 'replace')
    cur = {}
    for line in text.splitlines():
        if not line.strip():
            if cur.get('P'):
                out[cur['P']] = cur
            cur = {}
            continue
        if len(line) > 1 and line[1] == ':':
            k, v = line[0], line[2:]
            cur.setdefault(k, v)
    if cur.get('P'):
        out[cur['P']] = cur
    return out


def build_provides(index):
    prov = {}
    for name, p in index.items():
        for token in (p.get('p') or '').split():
            base = token.split('=')[0]
            prov.setdefault(base, name)
    return prov


def dep_tokens(pkg):
    raw = pkg.get('D') or ''
    for t in raw.split():
        if t.startswith('!'):
            continue
        yield t


def resolve(targets, index, prov):
    need = []
    seen = set()
    stack = list(targets)
    missing = []
    while stack:
        name = stack.pop()
        base = re.split(r'[<>=~]', name)[0]
        if base in seen:
            continue
        seen.add(base)
        real = base if base in index else prov.get(base)
        if not real:
            missing.append(base)
            continue
        pkg = index[real]
        need.append(real)
        for t in dep_tokens(pkg):
            stack.append(t)
    return sorted(set(need)), sorted(set(missing))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--repo', default='https://mirrors.ustc.edu.cn/alpine/v3.24')
    ap.add_argument('--arch', default='aarch64')
    ap.add_argument('--out', required=True)
    ap.add_argument('pkgs', nargs='+')
    a = ap.parse_args()

    os.makedirs(a.out, exist_ok=True)
    index = {}
    prov = {}
    for comp in ('main', 'community'):
        url = '%s/%s/%s/APKINDEX.tar.gz' % (a.repo.rstrip('/'), comp, a.arch)
        print('[index]', url, flush=True)
        try:
            blob = fetch(url)
        except Exception as e:
            print('  ! 拉取失败:', e)
            continue
        idx = parse_index_bytes(blob)
        print('  %d packages' % len(idx))
        index.update(idx)
        prov.update(build_provides(idx))

    names, missing = resolve(a.pkgs, index, prov)
    print('[resolve] %d packages, missing=%s' % (len(names), missing[:8]))
    total = 0
    for n in names:
        p = index[n]
        ver = p['V']
        fn = '%s-%s.apk' % (n, ver)
        path = os.path.join(a.out, fn)
        if os.path.exists(path) and os.path.getsize(path) > 0:
            total += os.path.getsize(path)
            continue
        data = None
        for comp in ('main', 'community'):
            url = '%s/%s/%s/%s' % (a.repo.rstrip('/'), comp, a.arch, fn)
            try:
                data = fetch(url, timeout=180)
                break
            except Exception:
                continue
        if data is None:
            print('  ! %s: 404/失败' % fn)
            continue
        with open(path, 'wb') as f:
            f.write(data)
        total += len(data)
        print('  + %s (%.1f MB)' % (fn, len(data) / 1048576), flush=True)

    print('[done] %d files, %.1f MB -> %s' % (len(os.listdir(a.out)), total / 1048576, a.out))


if __name__ == '__main__':
    main()
