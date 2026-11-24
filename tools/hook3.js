Java.perform(function () {
    console.log('PERFORM_OK');
    var S = Java.use('java.nio.charset.StandardCharsets').UTF_8.value;
    try {
        var MD = Java.use('java.security.MessageDigest');
        MD.update.overload('[B').implementation = function (b) {
            try { console.log('MD5IN:' + Java.use('java.lang.String').$new(b, S)); } catch (e) {}
            return this.update(b);
        };
        console.log('MD_HOOK_OK');
    } catch (e) { console.log('ERRMD:' + e); }
    try {
        var JU = Java.use('com.comingx.zanao.utils.JniUtils');
        JU.makeSign.overload('java.util.SortedMap').implementation = function (m) {
            var r = this.makeSign(m);
            console.log('SIGN:' + r + ' MAP:' + m.toString());
            return r;
        };
        console.log('JU_HOOK_OK');
    } catch (e) { console.log('ERRJU:' + e); }
});