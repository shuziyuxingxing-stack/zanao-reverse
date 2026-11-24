import frida, time, sys, subprocess, re
ADB = r'D:\Android-Studio-SDK\platform-tools\adb.exe'; DEV = 'DEVICE_SERIAL'
def sh(cmd):
    return subprocess.run([ADB, '-s', DEV, 'shell', cmd], capture_output=True, text=True).stdout
out = sh('ps -A -o pid,args | grep com.comingx | grep -v grep')
m = re.search(r'(\d+)', out)
pid = int(m.group(1)); print('pid', pid)
JS = open(r'D:\onedrive\文档\deepseek-harness\default-workspace\zanao_x\tools\hook_java.js', encoding='utf-8').read()
dev = frida.get_device_manager().add_remote_device('127.0.0.1:39999')
s = dev.attach(pid)
sc = s.create_script(JS)
sc.on('message', lambda m, d: print(m.get('payload') if m['type'] == 'send' else m, flush=True))
sc.load(); print('loaded')
time.sleep(3)
sh('input tap 540 2200'); time.sleep(6)
sh('input tap 200 2200'); time.sleep(6)
print('--- done ---')