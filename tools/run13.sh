#!/system/bin/sh
am force-stop com.comingx.zanao
sleep 1
am start -n com.comingx.zanao/.presentation.eGuideActivity >/dev/null 2>&1
sleep 4
PID=$(ps -A -o pid,args | grep com.comingx.zanao | grep -v grep | head -1 | awk '{print $1}')
rm -f /data/local/tmp/h13.out
nohup /data/local/tmp/frida-inject -p $PID -s /data/local/tmp/hook13.js > /data/local/tmp/h13.out 2>&1 &
sleep 3
input tap 540 2200
sleep 5
echo "=== out ==="
grep -a "^S<\|ATTACHED\|ERR" /data/local/tmp/h13.out | head -30
pkill -f frida-inject