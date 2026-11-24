import re, sys, os

def parse_js_string_array(src, start):
    out = []; i = start + 1; n = len(src)
    while i < n:
        c = src[i]
        if c == ']':
            return out, i
        if c == ',' or c.isspace():
            i += 1; continue
        if c in "'\"":
            q = c; i += 1; buf = bytearray()
            while i < n:
                ch = src[i]
                if ch == '\\':
                    nx = src[i+1]
                    if nx == 'x':
                        buf.append(int(src[i+2:i+4], 16)); i += 4; continue
                    if nx == 'u':
                        buf += chr(int(src[i+2:i+6], 16)).encode('utf-8'); i += 6; continue
                    buf += {'n':b'\n','t':b'\t','r':b'\r','\\':b'\\',"'":b"'",'"':b'"'}.get(nx, nx.encode()); i += 2; continue
                if ch == q:
                    i += 1; break
                buf += ch.encode('utf-8'); i += 1
            out.append(buf.decode('utf-8', 'replace')); continue
        i += 1
    return out, i

def js_parseint(s):
    if s is None:
        return float('nan')
    m = re.match(r'\s*([+-]?\d+)', s)
    return int(m.group(1)) if m else float('nan')

def pyexpr(expr, acc):
    body = re.sub(r'\b' + re.escape(acc) + r'\(\s*(0x[0-9a-fA-F]+)\s*\)',
                  lambda x: 'I(' + str(int(x.group(1), 16)) + ')', expr)
    body = re.sub(r'parseInt\s*\(', '(', body)
    body = re.sub(r'0x([0-9a-fA-F]+)', lambda x: str(int(x.group(1), 16)), body)
    body = body.replace('&&', ' and ').replace('||', ' or ')
    return body

def find_rotation(src, arrname, astart, off, arr):
    cm = re.search(r'try\s*\{\s*(?:const|var|let)\s+(\w+)\s*=(.*?);\s*if\s*\(\s*\1\s*===',
                   src[astart:], re.S)
    if not cm:
        return 0, 'no-checksum'
    base = astart + cm.start()
    tm = re.search(r'\(\s*' + re.escape(arrname) + r'\s*,\s*(0x[0-9a-fA-F]+)\s*\)',
                   src[base:base + 3000])
    if not tm:
        return 0, 'no-target'
    target = int(tm.group(1), 16)
    acc = re.search(r'\b(\w+)\s*\(\s*0x', cm.group(2))
    if not acc:
        return 0, 'no-acc'
    body = pyexpr(cm.group(2), acc.group(1))
    n = len(arr)
    for cand in range(n):
        rot = arr[cand:] + arr[:cand]
        def I(idx, _rot=rot):
            j = idx - off
            return js_parseint(_rot[j]) if 0 <= j < len(_rot) else float('nan')
        try:
            v = eval(body, {'__builtins__': {}}, {'I': I})
        except Exception:
            continue
        if v == target:
            return cand, 'ok'
    return 0, 'no-match'

def build(path):
    src = open(path, encoding='utf-8', errors='ignore').read()
    arrays = {}; apos = {}
    for am in re.finditer(r'function\s+(a\d+_0x[0-9a-f]+)\s*\(\s*\)\s*\{\s*(?:const|var|let)\s+_\w+\s*=\s*\[', src):
        arr, _ = parse_js_string_array(src, src.index('[', am.end()-1))
        arrays[am.group(1)] = arr
        apos[am.group(1)] = am.start()
    raw = {}
    for m in re.finditer(r'function\s+(a\d+_0x[0-9a-f]+)\s*\(\s*(_\w+)\s*,\s*(_\w+)\s*\)\s*\{\s*\2\s*=\s*\2\s*-\s*(0x[0-9a-fA-F]+)\s*;([^}]{0,400})', src):
        name, off, body = m.group(1), int(m.group(4), 16), m.group(5)
        fn = re.search(r'(a\d+_0x[0-9a-f]+)\(\)', body)
        if fn and fn.group(1) in arrays:
            raw[name] = (off, fn.group(1))
    rot_cache = {}; info = []
    tabs = {}
    for name, (off, arrname) in raw.items():
        if arrname not in rot_cache:
            r, why = find_rotation(src, arrname, apos[arrname], off, arrays[arrname])
            rot_cache[arrname] = arrays[arrname][r:] + arrays[arrname][:r]
            info.append((arrname, r, len(arrays[arrname]), why))
        tabs[name] = (off, rot_cache[arrname])
    print(f'  rotations: {info}', file=sys.stderr)
    for _ in range(8):
        added = False
        for m in re.finditer(r'(?:const|let|var)\s+([\w$]+)\s*=\s*([\w$]+)\s*[,;)]', src):
            if m.group(2) in tabs and m.group(1) not in tabs:
                tabs[m.group(1)] = tabs[m.group(2)]; added = True
        if not added:
            break
    return src, tabs

def resolve(src, tabs):
    def rep(m):
        name, hx = m.group(1), m.group(2)
        if name not in tabs:
            return m.group(0)
        off, arr = tabs[name]
        i = int(hx, 16) - off
        if 0 <= i < len(arr):
            return "'" + arr[i].replace("\\", "\\\\").replace("'", "\\'") + "'"
        return m.group(0) + '/*OUT*/'
    return re.sub(r'\b([\w$]+)\((0x[0-9a-f]+)\)', rep, src)

if __name__ == '__main__':
    path = sys.argv[1]
    src, tabs = build(path)
    print(f'{os.path.basename(path)}: tables={len(tabs)}', file=sys.stderr)
    open(path + '.dec.js', 'w', encoding='utf-8').write(resolve(src, tabs))
