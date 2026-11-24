import os, re
root = r'D:\onedrive\文档\deepseek-harness\default-workspace\zanao_x\assets\prod'
pats = ['comAlias', 'switchCommunity', 'joinCommunity', 'community_join', 'need_cert', 'certsave']
seen = set()
for dp, _, fs in os.walk(root):
    for fn in fs:
        if not fn.endswith('.dec.js'): continue
        p = os.path.join(dp, fn)
        s = open(p, encoding='utf-8', errors='ignore').read()
        for kw in pats:
            for m in list(re.finditer(kw, s))[:1]:
                seg = s[max(0, m.start()-220):m.start()+260].replace('\n', ' ')
                key = kw + seg[:60]
                if key in seen: continue
                seen.add(key)
                print('==', fn, '|', kw)
                print('   ', seg[:430])
                print()