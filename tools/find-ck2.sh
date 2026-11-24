#!/system/bin/sh
P=/data/data/com.comingx.zanao
echo "== cookie / db 文件 =="
find $P -maxdepth 5 \( -iname "*cookie*" -o -iname "*.db" -o -iname "*webview*" \) 2>/dev/null | head -30
echo "== 含 user_token 的小文件 =="
grep -rl "user_token" $P --include="*.xml" --include="*.db" --include="*.json" 2>/dev/null | head -10
echo "== app_webview 结构 =="
find $P/app_webview -maxdepth 3 2>/dev/null | head -20