import os, re
p = os.path.join(os.environ['TEMP'], 'zanao_so', 'libAesNew.so')
b = open(p, 'rb').read()
i = b.find(b'&secretkey=')
print('hexdump around &secretkey= (file off 0x%x)' % i)
seg = b[i-64:i+160]
for k in range(0, len(seg), 16):
    chunk = seg[k:k+16]
    hexs = ' '.join('%02x' % c for c in chunk)
    text = ''.join(chr(c) if 32 <= c < 127 else '.' for c in chunk)
    print('  %08x  %-47s  %s' % (i - 64 + k, hexs, text))
print()
print('--- 32 位十六进制样式字符串 ---')
for m in re.finditer(rb'\b[0-9a-fA-F]{32}\b', b):
    print(' ', hex(m.start()), m.group().decode())