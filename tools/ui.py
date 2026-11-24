import re
import sys
import xml.etree.ElementTree as ET

path = sys.argv[1] if len(sys.argv) > 1 else 'ui.xml'
tree = ET.parse(path)
for n in tree.iter('node'):
    t = n.get('text') or ''
    d = n.get('content-desc') or ''
    rid = n.get('resource-id') or ''
    cls = n.get('class') or ''
    if not (t or d):
        continue
    b = n.get('bounds') or ''
    m = re.match(r'\[(\d+),(\d+)\]\[(\d+),(\d+)\]', b)
    cx = cy = 0
    if m:
        x1, y1, x2, y2 = map(int, m.groups())
        cx, cy = (x1 + x2) // 2, (y1 + y2) // 2
    print('%s | %s | %s | %s | clickable=%s | @(%d,%d)' %
          (t[:40] or '-', d[:30], cls.split('.')[-1], rid.split('/')[-1], n.get('clickable'), cx, cy))
