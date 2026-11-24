#!/system/bin/sh
R=/data/data/io.github.whywood.deepdeep.local/files/linux/rootfs
echo "== 修复前 =="
ls -la $R/var/log/apk.log 2>&1
cat $R/etc/apk/repositories
echo "== 修复 =="
rm -f $R/var/log/apk.log
chown -R 10293:10293 $R/var/log $R/etc/apk $R/lib/apk $R/tmp 2>/dev/null
chmod 755 $R/var/log
echo http://mirrors.ustc.edu.cn/alpine/v3.24/main >  $R/etc/apk/repositories
echo http://mirrors.ustc.edu.cn/alpine/v3.24/community >> $R/etc/apk/repositories
echo "== 修复后 =="
ls -la $R/var/log
cat $R/etc/apk/repositories
ls -ld $R/var/log $R/tmp