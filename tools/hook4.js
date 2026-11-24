console.log('START v4');
var tries = 0;
function boot() {
    tries++;
    if (typeof Java === 'undefined') {
        if (tries < 30) { setTimeout(boot, 500); } else { console.log('NO_JAVA'); }
        return;
    }
    console.log('JAVA_AT_TRY=' + tries);
    Java.perform(function () {
        console.log('PERFORM_OK');
        var S = Java.use('java.nio.charset.StandardCharsets').UTF_8.value;
        var MD = Java.use('java.security.MessageDigest');
        MD.update.overload('[B').implementation = function (b) {
            try { console.log('MD5IN:' + Java.use('java.lang.String').$new(b, S)); } catch (e) {}
            return this.update(b);
        };
        console.log('MD_HOOK_OK');
        var JU = Java.use('com.comingx.zanao.utils.JniUtils');
        JU.makeSign.overload('java.util.SortedMap').implementation = function (m) {
            var r = this.makeSign(m);
            console.log('SIGN:' + r + ' MAP:' + m.toString());
            return r;
        };
        console.log('JU_HOOK_OK');
    });
}
setTimeout(boot, 800);