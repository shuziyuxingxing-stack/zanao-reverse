import base64, urllib.parse, sys
raw = "UDFlSGUrY1ZQTzNxRTV6bkxybXFadDMrSDhKVFkrbXllRmQ0akNXMGZ0WT0%3D"
a = urllib.parse.unquote(raw)
print("url-decoded:", a, "len", len(a))
try:
    b = base64.b64decode(a + "=" * (-len(a) % 4))
    print("b64-decoded repr:", repr(b[:80]))
    print("as text:", b.decode("utf-8", "replace")[:120])
    try:
        c = base64.b64decode(b + b"=" * (-len(b) % 4))
        print("second b64:", c[:80])
    except Exception as e:
        print("second decode failed:", e)
except Exception as e:
    print("decode failed:", e)