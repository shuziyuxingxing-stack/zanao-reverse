#!/bin/sh
# deepdeep 内置 Alpine 环境：apk 包装器
#   1) 把 /etc/apk/repositories 与 --repository 参数里的 https 官方源改成 http 国内镜像
#      （rootfs 里 https 走不通：apk 报 DNS/TLS 错；http 可用）
#   2) 尝试走代理（<rootfs>/tmp/apk-proxy.use，默认 127.0.0.1:8899），失败回落直连
# 日志：<rootfs>/tmp/apk-proxy.log

SELF_DIR=$(cd "$(dirname "$0")" && pwd)
REAL="$SELF_DIR/apk.real"
ROOT=$(cd "$SELF_DIR/.." && pwd)
TMPD="$ROOT/tmp"
[ -d "$TMPD" ] || TMPD=/tmp
LOG="$TMPD/apk-proxy.log"
USE="$TMPD/apk-proxy.use"
DEFAULT_PROXY="127.0.0.1:8899"
MIRROR="http://mirrors.ustc.edu.cn"
REPOS="$ROOT/etc/apk/repositories"

log() { echo "$(date '+%F %T') $*" >> "$LOG" 2>/dev/null; }

# 1) 仓库文件纠偏
if [ -f "$REPOS" ]; then
    if grep -q 'https://dl-cdn.alpinelinux.org\|https://mirror' "$REPOS" 2>/dev/null; then
        sed -i 's#https://dl-cdn\.alpinelinux\.org#http://mirrors.ustc.edu.cn#g; s#https://mirror\.\([a-z]*\)\.\([a-z.]*\)#http://mirrors.ustc.edu.cn#g' "$REPOS" 2>/dev/null
        log "apk: 已把 repositories 改成 http 镜像"
    fi
fi

# 2) 参数里带 https 官方源也换掉（不破坏引号：弹出再追加）
n=$#
i=0
while [ "$i" -lt "$n" ]; do
    a="$1"; shift
    case "$a" in
        *dl-cdn.alpinelinux.org*|*https://mirror.*)
            a=$(printf '%s' "$a" | sed 's#https://dl-cdn\.alpinelinux\.org#http://mirrors.ustc.edu.cn#g; s#https://mirror\.[a-z]*\.[a-z.]*#http://mirrors.ustc.edu.cn#g')
            log "apk: 参数来源改写 -> $a"
            ;;
    esac
    set -- "$@" "$a"
    i=$((i + 1))
done

# 3) 代理
if [ -n "$http_proxy" ] || [ -n "$https_proxy" ] || [ -n "$HTTP_PROXY" ] || [ -n "$HTTPS_PROXY" ]; then
    [ -z "$http_proxy" ] && http_proxy="$HTTP_PROXY"
    [ -z "$https_proxy" ] && https_proxy="$HTTPS_PROXY"
    export http_proxy https_proxy
    log "apk: 使用外部代理 $http_proxy"
    exec "$REAL" "$@"
fi

P=$(cat "$USE" 2>/dev/null | tr -d '\r\n ')
[ -n "$P" ] || P="$DEFAULT_PROXY"

http_proxy="http://$P" https_proxy="http://$P" "$REAL" "$@"
rc=$?
if [ "$rc" -eq 0 ]; then
    log "apk: 经代理 $P 成功"
    exit 0
fi
log "apk: 代理 $P 失败(rc=$rc)，改直连重试"
"$REAL" "$@"
rc2=$?
log "apk: 直连 rc=$rc2"
exit "$rc2"
