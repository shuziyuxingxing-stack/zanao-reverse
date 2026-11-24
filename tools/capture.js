// capture.js — 抓 App 自身的请求 payload（含 X-Sc-Token / X-Sc-Alias），供 Python 驱动
function hookAll() {
    try {
        var N = Java.use('com.comingx.zanao.JSIs.NetworkJSI');
        var names = ['easyRequest', 'request'];
        var n = 0;
        names.forEach(function (name) {
            if (!N[name]) return;
            N[name].overloads.forEach(function (ov) {
                if (ov.argumentTypes.length !== 1) return;
                if (ov.argumentTypes[0].className !== 'java.lang.String') return;
                ov.implementation = function (s) {
                    try {
                        if (s && s.indexOf('X-Sc-Token') >= 0 && !globalThis.__got) {
                            globalThis.__got = true;
                            send({ type: 'payload', fn: name, body: String(s) });
                        }
                    } catch (e) { }
                    return ov.call(this, s);
                };
                n++;
            });
        });
        send({ type: 'hooked', msg: 'network hooked (' + n + ' overloads)' });
    } catch (e) {
        send({ type: 'err', msg: '' + e });
    }
}

// frida 17 下 Java 桥是延迟注入的，等到可用再挂钩
(function waitJava(tries) {
    if (typeof Java !== 'undefined') {
        try { Java.perform(hookAll); } catch (e) { send({ type: 'err2', msg: '' + e }); }
        return;
    }
    if (tries <= 0) { send({ type: 'err', msg: 'Java bridge never appeared' }); return; }
    setTimeout(function () { waitJava(tries - 1); }, 200);
})(150);
