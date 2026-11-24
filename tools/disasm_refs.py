import os
from elftools.elf.elffile import ELFFile
from capstone import Cs, CS_ARCH_AARCH64, CS_MODE_ARM

p = os.path.join(os.environ['TEMP'], 'zanao_so', 'libAesNew.so')
raw = open(p, 'rb').read()
elf = ELFFile(open(p, 'rb'))
segs = [(s['p_vaddr'], s['p_filesz'], s['p_offset']) for s in elf.iter_segments() if s['p_type'] == 'PT_LOAD']

def va2off(va):
    for v, sz, off in segs:
        if v <= va < v + sz:
            return off + (va - v)
    return None

def cstr(va, n=64):
    o = va2off(va)
    if o is None: return None
    e = raw.find(b'\x00', o, o + n)
    s = raw[o:e if e > 0 else o + n]
    try:
        t = s.decode('utf-8')
    except Exception:
        return None
    return t if t and all(32 <= ord(c) < 127 for c in t) else None

sym_name = 'Java_com_comingx_zanao_utils_JniUtils_makeSign'
sym = None
for secname in ('.symtab', '.dynsym'):
    sec = elf.get_section_by_name(secname)
    if not sec: continue
    for s in sec.iter_symbols():
        if s.name == sym_name: sym = s; break
    if sym: break
addr, size = sym['st_value'], sym['st_size']
data = None
for seg in elf.iter_segments():
    if seg['p_type'] == 'PT_LOAD' and seg['p_vaddr'] <= addr < seg['p_vaddr'] + seg['p_filesz']:
        data = seg.data()[addr - seg['p_vaddr']: addr - seg['p_vaddr'] + size]; break

md = Cs(CS_ARCH_AARCH64, CS_MODE_ARM)
adrp = {}
for i in md.disasm(data, addr):
    ops = [x.strip() for x in i.op_str.split(',')]
    if i.mnemonic == 'adrp' and len(ops) >= 2:
        try:
            adrp[ops[0]] = int(ops[1].lstrip('#'), 0)
        except Exception:
            adrp[ops[0]] = None
        continue
    if i.mnemonic in ('add', 'ldr') and len(ops) >= 3 and ops[0] in adrp and ops[1] == ops[0] and adrp[ops[0]]:
        try:
            off = int(ops[2].lstrip('#'), 0)
        except Exception:
            off = None
        if off is not None:
            s = cstr(adrp[ops[0]] + off)
            if s:
                print('  %-8x %-6s %-26s ; "%s"' % (i.address, i.mnemonic, i.op_str, s))
                continue
    if i.mnemonic == 'bl':
        print('  %-8x bl %s' % (i.address, i.op_str))