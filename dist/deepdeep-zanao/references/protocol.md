# 协议与签名（实测）

## 1. 基础

| 项 | 值 |
|---|---|
| API host | `http://api.app.zanao.com`（**80 端口明文**，服务端接受） |
| 回退 | `https://api.app.zanao.com` 同样可用 |
| 路径前缀 | **没有**。`index.html` / `mx.html` 的 `CONST_PATH_NAME = ''` |
| 例外 | 聊天类走 `/im-api` 前缀，课程走 `/course-api` |
| 图片 CDN | `https://b1.cdn.zanao.com/`，缩略图后缀如 `@!sm_w100_h100` |

写成 `/sc-api/...` 会得到 `errno 3 sorry, illegal request`。

## 2. 请求头

```
X-Sc-Alias   社区别名（如 sysu）
X-Sc-Token   会话令牌（明文传输）
X-Sc-Client  app
X-Sc-Device  设备 uuid
X-Sc-Platform Android
X-Sc-Hb-V    210
X-Sc-Nt-V    310
X-Sc-Version 3.1.0
X-Sc-Nd      20 位随机数字
X-Sc-Td      10 位秒级时间戳
X-Sc-Ah      签名
X-Requested-With: XMLHttpRequest
Content-Type: application/json; charset=utf-8
```

## 3. 签名（关键）

`NetworkJSI.easyRequest/request` 里：

```java
TreeMap m = new TreeMap();
m.put("timestamp__", header["X-Sc-Td"]);
m.put("randnum__",   header["X-Sc-Nd"]);
for (String k : data.keySet()) m.put(k, data.get(k));   // 业务字段全进
headers.put("X-Sc-Ah", JniUtils.makeSign(m));            // native
```

- 输出 32 位大写十六进制，例 `1E5A1540D2A933506C41A75AFEF6FAAB`
- 输入只含 `timestamp__ + randnum__ + 业务字段`，**不含 URL / token / 其他头**
- 算法在 `libAesNew.so`，key 未定位 → **不能离线复算**，必须调 App 里的函数

插件做法：在目标进程内 `Java.use('com.comingx.zanao.utils.JniUtils').makeSign(treeMap)`，
即“签名 oracle”，无需逆向。

## 4. 响应加密

两种标记，命中就解：

| 标记 | 处理 |
|---|---|
| 响应头 `x-sc-encrypt: 1` | `JniUtils.unhashAppResult(body)` |
| 响应体 `{"__encrypt__":1,"__data__":"..."}` | `unhashAppResult(__data__)` 后再 `JSON.parse` |

`/app/checkuser`、`/user/v1/profile` 等会命中，不解就是 `errno: null`。

## 5. 会话获取

插件自动从 App 自身请求里取 `X-Sc-Token / X-Sc-Alias / X-Sc-Device`：
hook `NetworkJSI.request(String)`，解析 payload JSON 的 `parameters[0].value.header`。

## 6. 运行环境

- frida 17 的 **Python API 没有内置 Java bridge**，只有 `frida` CLI 有 → 驱动脚本必须用 CLI 跑。
- `frida` CLI 在 stdin 关闭时会立刻退出，所以 `Popen` 要保留 `stdin=PIPE` 不关。
- 目标 App 有反调试：attach 一次后可能被杀；优先 `-f`（spawn）。
