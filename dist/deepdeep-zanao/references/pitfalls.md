# 踩过的坑 / 排查手册

## 工具返回 `no token`

设备上 App 没登录，或请求还没发出来。

1. 手动打开一次 App，确认已登录；
2. 重跑；
3. 仍失败就显式传会话：`--token ... --alias sysu --device ...`（见下）。

## 工具返回 `no result from device`

按顺序看 `log` 字段里的尾巴：

| 现象 | 原因 | 处理 |
|---|---|---|
| `Java is not defined` / `Java bridge not available` | 用 Python API 加载了脚本 | 必须走 `frida` CLI（本插件的 CLI 已经这么做了） |
| 输出在 `Resuming main thread!` 后立刻 `Thank you for using Frida!` | frida CLI 的 stdin 被关了，进程退出 | `Popen(stdin=PIPE)` 不要提前关闭 |
| `art_quick_invoke_static_stub` 崩溃栈 | 极少数偶发（App 冷启动时序） | 重跑一次；连续两次再查设备状态 |
| 空输出且无报错 | 设备侧 frida-server 挂了 | `frida-ps -H 127.0.0.1:39999` 验证，必要时 `adb shell su -c '/data/local/tmp/frida-server &'` |

## `errno: null` / `http: 502`

- `errno null` 通常是**响应被加密但没解**：检查是否命中 `x-sc-encrypt`（插件已处理；老脚本没有）。
- `http 502` 偶发，重跑一次；连续 502 说明设备网络断了。

## `errno 3 sorry, illegal request`

路径写错。不要带 `/sc-api` 前缀，直接 `/thread/v2/list`。

## `errno 10 无操作权限`

调了 `/thread/admin/*` 或 `/mx/admin/*`。这些是管理员接口，普通账号永远被拒，不是参数问题。

## `errno 10 参数非法 / ID非法`

参数名不对，实测正确值：

| 接口 | 正确参数 |
|---|---|
| `/thread/info` | `{"id": thread_id}` |
| `/comment/list` | `{"id": thread_id, "page": 1}` |
| `/mx/thread/info` | `{"id": thread_id}` |
| `/user/usershow` | `{"thread_id": ...}` 或 `{"comment_id": ...}` |
| `/user/certinfo` | `{"school_id": "..."}`（GET） |

## 拿不到的东西（别试了）

| 目标 | 结论 |
|---|---|
| 别人姓名 / 学号 / 学生证照 | 需要对方 token；`/user/certinfo` 只认 token |
| 别人明文 uid | 只给不可解密文（`thread/info.detail.user_id`） |
| 匿名帖作者真实身份 | 列表给匿名头像，但 `user/show` 会回真实昵称+头像（App 缺陷，插件不主动强调） |
| 管理员能力 | 21 条写接口 + 8 条读接口全 `无操作权限` |

## 设备侧手工取一次会话（兜底）

```bash
adb forward tcp:39999 tcp:39999
frida -H 127.0.0.1:39999 -f com.comingx.zanao -l scripts/_driver.js   # 渲染过的版本
# 或者用老的 capture 脚本，日志里 grep X-Sc-Token
```

拿到后：

```bash
python scripts/zanao_cli.py --token '<值>' --alias sysu --device '<uuid>' self
```

## 无 root 设备怎么办

插件默认要求 root + frida。没有 root 时唯一的替代是**明文抓包**：
让设备走电脑代理（`scripts/proxy_log.py`），从请求头里取 `X-Sc-Token`，
再用一台有 root 的机器做签名端（签名与账号无关，任意设备算出的签名都能用）。
