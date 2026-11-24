# 校园集市（zanao）插件 — 交接文档

> 面向：接手本插件的工程师/Agent
> 目标宿主：Android App **deepdeep**（`io.github.whywood.deepdeep`）
> 目标能力：自然语言让 AI 以**非 GUI**方式读校园集市（`com.comingx.zanao`）的帖子、搜索、批量收割、汇总

---

## 1. 一句话现状

插件包已写好、MCP 工具链已通、**已用一个真实认证号跑通**（`thread_list` / `harvest` / `whoami` 返回 `errno 0` 与真实数据）。
唯一未完成的是**离线签名器**（现在依赖 frida 在 App 进程内签名）。

---

## 2. 目标 App 事实（已实测）

### 2.1 两个网关

| 网关 | 地址 | 认证方式 | 结论 |
|---|---|---|---|
| **App 通道** | `http://api.app.zanao.com`（**80 端口明文**） | `X-Sc-Token` 头 + `X-Sc-Ah` 签名 | 数据最全，**需要签名** |
| Web 通道 | `https://c.zanao.com/sc-api` | Cookie `user_token` + `X-Sc-Client: h5` | **不需要签名**，但拿不到 App token 的账号（两套会话不通） |

关键：**App 通道是明文 HTTP**，所以 token 可以在无 root 手机上用代理直接抓（见 §6）。

### 2.2 签名机制

```
X-Sc-Ah = MessageDigest( 排序后的 k=v 用 & 连接 + "&secretkey=" + secretkey )  → 32 位大写十六进制
```

实际抓到的签名原文（frida hook 得到）：

```
from=home&id=2186125324&randnum__=56124810751823774590&timestamp__=1794468822&secretkey=t6l9m3h7dLt1oqu3hKSivXiBo420fnavcaF5abR4sXm3rn26cKWVpg==
```

- 参数按字典序排列（`randnum__`、`timestamp__` 与请求 data 的键一起排）
- `secretkey` **每次请求都不同**，40–44 字符 base64，由 `libAesNew.so` 用 AES 派生（引用 `AES/CBC/PKCS5Padding` / `SecretKeySpec` / `IvParameterSpec`，唯一引用点在 .so 的 `0x27998`）
- 调用链：`JSIs/NetworkJSI` → `p000.yp0.m15295b` → `JniUtils.makeSign(SortedMap)`（native）

### 2.3 请求头（App 通道，实测）

```
X-Sc-Client: app          X-Sc-Platform: Android
X-Sc-Token: <token>       X-Sc-Alias: sysu
X-Sc-Device: <uuid>       X-Sc-Version: 3.1.0
X-Sc-Td: <unix 秒>        X-Sc-Nd: <20 位随机数>
X-Sc-Hb-V: 210            X-Sc-Nt-V: 310
X-Sc-Ah: <签名>
```

### 2.4 常用接口

| 接口 | 说明 |
|---|---|
| `POST /thread/v2/list` | 列表，body `{page, per_page}`；带 `cate_id=latest&from_time=0&with_comment=true&with_reply=true` 时最接近 App 行为 |
| `POST /thread/info` | 详情，body `{id}` |
| `POST /comment/list` | 评论，body `{id, page}` |
| `POST /user/usershow` | 作者画像，body `{thread_id}` 或 `{comment_id}` |
| `POST /thread/search` | 搜索（**参数名尚未确认**，见 §7） |
| `POST /user/v1/profile` | 自己：`user_id / nickname / cert_status` |
| `POST /user/certinfo` | 自己的认证字段（只回自己） |

`errno` 语义：`0` 成功 · `3` 路由不存在 · `6` 签名校验失败 · `10` 参数/业务错误 · `20` 未登录

---

## 3. 包结构

```
deepdeep-zanao/
├── SKILL.md                    # 技能说明（给 Agent 读的行为规范）
├── README.md
├── cordis.patch.snippet.yml    # MCP 注册片段（dsh 格式，deepdeep 需按其插件清单改写）
├── mcp/server.py               # MCP stdio server（零第三方依赖，JSON-RPC）
├── web/zanao_web.py            # web 通道客户端（Cookie，无需 root）
├── scripts/zanao_cli.py        # device 通道 CLI（frida 进程内签名）
├── scripts/_driver.js          # frida driver：抓会话 / 签名 / 发请求 / 收割
├── scripts/proxy_log.py        # 明文 HTTP 记录代理（抓 token 用）
└── references/
    ├── protocol.md             # 协议笔记
    └── pitfalls.md             # 踩坑记录
```

## 4. 工具清单（MCP）

`zanao_login` · `zanao_import_cookie` · `zanao_status` · `zanao_diagnose` · `zanao_thread_list` · `zanao_search` · `zanao_harvest` · `zanao_thread_info` · `zanao_comments` · `zanao_user_show` · `zanao_whoami` · `zanao_certinfo` · `zanao_raw`

两种后端由环境变量切换：

