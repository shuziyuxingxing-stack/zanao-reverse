import sqlite3, os, sys
p = os.path.join(os.environ['TEMP'], 'zanao_ck', 'Cookies')
con = sqlite3.connect(p)
rows = con.execute("select host_key, name, value, length(encrypted_value), is_secure, is_httponly from cookies").fetchall()
print('rows:', len(rows))
for h, n, v, el, sec, ho in rows:
    print('%-30s %-22s plain=%-6d enc=%-5d httponly=%s secure=%s' % (h, n, len(v or ''), el, ho, sec))