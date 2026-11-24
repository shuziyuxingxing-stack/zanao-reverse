/* eslint-disable */
// zanao driver — 在目标 App 进程内：抓会话 → 本地签名 → 发请求 → 打印结果
// 由 zanao_cli.py 渲染 CFG 后通过 frida CLI 载入（frida 17 只有 CLI 带 Java bridge）
var CFG = __CFG__;

var TOKEN = CFG.token || null;
var ALIAS = CFG.alias || null;
var DEVICE = CFG.device || null;
var STARTED = false;

function out(o) { console.log('__Z__' + JSON.stringify({ ok: true, data: o })); console.log('__Z_DONE__'); }
function fail(m) { console.log('__Z__' + JSON.stringify({ ok: false, error: String(m) })); console.log('__Z_DONE__'); }

function sign(fields) {
    var T = Java.use('java.util.TreeMap'), m = T.$new();
    for (var k in fields) m.put(String(k), String(fields[k]));
    return Java.use('com.comingx.zanao.utils.JniUtils').makeSign(m);
}

function bytesOf(str) {
    var S = Java.use('java.lang.String');
    var bs = S.$new(str).getBytes('UTF-8'), arr = [];
    for (var i = 0; i < bs.length; i++) arr.push(bs[i]);
    return Java.array('byte', arr);
}

function api(path, data, method) {
    method = (method || 'POST').toUpperCase();
    var S = Java.use('java.lang.String'), HUC = Java.use('java.net.HttpURLConnection');
    var base = CFG.base || 'http://api.app.zanao.com';
    var url = base + path, q = [], k;
    for (k in data) q.push(encodeURIComponent(k) + '=' + encodeURIComponent(data[k]));
    if (method === 'GET' && q.length) url += '?' + q.join('&');

    var nd = '', td = String(Math.floor(Date.now() / 1000));
    for (var i = 0; i < 20; i++) nd += Math.floor(Math.random() * 10);
    var si = { timestamp__: td, randnum__: nd };
    for (k in data) si[k] = data[k];

    var c = Java.cast(Java.use('java.net.URL').$new(url).openConnection(), HUC);
    c.setRequestMethod(method);
    c.setConnectTimeout(15000); c.setReadTimeout(25000); c.setDoInput(true);
    var h = {
        'X-Sc-Alias': ALIAS || '', 'X-Sc-Token': TOKEN || '', 'X-Sc-Client': 'app',
        'X-Sc-Device': DEVICE || '', 'X-Sc-Platform': 'Android', 'X-Sc-Hb-V': '210',
        'X-Sc-Nt-V': '310', 'X-Sc-Version': '3.1.0', 'X-Sc-Nd': nd, 'X-Sc-Td': td,
        'X-Sc-Ah': sign(si), 'X-Requested-With': 'XMLHttpRequest', 'User-Agent': 'okhttp/4.10.0'
    };
    if (method === 'POST') {
        h['Content-Type'] = 'application/json; charset=utf-8';
        c.setDoOutput(true);
    }
    for (k in h) c.setRequestProperty(k, String(h[k]));
    if (method === 'POST') {
        var os = c.getOutputStream();
        os.write(bytesOf(JSON.stringify(data)));
        os.flush(); os.close();
    }
    var code = c.getResponseCode();
    var is = (code >= 400) ? c.getErrorStream() : c.getInputStream(), txt = '';
    if (is !== null) {
        var BAOS = Java.use('java.io.ByteArrayOutputStream');
        var buf = Java.array('byte', new Array(8192).fill(0));
        var b = BAOS.$new();
        while (true) { var n = is.read(buf); if (n <= 0) break; b.write(buf, 0, n); }
        is.close();
        txt = String(S.$new(b.toByteArray(), 'UTF-8'));
    }
    var encHeader = '';
    try { encHeader = String(c.getHeaderField('x-sc-encrypt') || c.getHeaderField('X-Data-Encrypt') || ''); } catch (e) { }
    if (encHeader === '1') {
        try { txt = String(Java.use('com.comingx.zanao.utils.JniUtils').unhashAppResult(txt)); } catch (e) { }
    }
    var j = null;
    try { j = JSON.parse(txt); } catch (e) { }
    if (j && j.__encrypt__ && j.__data__) {
        try { j = JSON.parse(String(Java.use('com.comingx.zanao.utils.JniUtils').unhashAppResult(j.__data__))); } catch (e) { }
    }
    return { http: code, json: j, raw: j ? null : txt.substring(0, 400) };
}

