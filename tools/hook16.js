console.log('START v16');
var mod = Process.getModuleByName('libAesNew.so');
var sym = null;
mod.enumerateExports().forEach(function (e) { if (e.name.indexOf('makeSign') !== -1) sym = e.address; });
var nSet = 0, nArr = 0, installed = false;
function hex(ptr, n) {
    var out = '';
    try { for (var i = 0; i < n && i < 48; i++) { out += ('0' + ptr.add(i).readU8().toString(16)).slice(-2); } } catch (e) { return 'ERR'; }
    return out;
}
Interceptor.attach(sym, {
    onEnter: function (args) {
        if (installed) return;
        installed = true;
        try {
            var vt = args[0].readPointer();
            var newArr = vt.add(176 * 8).readPointer();
            var setReg = vt.add(208 * 8).readPointer();
            Interceptor.attach(newArr, {
                onEnter: function (a) { nArr++; if (nArr <= 12) console.log('NEWARR|len=' + a[1].toInt32()); }
            });
            Interceptor.attach(setReg, {
                onEnter: function (a) {
                    nSet++;
                    var len = a[3].toInt32();
                    if (nSet <= 20) console.log('SETREG|len=' + len + '|' + hex(a[4], len));
                }
            });
            console.log('ATTACHED');
        } catch (e) { console.log('ERR ' + e); }
    }
});
console.log('HOOKED');