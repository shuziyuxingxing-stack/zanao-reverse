import frida, sys, json, time
JS = r"""
Java.perform(function () {
    var StdCharsets = Java.use('java.nio.charset.StandardCharsets');
    function toStr(b) {
        try { return Java.use('java.lang.String').$new(b, StdCharsets.UTF_8.value); }
        catch (e) { return String(b); }
    }
    try {
        var MD = Java.use('java.security.MessageDigest');
        MD.update.overload('[B').implementation = function (b) {
            send({t: 'md5in', data: toStr(b)});
            return this.update(b);
        };
    } catch (e) { send({t: 'err', m: 'MD ' + e}); }
    try {
        var JU = Java.use('com.comingx.zanao.utils.JniUtils');
        JU.makeSign.overload('java.util.SortedMap').implementation = function (m) {
            var r = this.makeSign(m);
            send({t: 'sign', map: String(m.toString()), sig: String(r)});
            return r;
        };
    } catch (e) { send({t: 'err', m: 'JU ' + e}); }
    send({t: 'ready'});
});
"""
dev = frida.get_device_manager().add_remote_device('127.0.0.1:39999')
pid = dev.spawn(['com.comingx.zanao'])
print('spawned pid', pid)
s = dev.attach(pid)
script = s.create_script(JS)
out = []
def on_msg(m, d):
    if m['type'] == 'send':
        p = m['payload']
        if p.get('t') == 'md5in':
            print('MD5IN:', p['data'][:300])
        elif p.get('t') == 'sign':
            print('SIGN :', p['sig'], '<-', p['map'][:200])
        elif p.get('t') == 'err':
            print('ERR  :', p['m'])
        elif p.get('t') == 'ready':
            print('READY')
script.on('message', on_msg)
script.load()
dev.resume(pid)
time.sleep(18)
print('--- done ---')