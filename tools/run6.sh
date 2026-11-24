#!/system/bin/sh
PID=$(ps -A -o pid,args | grep com.comingx.zanao | grep -v grep | head -1 | awk '{print $1}')
echo "pid=$PID"
rm -f /data/local/tmp/h6.out
nohup /data/local/tmp/frida-inject -p $PID -s /data/local/tmp/hook6.js > /data/local/tmp/h6.out 2>&1 &
sleep 3
am start -n com.comingx.zanao/.presentation.eGuideActivity >/dev/null 2>&1
sleep 9
echo "=== out ==="
head -30 /data/local/tmp/h6.out
pkill -f frida-inject