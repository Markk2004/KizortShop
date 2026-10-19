import subprocess
import time

adb_path = r"E:\Program Files\Netease\MuMuPlayer\nx_device\12.0\shell\adb.exe"

def run_adb(args):
    cmd = [adb_path] + args
    res = subprocess.run(cmd, capture_output=True, text=True, timeout=10)
    return res.stdout.strip(), res.stderr.strip()

print("1. Connect:")
out, err = run_adb(["connect", "127.0.0.1:16384"])
print("OUT:", out)
print("ERR:", err)

print("\n2. Devices:")
out, err = run_adb(["devices"])
print("OUT:", out)

print("\n3. Current Activity:")
out, err = run_adb(["-s", "127.0.0.1:16384", "shell", "dumpsys", "activity", "activities"])
lines = [line.strip() for line in out.splitlines() if any(k in line.lower() for k in ["mfocusedapp", "mresumedactivity", "topactivity", "roblox"])]
for l in lines[:15]:
    print(l)
