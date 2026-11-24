#!/system/bin/sh
echo "== listening tcp =="
netstat -ltn 2>/dev/null | sed -n '3,40p'
echo "== flclash pid/uid =="
ps -A | grep -i flclash