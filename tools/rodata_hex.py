import os
p = os.path.join(os.environ['TEMP'], 'zanao_so', 'libAesNew.so')
b = open(p, 'rb').read()
i = b.find(b'AES/CBC/PKCS5Padding')
start = i - 320
seg = b[start:i + 200]
for k in range(0, len(seg), 16):
    chunk = seg[k:k+16]
    hexs = ' '.join('%02x' % c for c in chunk)
    txt = ''.join(chr(c) if 32 <= c < 127 else '.' for c in chunk)
    print('%08x  %-47s  %s' % (start + k, hexs, txt))