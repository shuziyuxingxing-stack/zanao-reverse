import os, re
root = r'D:\onedrive\文档\deepseek-harness\default-workspace\zanao_x\assets\prod'
for dp, _, fs in os.walk(root):
    for fn in fs:
        if not fn.endswith('.js'): continue
        p = os.path.join(dp, fn)
        s = open(p, encoding='utf-8', errors='ignore').read()
        for kw in ['仅认证可见', 'need_cert', 'cert_only', 'cate_need_cert']:
            for m in list(re.finditer(kw, s))[:2]:
                seg = s[max(0, m.start()-200):m.start()+200].replace('\n', ' ')
                print('==', fn, kw); print('   ', seg[:380]); print()