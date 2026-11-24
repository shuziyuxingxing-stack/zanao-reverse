console.log('START v13');
var mod = Process.getModuleByName('libAesNew.so');
var sym = null;
mod.enumerateExports().forEach(function (e) { if (e.name.indexOf('makeSign') !== -1) sym = e.address; });
var inSign = 0, installed = false;
Interceptor.attach(sym, {
    onEnter: function (args) {
        inSign++;
        if (installed) return;
        installed = true;
        try {
            var env = args[0];
            var vt = env.readPointer();
            var fn = vt.add(167 * 8).readPointer();
            console.log('newStringUTF=' + fn);
            Interceptor.attach(fn, {
                onEnter: function (a) {
                    if (inSign <= 0) return;
                    try {
                        var s = a[1].readUtf8String(200);
                        if (s && s.length >= 6 && s.length <= 120) console.log('S<' + s.length + '>:' + s);
                    } catch (e) {}
                }
            });
            console.log('ATTACHED');
        } catch (e) { console.log('ERR ' + e); }
    },
    onLeave: function () { inSign--; }
});
console.log('HOOKED');