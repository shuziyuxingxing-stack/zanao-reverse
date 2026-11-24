#!/system/bin/sh
R=/data/data/io.github.whywood.deepdeep.local/files/linux/rootfs
L=$R/lib/ld-musl-aarch64.so.1
LP=$R/lib:$R/usr/lib
printf 'nameserver 223.5.5.5\nnameserver 8.8.8.8\n' > $R/etc/resolv.conf
echo http://mirrors.ustc.edu.cn/alpine/v3.24/main >  $R/etc/apk/repositories
echo http://mirrors.ustc.edu.cn/alpine/v3.24/community >> $R/etc/apk/repositories
echo "== 无代理 update（http 源 + 新 DNS）=="
$L --library-path $LP $R/sbin/apk.real --root $R --arch aarch64 update 2>&1 | tail -3
echo "== 无代理安装 tree2 测试（用已有包 tree 卸载重装）=="
$L --library-path $LP $R/sbin/apk.real --root $R --arch aarch64 add --force-overwrite tree 2>&1 | tail -4