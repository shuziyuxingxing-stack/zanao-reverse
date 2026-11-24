#!/system/bin/sh
R=/data/data/io.github.whywood.deepdeep.local/files/linux/rootfs
L=$R/lib/ld-musl-aarch64.so.1
LP=$R/lib:$R/usr/lib
echo "== apk 里的 Unable to open 片段 =="
grep -a -o "Unable to open[^ ]\{0,20\}" $R/sbin/apk 2>/dev/null | sort -u | head -10
echo "== 附近字符串 =="
grep -a -o "[ -~]\{0,30\}log[ -~]\{0,30\}" $R/sbin/apk 2>/dev/null | sort -u | head -20
echo "== 全局选项 =="
$L --library-path $LP $R/sbin/apk --help 2>&1 | sed -n '40,80p'