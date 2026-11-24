import json, subprocess, sys
py = r"D:\rea environments needed\python-venv\Scripts\python.exe"
srv = r"C:\Users\数字与星星\.dsh\skills\zanao\mcp\server.py"
msgs = [
    {"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"t","version":"1"}}},
    {"jsonrpc":"2.0","method":"notifications/initialized"},
    {"jsonrpc":"2.0","id":2,"method":"tools/list"},
    {"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"zanao_status","arguments":{}}},
    {"jsonrpc":"2.0","id":4,"method":"tools/call","params":{"name":"zanao_search","arguments":{"keyword":"快递","page":1}}},
]
p = subprocess.run([py, srv], input="\n".join(json.dumps(m) for m in msgs)+"\n",
                   capture_output=True, text=True, encoding="utf-8", errors="replace", timeout=120)
for line in (p.stdout or "").splitlines():
    try:
        o = json.loads(line)
    except Exception:
        print("RAW:", line[:200]); continue
    if o.get("id") == 2:
        print("tools:", [t["name"] for t in o["result"]["tools"]])
    else:
        txt = json.dumps(o.get("result") or o.get("error"), ensure_ascii=False)
        print(f"id={o.get('id')}:", txt[:260])
if p.stderr.strip():
    print("STDERR:", p.stderr[-400:])