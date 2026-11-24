#!/system/bin/sh
R=/data/data/io.github.whywood.deepdeep.local/files/linux/rootfs
L=$R/lib/ld-musl-aarch64.so.1
LP=$R/lib:$R/usr/lib
A="$L --library-path $LP $R/sbin/apk"
run() { echo "--- $1 ---"; shift; su 10293 -c "$*" 2>&1 | tail -2; }
run baseline        "$A --root $R --arch aarch64 update"
run APK_LOG         "APK_LOG=/dev/null $A --root $R --arch aarch64 update"
run APK_LOG_FILE    "APK_LOG_FILE=/dev/null $A --root $R --arch aarch64 update"
run HOME=/tmp       "HOME=/tmp $A --root $R --arch aarch64 update"
run --log-file      "$A --log-file /tmp/apk.log --root $R --arch aarch64 update"