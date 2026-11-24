#!/system/bin/sh
am force-stop com.comingx.zanao
sleep 2
am start -n com.comingx.zanao/.presentation.eGuideActivity >/dev/null 2>&1
sleep 5
PID=$(ps -A -o pid,args | grep com.comingx.zanao | grep -v grep | head -1 | awk '{print $1}')
echo "pid=$PID"
rm -f /data/local/tmp/h15.out
nohup /data/local/tmp/frida-inject -p $PID -s /data/local/tmp/hook15.js > /data/local/tmp/h15.out 2>&1 &
sleep 3
input tap 540 2200
sleep 6
echo "=== out ==="
head -25 /data/local/tmp/h15.out
pkill -f frida-inject