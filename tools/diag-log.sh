#!/system/bin/sh
R=/data/data/io.github.whywood.deepdeep.local/files/linux/rootfs
echo "== trigger 脚本 =="
cat $R/lib/apk/exec/busybox-1.37.0-r31.trigger 2>&1 | head -30
echo "== 名字叫 log 的东西 =="
find $R -maxdepth 4 -name log 2>/dev/null | head
echo "== /var/log 内容 =="
ls -la $R/var/log
echo "== 各关键目录属主 =="
ls -ld $R/var $R/var/log $R/tmp $R/lib/apk $R/lib/apk/db $R/etc/apk $R/root $R/home 2>&1