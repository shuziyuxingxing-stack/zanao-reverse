import frida, time, subprocess, sys
ADB = r'D:\Android-Studio-SDK\platform-tools\adb.exe'; DEV = 'DEVICE_SERIAL'
pid_s = subprocess.run([ADB, '-s', DEV, 'shell', 'pidof com.comingx.zanao'],
                       capture_output=True, text=True).stdout.strip()
if not pid_s:
    print('app not running'); sys.exit(1)
pid = int(pid_s.split()[0]); print('pid', pid)
JS = open(r'D:\onedrive\文档\deepseek-harness\default-workspace\zanao_x\tools\hook_java.js', encoding='utf-8').read()
dev = frida.get_device_manager().add_remote_device('127.0.0.1:39999')
s = dev.attach(pid)
sc = s.create_script(JS)
sc.on('message', lambda m, d: print(m.get('payload') if m['type'] == 'send' else m, flush=True))
sc.load(); print('loaded')
time.sleep(2)
subprocess.run([ADB, '-s', DEV, 'shell', 'input tap 540 2200'])
time.sleep(6)
subprocess.run([ADB, '-s', DEV, 'shell', 'input tap 200 2200'])
time.sleep(6)
print('--- done ---')