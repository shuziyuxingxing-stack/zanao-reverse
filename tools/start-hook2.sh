#!/system/bin/sh
am force-stop com.comingx.zanao
sleep 1
rm -f /data/local/tmp/hook.out
nohup /data/local/tmp/frida-inject -f com.comingx.zanao -s /data/local/tmp/hook2.js > /data/local/tmp/hook.out 2>&1 &
sleep 16
pkill -f frida-inject 2>/dev/null
echo "=== output ==="
head -40 /data/local/tmp/hook.out