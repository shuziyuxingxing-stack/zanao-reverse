#!/system/bin/sh
R=/data/data/io.github.whywood.deepdeep.local/files/linux/rootfs
L=$R/lib/ld-musl-aarch64.so.1
LP=$R/lib:$R/usr/lib
A="$L --library-path $LP $R/sbin/apk"
echo "--- 预创建 var/log/apk.log (uid 10293) ---"
su 10293 -c "touch $R/var/log/apk.log; ls -la $R/var/log/apk.log"
su 10293 -c "$A --root $R --arch aarch64 update" 2>&1 | tail -2
echo "--- 预创建 \$R/log ---"
su 10293 -c "touch $R/log; ls -la $R/log"
su 10293 -c "$A --root $R --arch aarch64 update" 2>&1 | tail -2
echo "--- 预创建 \$R/var/log/log ---"
su 10293 -c "touch $R/var/log/log"
su 10293 -c "$A --root $R --arch aarch64 update" 2>&1 | tail -2