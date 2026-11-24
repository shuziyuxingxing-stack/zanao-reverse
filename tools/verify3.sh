#!/system/bin/sh
L=/data/data/io.github.whywood.deepdeep.local/files/linux/rootfs/lib/ld-musl-aarch64.so.1
LP=/data/data/io.github.whywood.deepdeep.local/files/linux/rootfs/lib:/data/data/io.github.whywood.deepdeep.local/files/linux/rootfs/usr/lib
BB=/data/data/io.github.whywood.deepdeep.local/files/linux/rootfs/bin/busybox
echo "== HEAD via nc -> proxy =="
printf 'HEAD http://mirrors.ustc.edu.cn/ HTTP/1.0\r\nHost: mirrors.ustc.edu.cn\r\n\r\n' | $L --library-path $LP $BB nc -w 4 127.0.0.1 8899 2>&1 | head -3
echo "== apk update via proxy =="
http_proxy=http://127.0.0.1:8899 $L --library-path $LP $root/sbin/apk.real --root /data/data/io.github.whywood.deepdeep.local/files/linux/rootfs --arch aarch64 update 2>&1 | tail -2
echo "== done =="