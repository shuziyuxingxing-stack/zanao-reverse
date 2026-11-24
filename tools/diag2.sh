#!/system/bin/sh
P=/data/data/io.github.whywood.deepdeep.local
echo "== 最近修改的文件（files 下，排除 rootfs 内部）=="
find $P/files -maxdepth 3 -mmin -15 -not -path "*/rootfs/*" 2>/dev/null | head -20
echo "== rootfs 下最近修改（排除 usr/lib）=="
find $P/files/linux/rootfs -maxdepth 2 -mmin -15 2>/dev/null | head -20
echo "== 可能的日志文件 =="
find $P/files -maxdepth 4 -name "*.log" 2>/dev/null | head -20