#!/system/bin/sh
am force-stop com.comingx.zanao
sleep 1
am start -n com.comingx.zanao/.presentation.eGuideActivity >/dev/null 2>&1
sleep 4
PID=$(ps -A -o pid,args | grep com.comingx.zanao | grep -v grep | head -1 | awk '{print $1}')
rm -f /data/local/tmp/h10.out
nohup /data/local/tmp/frida-inject -p $PID -s /data/local/tmp/hook10.js > /data/local/tmp/h10.out 2>&1 &
sleep 3
input tap 540 2200
sleep 4
echo "=== out ==="
head -20 /data/local/tmp/h10.out
pkill -f frida-inject