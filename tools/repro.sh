#!/system/bin/sh
R=/data/data/io.github.whywood.deepdeep.local/files/linux/rootfs
L=$R/lib/ld-musl-aarch64.so.1
LP=$R/lib:$R/usr/lib
echo "== 以 uid 10293 跑 apk（复现）=="
su 10293 -c "$L --library-path $LP $R/sbin/apk --root $R --arch aarch64 update" 2>&1 | tail -5
echo "== rc=$? =="