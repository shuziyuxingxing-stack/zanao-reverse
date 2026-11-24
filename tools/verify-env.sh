#!/system/bin/sh
L=/data/data/io.github.whywood.deepdeep.local/files/linux/rootfs/lib/ld-musl-aarch64.so.1
LP=/data/data/io.github.whywood.deepdeep.local/files/linux/rootfs/lib:/data/data/io.github.whywood.deepdeep.local/files/linux/rootfs/usr/lib
echo "== files =="; ls -la /data/data/io.github.whywood.deepdeep.local/files/linux/rootfs/sbin/apk /data/data/io.github.whywood.deepdeep.local/files/linux/rootfs/sbin/apk.real 2>&1
echo "== repos =="; cat /data/data/io.github.whywood.deepdeep.local/files/linux/rootfs/etc/apk/repositories
echo "== apk.real 直连 loader =="; $L --library-path $LP /data/data/io.github.whywood.deepdeep.local/files/linux/rootfs/sbin/apk.real --version 2>&1 | head -1
echo "== wrapper 语法 =="; $L --library-path $LP /data/data/io.github.whywood.deepdeep.local/files/linux/rootfs/bin/busybox sh -n /data/data/io.github.whywood.deepdeep.local/files/linux/rootfs/sbin/apk && echo SYNTAX_OK
echo "== busybox wget 走代理 =="; $L --library-path $LP $root/usr/bin/env http_proxy=http://127.0.0.1:8899 https_proxy=http://127.0.0.1:8899 $root/bin/busybox wget -q -T 6 -O - http://mirrors.ustc.edu.cn/alpine/v3.24/main/aarch64/ 2>&1 | head -c 60
echo
echo "== done =="