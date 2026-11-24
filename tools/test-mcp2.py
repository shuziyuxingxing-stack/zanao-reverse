import json, subprocess
py = r"D:\rea environments needed\python-venv\Scripts\python.exe"
srv = r"C:\Users\数字与星星\.dsh\skills\zanao\mcp\server.py"
msgs = [
 {"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"t","version":"1"}}},
 {"jsonrpc":"2.0","method":"notifications/initialized"},
 {"jsonrpc":"2.0","id":2,"method":"tools/list"},
 {"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"zanao_harvest","arguments":{"keyword":"考研 自习室","pages":2,"per_page":10,"min_likes":0}}},
]
p = subprocess.run([py, srv], input="\n".join(json.dumps(m) for m in msgs)+"\n",
                   capture_output=True, text=True, encoding="utf-8", errors="replace", timeout=120)
for line in (p.stdout or "").splitlines():
    o = json.loads(line)
    if o.get("id") == 2:
        names = [t["name"] for t in o["result"]["tools"]]
        print("tools(%d):" % len(names), names)
    elif o.get("id") == 3:
        print("harvest ->", json.dumps(o.get("result"), ensure_ascii=False)[:300])