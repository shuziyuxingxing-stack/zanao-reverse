console.log('START exports scan');
var art = Process.getModuleByName('libart.so');
var names = art.enumerateExports().map(function (e) { return e.name; });
var want = names.filter(function (n) {
    return /NewStringUTF|CallVoidMethod|CallObjectMethod|NewByteArray/i.test(n);
});
console.log('found ' + want.length);
want.slice(0, 25).forEach(function (n) { console.log('EXP:' + n); });