import frida, time, sys

JS = r"""
function hexBytes(b) {
    var out = '';
    for (var i = 0; i < b.length; i++) {
        var v = (b[i] + 256) % 256;
        out += ('0' + v.toString(16)).slice(-2);
    }
    return out;
}
Java.perform(function () {
    console.log('PERFORM_OK');
    try {
        var SKS = Java.use('javax.crypto.spec.SecretKeySpec');
        SKS.$init.overload('[B', 'java.lang.String').implementation = function (k, alg) {
            console.log('SKS|' + alg + '|' + hexBytes(k));
            return this.$init(k, alg);
        };
        console.log('SKS_HOOKED');
    } catch (e) { console.log('SKS_ERR ' + e); }
    try {
        var IV = Java.use('javax.crypto.spec.IvParameterSpec');
        IV.$init.overload('[B').implementation = function (iv) {
            console.log('IV|' + hexBytes(iv));
            return this.$init(iv);
        };
        console.log('IV_HOOKED');
    } catch (e) { console.log('IV_ERR ' + e); }
    try {
        var MD = Java.use('java.security.MessageDigest');
        MD.update.overload('[B').implementation = function (b) {
            try {
                var s = Java.use('java.lang.String').$new(b, Java.use('java.nio.charset.StandardCharsets').UTF_8.value);
                console.log('DIG|' + s);
            } catch (e) {}
            return this.update(b);
        };
        console.log('MD_HOOKED');
    } catch (e) { console.log('MD_ERR ' + e); }
    try {
        var JU = Java.use('com.comingx.zanao.utils.JniUtils');
        JU.makeSign.overload('java.util.SortedMap').implementation = function (m) {
            var r = this.makeSign(m);
            console.log('SIGN|' + r + '|MAP|' + m.toString());
            return r;
        };
        console.log('JU_HOOKED');
    } catch (e) { console.log('JU_ERR ' + e); }
});
"""

dev = frida.get_device_manager().add_remote_device('127.0.0.1:39999')
print('server', dev.query_system_parameters().get('version'))
pid = dev.spawn(['com.comingx.zanao'])
print('spawned', pid)
s = dev.attach(pid)
sc = s.create_script(JS)
sc.on('message', lambda m, d: print(m.get('payload') if m['type'] == 'send' else m, flush=True))
sc.load()
dev.resume(pid)
time.sleep(20)
print('--- done ---')