// sniff2.js — 观察 App 自己请求的响应，判断 token 是否有效 / 服务端是否回 errno 0
var last = null, n = 0, reqs = {};
(function waitJava(t) {
    if (typeof Java !== 'undefined') {
        Java.perform(function () {
            try {
                var N = Java.use('com.comingx.zanao.JSIs.NetworkJSI');
                ['request', 'easyRequest'].forEach(function (m) {
                    if (!N[m]) return;
                    N[m].overloads.forEach(function (ov) {
                        if (ov.argumentTypes.length !== 1 || ov.argumentTypes[0].className !== 'java.lang.String') return;
                        ov.implementation = function (s) {
                            try {
                                var p = JSON.parse(s);
                                var v = p.parameters[0].value;
                                last = String(v.url);
                                send({ t: 'req', url: last, auth: (v.header && v.header['X-Sc-Token'] ? 'has-token' : 'no-token'), body: JSON.stringify(v.data || {}).slice(0, 1200) });
                            } catch (e) { }
                            return ov.call(this, s);
                        };
                    });
                });
            } catch (e) { send({ t: 'hook-err', m: '' + e }); }

            try {
                var C = Java.use('com.comingx.zanao.JSIs.BaseJSI$CompleterCallback');
                C.success.overloads.forEach(function (ov) {
                    ov.implementation = function () {
                        try {
                            if (n < 8) {
                                n++;
                                var args = [];
                                for (var i = 0; i < arguments.length; i++) args.push(String(arguments[i]).slice(0, 12000));
                                send({ t: 'resp', url: last, args: args });
                            }
                        } catch (e) { }
                        return ov.apply(this, arguments);
                    };
                });
                var F = Java.use('com.comingx.zanao.JSIs.BaseJSI$CompleterCallback');
                F.fail.overloads.forEach(function (ov) {
                    ov.implementation = function () {
                        try {
                            var args = [];
                            for (var i = 0; i < arguments.length; i++) args.push(String(arguments[i]).slice(0, 300));
                            send({ t: 'fail', url: last, args: args });
                        } catch (e) { }
                        return ov.apply(this, arguments);
                    };
                });
            } catch (e) { send({ t: 'cb-err', m: '' + e }); }
        });
        return;
    }
    if (t <= 0) { send({ t: 'nojava' }); return; }
    setTimeout(function () { waitJava(t - 1); }, 200);
})(200);
