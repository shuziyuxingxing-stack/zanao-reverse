#!/system/bin/sh
SRC="/data/data/com.comingx.zanao/app_webview/Default/Local Storage/leveldb"
rm -rf /data/local/tmp/ls1
mkdir -p /data/local/tmp/ls1
cp "$SRC"/* /data/local/tmp/ls1/ 2>/dev/null
chmod -R 644 /data/local/tmp/ls1/* 2>/dev/null
ls -la /data/local/tmp/ls1