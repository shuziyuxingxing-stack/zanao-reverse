#!/system/bin/sh
R=/data/data/io.github.whywood.deepdeep.local/files/linux/rootfs
echo "== 回滚前 =="
ls -la $R/sbin/apk $R/sbin/apk.real 2>&1
echo "== 恢复真 apk =="
if [ -f "$R/sbin/apk.real" ]; then
  rm -f "$R/sbin/apk"
  mv "$R/sbin/apk.real" "$R/sbin/apk"
  chown 10293:10293 "$R/sbin/apk"
  chmod 755 "$R/sbin/apk"
fi
rm -f "$R/tmp/apk-proxy.use" "$R/tmp/apk-proxy.log"
echo "== 恢复原始 resolv.conf / repositories =="
echo "nameserver 10.73.49.253" > "$R/etc/resolv.conf"
echo "https://dl-cdn.alpinelinux.org/alpine/v3.24/main" > "$R/etc/apk/repositories"
echo "https://dl-cdn.alpinelinux.org/alpine/v3.24/community" >> "$R/etc/apk/repositories"
chown 10293:10293 "$R/etc/resolv.conf" "$R/etc/apk/repositories"
echo "== 回滚后 =="
ls -la $R/sbin/apk 2>&1
file $R/sbin/apk 2>/dev/null | head -1
cat $R/etc/apk/repositories
cat $R/etc/resolv.conf