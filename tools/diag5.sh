#!/system/bin/sh
R=/data/data/io.github.whywood.deepdeep.local/files/linux/rootfs
L=$R/lib/ld-musl-aarch64.so.1
LP=$R/lib:$R/usr/lib
echo "== 现有 log 相关文件/目录 =="
ls -la $R/var/log 2>&1 | head -5
find $R -maxdepth 3 -name 'log' 2>/dev/null | head -5
echo "== 把 var/log 设为只读，再装包，看是否复现 =="
chmod 555 $R/var/log
http_proxy=http://127.0.0.1:8899 $L --library-path $LP $R/sbin/apk.real --root $R --arch aarch64 add tree 2>&1 | tail -4
chmod 755 $R/var/log