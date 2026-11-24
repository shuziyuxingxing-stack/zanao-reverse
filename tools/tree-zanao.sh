#!/system/bin/sh
P=/data/data/com.comingx.zanao
echo "== 顶层 =="
ls -la $P
echo "== files 下 =="
ls -la $P/files 2>/dev/null | head -25
echo "== cache/WebView =="
find $P/cache/WebView -maxdepth 3 2>/dev/null | head -20