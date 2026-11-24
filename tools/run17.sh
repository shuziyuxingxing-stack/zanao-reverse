#!/system/bin/sh
PID=$(ps -A -o pid,args | grep com.comingx.zanao | grep -v grep | head -1 | awk '{print $1}')
rm -f /data/local/tmp/h16.out
nohup /data/local/tmp/frida-inject -p $PID -s /data/local/tmp/hook16.js > /data/local/tmp/h16.out 2>&1 &
sleep 3
input swipe 540 700 540 1700 300
sleep 5
echo "=== out ==="
head -30 /data/local/tmp/h16.out
pkill -f frida-inject