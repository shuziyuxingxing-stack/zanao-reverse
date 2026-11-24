console.log('START v12');
var mod = Process.getModuleByName('libAesNew.so');
var sym = null;
mod.enumerateExports().forEach(function (e) { if (e.name.indexOf('makeSign') !== -1) sym = e.address; });
console.log('makeSign=' + sym);
var installed = false;
Interceptor.attach(sym, {
    onEnter: function (args) {
        if (installed) return;
        installed = true;
        try {
            var env = args[0];
            var vt = env.readPointer();
            var slot = vt.add(167 * 8);
            var fn = slot.readPointer();
            console.log('slot=' + slot + ' fn=' + fn);
            var orig = new NativeFunction(fn, 'pointer', ['pointer', 'pointer']);
            var cb = new NativeCallback(function (e, cstr) {
                try {
                    var s = cstr.readUtf8String(300);
                    if (s && s.length > 3) console.log('NSTR<' + s.length + '>:' + s);
                } catch (err) {}
                return orig(e, cstr);
            }, 'pointer', ['pointer', 'pointer']);
            Memory.protect(slot, 8, 'rwx');
            slot.writePointer(cb);
            console.log('VTABLE_HOOKED');
        } catch (e) { console.log('INSTALL_ERR ' + e); }
    }
});
console.log('HOOKED');