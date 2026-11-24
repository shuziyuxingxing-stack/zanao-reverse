import hashlib, json, urllib.request, urllib.error
TOKEN = "UDFlSGUrY1ZQTzNxRTV6bkxybXFadDMrSDhKVFkrbXllRmQ0akNXMGZ0WT0%3D"
S = ("from=detail&id=2186125324&randnum__=43257199998978800280"
     "&timestamp__=1794468824&secretkey=hq1zeoeium9r1YeKaqG6vYV3u7ilqYClcap9a4F+tHmGrXePb6fJfg==")
sign = hashlib.md5(S.encode()).hexdigest().upper()
print("sign =", sign)
hdr = {
    "X-Sc-Client": "app",
    "X-Sc-Platform": "android",
    "X-Sc-Token": TOKEN,
    "X-Sc-Td": "1794468824",
    "X-Sc-Nd": "43257199998978800280",
    "X-Sc-Ah": sign,
    "X-Sc-Version": "310",
    "Content-Type": "application/json",
}
for path, body in (("/thread/info", {"from": "detail", "id": "2186125324"}),
                   ("/thread/info", {"id": "2186125324"})):
    data = json.dumps(body).encode()
    req = urllib.request.Request("http://api.app.zanao.com" + path, data=data,
                                 headers=hdr, method="POST")
    try:
        with urllib.request.urlopen(req, timeout=15) as r:
            out = r.read().decode("utf-8", "replace")
    except Exception as e:
        out = "EXC %s" % e
    print(path, body, "->", out[:180])