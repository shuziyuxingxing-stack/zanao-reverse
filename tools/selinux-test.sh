#!/system/bin/sh
R=/data/data/io.github.whywood.deepdeep.local/files/linux/rootfs
echo "== SELinux / 属主 =="
ls -ldZ $R $R/var $R/var/log $R/tmp 2>&1
echo "== 以 10293 写测试 =="
su 10293 -c "id; touch $R/tmp/x1 && echo tmp_ok || echo tmp_fail; touch $R/var/log/x2 && echo varlog_ok || echo varlog_fail"
echo "== 以 10293 写 app 私有目录 =="
su 10293 -c "touch /data/data/io.github.whywood.deepdeep.local/files/zz_test && echo files_ok || echo files_fail"