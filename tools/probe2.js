// probe2.js — 用 App 的 token，逐个变体试探 /thread/v2/list 等，定位 errno 3 的原因
var TOKEN = null, ALIAS = null, DEVICE = null;
var KEYS_JSON = {};

function findKey(o, k) {
    if (o && typeof o === 'object') {
        if (Object.prototype.hasOwnProperty.call(o, k)) return o[k];
        for (var kk in o) { var r = findKey(o[kk], k); if (r !== null && r !== undefined) return r; }
    }
    return null;
}

function sign(fields) {
    var T = Java.use('java.util.TreeMap');
    var I = Java.use('java.lang.Integer');
    var m = T.$new();
    for (var k in fields) {
        var v = fields[k];
        var val = (typeof v === 'number') ? I.valueOf(Math.round(v)) : String(v);
        m.put(String(k), val);
    }
    return Java.use('com.comingx.zanao.utils.JniUtils').makeSign(m);
}

function http(method, path, data, opt) {
    var URLc = Java.use('java.net.URL');
    var HUC = Java.use('java.net.HttpURLConnection');
    var S = Java.use('java.lang.String');
    var url = 'http://api.app.zanao.com' + path;
    var q = [];
    for (var k in data) q.push(encodeURIComponent(k) + '=' + encodeURIComponent(data[k]));
    if (method === 'GET' && q.length) url += '?' + q.join('&');
    var c = Java.cast(URLc.$new(url).openConnection(), HUC);
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
        'X-Sc-Ah': ah, 'X-Requested-With': 'XMLHttpRequest'
    };
    if (method === 'POST') h['Content-Type'] = 'application/json; charset=utf-8';
    for (var k2 in h) c.setRequestProperty(k2, String(h[k2]));
    if (method === 'POST') {
        c.setDoOutput(true);
        var bodyStr = opt && opt.form
            ? q.join('&')
            : JSON.stringify(data);
        if (opt && opt.form) c.setRequestProperty('Content-Type', 'application/x-www-form-urlencoded');
        var bs = S.$new(bodyStr).getBytes();
        var arr = [];
        for (var j = 0; j < bs.length; j++) arr.push(bs[j]);
        var os = c.getOutputStream();
        os.write(Java.array('byte', arr));
        os.flush(); os.close();
    }
    var code = c.getResponseCode();
    var is = (code >= 400) ? c.getErrorStream() : c.getInputStream();
    var txt = '';
    if (is !== null) {
        var BAOS = Java.use('java.io.ByteArrayOutputStream');
        var buf = Java.array('byte', new Array(4096).fill(0));
        var b = BAOS.$new();
        while (true) { var n = is.read(buf); if (n <= 0) break; b.write(buf, 0, n); }
        is.close();
        txt = String(S.$new(b.toByteArray()));
    }
    return { code: code, body: txt.substring(0, 400), ah: ah, td: td, nd: nd };
}

function run() {
    var out = [];
    try {
        out.push({ v: 'A POST list ints', r: http('POST', '/sc-api/thread/v2/list', { page: 1, per_page: 10 }) });
        out.push({ v: 'B POST list strings', r: http('POST', '/sc-api/thread/v2/list', { page: '1', per_page: '10' }) });
        out.push({ v: 'C POST user/info', r: http('POST', '/sc-api/user/info', { from: 'mine' }) });
        out.push({ v: 'D GET user/certinfo', r: http('GET', '/sc-api/user/certinfo', { school_id: '1' }) });
        out.push({ v: 'E GET common/stp', r: http('GET', '/sc-api/common/stp', {}) });
    } catch (e) { out.push({ err: '' + e }); }
    send({ t: 'results', list: out });
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
                                    var hd = p.parameters[0].value.header;
                                    TOKEN = hd['X-Sc-Token']; ALIAS = hd['X-Sc-Alias']; DEVICE = hd['X-Sc-Device'];
                                    send({ t: 'token', alias: ALIAS });
                                    setTimeout(function () { try { run(); } catch (e) { send({ t: 'run-err', m: '' + e }); } }, 1500);
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
    if (t <= 0) { send({ t: 'nojava' }); return; }
    setTimeout(function () { waitJava(t - 1); }, 200);
})(200);
