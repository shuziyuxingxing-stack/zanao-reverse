#!/system/bin/sh
R=/data/data/io.github.whywood.deepdeep.local/files/linux/rootfs
L=$R/lib/ld-musl-aarch64.so.1
LP=$R/lib:$R/usr/lib
echo "== 恢复 App 默认的 https 源，测直连 =="
echo https://dl-cdn.alpinelinux.org/alpine/v3.24/main >  $R/etc/apk/repositories
echo https://dl-cdn.alpinelinux.org/alpine/v3.24/community >> $R/etc/apk/repositories
$L --library-path $LP $R/sbin/apk.real --root $R --arch aarch64 update 2>&1 | tail -4