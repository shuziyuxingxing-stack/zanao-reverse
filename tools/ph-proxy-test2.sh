#!/system/bin/sh
R=/data/data/io.github.whywood.deepdeep.local/files/linux/rootfs
L=$R/lib/ld-musl-aarch64.so.1
LP=$R/lib:$R/usr/lib
P=127.54.178.30:38793
echo "== update via $P =="
http_proxy=http://$P https_proxy=http://$P $L --library-path $LP $R/sbin/apk.real --root $R --arch aarch64 update 2>&1 | tail -3
echo "== add ripgrep via $P =="
http_proxy=http://$P https_proxy=http://$P $L --library-path $LP $R/sbin/apk.real --root $R --arch aarch64 add ripgrep 2>&1 | tail -4
ls -la $R/usr/bin/rg 2>&1 | head -1