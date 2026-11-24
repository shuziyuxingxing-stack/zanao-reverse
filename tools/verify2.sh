#!/system/bin/sh
L=/data/data/io.github.whywood.deepdeep.local/files/linux/rootfs/lib/ld-musl-aarch64.so.1
LP=/data/data/io.github.whywood.deepdeep.local/files/linux/rootfs/lib:/data/data/io.github.whywood.deepdeep.local/files/linux/rootfs/usr/lib
BB=/data/data/io.github.whywood.deepdeep.local/files/linux/rootfs/bin/busybox
echo "== direct =="
$L --library-path $LP $BB wget -q -T 5 -O - http://mirrors.ustc.edu.cn/ 2>&1 | head -c 60; echo
echo "== via proxy 8899 =="
http_proxy=http://127.0.0.1:8899 $L --library-path $LP $BB wget -q -T 6 -O - http://mirrors.ustc.edu.cn/ 2>&1 | head -c 60; echo
echo "== done =="