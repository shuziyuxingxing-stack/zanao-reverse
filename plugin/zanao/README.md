# zanao —— 校园集市查询插件（web + device 双模式）

把「校园集市」接进对话：用户在聊天里问，插件取数，模型用自然语言回。

## 两种模式

| 模式 | 依赖 | 登录 | 适合 |
|---|---|---|---|
| **web（默认）** | 只要账号密码 | `login --account --password` | 普通用户，**无需 root、无需手机、无需电脑调试** |
| device | root 手机 + frida-server + PC | 自动抓 App 会话 | 已具备设备的用户，数据更全 |

```bash
# web
python web/zanao_web.py login --account <手机号> --password <密码>
python web/zanao_web.py thread-list --per-page 10

# device
adb forward tcp:39999 tcp:39999
python scripts/zanao_cli.py thread-list --per-page 10
```

## web 模式凭什么能不用签名

实测：

| 请求 | 返回 |
|---|---|
| `POST https://c.zanao.com/sc-api/thread/v2/list`（未登录，带 `X-Sc-Client: h5`） | `{"errno":20,"errmsg":"登录中..."}` |
| `POST https://c.zanao.com/sc-api/user/loginpost`（错密码） | `{"errno":10,"errmsg":"用户名或密码错误"}` |
| 同上但带 `X-Sc-Client: app` | `{"errno":10,"errmsg":"用户本地网络异常"}` ← app 通道才要签名 |

结论：**网页网关只认 Cookie 会话 + `X-Sc-Client: h5`，不需要 `X-Sc-Ah`**。
所以插件只要拿到网页会话，就能以用户身份读集市，完全不碰手机。

## 登录方式与限制（重要）

- ✅ **账号密码**：`/user/loginpost`，第三方客户端可以直接调。
- ❌ **扫码**：集市网页只支持微信内 OAuth（`c.zanao.com` 在微信外会 302 到 `p.zanao.com/wxopen` 要求用微信打开），第三方容器拿不到回调，做不成扫码。
- ⚠️ **只有微信登录的用户**：需要先在 App「我的 → 账号」设置一次密码，之后插件可用密码登录。

## 工具（MCP）

`zanao_login` · `zanao_status` · `zanao_thread_list` · `zanao_thread_info` ·
`zanao_comments` · `zanao_user_show` · `zanao_whoami` · `zanao_certinfo` · `zanao_raw`

注册方式见 `cordis.patch.snippet.yml`（`ZANAO_MODE` 选 web / device）。

## 目录

```
zanao/
├── SKILL.md                  # agent 用法（默认 web 模式）
├── mcp/server.py             # MCP stdio server（web / device 后端可切）
├── web/zanao_web.py          # 无 root 客户端（cookie 会话）
├── scripts/zanao_cli.py      # device 客户端（frida 签名）
├── scripts/_driver.js        # 在 App 进程内签名/发请求
├── scripts/proxy_log.py      # 可选：无 root 设备抓明文取 token
├── references/{protocol,pitfalls}.md
├── cordis.patch.snippet.yml
└── README.md
```

## 上架前自查

- [ ] 描述里写明「只需账号密码，不需要 root」（web 模式的最大卖点）
- [ ] 说明微信登录用户要先设置密码，别让用户装完发现登不上
- [ ] 不承诺扫码登录（集市不支持第三方扫码）
- [ ] 只读：不提供发帖/评论/点赞等写操作
- [ ] 会话文件 `~/.zanao/session.json` 0600，不上传

## 已知边界

- 拿不到别人的姓名/学号/学生证照（`/user/certinfo` 只回自己）
- 别人的 uid 只有不可解密文
- 管理员操作服务端角色鉴权，全部拒绝
