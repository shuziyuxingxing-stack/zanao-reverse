#!/system/bin/sh
R=/data/data/io.github.whywood.deepdeep.local/files/linux/rootfs
L=$R/lib/ld-musl-aarch64.so.1
LP=$R/lib:$R/usr/lib
for ns in 10.73.49.253 8.8.8.8 223.5.5.5 1.1.1.1 192.168.1.1; do
  echo "--- DNS $ns ---"
  $L --library-path $LP $R/bin/busybox nslookup dl-cdn.alpinelinux.org $ns 2>&1 | tail -3
done