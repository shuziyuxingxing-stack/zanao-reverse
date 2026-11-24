function hexBytes(b) {
    var out = '';
    for (var i = 0; i < b.length; i++) { var v = (b[i] + 256) % 256; out += ('0' + v.toString(16)).slice(-2); }
    return out;
}
Java.perform(function () {
    console.log('PERFORM_OK');
    var SKS = Java.use('javax.crypto.spec.SecretKeySpec');
    SKS.$init.overload('[B', 'java.lang.String').implementation = function (k, alg) {
        console.log('SKS|' + alg + '|' + hexBytes(k));
        return this.$init(k, alg);
    };
    var IV = Java.use('javax.crypto.spec.IvParameterSpec');
    IV.$init.overload('[B').implementation = function (iv) {
        console.log('IV|' + hexBytes(iv));
        return this.$init(iv);
    };
    var MD = Java.use('java.security.MessageDigest');
    MD.update.overload('[B').implementation = function (b) {
        try {
            var s = Java.use('java.lang.String').$new(b, Java.use('java.nio.charset.StandardCharsets').UTF_8.value);
            console.log('DIG|' + s);
        } catch (e) {}
        return this.update(b);
    };
    var JU = Java.use('com.comingx.zanao.utils.JniUtils');
    JU.makeSign.overload('java.util.SortedMap').implementation = function (m) {
        var r = this.makeSign(m);
        console.log('SIGN|' + r + '|MAP|' + m.toString());
        return r;
    };
    console.log('HOOKS_READY');
});