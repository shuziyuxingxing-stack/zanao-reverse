import hashlib, itertools
TARGET = "1E5A1540D2A933506C41A75AFEF6FAAB"
ts, rn = "1700000000", "11111111111111111111"
pairs = {"randnum__": rn, "timestamp__": ts}
cands = [
    "68bfccbfb8ef27ff31dc75f05490c85c",
    "hIWanaS4k5iji5WqZmypng==",
    "g4KSn6S4mpi6fJ6XaWmqlw==",
    "NM87AU12AS0D45C8", "MJ09AU82XD9172D1",
    "zanao", "comingx", "com.comingx.zanao", "zaixiaoyuan",
    "zanao_secret", "secretkey", "",
]
def md5(s):
    return hashlib.md5(s.encode()).hexdigest().upper()
bodies = {}
for order in (("randnum__","timestamp__"), ("timestamp__","randnum__")):
    for sep in ("&", ""):
        for trail in ("&", ""):
            b = sep.join("%s=%s" % (k, pairs[k]) for k in order) + trail
            bodies["%s|sep=%r|trail=%r" % (",".join(order), sep, trail)] = b
ok = 0
for name, b in bodies.items():
    for c in cands:
        for tpl in ("%s&secretkey=%s", "%ssecretkey=%s", "%s&secretkey=%s&", "%s%s"):
            s = tpl % (b, c)
            if md5(s) == TARGET:
                print("HIT:", name, "secret=%r" % c, "string=%r" % s); ok += 1
print("done, hits =", ok)
# 打印一种候选串，便于人工核对
print("sample string:", bodies["randnum__,timestamp__|sep='&'|trail=''"] + "&secretkey=<SECRET>")