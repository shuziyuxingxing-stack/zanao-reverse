// dbg.js — 观察 App 真实请求的最终 header（含 X-Sc-Ah / X-Sc-Nd / X-Sc-Td）
function enter() {
    try {
        var RB = Java.use('okhttp3.Request$Builder');
        RB.addHeader.overload('java.lang.String', 'java.lang.String').implementation = function (k, v) {
            try {
                if (k && k.indexOf('X-Sc') === 0) send({ t: 'hdr', n: k, v: String(v) });
            } catch (e) { }
            return this.addHeader(k, v);
        };
        RB.header.overload('java.lang.String', 'java.lang.String').implementation = function (k, v) {
            try {
                if (k && k.indexOf('X-Sc') === 0) send({ t: 'hdr2', n: k, v: String(v) });
            } catch (e) { }
            return this.header(k, v);
        };
        send({ t: 'ok' });
    } catch (e) { send({ t: 'err', msg: '' + e }); }
}
(function wait(t) {
    if (typeof Java !== 'undefined') { Java.perform(enter); return; }
    if (t <= 0) { send({ t: 'nojava' }); return; }
    setTimeout(function () { wait(t - 1); }, 200);
})(200);
