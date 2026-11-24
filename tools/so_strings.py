import re, sys, os
p = os.path.join(os.environ['TEMP'], 'zanao_so', 'libAesNew.so')
b = open(p, 'rb').read()
print('size', len(b))
# 导出符号 / JNI 名
for m in re.finditer(rb'Java_[A-Za-z0-9_]{5,80}', b):
    print('JNI:', m.group().decode())
print('--- 可疑常量 ---')
for m in re.finditer(rb'[ -~]{6,60}', b):
    s = m.group().decode('latin1')
    if re.search(r'(?i)(sign|salt|key|secret|aes|md5|sha|hmac|token|x-sc|timestamp|randnum)', s):
        print(' ', s)