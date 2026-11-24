# zanao-reverse · 校园集市（赞噢）App 逆向工程全记录

对校园集市 App `com.comingx.zanao`（3.1.0 / versionCode 310，Android）的**完整协议逆向**：明文 HTTP API 合同、JNI 签名机制、会话获取、可达性实测与防护结论。所有结果来自黑盒实测（frida 签名 oracle + 抓包），不含任何账号凭据与个人信息。

> **不含**：APK 本体、jadx 全量反编译树、frida 设备序列号、抓包明文样本（均为可由 `tools/` 重现的产物）。

## 核心结论速览

| 项 | 实测值 |
|---|---|
| API host | `http://api.app.zanao.com`（**80 端口明文**，服务端直接回 200/errno 0；HTTPS 亦可用） |
| 路径前缀 | **没有** `/sc-api`；写成 `/sc-api/...` → `errno 3 sorry, illegal request` |
| 真实路径 | `/thread/v2/list`、`/comment/post`、`/user/usershow`、`/user/certinfo`…；im 类走 `/im-api`，课程走 `/course-api` |
| 请求签名 | `TreeMap{ timestamp__=X-Sc-Td, randnum__=X-Sc-Nd, …业务字段 }` → `JniUtils.makeSign` → 32 位大写 hex → 头 `X-Sc-Ah`；**不含 URL / token / 其他头** |
| 签名特性 | **与账号无关**：任意设备算出的签名通用；oracle 可用 frida 挂 `JniUtils.makeSign` 复用 |
| 会话 | 头 `X-Sc-Token`（明文传输）；无 refresh 接口，`errno 20 = 登录中` 即需重抓 |
| 响应加密 | 响应头 `x-sc-encrypt: 1` → native `unhashAppResult` 自动解密 |
| 评论长度 | **200 字**（客户端校验串 `请填写评论内容，200字以内`；帖子正文 `maxlength:0x320`=800；超限服务端 `errno=10 评论内容长度非法`） |
| `errno` 语义 | `0` 成功 / `3` 路径错 / `10` 参数或权限非法 / `20` 未登录；**HTTP 200 也必须看 errno** |
| 管理员写接口 | 21/21 全部 `errno 10 无操作权限`；`is_admin` 仅服务端下发，不可伪造 |
| uid | 只回不可解密文；姓名/学号/学生证照接口需对方 token，取不到 |

## 目录

```
EVIDENCE.md                 # 可达性实测全记录（他人画像/认证字段/防护矩阵）
references/protocol.md      # 协议与签名（请求头表、makeSign 输入构造）
references/pitfalls.md      # errno 排查手册（含拿不到的东西清单）
plugin/zanao/               # DeepDeep 插件（Python：CLI + web gateway + frida 采集）
plugin-android/zanao/       # DeepDeep Lab Android 插件（Kotlin 读取器）
tools/                      # 逆向工具箱：签名逆向、会话采集、代理、诊断
dist/deepdeep-zanao/        # 插件发布产物
```

## 会话获取（三选一）

```bash
# 1) frida 签名 oracle + 抓会话（需 root + frida-server）
frida -H 127.0.0.1:39999 -f com.comingx.zanao -l tools/cli_hook.js
# 2) 明文代理：设备走电脑代理，从请求头取 X-Sc-Token（tools/proxy_log.py）
# 3) 已有会话直接显式传入
python plugin/zanao/scripts/zanao_cli.py --token '<X-Sc-Token>' --alias sysu --device '<uuid>' self
```

抓到后即可脱离 App 直接调全部读接口（签名端与账号解耦，任意设备可算）。

## 免责与范围

- 所有写类管理接口只用**不存在的 id/uid** 做鉴权实测（最坏结果是「对象不存在」），未触碰任何真实内容
- 本仓库用于**防御性安全研究**：展示明文传输、会话单因素、签名可复用等真实风险面
