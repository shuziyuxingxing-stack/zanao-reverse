// probe14.js — 穷举找 uid：点赞列表/收藏/消息/会话/我的信息 等
var TOKEN = null, ALIAS = null, DEVICE = null, TID = '2185811440';
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
    c.setRequestMethod(method); c.setConnectTimeout(12000); c.setReadTimeout(20000); c.setDoInput(true);
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
    return { code: code, json: j, raw: j ? null : txt.substring(0, 240) };
}
function findUid(o, path, out, d) {
    d = d || 0; out = out || [];
    if (d > 7 || !o || typeof o !== 'object') return out;
    if (Array.isArray(o)) { for (var i = 0; i < Math.min(o.length, 3); i++) findUid(o[i], path + '[' + i + ']', out, d + 1); return out; }
    for (var k in o) {
        if (['uid', 'user_id', 'userId', 'uuid'].indexOf(k) >= 0) out.push(path + '.' + k + '=' + String(o[k]).substring(0, 40));
        findUid(o[k], path + '.' + k, out, d + 1);
    }
    return out;
}
function shape(o, d) {
    d = d || 0;
    if (!o || typeof o !== 'object' || d > 3) return typeof o;
    if (Array.isArray(o)) return '[' + (o.length ? shape(o[0], d + 1) : '') + ']x' + o.length;
    var ks = [];
    for (var k in o) { ks.push(k + ':' + (typeof o[k] === 'object' ? shape(o[k], d + 1) : typeof o[k])); if (ks.length > 14) break; }
    return '{' + ks.join(',') + '}';
}
function run() {
    var out = [];
    var tests = [
        ['/thread/likelist', { thread_id: TID, page: 1 }],
        ['/thread/mark/list', { page: 1 }],
        ['/msg/list', { page: 1 }],
        ['/im-api/chat/list', {}],
        ['/user/mineinfo', {}],
        ['/user/simpleinfo', {}],
        ['/thread/stat', { thread_id: TID }],
        ['/view/hotlist', { page: 1 }],
        ['/user/v1/profile', {}],
        ['/mine/mythread', { page: 1 }]
    ];
    for (var i = 0; i < tests.length; i++) {
        var p = tests[i][0], d = tests[i][1];
        try {
            var r = api('POST', p, d);
            out.push({ path: p, errno: r.json && r.json.errno, errmsg: r.json && r.json.errmsg,
                       uidHits: findUid(r.json, ''), shape: shape(r.json && r.json.data),
                       raw: r.raw });
        } catch (e) { out.push({ path: p, m: '' + e }); }
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
