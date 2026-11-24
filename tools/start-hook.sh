#!/system/bin/sh
PID=$(ps -A -o pid,args | grep com.comingx.zanao | grep -v grep | head -1 | awk '{print $1}')
echo "pid=$PID"
rm -f /data/local/tmp/hook.out
nohup /data/local/tmp/frida-inject -p $PID -s /data/local/tmp/hook2.js > /data/local/tmp/hook.out 2>&1 &
echo started