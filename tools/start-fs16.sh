#!/system/bin/sh
pkill -f frida-server 2>/dev/null
sleep 1
cp /data/local/tmp/fs16 /data/adb/frida-server
chmod 755 /data/adb/frida-server
nohup /data/adb/frida-server -l 0.0.0.0:39999 >/data/local/tmp/fs16.log 2>&1 &
sleep 3
ps -A | grep frida-server
netstat -ltn 2>/dev/null | grep 39999
head -3 /data/local/tmp/fs16.log