function pick(x, terms) {
    var t = (x.title || ''), c = (x.content || '');
    var score = 0, hits = [];
    for (var i = 0; i < (terms || []).length; i++) {
        var k = terms[i].toLowerCase();
        if (!k) continue;
        if (t.toLowerCase().indexOf(k) >= 0) { score += 3; hits.push(terms[i]); }
        else if (c.toLowerCase().indexOf(k) >= 0) { score += 1; hits.push(terms[i]); }
    }
    return { thread_id: x.thread_id, title: t, nickname: x.nickname, headimgurl: x.headimgurl,
             cate_name: x.cate_name, c_count: x.c_count, l_count: x.l_count,
             score: score, hits: hits };
}

// ---------------- commands ----------------
var CMD = {
    'thread-list': function (a) {
        var r = api('/thread/v2/list', { page: a.page || 1, per_page: a.per_page || 10 });
        var list = r.json && r.json.data && r.json.data.list || [];
        return {
            errno: r.json && r.json.errno,
            items: list.map(function (x) {
                return {
                    thread_id: x.thread_id, title: x.title, is_anon: x.is_anon,
                    nickname: x.nickname, headimgurl: x.headimgurl,
                    cate_name: x.cate_name, c_count: x.c_count, l_count: x.l_count
                };
            })
        };
    },
    'search': function (a) {
        var body = { keyword: a.keyword, page: a.page || 1, per_page: a.per_page || 10 };
        var r = api('/thread/search', body);
        if (!r.json || r.json.errno !== 0) {
            var r2 = api('/thread/v2/search', body);
            if (r2.json && r2.json.errno === 0) r = r2;
        }
        var ks = (a.keyword || '').split(/[\s,]+/).filter(function (x) { return x; });
        return {
            errno: r.json && r.json.errno, errmsg: r.json && r.json.errmsg,
            keyword: a.keyword,
            items: ((r.json && r.json.data && r.json.data.list) || []).map(function (x) { return pick(x, ks); })
        };
    },
    'harvest': function (a) {
        var terms = (a.keyword || '').split(/[\s,]+/).filter(function (x) { return x; });
        var noise = new RegExp(a.exclude || '抽奖|接龙|拼单|砍一刀|助力|投票|互赞|打卡签到');
        var stats = { pages: 0, scanned: 0, dropped_noise: 0, dropped_threshold: 0, dropped_duplicate: 0, dropped_irrelevant: 0, kept: 0 };
        var seen = {}, pool = [];
        var pages = a.pages || 3, per = a.per_page || 20;
        for (var p = 1; p <= pages; p++) {
            var r = api('/thread/v2/list', { page: p, per_page: per });
            if (!r.json || r.json.errno !== 0) break;
            stats.pages++;
            var list = (r.json.data && r.json.data.list) || [];
            if (!list.length) break;
            for (var i = 0; i < list.length; i++) {
                var x = list[i];
                stats.scanned++;
                var title = x.title || '';
                if (noise.test(title)) { stats.dropped_noise++; continue; }
                if (a.cate && (x.cate_name || '').indexOf(a.cate) < 0) { stats.dropped_threshold++; continue; }
                var lc = parseInt(x.l_count || 0), cc = parseInt(x.c_count || 0);
                if (lc < (a.min_likes || 0) || cc < (a.min_comments || 0)) { stats.dropped_threshold++; continue; }
                var key = title.replace(/[\s\W_]+/g, '').toLowerCase();
                if (!key) { stats.dropped_irrelevant++; continue; }
                if (seen[key]) { stats.dropped_duplicate++; continue; }
                seen[key] = 1;
                pool.push(x);
            }
        }
        var out = [];
        for (var j = 0; j < pool.length; j++) {
            var it = pool[j];
            var row = pick(it, terms);
            if (terms.length && row.score <= 0) { stats.dropped_irrelevant++; continue; }
            out.push(row);
        }
        out.sort(function (m, n) { return (n.score - m.score) || ((parseInt(n.l_count||0)+parseInt(n.c_count||0)) - (parseInt(m.l_count||0)+parseInt(m.c_count||0))); });
        stats.kept = out.length;
        return { errno: 0, stats: stats, items: out.slice(0, a.limit || 20) };
    },    'thread-info': function (a) {
        var r = api('/thread/info', { id: a.id });
        var d = (r.json && r.json.data && r.json.data.detail) || {};
        return {
            errno: r.json && r.json.errno, errmsg: r.json && r.json.errmsg,
            thread_id: d.thread_id, title: d.title, nickname: d.nickname,
            headimgurl: d.headimgurl, is_anon: d.is_anon,
            user_id_token: d.user_id,            // 不透明标识，不可解
            contact_person: d.contact_person, contact_phone: d.contact_phone, contact_qq: d.contact_qq
        };
    },
    'comments': function (a) {
        var r = api('/comment/list', { id: a.id, page: a.page || 1 });
        var list = r.json && r.json.data && r.json.data.list || [];
        return {
            errno: r.json && r.json.errno, errmsg: r.json && r.json.errmsg,
            total: r.json && r.json.data && r.json.data.total,
            items: list.slice(0, a.limit || 20).map(function (x) {
                return {
                    comment_id: x.comment_id, nickname: x.nickname, headimgurl: x.headimgurl,
                    content: x.content, uid_token: x.uid, is_author: x.is_author
                };
            })
        };
    },
    'user-show': function (a) {
        var r = api('/user/usershow', a.comment_id ? { comment_id: a.comment_id } : { thread_id: a.thread_id });
        var u = (r.json && r.json.data && r.json.data.user_info) || {};
        return {
            errno: r.json && r.json.errno,
            nickname: u.nickname, headimgurl: u.headimgurl, school_name: u.school_name,
            reg_days: u.reg_days, user_level: u.user_level, user_level_title: u.user_level_title
        };
    },
    'self': function () {
        var r = api('/user/v1/profile', {});
        var u = (r.json && r.json.data && r.json.data.user_info) || {};
        return {
            errno: r.json && r.json.errno, user_id: u.user_id, id: u.id,
            nickname: u.nickname, headimgurl: u.headimgurl,
            cert_status: u.cert_status, community_id: u.community_id
        };
    },
    'certinfo': function (a) {
        var r = api('/user/certinfo', { school_id: a.school_id }, 'GET');
        var ci = (r.json && r.json.data && r.json.data.cert_info) || {};
        return {
            errno: r.json && r.json.errno, errmsg: r.json && r.json.errmsg,
            keys: Object.keys(ci),
            realname_present: !!ci.realname, student_no_present: !!ci.student_no,
            has_cert_img: !!ci.cert_img, has_cert_img_url: !!ci.cert_img_url,
            school_name: ci.school_name, cert_status: ci.cert_status
        };
    },
    'schools': function (a) {
        var r = api('/app/schoollist', {});
        var hits = [];
        (function walk(o) {
            if (!o || typeof o !== 'object') return;
            if (Array.isArray(o)) { for (var i = 0; i < o.length; i++) walk(o[i]); return; }
            if (o.id && o.name && (!a.keyword || String(o.name).indexOf(a.keyword) >= 0)) {
                hits.push({ id: o.id, name: o.name });
            }
            for (var k in o) walk(o[k]);
        })(r.json);
        return { errno: r.json && r.json.errno, matches: hits.slice(0, 20) };
    },
    'raw': function (a) {
        var r = api(a.path, a.data || {}, a.method || 'POST');
        return { http: r.http, errno: r.json && r.json.errno, errmsg: r.json && r.json.errmsg, json: r.json, raw: r.raw };
    }
};

