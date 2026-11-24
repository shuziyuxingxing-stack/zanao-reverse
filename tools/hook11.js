console.log('START v11');
var mod = Process.getModuleByName('libAesNew.so');
var makeSign = null;
mod.enumerateExports().forEach(function (e) {
    if (e.name.indexOf('makeSign') !== -1) makeSign = e.address;
});
console.log('makeSign=' + makeSign);
var lastP = null;
function cstr(p, max) {
    var out = '';
    try {
        for (var i = 0; i < max; i++) {
            var c = p.add(i).readU8();
            if (c === 0) break;
            out += String.fromCharCode(c);
        }
    } catch (e) { return null; }
    return out;
}
Interceptor.attach(mod.base.add(0x28cd0), {
    onEnter: function (args) {
        try {
            var ptr = args[1].add(16).readPointer();
            var s = cstr(ptr, 400);
            if (s && s.indexOf('secretkey') !== -1) lastP = s;
        } catch (e) {}
    }
});
Interceptor.attach(makeSign, {
    onEnter: function (args) { this.env = args[0]; },
    onLeave: function (ret) {
        try {
            var vt = this.env.readPointer();
            var fn = vt.add(169 * 8).readPointer();
            var getChars = new NativeFunction(fn, 'pointer', ['pointer', 'pointer', 'pointer']);
            var p = getChars(this.env, ret, ptr(0));
            var s = cstr(p, 80);
            console.log('PAIR|SIGN=' + s + '|P=' + lastP);
        } catch (e) { console.log('ERR ' + e); }
    }
});
console.log('HOOKED');