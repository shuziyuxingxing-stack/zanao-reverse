---
name: zanao
description: 校园集市（com.comingx.zanao）查询插件。用户问“集市上有什么帖子 / 这条帖子是谁发的 / 看看某人头像和学校 / 我的认证状态”时使用。默认走网页网关（只要账号密码，无需 root、无需电脑、无需 frida）；设备模式（root + frida + 抓会话）仅在用户已具备时才用。
---

# 校园集市查询插件

两种模式，**默认用网页模式**——普通用户装完插件只需要输入一次账号密码。

| 模式 | 依赖 | 适合谁 |
|---|---|---|
| **web（默认）** | 只有账号密码（集市账号，或用 `login` 前先在 App 里设置一次密码） | 普通用户 |
| device（可选） | root 手机 + frida-server + PC 调试 | 已经折腾过设备的用户 |

## web 模式：怎么登录

网关事实（实测）：

- base = `https://c.zanao.com/sc-api`，请求头带 `X-Sc-Client: h5`
- 只认 **Cookie 会话**，**不需要 `X-Sc-Ah` 签名**
- 未登录时任何业务接口都返回 `{"errno":20,"errmsg":"登录中..."}`
- 登录：`POST /user/loginpost {"account","password"}`

所以流程是：

```bash
python <skill-dir>/web/zanao_web.py login --account <手机号或用户名> --password <密码>
python <skill-dir>/web/zanao_web.py status      # 看会话是否有效
python <skill-dir>/web/zanao_web.py thread-list --per-page 10
```

会话存在 `~/.zanao/session.json`（0600），下次直接复用。

**如果用户只有微信登录、没有密码**：让他去 App「我的 → 账号」设置一次密码，再回来 `login`。
不要承诺“扫码登录”——集市网页只支持微信内 OAuth（`c.zanao.com` 在微信外会跳到 `p.zanao.com/wxopen` 要求用微信打开），第三方插件容器拿不到那个回调，做不成扫码。

## device 模式（可选）

用户设备已 root 且有 frida 时，可以走 App 接口（数据更全，比如 `/user/v1/profile` 的 cert_status）：

```bash
adb forward tcp:39999 tcp:39999
python <skill-dir>/scripts/zanao_cli.py thread-list --per-page 10
```

签名在 App 进程内算（`JniUtils.makeSign`），不需要密码。

## 工具（MCP）

| 工具 | 用途 |
|---|---|
| `zanao_login(account, password)` | web 模式登录并保存会话 |
| `zanao_status()` | 会话是否有效 |
| `zanao_thread_list(page, per_page)` | 帖子列表：id / 标题 / 昵称 / 头像 / 是否匿名 / 分类 |
| `zanao_thread_info(id)` | 帖子详情 + 联系方式字段 |
| `zanao_comments(id, page, limit)` | 评论列表 |
| `zanao_user_show(thread_id \| comment_id)` | 作者公开画像：昵称 / 头像 / 学校 / 注册天数 / 等级 |
| `zanao_whoami()` | 自己的 user_id / 昵称 / 认证状态 |
| `zanao_certinfo(school_id)` | 自己在该校的认证字段存在性 |

## 回答用户的姿势

1. 先结论后依据；头像给 URL，要展示就 `![头像](url)`。
2. 列表默认一页 10 条，用户要更多再翻页。
3. 失败照实说哪一环：没登录（errno 20）／密码错（errno 10）／网络。
4. 不要编数据；接口没给的字段就说没给。

## 硬规矩

- **只读**：不发帖、不评论、不点赞、不举报；`/admin/*` 服务端角色鉴权，一律拒绝。
- **只用用户自己的账号**：cookie 只存本机、只给该用户用。
- **不做批量收割**：一次任务几页、几十条；不要循环 uid、不要拉全站名单。
- **匿名帖**：`user_show` 对匿名帖仍会返回真实昵称/头像（集市自身缺陷），不要主动强调或展示“这是谁”。

## 已知边界

| 想做的事 | 结果 |
|---|---|
| 别人的姓名/学号/学生证照 | 拿不到（`/user/certinfo` 只回自己那份） |
| 用 uid 反查别人 | 别人只给不可解的 uid 密文 |
| 管理员操作 | 服务端角色鉴权，全部拒绝 |
| 扫码登录 | 集市不支持第三方扫码；只能在微信内 OAuth |