function runCmd() {
    if (!TOKEN) { fail('no token: 设备上 App 未登录，或先手动提供 --token'); return; }
    var fn = CMD[CFG.cmd];
    if (!fn) { fail('unknown cmd: ' + CFG.cmd); return; }
    try { out(fn(CFG.args || {})); } catch (e) { fail(e); }
}

function doCapture(then) {
    Java.perform(function () {
        try {
            var N = Java.use('com.comingx.zanao.JSIs.NetworkJSI');
            ['request', 'easyRequest'].forEach(function (m) {
                if (!N[m]) return;
                N[m].overloads.forEach(function (ov) {
                    if (ov.argumentTypes.length !== 1 || ov.argumentTypes[0].className !== 'java.lang.String') return;
                    ov.implementation = function (s) {
                        try {
                            if (!TOKEN && s && s.indexOf('X-Sc-Token') >= 0) {
                                var p = JSON.parse(s), v = p.parameters[0].value, hd = v.header || {};
                                TOKEN = hd['X-Sc-Token']; ALIAS = ALIAS || hd['X-Sc-Alias']; DEVICE = DEVICE || hd['X-Sc-Device'];
                                console.log('__Z_SESSION__' + JSON.stringify({ alias: ALIAS, device: DEVICE }));
                                setTimeout(runCmd, 1200);
                            }
                        } catch (e) { }
                        return ov.call(this, s);
                    };
                });
            });
        } catch (e) { fail('hook: ' + e); }
    });
}

function waitClass(t) {
    var ok = false;
    try {
        Java.perform(function () {
            try { Java.use('com.comingx.zanao.utils.JniUtils'); ok = true; } catch (e) {}
        });
    } catch (e) {}
    if (ok) { setTimeout(runCmd, 300); return; }
    if (t <= 0) { fail('JniUtils 未加载（App 启动太慢或类被裁剪）'); return; }
    setTimeout(function () { waitClass(t - 1); }, 300);
}

(function waitJava(t) {
    if (typeof Java !== 'undefined') {
        if (TOKEN) { waitClass(80); }
        else { setTimeout(function () { doCapture(); }, 500); }
        return;
    }
    if (t <= 0) { fail('Java bridge not available'); return; }
    setTimeout(function () { waitJava(t - 1); }, 200);
})(250);
