#!/system/bin/sh
R=/data/data/io.github.whywood.deepdeep.local/files/linux/rootfs
echo "== strings in apk.real =="
grep -a -o "Unable to open log" $R/sbin/apk.real | head -2
echo "== /etc/apk =="
ls -la $R/etc/apk/
echo "== tmp/var/log =="
ls -ld $R/tmp $R/var/log 2>&1