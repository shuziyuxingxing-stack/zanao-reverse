console.log('START v10');
var mod = Process.getModuleByName('libAesNew.so');
var n = 0;
function cstr(p, max) {
    var out = '';
    try {
        for (var i = 0; i < max; i++) {
            var c = p.add(i).readU8();
            if (c === 0) break;
            out += String.fromCharCode(c);
        }
    } catch (e) { return out + '<ERR>'; }
    return out;
}
Interceptor.attach(mod.base.add(0x28cd0), {
    onEnter: function (args) {
        n++;
        if (n > 6) return;
        try {
            var len = args[1].readU32();
            var ptr = args[1].add(16).readPointer();
            console.log('C' + n + ' len=' + len + ' data=' + cstr(ptr, 320));
        } catch (e) { console.log('C' + n + ' err ' + e); }
    }
});
console.log('HOOKED');