/*
 * zanao_oracle.js — 签名/解密 oracle
 * 目标: com.comingx.zanao (校园集市 3.1.0 / versionCode 310)
 *
 * 原理: 客户端所有请求的 X-Sc-Ah 都由 native 层
 *       Java_com_comingx_zanao_utils_JniUtils_makeSign(SortedMap) 计算,
 *       签名输入 = TreeMap{ timestamp__: X-Sc-Td, randnum__: X-Sc-Nd, ...req.data }
 *       响应体若加密, 由 JniUtils.unhashAppResult() 解。
 *       所以不需要还原 AES key/IV, 直接把 App 当 oracle 用。
 *
 * 用法:
 *   frida -H 127.0.0.1:39999 -f com.comingx.zanao -l zanao_oracle.js
 *   (由 zanao_api.py 通过 rpc.exports 调用)
 *
 * 反调试提示: App 检测到注入会 kill(getpid(), SIGSEGV)。
 *   - 优先 spawn (-f) 而不是 attach;
 *   - 若秒退, 用 tools/patch_antidebug.md 里的改包方案, 或直接用 H5 注入路线。
 */

Java.perform(function () {
    var JniUtils = Java.use('com.comingx.zanao.utils.JniUtils');
    var TreeMap = Java.use('java.util.TreeMap');

    function buildMap(fields) {
        var m = TreeMap.$new();
        for (var k in fields) {
            if (!Object.prototype.hasOwnProperty.call(fields, k)) continue;
            var v = fields[k];
            // SortedMap<String,Object>: 统一按字符串塞, 与 H5 侧一致
            m.put(String(k), v === null || v === undefined ? '' : String(v));
        }
        return m;
    }

    rpc.exports = {
        /* 生成 X-Sc-Ah */
        sign: function (fields) {
            return JniUtils.makeSign(buildMap(fields));
        },
        /* 解响应体 (X-Data-Encrypt:1 或 __data__) */
        unhashApp: function (s) {
            return JniUtils.unhashAppResult(s);
        },
        unhash: function (s) {
            return JniUtils.unhash(s);
        },
        unhashText: function (s, k) {
            return JniUtils.unhashText(s, k);
        },
        /* 版本自检 */
        ping: function () {
            return 'ok';
        }
    };

    send({ type: 'ready', msg: 'oracle installed' });
});
