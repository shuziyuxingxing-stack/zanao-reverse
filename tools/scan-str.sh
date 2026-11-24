#!/system/bin/sh
R=/data/data/io.github.whywood.deepdeep.local/files/linux/rootfs
echo "== 在 rootfs 二进制里找这条字符串 =="
for f in $R/bin/* $R/sbin/* $R/usr/bin/* $R/usr/sbin/*; do
  [ -f "$f" ] || continue
  if grep -a -q "Unable to open log" "$f" 2>/dev/null; then echo "HIT: $f"; fi
done
echo "== done =="