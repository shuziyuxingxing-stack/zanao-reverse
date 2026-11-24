// sniff.js — 累积缓冲，抓明文 HTTP 请求头（含 X-Sc-Ah）+ body
var hits = 0, bufs = {};
function find(name) {
    try { if (Module.findGlobalExportByName) return Module.findGlobalExportByName(name); } catch (e) { }
    try { if (Module.findExportByName) return Module.findExportByName(null, name); } catch (e) { }
    return null;
}
function feed(key, buf, len) {
    if (len <= 0 || len > 65535) return;
    var s = '';
    try { s = Memory.readCString(buf, Math.min(len, 4096)); } catch (e) { return; }
    if (!s) return;
    var acc = (bufs[key] || '') + s;
    if (acc.length > 20000) acc = acc.slice(-20000);
    bufs[key] = acc;
    if (hits < 3 && acc.indexOf('X-Sc-Ah') >= 0 && acc.indexOf('HTTP/1') >= 0) {
        hits++;
        send({ t: 'http', raw: acc.slice(-3000) });
        bufs[key] = '';
    }
}
['send', 'sendto', 'sendmsg', 'write'].forEach(function (fn) {
    var p = find(fn);
    if (!p) return;
    try {
        Interceptor.attach(p, {
            onEnter: function (args) {
                try { feed(this.threadId + ':' + fn, args[1], args[2].toInt32()); } catch (e) { }
            }
        });
        send({ t: 'attached', fn: fn });
    } catch (e) { send({ t: 'err', fn: fn, m: '' + e }); }
});