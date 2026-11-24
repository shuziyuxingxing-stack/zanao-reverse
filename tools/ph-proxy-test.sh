#!/system/bin/sh
R=/data/data/io.github.whywood.deepdeep.local/files/linux/rootfs
L=$R/lib/ld-musl-aarch64.so.1
LP=$R/lib:$R/usr/lib
echo http://mirrors.ustc.edu.cn/alpine/v3.24/main >  $R/etc/apk/repositories
echo http://mirrors.ustc.edu.cn/alpine/v3.24/community >> $R/etc/apk/repositories
for P in 127.54.178.30:38793 127.60.184.177:41531; do
  echo "=== try proxy $P ==="
  http_proxy=http://$P https_proxy=http://$P $L --library-path $LP $R/sbin/apk.real --root $R --arch aarch64 --no-cache add ripgrep 2>&1 | tail -3
done