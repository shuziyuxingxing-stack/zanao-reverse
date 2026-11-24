console.log('START v9');
var mod = Process.getModuleByName('libAesNew.so');
var n = 0;
Interceptor.attach(mod.base.add(0x28cd0), {
    onEnter: function (args) {
        n++;
        if (n > 8) return;
        try {
            var len = args[1].readU32();
            var ptr = args[1].add(16).readPointer();
            var s = ptr.readUtf8String(Math.min(len > 0 && len < 900 ? len : 120, 400));
            console.log('C' + n + ' len=' + len + ' str=' + s);
        } catch (e) { console.log('C' + n + ' err ' + e); }
    }
});
console.log('HOOKED');