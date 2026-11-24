import re, os
p = os.path.join(os.environ['TEMP'], 'zanao_so', 'libAesNew.so')
b = open(p, 'rb').read()
i = b.find(b'&secretkey=')
print('offset of &secretkey= :', hex(i))
print('context repr:', repr(b[max(0,i-160):i+160]))
print()
# 附近的可读串
seg = b[max(0,i-2000):i+2000]
for m in re.finditer(rb'[ -~]{8,80}', seg):
    print(' ', m.group().decode('latin1'))