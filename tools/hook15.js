console.log('START v15');
var mod = Process.getModuleByName('libAesNew.so');
var sym = null;
mod.enumerateExports().forEach(function (e) { if (e.name.indexOf('makeSign') !== -1) sym = e.address; });
console.log('makeSign=' + sym);
var inSign = 0, installed = false;
function hex(ptr, n) {
    var out = '';
    try { for (var i = 0; i < n; i++) { var v = ptr.add(i).readU8(); out += ('0' + v.toString(16)).slice(-2); } } catch (e) { return 'ERR'; }
    return out;
}
Interceptor.attach(sym, {
    onEnter: function (args) {
        inSign++;
        if (installed) return;
        installed = true;
        try {
            var env = args[0];
            var vt = env.readPointer();
            var newByteArray = vt.add(176 * 8).readPointer();
            var setRegion = vt.add(208 * 8).readPointer();
            console.log('newByteArray=' + newByteArray + ' setRegion=' + setRegion);
            Interceptor.attach(setRegion, {
                onEnter: function (a) {
                    if (inSign <= 0) return;
                    try {
                        var len = a[3].toInt32();
                        if (len === 16 || len === 24 || len === 32) {
                            console.log('SETREGION|len=' + len + '|' + hex(a[4], len));
                        }
                    } catch (e) {}
                }
            });
            console.log('ATTACHED');
        } catch (e) { console.log('ERR ' + e); }
    },
    onLeave: function () { inSign--; }
});
console.log('HOOKED');