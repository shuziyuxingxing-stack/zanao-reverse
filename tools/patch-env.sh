#!/system/bin/sh
set -e
R=/data/data/io.github.whywood.deepdeep.local/files/linux/rootfs
[ -d "$R/sbin" ] || { echo ROOTFS_MISSING; exit 3; }
[ -f "$R/sbin/apk.real" ] || cp -a "$R/sbin/apk" "$R/sbin/apk.real"
cp /data/local/tmp/apk-wrapper.sh "$R/sbin/apk"
chmod 755 "$R/sbin/apk"
chown 10293:10293 "$R/sbin/apk" 2>/dev/null || true
rm -f /tmp/apk-proxy.cache
echo http://mirrors.ustc.edu.cn/alpine/v3.24/main >  "$R/etc/apk/repositories"
echo http://mirrors.ustc.edu.cn/alpine/v3.24/community >> "$R/etc/apk/repositories"
echo WRAPPER_OK