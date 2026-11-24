import os, sys
from elftools.elf.elffile import ELFFile
from capstone import Cs, CS_ARCH_AARCH64, CS_MODE_ARM

p = os.path.join(os.environ['TEMP'], 'zanao_so', 'libAesNew.so')
elf = ELFFile(open(p, 'rb'))
sym_name = 'Java_com_comingx_zanao_utils_JniUtils_makeSign'
sym = None
for secname in ('.symtab', '.dynsym'):
    sec = elf.get_section_by_name(secname)
    if not sec: continue
    for s in sec.iter_symbols():
        if s.name == sym_name:
            sym = s; break
    if sym: break
print('symbol:', getattr(sym, 'name', None), hex(sym['st_value']) if sym else None, sym['st_size'] if sym else None)
addr, size = sym['st_value'], sym['st_size']
data = None
for seg in elf.iter_segments():
    if seg['p_type'] == 'PT_LOAD':
        va, sz = seg['p_vaddr'], seg['p_filesz']
        if va <= addr < va + sz:
            data = seg.data()[addr - va: addr - va + size]; break
md = Cs(CS_ARCH_AARCH64, CS_MODE_ARM)
n = 0
for i in md.disasm(data, addr):
    print('  %-8x %-8s %s' % (i.address, i.mnemonic, i.op_str))
    n += 1
    if n > 120: break