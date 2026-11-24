// probe9.js — 找 uid 的一切来源：数字型 thread_id、mx 首页、im 会话、sign 当 uid
var TOKEN = null, ALIAS = null, DEVICE = null;
function sign(f) {
    var T = Java.use('java.util.TreeMap'), I = Java.use('java.lang.Integer'), m = T.$new();
    for (var k in f) m.put(String(k), (typeof f[k] === 'number') ? I.valueOf(Math.round(f[k])) : String(f[k]));
    return Java.use('com.comingx.zanao.utils.JniUtils').makeSign(m);
}
function bytesOf(s) {
    var S = Java.use('java.lang.String'), bs = S.$new(s).getBytes('UTF-8'), a = [];
    for (var i = 0; i < bs.length; i++) a.push(bs[i]);
    return Java.array('byte', a);
}
function api(method, path, data) {
    var S = Java.use('java.lang.String'), HUC = Java.use('java.net.HttpURLConnection');
    var url = 'http://api.app.zanao.com' + path, q = [];
    for (var k in data) q.push(encodeURIComponent(k) + '=' + encodeURIComponent(data[k]));
    if (method === 'GET' && q.length) url += '?' + q.join('&');
    var c = Java.cast(Java.use('java.net.URL').$new(url).openConnection(), HUC);
    c.setRequestMethod(method); c.setConnectTimeout(15000); c.setReadTimeout(25000); c.setDoInput(true);
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
    if (method === 'POST') { h['Content-Type'] = 'application/json; charset=utf-8'; c.setDoOutput(true); }
    for (var k2 in h) c.setRequestProperty(k2, String(h[k2]));
    if (method === 'POST') { var os = c.getOutputStream(); os.write(bytesOf(JSON.stringify(data))); os.flush(); os.close(); }
    var code = c.getResponseCode();
    var is = (code >= 400) ? c.getErrorStream() : c.getInputStream(), txt = '';
    if (is !== null) {
        var BAOS = Java.use('java.io.ByteArrayOutputStream'), buf = Java.array('byte', new Array(8192).fill(0)), b = BAOS.$new();
        while (true) { var n = is.read(buf); if (n <= 0) break; b.write(buf, 0, n); }
        is.close(); txt = String(S.$new(b.toByteArray(), 'UTF-8'));
    }
    var j = null; try { j = JSON.parse(txt); } catch (e) { }
    return { code: code, json: j, raw: j ? null : txt.substring(0, 300) };
}
function keysOf(o) {
    var k = [];
    (function f(x, d) {
        if (!x || typeof x !== 'object' || d > 4) return;
        if (Array.isArray(x)) { if (x[0] && typeof x[0] === 'object') k.push(Object.keys(x[0]).join(',')); return; }
        for (var kk in x) f(x[kk], d + 1);
    })(o, 0);
    return k.slice(0, 4);
}
function run() {
    var out = [];
    var tests = [
        ['POST /comment/list(num)', 'POST', '/comment/list', { thread_id: 2185805931, page: 1 }],
        ['POST /thread/info(num)', 'POST', '/thread/info', { thread_id: 2185805931 }],
        ['POST /mx/home', 'POST', '/mx/home', { page: 1 }],
        ['POST /im-api/chat/list', 'POST', '/im-api/chat/list', {}],
        ['POST /mx/user/usershow(sign)', 'POST', '/mx/user/usershow', { uid: 'lmFtZpuUZ2uVlg==' }],
        ['POST /mx/user/usershow(num)', 'POST', '/mx/user/usershow', { uid: 1 }],
        ['POST /mx/admin/userinfo(num1)', 'POST', '/mx/admin/userinfo', { uid: 1 }]
    ];
    for (var i = 0; i < tests.length; i++) {
        var t = tests[i];
        try {
            var r = api(t[1], t[2], t[3]);
            out.push({ tag: t[0], code: r.code, errno: r.json && r.json.errno, errmsg: r.json && r.json.errmsg,
                       keys: keysOf(r.json), json: JSON.stringify(r.json).substring(0, 700), raw: r.raw });
        } catch (e) { out.push({ tag: t[0], m: '' + e }); }
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
