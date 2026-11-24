#!/system/bin/sh
kill 22597 2>/dev/null
kill 10243 2>/dev/null
sleep 1
mkdir -p /data/adb
cp /data/local/tmp/fsrv /data/adb/frida-server
chmod 755 /data/adb/frida-server
chown root:root /data/adb/frida-server
nohup /data/adb/frida-server -l 0.0.0.0:39999 >/data/local/tmp/fsrv.log 2>&1 &
sleep 3
ps -A | grep frida-server
netstat -ltn 2>/dev/null | grep 39999
echo "--- log ---"
head -5 /data/local/tmp/fsrv.log