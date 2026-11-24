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
lo, hi = int(sys.argv[1], 0), int(sys.argv[2], 0)
o = va2off(lo)
md = Cs(CS_ARCH_AARCH64, CS_MODE_ARM)
for i in md.disasm(raw[o:o + (hi - lo)], lo):
    print('  %-8x %-8s %s' % (i.address, i.mnemonic, i.op_str))