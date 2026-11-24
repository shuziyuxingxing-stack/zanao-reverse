#!/system/bin/sh
R=/data/data/io.github.whywood.deepdeep.local/files/linux/rootfs
L=$R/lib/ld-musl-aarch64.so.1
LP=$R/lib:$R/usr/lib
echo "== 删掉 root 所有的 apk.log =="
ls -la $R/var/log/
rm -f $R/var/log/apk.log
chown -R 10293:10293 $R/var/log
ls -la $R/var/log/
echo "== 以 10293 重跑 apk update =="
su 10293 -c "$L --library-path $LP $R/sbin/apk --root $R --arch aarch64 update" 2>&1 | tail -4
echo "== 日志文件 =="
ls -la $R/var/log/apk.log 2>&1