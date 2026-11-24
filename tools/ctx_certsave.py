import os, re
root = r'D:\onedrive\文档\deepseek-harness\default-workspace\zanao_x\assets\prod'
for dp, _, fs in os.walk(root):
    for fn in fs:
        if not fn.endswith('.js'): continue
        s = open(os.path.join(dp, fn), encoding='utf-8', errors='ignore').read()
        for kw in ['/user/certsave', 'certcancel', 'school_id']:
            for m in list(re.finditer(re.escape(kw), s))[:2]:
                seg = s[max(0, m.start()-260):m.start()+300].replace('\n', ' ')
                print('==', fn, '|', kw)
                print('   ', seg[:460])
                print()