```
ZANAO_MODE=web      # 只要账号密码 / Cookie
ZANAO_MODE=device   # frida + 手机，签名在 App 内算
ZANAO_FRIDA=127.0.0.1:39999
```

## 5. 已验证可用（真实数据）

```
zanao_thread_list  → errno 0，返回中山大学 10 条帖子（含标题/昵称/头像/分类）
zanao_whoami       → user_id 1998502067, nickname uvkfrh, cert_status "30"（认证号）
zanao_harvest      → 翻页 30 条；去重 4；按关键词打分过滤；返回候选集
```

device 模式命令行：

```powershell
adb forward tcp:39999 tcp:39999
python scripts/zanao_cli.py thread-list --json
python scripts/zanao_cli.py harvest --keyword "宿舍 外卖" --pages 3 --limit 10 --json
```

会话（token/alias/device）默认从 `~/.zanao/app_session.json` 读取，不用每次传参。

---

## 6. 怎么拿到 token（无 root 手机也可）

App 通道是 **明文 HTTP**，所以：

1. PC 上跑 `scripts/proxy_log.py 8899 proxy.log`
2. `adb reverse tcp:8899 tcp:8899`
3. 手机 WLAN → 该网络 → 代理 → 手动 → `127.0.0.1 : 8899`
4. 打开集市 App，随便刷新一下
5. `proxy.log` 里就有 `X-Sc-Token: ...` 和完整请求头

（本次认证号 token 就是这么拿到的。）

---

## 7. 未完成 / 已知问题

### 7.1 搜索接口参数未知（低优先级）

`/thread/search` 返回 `errno 0` 但内容是普通时间线（客户端算 `score` 全为 0），说明关键词字段名不对。
**临时方案**：用 `zanao_harvest`，它在客户端做关键词打分，结果准确。

### 7.2 离线签名器（核心缺口）

现在签名依赖设备上的 frida。要脱离设备需要还原 `secretkey` 的生成：

- 已确认：`secretkey` = 40/44 字符，随请求变化，由 `libAesNew.so` 派生
- 已确认：AES 调用点唯一，位于 .so 偏移 `0x27998` 附近
- 已知难点：AES 的 key/iv 不是以 `byte[]` 传入 Java 层（hook `SetByteArrayRegion` 只看到 40/181 字节的参数串和 4 字节随机量），需要在原生 AES 函数上下断点
- 建议路线：Frida 17 的 Java 桥需单独打包（`frida-java-bridge` + `frida-compile`）；或用 frida 16 + 老设备

拿到 key/iv 后即可：

```python
secretkey = base64(AES_CBC(td|nd, KEY, IV))
sign = md5(sorted_params + "&secretkey=" + secretkey).upper()
```

---

## 8. 装进 deepdeep App

App 内技能目录（实测存在）：

```
/data/data/io.github.whywood.deepdeep/files/skills/<name>/
/data/data/io.github.whywood.deepdeep/files/plugins/      # 插件（MCP）
/data/data/io.github.whywood.deepdeep/files/market/       # 插件市场缓存
```

做法：

1. 把整个 `deepdeep-zanao/` 推到 `files/skills/zanao/`
2. 按 deepdeep 的插件清单格式（参考 `files/plugins/` 里现有插件）登记 MCP：
   - `command`: 一个可用的 python（App 的 Linux 环境里需 `requests`；或改 `mcp/server.py` 走标准库 http.client 以去除依赖）
   - `args`: `<skill>/mcp/server.py`
   - `env`: `ZANAO_MODE=device`、`ZANAO_FRIDA=127.0.0.1:39999`
3. device 模式要求 App 内有 root + frida-server；否则只能用 web 模式（需账号密码或 Cookie）

> 注意：`mcp/server.py` 当前用 `subprocess` 调 CLI，CLI 又调 `frida` CLI。App 内如无 frida CLI，需要改成直接走 frida python binding，或改为纯 HTTP + 预计算签名。

---

## 9. 关键文件（原始分析产物）

| 路径 | 内容 |
|---|---|
| `zanao_x/EVIDENCE.md` | 早期全量取证记录（接口/权限/边界） |
| `zanao_x/jadx/` | App 反编译源码（`JniUtils`、`NetworkJSI`、`yp0`） |
| `zanao_x/assets/prod/` | H5 产物（含混淆与已还原版本 `.dec.js`/`.fold.js`） |
| `zanao_x/tools/` | frida 探针、反汇编脚本、代理工具（`disasm_*.py`、`hook*.js`、`proxy_log.py`） |
| `libAesNew.so` | 从设备拉取的原生库（在 `%TEMP%\zanao_so\`） |

---

## 10. 交接检查清单

- [x] 技能 + MCP server + 两个后端的客户端
- [x] 认证号会话可复用（`~/.zanao/app_session.json`）
- [x] 列表 / 详情 / 评论 / 作者 / 收割链路实测通过
- [ ] 搜索参数名
- [ ] 离线签名器（key/iv）
- [ ] 装进 deepdeep App 并在其插件市场可见
