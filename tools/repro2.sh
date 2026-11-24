#!/system/bin/sh
R=/data/data/io.github.whywood.deepdeep.local/files/linux/rootfs
L=$R/lib/ld-musl-aarch64.so.1
LP=$R/lib:$R/usr/lib
echo "== cwd=\$R/tmp（可写）=="
su 10293 -c "cd $R/tmp && $L --library-path $LP $R/sbin/apk --root $R --arch aarch64 update" 2>&1 | tail -3
echo "== cwd=/data/local/tmp（不可写）=="
su 10293 -c "cd /data/local/tmp && $L --library-path $LP $R/sbin/apk --root $R --arch aarch64 update" 2>&1 | tail -3
echo "== 是否生成 log 文件 =="
ls -la $R/tmp/log /data/local/tmp/log 2>&1 | head -4
echo "== apk --help 全量（找 log）=="
$L --library-path $LP $R/sbin/apk --help 2>&1 | head -40