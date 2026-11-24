#!/system/bin/sh
L=/data/data/io.github.whywood.deepdeep.local/files/linux/rootfs/lib/ld-musl-aarch64.so.1
LP=/data/data/io.github.whywood.deepdeep.local/files/linux/rootfs/lib:/data/data/io.github.whywood.deepdeep.local/files/linux/rootfs/usr/lib
echo "== 通过代理解析索引并装一个小包(tree) =="
http_proxy=http://127.0.0.1:8899 https_proxy=http://127.0.0.1:8899 $L --library-path $LP /data/data/io.github.whywood.deepdeep.local/files/linux/rootfs/sbin/apk.real --root /data/data/io.github.whywood.deepdeep.local/files/linux/rootfs --arch aarch64 add tree 2>&1 | tail -6
echo "== 结果 =="
ls -la /data/data/io.github.whywood.deepdeep.local/files/linux/rootfs/usr/bin/tree 2>&1 | head -1