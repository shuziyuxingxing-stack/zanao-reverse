#!/system/bin/sh
L=/data/data/io.github.whywood.deepdeep.local/files/linux/rootfs/lib/ld-musl-aarch64.so.1
LP=/data/data/io.github.whywood.deepdeep.local/files/linux/rootfs/lib:/data/data/io.github.whywood.deepdeep.local/files/linux/rootfs/usr/lib
BB=/data/data/io.github.whywood.deepdeep.local/files/linux/rootfs/bin/busybox
D=/data/local/tmp/aptest
rm -rf $D; mkdir -p $D/sbin $D/tmp
cp /data/data/io.github.whywood.deepdeep.local/files/linux/rootfs/sbin/apk $D/sbin/apk
cp $BB $D/sbin/apk.real
chmod +x $D/sbin/apk
echo "-- run wrapper (应打印代理选择并执行 busybox) --"
$L --library-path $LP $BB sh $D/sbin/apk --list 2>&1 | head -3
echo "-- log --"
cat $D/tmp/apk-proxy.log 2>/dev/null
echo "-- cache --"; cat $D/tmp/apk-proxy.cache 2>/dev/null