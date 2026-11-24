#!/system/bin/sh
R=/data/data/io.github.whywood.deepdeep.local/files/linux/rootfs
L=$R/lib/ld-musl-aarch64.so.1
LP=$R/lib:$R/usr/lib
F=/data/local/tmp/repo.test
printf 'https://dl-cdn.alpinelinux.org/alpine/v3.24/main\nhttps://dl-cdn.alpinelinux.org/alpine/v3.24/community\n' > $F
$L --library-path $LP $R/bin/busybox sed -i 's#https://dl-cdn\.alpinelinux\.org#http://mirrors.ustc.edu.cn#g' $F
echo "== rewrite result =="
cat $F
echo "== 单文件安装复测（无代理）=="
echo http://mirrors.ustc.edu.cn/alpine/v3.24/main >  $R/etc/apk/repositories
echo http://mirrors.ustc.edu.cn/alpine/v3.24/community >> $R/etc/apk/repositories
$L --library-path $LP $R/sbin/apk.real --root $R --arch aarch64 add ripgrep 2>&1 | tail -3