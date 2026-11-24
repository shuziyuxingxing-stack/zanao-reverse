function dump() {
    Java.perform(function () {
        var out = [];
        Java.enumerateLoadedClasses({
            onMatch: function (n) {
                var s = n.toLowerCase();
                if (s.indexOf('x509') >= 0) return;
                if (s.indexOf('smtt') >= 0 || s.indexOf('.tbs.') >= 0 || s.indexOf('x5core') >= 0 || s.indexOf('webview') >= 0) {
                    if (out.length < 120) out.push(n);
                }
            },
            onComplete: function () { send({ t: 'classes', n: out.length, list: out }); }
        });
    });
}
(function w(t) {
    if (typeof Java !== 'undefined') { setTimeout(dump, 15000); return; }
    if (t <= 0) { send({ t: 'nojava' }); return; }
    setTimeout(function () { w(t - 1); }, 200);
})(200);