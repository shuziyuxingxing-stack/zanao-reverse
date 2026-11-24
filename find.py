import re, sys, glob, os
ROOT = r'D:\onedrive\文档\deepseek-harness\default-workspace\zanao_x\assets\prod'
files = sorted(glob.glob(os.path.join(ROOT, 'static-v2', 'js', '*.dec.js'))) + [os.path.join(ROOT,'static-v3','js','index-DaX7KwnJ.js')]
pats = sys.argv[1:]
for f in files:
    src = open(f, encoding='utf-8', errors='ignore').read()
    for p in pats:
        for m in re.finditer(p, src):
            a = max(0, m.start()-260); b = min(len(src), m.end()+260)
            seg = src[a:b].replace('\n', ' ')
            print(f'### {os.path.basename(f)} :: /{p}/ @{m.start()}\n{seg}\n')
