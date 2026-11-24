#!/system/bin/sh
PID=$(ps -A -o pid,args | grep com.comingx.zanao | grep -v grep | head -1 | awk '{print $1}')
rm -f /data/local/tmp/h9.out
nohup /data/local/tmp/frida-inject -p $PID -s /data/local/tmp/hook9.js > /data/local/tmp/h9.out 2>&1 &
sleep 3
input tap 540 2200
sleep 5
echo "=== out ==="
head -20 /data/local/tmp/h9.out
pkill -f frida-inject