#!/system/bin/sh
P=/data/data/com.comingx.zanao
echo "== shared_prefs =="
ls -la $P/shared_prefs 2>&1 | head -20
echo "== userToken =="
grep -o 'name="userToken">[^<]*' $P/shared_prefs/storage.xml 2>&1 | head -3
echo "== webview 目录 =="
ls -d $P/app_webview $P/app_x5webview $P/app_webview_* 2>/dev/null
find $P -maxdepth 3 -name "Cookies" 2>/dev/null