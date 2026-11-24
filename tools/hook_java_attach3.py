import frida, time, subprocess, sys
ADB = r'D:\Android-Studio-SDK\platform-tools\adb.exe'; DEV = 'DEVICE_SERIAL'
def sh(c):
    return subprocess.run([ADB, '-s', DEV, 'shell', c], capture_output=True, text=True).stdout
sh('am start -n com.comingx.zanao/.presentation.eGuideActivity')
time.sleep(6)
pid_s = sh('pidof com.comingx.zanao').strip()
print('pid_s=%r' % pid_s)
if not pid_s:
    print('still not running'); sys.exit(1)
pid = int(pid_s.split()[0])
JS = open(r'D:\onedrive\文档\deepseek-harness\default-workspace\zanao_x\tools\hook_java.js', encoding='utf-8').read()
dev = frida.get_device_manager().add_remote_device('127.0.0.1:39999')
s = dev.attach(pid)
sc = s.create_script(JS)
sc.on('message', lambda m, d: print(m.get('payload') if m['type'] == 'send' else m, flush=True))
sc.load(); print('loaded')
time.sleep(2)
sh('input tap 540 2200'); time.sleep(6)
sh('input tap 200 2200'); time.sleep(6)
print('--- done ---')