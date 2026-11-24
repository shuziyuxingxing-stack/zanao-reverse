// test_sign.js — 一次性验证 makeSign oracle 可用
setTimeout(function () {
    try {
        Java.perform(function () {
            var T = Java.use('java.util.TreeMap');
            var m = T.$new();
            m.put('timestamp__', '1700000000');
            m.put('randnum__', '11111111111111111111');
            var s = Java.use('com.comingx.zanao.utils.JniUtils').makeSign(m);
            console.log('SIGN_RESULT=' + s);
        });
    } catch (e) {
        console.log('SIGN_ERR=' + e);
    }
}, 1500);
