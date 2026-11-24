console.log('START strhook');
var mod = Process.getModuleByName('libAesNew.so');
var target = mod.base.add(0x28cd0);
console.log('base=' + mod.base + ' target=' + target);
function readStdString(p) {
    try {
        var b0 = p.readU8();
        var len, dataPtr;
        if ((b0 & 1) === 0) {
            len = b0 >> 1;
            dataPtr = p.add(1);
        } else {
            len = p.add(0).readU64().toNumber() >>> 1;
            dataPtr = p.add(8).readPointer();
        }
        if (len <= 0 || len > 4096) return null;
        return dataPtr.readUtf8String(len);
    } catch (e) { return null; }
}
Interceptor.attach(target, {
    onEnter: function (args) {
        var s = readStdString(args[1]);
        if (s) console.log('DIGEST_IN:' + s);
    }
});
console.log('HOOKED');