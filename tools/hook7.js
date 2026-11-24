console.log('START v7');
var mod = Process.getModuleByName('libAesNew.so');
var n = 0;
Interceptor.attach(mod.base.add(0x28cd0), {
    onEnter: function (args) {
        n++;
        if (n <= 8) {
            console.log('CALL#' + n + ' x0=' + args[0] + ' x1=' + args[1]);
            try { console.log('  head=' + args[1].readByteArray(16)); } catch (e) {}
        }
    }
});
console.log('HOOKED');