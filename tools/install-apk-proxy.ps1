<#
.SYNOPSIS
  给 deepdeep（io.github.whywood.deepdeep.local）内置 Alpine 环境装上「apk 代理自动探测」。
  幂等：rootfs 被「重新准备内置环境」重建后再跑一次即可。

.EXAMPLE
  pwsh -File install-apk-proxy.ps1
  pwsh -File install-apk-proxy.ps1 -Device DEVICE_SERIAL -ProxyPort 8899
#>
param(
    [string]$Device = '',
    [int]$WaitSeconds = 60,
    [int]$ProxyPort = 8899,
    [string]$Package = 'io.github.whywood.deepdeep.local'
)

$ErrorActionPreference = 'Stop'
$here = Split-Path -Parent $MyInvocation.MyCommand.Path
$adb = (Get-Command adb -ErrorAction SilentlyContinue).Source
if (-not $adb) { $adb = 'D:\Android-Studio-SDK\platform-tools\adb.exe' }
$py = 'D:\rea environments needed\python-venv\Scripts\python.exe'
if (-not (Test-Path $py)) { $py = (Get-Command python).Source }

$root = "/data/data/$Package/files/linux/rootfs"

function Test-ProxyPort([int]$p) {
    $code = & curl.exe -sS -m 6 -x "http://127.0.0.1:$p" -o NUL -w "%{http_code}" "http://mirrors.ustc.edu.cn/alpine/v3.24/main/aarch64/" 2>$null
    return ("$code" -match '^(200|301|302)')
}

function Get-Device {
    $out = & $adb devices | Select-String '^\S+\s+device$'
    if (-not $out) { return $null }
    $ids = $out | ForEach-Object { ($_.Line -split '\s+')[0] }
    if ($Device) { return ($ids | Where-Object { $_ -eq $Device } | Select-Object -First 1) }
    return ($ids | Select-Object -First 1)
}

Write-Host "[1/5] 等待设备..." -ForegroundColor Cyan
$deadline = (Get-Date).AddSeconds($WaitSeconds)
$dev = Get-Device
while (-not $dev -and (Get-Date) -lt $deadline) { Start-Sleep -Seconds 2; $dev = Get-Device }
if (-not $dev) { throw "没有找到设备（$WaitSeconds 秒）" }
Write-Host "      $dev"

Write-Host "[2/5] 检查本机代理 :$ProxyPort ..." -ForegroundColor Cyan
if (-not (Test-ProxyPort $ProxyPort)) {
    Start-Process -FilePath $py -ArgumentList @("$here\proxy_log.py", "$ProxyPort", (Join-Path $here 'proxy.log')) -WindowStyle Hidden
    for ($i = 0; $i -lt 10; $i++) { Start-Sleep -Milliseconds 800; if (Test-ProxyPort $ProxyPort) { break } }
    if (-not (Test-ProxyPort $ProxyPort)) { throw "代理起不来（$ProxyPort）" }
    Write-Host "      已启动 proxy_log.py"
} else { Write-Host "      代理可用" }
& $adb -s $dev reverse "tcp:$ProxyPort" "tcp:$ProxyPort" | Out-Null
Write-Host "      adb reverse 就绪"

Write-Host "[3/5] 安装 wrapper..." -ForegroundColor Cyan
& $adb -s $dev push "$here\apk-proxy-wrapper.sh" /data/local/tmp/apk-wrapper.sh | Out-Null

$patch = @"
#!/system/bin/sh
set -e
R=$root
[ -d "`$R/sbin" ] || { echo ROOTFS_MISSING; exit 3; }
[ -f "`$R/sbin/apk.real" ] || cp -a "`$R/sbin/apk" "`$R/sbin/apk.real"
cp /data/local/tmp/apk-wrapper.sh "`$R/sbin/apk"
chmod 755 "`$R/sbin/apk"
chown 10293:10293 "`$R/sbin/apk" 2>/dev/null || true
rm -f /tmp/apk-proxy.cache
echo http://mirrors.ustc.edu.cn/alpine/v3.24/main >  "`$R/etc/apk/repositories"
echo http://mirrors.ustc.edu.cn/alpine/v3.24/community >> "`$R/etc/apk/repositories"
echo WRAPPER_OK
"@
$patchFile = Join-Path $here 'patch-env.sh'
[System.IO.File]::WriteAllText($patchFile, ($patch -replace "`r`n", "`n"), (New-Object System.Text.UTF8Encoding($false)))
& $adb -s $dev push $patchFile /data/local/tmp/patch-env.sh | Out-Null

$r = & $adb -s $dev shell 'su -c "sh /data/local/tmp/patch-env.sh"' 2>&1
Write-Host "      $($r -join ' ')"
if (($r -join '') -notmatch 'WRAPPER_OK') { throw "wrapper 安装失败: $r" }

Write-Host "[4/5] 自检..." -ForegroundColor Cyan
$L = "$root/lib/ld-musl-aarch64.so.1 --library-path $root/lib:$root/usr/lib"
$chk = & $adb -s $dev shell "su -c `"$L $root/bin/busybox sh $root/sbin/apk --version 2>&1 | head -2`"" 2>&1
Write-Host "      $($chk -join ' ')"
$upd = & $adb -s $dev shell "su -c `"$L $root/bin/busybox sh $root/sbin/apk --root $root --arch aarch64 update 2>&1 | tail -3`"" 2>&1
Write-Host "      $($upd -join ' ')"
$log = & $adb -s $dev shell 'su -c "tail -3 /tmp/apk-proxy.log 2>/dev/null"' 2>&1
Write-Host "      探测日志: $($log -join ' ')" -ForegroundColor Green

Write-Host ""
Write-Host "完成。回 App 点「安装组合」（保持 USB 与代理进程）。" -ForegroundColor Green
Write-Host "回滚: su -c 'mv $root/sbin/apk.real $root/sbin/apk'"
