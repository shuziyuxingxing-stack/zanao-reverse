function hexBytes(b){var s='';for(var i=0;i<b.length;i++){var v=(b[i]+256)%256;s+=('0'+v.toString(16)).slice(-2);}return s;}
Java.perform(function(){
  console.log('PERFORM_OK');
  try{
    var SKS=Java.use('javax.crypto.spec.SecretKeySpec');
    SKS.$init.overload('[B','java.lang.String').implementation=function(k,alg){console.log('SKS|'+alg+'|'+hexBytes(k));return this.$init(k,alg);};
  }catch(e){console.log('SKS_ERR '+e);}
  try{
    var IV=Java.use('javax.crypto.spec.IvParameterSpec');
    IV.$init.overload('[B').implementation=function(iv){console.log('IV|'+hexBytes(iv));return this.$init(iv);};
  }catch(e){console.log('IV_ERR '+e);}
  try{
    var MD=Java.use('java.security.MessageDigest');
    MD.update.overload('[B').implementation=function(b){
      try{var s=Java.use('java.lang.String').$new(b,Java.use('java.nio.charset.StandardCharsets').UTF_8.value);console.log('DIG|'+s);}catch(e){}
      return this.update(b);};
  }catch(e){console.log('MD_ERR '+e);}
  console.log('HOOKS_READY');
});