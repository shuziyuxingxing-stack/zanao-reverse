#!/system/bin/sh
R=/data/data/io.github.whywood.deepdeep.local/files/linux/rootfs
L=$R/lib/ld-musl-aarch64.so.1
LP=$R/lib:$R/usr/lib
echo "== apk 是否支持 --log =="
$L --library-path $LP $R/sbin/apk --help 2>&1 | grep -i -E "log|verbose" | head -6
echo "== 各目录属主 =="
ls -ld $R/var $R/var/log $R/tmp $R/etc/apk $R/lib/apk/db 2>&1
echo "== 运行中的 deepdeep 进程 uid =="
ps -A -o uid,pid,args 2>/dev/null | grep -i deepdeep | head -5
echo "== rootfs 顶层属主 =="
ls -ld $R