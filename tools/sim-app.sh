#!/system/bin/sh
R=/data/data/io.github.whywood.deepdeep.local/files/linux/rootfs
L=$R/lib/ld-musl-aarch64.so.1
LP=$R/lib:$R/usr/lib
# 模拟 App 行为：写回 https 官方源，然后通过 wrapper 调 apk
echo https://dl-cdn.alpinelinux.org/alpine/v3.24/main >  $R/etc/apk/repositories
echo https://dl-cdn.alpinelinux.org/alpine/v3.24/community >> $R/etc/apk/repositories
echo "== wrapper 前："
$L --library-path $LP $R/bin/busybox sh $R/sbin/apk --root $R --arch aarch64 update 2>&1 | tail -3
echo "== wrapper 后："
echo "== log =="; tail -3 $R/tmp/apk-proxy.log