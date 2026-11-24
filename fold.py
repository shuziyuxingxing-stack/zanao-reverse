import re, sys, os, collections

def fold(path):
    src = open(path, encoding='utf-8', errors='ignore').read()
    pairs = collections.Counter()
    for m in re.finditer(r"'([a-zA-Z]{4,6})'\s*:\s*'((?:[^'\\]|\\.)*)'", src):
        pairs[(m.group(1), m.group(2))] += 1
    # keep only keys that always map to the same value
    keyed = {}
    ambiguous = set()
    for (k, v), c in pairs.items():
        if k in keyed and keyed[k] != v:
            ambiguous.add(k)
        keyed[k] = v
    for k in ambiguous:
        keyed.pop(k, None)
    def rep(m):
        k = m.group(1)
        if k in keyed:
            v = keyed[k].replace('\\', '\\\\').replace("'", "\\'")
            return "'" + v + "'"
        return m.group(0)
    out = re.sub(r"\['([a-zA-Z]{4,6})'\]", rep, src)
    open(path + '.fold.js', 'w', encoding='utf-8').write(out)
    print(f'{os.path.basename(path)}: folded {len(keyed)} keys', file=sys.stderr)

for p in sys.argv[1:]:
    fold(p)
