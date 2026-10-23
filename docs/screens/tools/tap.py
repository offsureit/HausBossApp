"""Tap a node on the connected Android emulator by exact text / content-desc / resource-id (uiautomator)."""
import sys, re, subprocess
subprocess.run(['adb', 'shell', 'uiautomator', 'dump', '/sdcard/ui.xml'], capture_output=True)
x = subprocess.run(['adb', 'shell', 'cat', '/sdcard/ui.xml'], capture_output=True, text=True).stdout
key = sys.argv[1]; idx = int(sys.argv[2]) if len(sys.argv) > 2 else 0
nodes = re.findall(r'<node [^>]*>', x)
hits = [n for n in nodes if re.search(r'(text|content-desc|resource-id)="' + re.escape(key) + r'"', n)] or [n for n in nodes if key in n]
if not hits: print('NOT FOUND', key); sys.exit(1)
m = re.search(r'bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"', hits[idx]); cx = (int(m.group(1)) + int(m.group(3))) // 2; cy = (int(m.group(2)) + int(m.group(4))) // 2
subprocess.run(['adb', 'shell', 'input', 'tap', str(cx), str(cy)]); print('tapped', key, cx, cy)
