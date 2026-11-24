// probe20.js — 用正确参数名再挖 uid：/thread/info{id}、/mx/thread/info{id}、/im-api/chat/prepare{sign}
var TOKEN = null, ALIAS = null, DEVICE = null;
function sign(f) {
    var T = Java.use('java.util.TreeMap'), m = T.$new();
    for (var k in f) m.put(String(k), String(f[k]));
    return Java.use('com.comingx.zanao.utils.JniUtils').makeSign(m);
}
function api(path, pathname, data, method) {
    var S = Java.use('java.lang.String'), HUC = Java.use('java.net.HttpURLConnection');
    var url = 'http://api.app.zanao.com' + (pathname || '') + path, q = [];
    for (var k in data) q.push(encodeURIComponent(k) + '=' + encodeURIComponent(data[k]));
    if ((method || 'POST') === 'GET' && q.length) url += '?' + q.join('&');
    var c = Java.cast(Java.use('java.net.URL').$new(url).openConnection(), HUC);
    c.setRequestMethod(method || 'POST');
    c.setConnectTimeout(12000); c.setReadTimeout(20000); c.setDoInput(true);
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
    if ((method || 'POST') === 'POST') { h['Content-Type'] = 'application/json; charset=utf-8'; c.setDoOutput(true); }
    for (var k2 in h) c.setRequestProperty(k2, String(h[k2]));
    if ((method || 'POST') === 'POST') {
        var bs = S.$new(JSON.stringify(data)).getBytes('UTF-8'), arr = [];
        for (var j = 0; j < bs.length; j++) arr.push(bs[j]);
        var os = c.getOutputStream(); os.write(Java.array('byte', arr)); os.flush(); os.close();
    }
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
function uidHits(o, path, out, d) {
    d = d || 0; out = out || [];
    if (d > 8 || !o || typeof o !== 'object') return out;
    if (Array.isArray(o)) { for (var i = 0; i < Math.min(o.length, 3); i++) uidHits(o[i], path + '[' + i + ']', out, d + 1); return out; }
    for (var k in o) {
        if (['uid', 'user_id', 'userId', 'to_uid', 'peer_uid', 'author_uid'].indexOf(k) >= 0)
            out.push(path + '.' + k + '=' + String(o[k]).substring(0, 30));
        uidHits(o[k], path + '.' + k, out, d + 1);
    }
    return out;
}
function keysOf(o) {
    if (!o || typeof o !== 'object') return null;
    return Object.keys(o).slice(0, 16).join(',');
}
function run() {
    var out = [];
    var rl = api('/thread/v2/list', '', { page: 1, per_page: 10 });
    var list = null;
    (function f(o) {
        if (!o || typeof o !== 'object' || list) return;
        if (Array.isArray(o) && o.length && o[0] && o[0].thread_id) { list = o; return; }
        for (var k in o) f(o[k]);
    })(rl.json);
    if (!list) { send({ t: 'results', list: [{ step: 'no-list', raw: rl.raw }] }); return; }
    var it = null;
    for (var i = 0; i < list.length; i++) { if (!list[i].is_anon) { it = list[i]; break; } }
    it = it || list[0];
    out.push({ step: 'target', thread_id: it.thread_id, sign: it.sign, is_anon: it.is_anon, nickname: it.nickname });

    var cases = [
        ['/thread/info {id}', api('/thread/info', '', { id: it.thread_id })],
        ['/mx/thread/info {id}', api('/mx/thread/info', '', { id: it.thread_id })],
        ['/comment/list {thread_id}', api('/comment/list', '', { thread_id: it.thread_id, page: 1 })],
        ['/comment/list {id}', api('/comment/list', '', { id: it.thread_id, page: 1 })],
        ['/im-api/chat/prepare {sign}', api('/chat/prepare', '/im-api', { sign: it.sign })]
    ];
    for (var c = 0; c < cases.length; c++) {
        var name = cases[c][0], r = cases[c][1];
        out.push({ step: name, code: r.code, errno: r.json && r.json.errno, errmsg: r.json && r.json.errmsg,
                   uidHits: uidHits(r.json, ''),
                   dataKeys: keysOf(r.json && r.json.data),
                   json: JSON.stringify(r.json).substring(0, 600), raw: r.raw });
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
                                setTimeout(function () { try { run(); } catch (e) { send({ t: 'run-err', m: '' + e }); } }, 2000);
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
