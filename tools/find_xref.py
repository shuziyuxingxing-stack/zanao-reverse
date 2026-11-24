import os, sys
from elftools.elf.elffile import ELFFile
from capstone import Cs, CS_ARCH_AARCH64, CS_MODE_ARM

p = os.path.join(os.environ['TEMP'], 'zanao_so', 'libAesNew.so')
raw = open(p, 'rb').read()
elf = ELFFile(open(p, 'rb'))
segs = [(s['p_vaddr'], s['p_filesz'], s['p_offset']) for s in elf.iter_segments() if s['p_type'] == 'PT_LOAD']

def va2off(va):
    for v, sz, off in segs:
        if v <= va < v + sz: return off + (va - v)
    return None

target_str = b'AES/CBC/PKCS5Padding'
i = raw.find(target_str)
# 该字符串在 .rodata，计算其运行时 VA
str_va = None
for v, sz, off in segs:
    if off <= i < off + sz:
        str_va = v + (i - off); break
print('str file off=0x%x va=0x%x' % (i, str_va))

# 找引用它的指令（adrp + add）
text = None
text_va = None
for s in elf.iter_sections():
    if s.name == '.text':
        text = s.data(); text_va = s['sh_addr']
md = Cs(CS_ARCH_AARCH64, CS_MODE_ARM)
adrp = {}
hits = []
for ins in md.disasm(text, text_va):
    ops = [x.strip() for x in ins.op_str.split(',')]
    if ins.mnemonic == 'adrp' and len(ops) >= 2:
        try: adrp[ops[0]] = int(ops[1].lstrip('#'), 0)
        except Exception: adrp[ops[0]] = None
    elif ins.mnemonic == 'add' and len(ops) >= 3 and ops[1] == ops[0] and adrp.get(ops[0]):
        try: off = int(ops[2].lstrip('#'), 0)
        except Exception: off = None
        if off is not None and adrp[ops[0]] + off == str_va:
            hits.append(ins.address)
print('xrefs:', [hex(h) for h in hits])