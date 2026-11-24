#!/system/bin/sh
R=/data/data/io.github.whywood.deepdeep.local/files/linux/rootfs
rm -f $R/var/log/log $R/var/log/x2 $R/log
chown -R 10293:10293 $R/var/log
echo "== var/log =="
ls -la $R/var/log
echo "== 顶层杂项 =="
ls -la $R | head -8
echo "== 最终以 10293 跑一次 =="
L=$R/lib/ld-musl-aarch64.so.1
LP=$R/lib:$R/usr/lib
su 10293 -c "$L --library-path $LP $R/sbin/apk --root $R --arch aarch64 info busybox" 2>&1 | head -5