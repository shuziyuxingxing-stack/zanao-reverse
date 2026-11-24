---
name: zanao
description: 校园集市（com.comingx.zanao）查询、批量收割与信息汇总插件。用户说“集市上有什么帖子 / 搜一下集市关于某事的帖子并汇总 / 把相关帖子都翻出来筛一遍 / 这条帖子是谁发的 / 看看某人头像和学校 / 我的认证状态”时使用。默认走网页网关（只要账号密码，无需 root、无需电脑、无需 frida）；设备模式（root + frida + 抓会话）仅在用户已具备时才用。
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


## 已接入的认证号（device 模式，现用）

会话存在 `~/.zanao/app_session.json`（token / alias / device），CLI 不传参数就自动用它：

```powershell
python scripts/zanao_cli.py thread-list --json
python scripts/zanao_cli.py harvest --keyword "宿舍 外卖" --pages 3 --limit 10 --json
```

要求：手机连 USB + `frida-server` 在 :39999 + `adb forward tcp:39999 tcp:39999`。
签名在 App 进程内算（`JniUtils.makeSign`），不需要密码、不碰 web 网关。

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
| `zanao_search(keyword, page, per_page)` | 按关键词搜帖（标题/正文命中），做主题汇总时先用它 |
| `zanao_harvest(keyword, pages, per_page, min_likes, min_comments, since_days, cate, exclude, fetch_detail, limit)` | **批量收割 + 无关过滤**：翻多页、打分、去重、丢噪声，返回排序候选集 |
| `zanao_thread_info(id)` | 帖子详情 + 联系方式字段 |
| `zanao_comments(id, page, limit)` | 评论列表 |
| `zanao_user_show(thread_id \| comment_id)` | 作者公开画像：昵称 / 头像 / 学校 / 注册天数 / 等级 |
| `zanao_whoami()` | 自己的 user_id / 昵称 / 认证状态 |
| `zanao_certinfo(school_id)` | 自己在该校的认证字段存在性 |

## 自然语言 → 汇总的工作流

用户说“帮我看看集市上关于 X 的帖子，汇总一下”时：

1. **优先用 `zanao_harvest`**：`keyword=X, pages=3~5, per_page=20, min_likes=0, fetch_detail=5`。
   它会自动去重、丢噪声（抽奖/接龙/拼单/助力等功能性刷屏）、按「标题命中 3 分 + 正文命中 1 分」排序，并返回 `stats` 说明每类丢了多少。
2. 候选不足时再 `zanao_search(keyword=X)` 补一轮；关键词太窄命中 0 条就换同义词。
3. 挑 3–8 条高分的 `zanao_thread_info(id)` 取正文要点；需要看反应时 `zanao_comments(id, limit=10)`。
4. 汇总输出：**结论在前**（几条帖、主要诉求/结论是什么），再列条目（标题 + 一句话摘要 + thread_id），需要用户看原帖再给链接。
5. 不要把所有正文抄一遍；不要对匿名帖点破作者身份。

### 收割参数怎么调

| 场景 | 参数 |
|---|---|
| 只看“最近有热度”的 | `min_likes=5, min_comments=2, since_days=7` |
| 覆盖全量话题 | `pages=5~10, per_page=20, fetch_detail=10` |
| 噪声多（活动/广告刷屏） | 传 `exclude='抽奖\|接龙\|代拿\|拼单\|推广'` |
| 只关心某分类 | `cate='吐槽'`（分类名来自列表里的 `cate_name`） |

`fetch_detail` 是“标题没命中但正文可能命中”的补救条数，别设太大（每条约 0.6s）。

`errno` 语义（用来判断卡在哪）：

| errno | 含义 |
|---|---|
| 0 | 成功 |
| 3 | `sorry, illegal request` —— 路由不存在，路径写错 |
| 10 | 参数/业务错误（如密码错、ID 非法） |
| 20 | `登录中...` —— 需要登录，或会话已失效 |

## 回答用户的姿势

1. 先结论后依据；头像给 URL，要展示就 `![头像](url)`。
2. 列表默认一页 10 条，用户要更多再翻页。
3. 失败照实说哪一环：没登录（errno 20）／密码错（errno 10）／网络。
4. 不要编数据；接口没给的字段就说没给。

## 硬规矩

- **只读**：不发帖、不评论、不点赞、不举报；`/admin/*` 服务端角色鉴权，一律拒绝。
- **只用用户自己的账号**：cookie 只存本机、只给该用户用。
- **批量收割按需限速**：`pages` 默认 3、每次翻页 sleep 0.6s；一次任务控制在 5–10 页、几百条以内，别拉全站。
- **收割的是帖子，不是人**：批量结果只落帖子标题/正文/互动数，不要顺手批量抓作者画像（`user_show`）拼人肉档案。
- **匿名帖**：`user_show` 对匿名帖仍会返回真实昵称/头像（集市自身缺陷），不要主动强调或展示“这是谁”。

## 已知边界

| 想做的事 | 结果 |
|---|---|
| 别人的姓名/学号/学生证照 | 拿不到（`/user/certinfo` 只回自己那份） |
| 用 uid 反查别人 | 别人只给不可解的 uid 密文 |
| 管理员操作 | 服务端角色鉴权，全部拒绝 |
| 扫码登录 | 集市不支持第三方扫码；只能在微信内 OAuth |
