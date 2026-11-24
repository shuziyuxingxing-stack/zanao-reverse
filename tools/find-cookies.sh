#!/system/bin/sh
P=/data/data/com.comingx.zanao
echo "== app 私有目录 =="
ls $P 2>&1 | head -20
echo "== webview 相关 =="
find $P -maxdepth 3 -iname "*ookie*" -o -maxdepth 3 -iname "*webview*" 2>/dev/null | head -20