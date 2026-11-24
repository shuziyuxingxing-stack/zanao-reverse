console.log('START v8');
var mod = Process.getModuleByName('libAesNew.so');
function hex(b) {
    var u = new Uint8Array(b);
    var out = '';
    for (var i = 0; i < u.length && i < 24; i++) {
        out += ('0' + u[i].toString(16)).slice(-2) + ' ';
    }
    return out;
}
function readStd(p) {
    try {
        var b0 = p.readU8();
        if ((b0 & 1) === 0) {
            var len = b0 >> 1;
            if (len > 0 && len < 512) return p.add(1).readUtf8String(len);
        } else {
            var len2 = p.readU64().toNumber() >>> 1;
            if (len2 > 0 && len2 < 8192) return p.add(8).readPointer().readUtf8String(len2);
        }
    } catch (e) { return 'ERR:' + e; }
    return null;
}
var n = 0;
Interceptor.attach(mod.base.add(0x28cd0), {
    onEnter: function (args) {
        n++;
        if (n <= 6) {
            try { console.log('C' + n + ' hex=' + hex(args[1].readByteArray(24))); } catch (e) { console.log('C' + n + ' hexerr'); }
            console.log('   str=' + readStd(args[1]));
        }
    }
});
console.log('HOOKED');