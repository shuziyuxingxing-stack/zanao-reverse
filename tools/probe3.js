// probe3.js — 用 App 真实请求的 url+data 原样重放（只换 X-Sc-Nd/Td/Ah），验证我们的签名链路
var TOKEN = null, ALIAS = null, DEVICE = null, FIRST = null;

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

function post(url, data, ctype) {
    var S = Java.use('java.lang.String');
    var HUC = Java.use('java.net.HttpURLConnection');
    var c = Java.cast(Java.use('java.net.URL').$new(url).openConnection(), HUC);
    c.setRequestMethod('POST');
    c.setConnectTimeout(15000); c.setReadTimeout(25000); c.setDoInput(true); c.setDoOutput(true);
    var nd = '', td = String(Math.floor(Date.now() / 1000));
    for (var i = 0; i < 20; i++) nd += Math.floor(Math.random() * 10);
    var si = { timestamp__: td, randnum__: nd };
    for (var k in data) si[k] = data[k];
    var ah = sign(si);
    var h = {
        'X-Sc-Alias': ALIAS, 'X-Sc-Token': TOKEN, 'X-Sc-Client': 'app',
        'X-Sc-Device': DEVICE, 'X-Sc-Platform': 'Android', 'X-Sc-Hb-V': '210',
        'X-Sc-Nt-V': '310', 'X-Sc-Version': '3.1.0', 'X-Sc-Nd': nd, 'X-Sc-Td': td,
        'X-Sc-Ah': ah, 'X-Requested-With': 'XMLHttpRequest',
        'Content-Type': ctype || 'application/json; charset=utf-8',
        'User-Agent': 'okhttp/4.9.3'
    };
    for (var k2 in h) c.setRequestProperty(k2, String(h[k2]));
    var bs = S.$new(JSON.stringify(data)).getBytes();
    var arr = []; for (var j = 0; j < bs.length; j++) arr.push(bs[j]);
    var os = c.getOutputStream(); os.write(Java.array('byte', arr)); os.flush(); os.close();
    var code = c.getResponseCode();
    var is = (code >= 400) ? c.getErrorStream() : c.getInputStream();
    var txt = '';
    if (is !== null) {
        var BAOS = Java.use('java.io.ByteArrayOutputStream');
        var buf = Java.array('byte', new Array(4096).fill(0));
        var b = BAOS.$new();
        while (true) { var n = is.read(buf); if (n <= 0) break; b.write(buf, 0, n); }
        is.close(); txt = String(S.$new(b.toByteArray()));
    }
    return { code: code, body: txt.substring(0, 500), ah: ah };
}

function run() {
    var out = [];
    try {
        out.push({ v: 'replay-app-request', url: FIRST.url, data: FIRST.data, r: post(FIRST.url, FIRST.data, FIRST.ctype) });
    } catch (e) { out.push({ err: 'replay:' + e }); }
    try {
        out.push({ v: 'sc-api list', r: post('http://api.app.zanao.com/sc-api/thread/v2/list', { page: 1, per_page: 10 }) });
    } catch (e) { out.push({ err: 'list:' + e }); }
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
                                TOKEN = v.header['X-Sc-Token'];
                                ALIAS = v.header['X-Sc-Alias'];
                                DEVICE = v.header['X-Sc-Device'];
                                FIRST = { url: v.url, data: v.data, ctype: v.content_type };
                                send({ t: 'cap', url: v.url, ctype: v.content_type });
                                setTimeout(function () { try { run(); } catch (e) { send({ t: 'run-err', m: '' + e }); } }, 1500);
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
