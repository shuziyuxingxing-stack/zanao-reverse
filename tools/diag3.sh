#!/system/bin/sh
R=/data/data/io.github.whywood.deepdeep.local/files/linux/rootfs
echo "== wrapper log =="
cat $R/tmp/apk-proxy.log 2>&1 | tail -10
echo "== use =="
cat $R/tmp/apk-proxy.use
echo "== apk.real 里的 log 相关字符串 =="
grep -a -o "open log[^\"]\{0,40\}" $R/sbin/apk.real 2>/dev/null | head -3
grep -a -o "Unable to open[^\"]\{0,40\}" $R/sbin/apk.real 2>/dev/null | head -3
echo "== 已装包数 =="
ls $R/lib/apk/db/installed >/dev/null && grep -c '^P:' $R/lib/apk/db/installed