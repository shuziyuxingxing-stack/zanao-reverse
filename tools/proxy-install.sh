#!/system/bin/sh
R=/data/data/io.github.whywood.deepdeep.local/files/linux/rootfs
L=$R/lib/ld-musl-aarch64.so.1
LP=$R/lib:$R/usr/lib
echo "== 走代理安装 ripgrep =="
http_proxy=http://127.0.0.1:8899 https_proxy=http://127.0.0.1:8899 $L --library-path $LP $R/sbin/apk.real --root $R --arch aarch64 add ripgrep 2>&1 | tail -4
echo "== 结果 =="
ls -la $R/usr/bin/rg 2>&1 | head -1