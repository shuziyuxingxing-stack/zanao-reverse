#!/system/bin/sh
pkill -9 -f frida-server
sleep 2
rm -f /data/adb/frida-server
cp /data/local/tmp/fsrv /data/adb/frida-server
chmod 755 /data/adb/frida-server
nohup /data/adb/frida-server -l 0.0.0.0:39999 >/data/local/tmp/fsrv.log 2>&1 &
sleep 3
/data/adb/frida-server --version
ps -A | grep frida-server
netstat -ltn 2>/dev/null | grep 39999