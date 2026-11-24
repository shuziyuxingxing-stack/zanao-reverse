// probe18.js — 账号 B 自测脚本：只做"取 token → 读本人 certinfo"，不发任何写请求
// 用法（在 B 账号已登录的那台设备上跑）：
//   adb forward tcp:39999 tcp:39999
//   frida -H 127.0.0.1:39999 -f com.comingx.zanao -l tools/probe18.js
// 输出：token（前 12 位脱敏）+ alias + 自己的 id/user_id/cert_status + 各 school_id 下的 cert_info
// 你可以只把 JSON 结果贴出来，token 不必给。

var TOKEN = null, ALIAS = null, DEVICE = null;
var CAND_SCHOOL = ['DxB7', 'MaGe', 'MX4Q'];   // 有效的学校 id 样本，可按需改

function sign(f) {
    var T = Java.use('java.util.TreeMap'), m = T.$new();
    for (var k in f) m.put(String(k), String(f[k]));
    return Java.use('com.comingx.zanao.utils.JniUtils').makeSign(m);
}
function api(path, data, method) {
    var S = Java.use('java.lang.String'), HUC = Java.use('java.net.HttpURLConnection');
    var url = 'http://api.app.zanao.com' + path, q = [];
    for (var k in data) q.push(encodeURIComponent(k) + '=' + encodeURIComponent(data[k]));
    if (q.length) url += '?' + q.join('&');
    var c = Java.cast(Java.use('java.net.URL').$new(url).openConnection(), HUC);
    c.setRequestMethod(method || 'GET'); c.setConnectTimeout(12000); c.setReadTimeout(20000); c.setDoInput(true);
    var nd = '', td = String(Math.floor(Date.now() / 1000));
    for (var i = 0; i < 20; i++) nd += Math.floor(Math.random() * 10);
    var si = { timestamp__: td, randnum__: nd };
    for (var kk in data) si[kk] = data[kk];
    var h = {
        'X-Sc-Alias': ALIAS, 'X-Sc-Token': TOKEN, 'X-Sc-Client': 'app',
        'X-Sc-Device': DEVICE, 'X-Sc-Platform': 'Android', 'X-Sc-Hb-V': '210',
        'X-Sc-Nt-V': '310', 'X-Sc-Version': '3.1.0', 'X-Sc-Nd': nd, 'X-Sc-Td': td,
        'X-Sc-Ah': sign(si), 'X-Requested-With': 'XMLHttpRequest', 'User-Agent': 'okhttp/4.9.3'
    };
    for (var k2 in h) c.setRequestProperty(k2, String(h[k2]));
    var code = c.getResponseCode();
    var is = (code >= 400) ? c.getErrorStream() : c.getInputStream(), txt = '';
    if (is !== null) {
        var BAOS = Java.use('java.io.ByteArrayOutputStream'), buf = Java.array('byte', new Array(4096).fill(0)), b = BAOS.$new();
        while (true) { var n = is.read(buf); if (n <= 0) break; b.write(buf, 0, n); }
        is.close(); txt = String(S.$new(b.toByteArray(), 'UTF-8'));
    }
    var j = null; try { j = JSON.parse(txt); } catch (e) { }
    return { code: code, json: j, raw: j ? null : txt.substring(0, 200) };
}
function mask(s) {
    if (!s) return s;
    s = String(s);
    if (s.length <= 2) return s[0] + '*';
    return s[0] + new Array(s.length - 1).join('*') + s[s.length - 1];
}
function run() {
    var out = [];
    out.push({ tag: 'token', token_head: String(TOKEN).substring(0, 12) + '…', alias: ALIAS, device: DEVICE });
    var p0 = api('/user/v1/profile', {});
    var ui = (p0.json && p0.json.data && p0.json.data.user_info) || {};
    out.push({ tag: 'self', errno: p0.json && p0.json.errno, id: ui.id, user_id: ui.user_id,
               nickname: mask(ui.nickname), cert_status: ui.cert_status, vr_status: ui.vr_status,
               community_id: ui.community_id });
    for (var i = 0; i < CAND_SCHOOL.length; i++) {
        var sid = CAND_SCHOOL[i];
        var r = api('/user/certinfo', { school_id: sid }, 'GET');
        var ci = (r.json && r.json.data && r.json.data.cert_info) || null;
        out.push({
            tag: 'certinfo', school_id: sid, errno: r.json && r.json.errno, errmsg: r.json && r.json.errmsg,
            keys: ci ? Object.keys(ci) : null,
            realname: ci && ci.realname ? mask(ci.realname) : null,
            student_no: ci && ci.student_no ? mask(ci.student_no) : null,
            has_cert_img: !!(ci && ci.cert_img),
            has_cert_img_url: !!(ci && ci.cert_img_url),
            college_text: ci && ci.college_text, degree_text: ci && ci.degree_text,
            join_year: ci && ci.join_year, cert_status: ci && ci.cert_status
        });
    }
    send({ t: 'results', list: out });
}
(function w(t) {
    if (typeof Java !== 'undefined') {
        Java.perform(function () {
            var N = Java.use('com.comingx.zanao.JSIs.NetworkJSI');
            ['request', 'easyRequest'].forEach(function (m) {
                if (!N[m]) return;
                N[m].overloads.forEach(function (ov) {
                    if (ov.argumentTypes.length !== 1 || ov.argumentTypes[0].className !== 'java.lang.String') return;
                    ov.implementation = function (s) {
                        try {
                            if (!TOKEN && s && s.indexOf('X-Sc-Token') >= 0) {
                                var p = JSON.parse(s), v = p.parameters[0].value;
                                TOKEN = v.header['X-Sc-Token']; ALIAS = v.header['X-Sc-Alias']; DEVICE = v.header['X-Sc-Device'];
                                setTimeout(function () { try { run(); } catch (e) { send({ t: 'run-err', m: '' + e }); } }, 2500);
                            }
                        } catch (e) { }
                        return ov.call(this, s);
                    };
                });
            });
        });
        return;
    }
    if (t <= 0) return;
    setTimeout(function () { w(t - 1); }, 200);
})(200);
