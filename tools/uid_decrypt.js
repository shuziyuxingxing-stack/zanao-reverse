// uid_decrypt.js — 解 user_id 密文（复刻 H5 的 Utils.decrypt）
// blob 结构：base64( base64(AES-128-CBC(plain)) )，双层 base64
const crypto = require('crypto');

const MIX = '68bfccbfb8ef27ff31dc75f05490c85c';
const KEY_B64 = 'hIWanaS4k5iji5WqZmypng==';
const IV_B64 = 'g4KSn6S4mpi6fJ6XaWmqlw==';

function customDecrypt(b64, mix) {
    const s = Buffer.from(b64, 'base64').toString('latin1');
    let o = '';
    for (let i = 0; i < s.length; i++) {
        o += String.fromCharCode(s.charCodeAt(i) - mix.charCodeAt(i % mix.length));
    }
    return o;
}

const key = Buffer.from(customDecrypt(KEY_B64, MIX), 'latin1');
const iv = Buffer.from(customDecrypt(IV_B64, MIX), 'latin1');

function decryptUid(blob) {
    // 1) 外层 base64（H5: Base64.parse(...).toString(Utf8)）→ 得到内层 base64 字符串
    const inner = Buffer.from(decodeURIComponent(blob), 'base64').toString('latin1');
    // 2) 内层 base64 → 真正的 AES 密文
    const cipher = Buffer.from(inner, 'base64');
    const d = crypto.createDecipheriv('aes-128-cbc', key, iv);
    return Buffer.concat([d.update(cipher), d.final()]).toString('utf8');
}

if (require.main === module) {
    if (process.argv[2] === '--info') {
        console.log(JSON.stringify({ key_hex: key.toString('hex'), iv_hex: iv.toString('hex') }));
    } else {
        for (const b of process.argv.slice(2)) {
            try {
                console.log(JSON.stringify({ blob_head: b.slice(0, 16), plain: decryptUid(b) }));
            } catch (e) {
                console.log(JSON.stringify({ blob_head: b.slice(0, 16), error: String(e.message || e) }));
            }
        }
    }
}
module.exports = { decryptUid };
