#!/system/bin/sh
PID=$(ps -A -o pid,args | grep com.comingx.zanao | grep -v grep | head -1 | awk '{print $1}')
echo "pid=$PID"
rm -f /data/local/tmp/h7.out
nohup /data/local/tmp/frida-inject -p $PID -s /data/local/tmp/hook7.js > /data/local/tmp/h7.out 2>&1 &
sleep 3
input tap 540 2200
sleep 2
input tap 660 2200
sleep 4
echo "=== out ==="
head -25 /data/local/tmp/h7.out
pkill -f frida-inject