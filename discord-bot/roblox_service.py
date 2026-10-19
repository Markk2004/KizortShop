"""
Roblox & Android Emulator Monitoring Service for Discord Bot
จัดการการตรวจสอบสถานะ Process ของ Roblox และโปรแกรมจำลอง รวมถึงการคำนวณเวลาที่อยู่ในเกมจริง และการแคปภาพหน้าจอ
"""

import os
import sys
import time
import subprocess
import csv
import io
import ctypes
from ctypes import wintypes
from datetime import datetime, timedelta
import glob
from typing import List, Dict, Any, Optional, Tuple

ROBLOX_LOG_DIR = os.path.expandvars(r"%localappdata%\Roblox\logs")
DISCONNECT_KEYWORDS = [
    "disconnect",
    "kicked",
    "connection lost",
    "lost connection",
    "error code 277",
    "error code 268",
    "error code 279",
    "error code 524",
    "websocket error",
    "client:disconnect",
    "destroying megareplicator",
    "signalrcoreerror",
]

DEFAULT_TARGETS = [
    "RobloxPlayerBeta.exe",
    "MuMuPlayer.exe",
    "MuMuNxDevice.exe",
    "NemuPlayer.exe",
    "HD-Player.exe",
    "dnplayer.exe",
]


def get_latest_roblox_log() -> Optional[str]:
    """ดึงไฟล์ log ล่าสุดของ Roblox PC"""
    if not os.path.exists(ROBLOX_LOG_DIR):
        return None
    files = glob.glob(os.path.join(ROBLOX_LOG_DIR, "*.log"))
    if not files:
        return None
    return max(files, key=os.path.getmtime)


def check_log_disconnect(log_file: Optional[str], last_pos: int) -> Tuple[bool, int, str]:
    """ตรวจจับข้อความหลุดการเชื่อมต่อในไฟล์ log"""
    if not log_file or not os.path.exists(log_file):
        return False, last_pos, ""
    try:
        current_size = os.path.getsize(log_file)
        if current_size < last_pos:
            last_pos = 0
        with open(log_file, "r", encoding="utf-8", errors="ignore") as f:
            f.seek(last_pos)
            new_lines = f.read()
            new_pos = f.tell()

        for kw in DISCONNECT_KEYWORDS:
            if kw in new_lines.lower():
                return True, new_pos, kw
        return False, new_pos, ""
    except Exception:
        return False, last_pos, ""


def get_last_place_id(log_file: Optional[str] = None) -> Optional[str]:
    """ดึง placeId ล่าสุดที่ผู้เล่นเข้าเล่นจาก Log ของ Roblox"""
    import re
    if not log_file:
        log_file = get_latest_roblox_log()
    if not log_file or not os.path.exists(log_file):
        return None
    try:
        with open(log_file, "r", encoding="utf-8", errors="ignore") as f:
            lines = f.readlines()
            for line in reversed(lines):
                m = re.search(r"placeId[:=]\s*(\d+)", line, re.IGNORECASE)
                if m:
                    return m.group(1)
    except Exception:
        pass
    return None


def launch_roblox(place_id: Optional[str] = None) -> Tuple[bool, str]:
    """เปิด Roblox PC โดยระบุ placeId ผ่าน Deeplink (roblox://) หรือเปิดหน้าหลัก"""
    try:
        if not place_id:
            place_id = get_last_place_id()
        if place_id and str(place_id).isdigit():
            deeplink = f"roblox://placeId={place_id}"
            subprocess.Popen(["cmd", "/c", "start", deeplink], shell=True)
            return True, f"กำลังเปิด Roblox และเชื่อมต่อไปยัง Place ID: `{place_id}`..."
        else:
            # Fallback เปิด Roblox Player ปกติ
            subprocess.Popen(["cmd", "/c", "start", "roblox://"], shell=True)
            return True, "กำลังเปิด Roblox Player..."
    except Exception as e:
        return False, f"เกิดข้อผิดพลาดในการเปิดเกม: {e}"

kernel32 = ctypes.windll.kernel32
PROCESS_QUERY_LIMITED_INFORMATION = 0x1000


def get_pid_start_time(pid: int) -> Optional[datetime]:
    """ดึงเวลาเริ่มต้นทำงานจริงของ Process จาก Windows Kernel"""
    try:
        h = kernel32.OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, False, int(pid))
        if not h:
            return None
        try:
            ft_create = wintypes.FILETIME()
            ft_exit = wintypes.FILETIME()
            ft_kernel = wintypes.FILETIME()
            ft_user = wintypes.FILETIME()
            if kernel32.GetProcessTimes(
                h,
                ctypes.byref(ft_create),
                ctypes.byref(ft_exit),
                ctypes.byref(ft_kernel),
                ctypes.byref(ft_user),
            ):
                t = (ft_create.dwHighDateTime << 32) + ft_create.dwLowDateTime
                epoch_diff = 116444736000000000
                if t > epoch_diff:
                    ts = (t - epoch_diff) / 10000000
                    return datetime.fromtimestamp(ts)
        finally:
            kernel32.CloseHandle(h)
    except Exception:
        pass
    return None


def format_duration(seconds: float) -> str:
    """แปลงจำนวนวินาทีให้เป็นข้อความ เช่น 1 วัน 2 ชั่วโมง 35 นาที 10 วินาที"""
    td = timedelta(seconds=max(0, int(seconds)))
    hours, remainder = divmod(td.seconds, 3600)
    minutes, sec = divmod(remainder, 60)
    days = td.days
    parts = []
    if days > 0:
        parts.append(f"{days} วัน")
    if hours > 0:
        parts.append(f"{hours} ชั่วโมง")
    if minutes > 0:
        parts.append(f"{minutes} นาที")
    if sec > 0 or not parts:
        parts.append(f"{sec} วินาที")
    return " ".join(parts)


class RobloxService:
    def __init__(self, targets: Optional[List[str]] = None):
        self.targets = targets or DEFAULT_TARGETS
        self._is_running = False
        self._state_start_time = time.time()
        self._last_processes: List[Dict[str, Any]] = []

    @property
    def is_running(self) -> bool:
        return self._is_running

    def check_processes(self) -> List[Dict[str, Any]]:
        """ตรวจจับว่ามี process ใน targets กำลังรันอยู่หรือไม่ พร้อมดึง StartTime"""
        found = []
        try:
            cmd = ["tasklist", "/NH", "/FO", "CSV"]
            output = subprocess.check_output(cmd, text=True, errors="ignore")
            reader = csv.reader(io.StringIO(output))
            targets_lower = {t.lower(): t for t in self.targets}

            for row in reader:
                if not row or len(row) < 5:
                    continue
                p_name = row[0].strip()
                p_pid = row[1].strip()
                p_mem = row[4].strip()

                p_lower = p_name.lower()
                if p_lower in targets_lower:
                    start_dt = get_pid_start_time(int(p_pid)) if p_pid.isdigit() else None
                    found.append({
                        "name": targets_lower[p_lower],
                        "raw_name": p_name,
                        "pid": p_pid,
                        "memory": p_mem,
                        "start_dt": start_dt,
                        "start_time_str": start_dt.strftime("%H:%M:%S") if start_dt else "ไม่ระบุ",
                    })
        except Exception:
            pass

        now = time.time()
        was_running = self._is_running
        self._is_running = len(found) > 0

        # ถ้ามีการเปลี่ยนสถานะระหว่าง Online <-> Offline ให้รีเซ็ตเวลา
        if was_running != self._is_running:
            self._state_start_time = now

        self._last_processes = found
        return found

    def get_duration_str(self) -> str:
        """แปลงเวลาที่อยู่ในสถานะปัจจุบันเป็นข้อความ เช่น 2 ชั่วโมง 15 นาที"""
        duration = int(time.time() - self._state_start_time)
        return format_duration(duration)

    def get_status_info(self) -> Dict[str, Any]:
        """ดึงข้อมูลสถานะแบบครบถ้วน ละเอียดทั้ง Online และ Offline"""
        active = self.check_processes()
        now_dt = datetime.now()

        if active:
            # คำนวณเวลาที่เริ่มเปิดเกมจริงจาก Process ที่เปิดเร็วที่สุด
            valid_starts = [p["start_dt"] for p in active if p.get("start_dt") is not None]
            if valid_starts:
                earliest_start = min(valid_starts)
                uptime_seconds = (now_dt - earliest_start).total_seconds()
                uptime_str = format_duration(uptime_seconds)
                started_str = earliest_start.strftime("%Y-%m-%d %H:%M:%S")
            else:
                uptime_seconds = time.time() - self._state_start_time
                uptime_str = format_duration(uptime_seconds)
                started_str = "เริ่มทำงานในเซสชันนี้"

            return {
                "is_running": True,
                "status_text": "🟢 กำลังเล่นอยู่ (Online)",
                "duration_title": "⏱️ อยู่ในเกมนานเท่าไหร่",
                "duration_str": uptime_str,
                "started_at": started_str,
                "processes": active,
                "timestamp": now_dt.strftime("%Y-%m-%d %H:%M:%S"),
            }
        else:
            # กรณีไม่ได้อยู่ใน Roblox / MuMu
            offline_seconds = time.time() - self._state_start_time
            offline_str = format_duration(offline_seconds)

            return {
                "is_running": False,
                "status_text": "🔴 ออฟไลน์ (Offline)",
                "duration_title": "⏱️ ออฟไลน์มานานเท่าไหร่",
                "duration_str": offline_str,
                "started_at": "ไม่มีการเปิดเกม",
                "processes": [],
                "timestamp": now_dt.strftime("%Y-%m-%d %H:%M:%S"),
            }

    @classmethod
    def capture_screen_detailed(cls, save_path: str) -> Tuple[bool, str]:
        """
        แคปภาพหน้าจอแบบเจาะจง:
        1. ค้นหาแท็บ/หน้าต่างเกม Roblox หรือ MuMu Player ที่เปิดอยู่บนหน้าจอ และแคปเฉพาะกรอบหน้าต่างนั้น
        2. หากไม่พบหน้าต่างเกม (หรือเกมพับจออยู่) จะแคปเฉพาะหน้าจอหลัก (Primary Screen) เท่านั้น ไม่ติดหน้าจออื่น
        """
        user32 = ctypes.windll.user32
        gdi32 = ctypes.windll.gdi32
        dwmapi = ctypes.windll.dwmapi

        # สลับ Thread Desktop ไปยัง Default Interactive Desktop หากจำเป็น
        try:
            h_desk = user32.OpenDesktopW("Default", 0, False, 0x10000000)
            if h_desk:
                user32.SetThreadDesktop(h_desk)
        except Exception:
            pass

        class RECT(ctypes.Structure):
            _fields_ = [
                ("left", ctypes.c_long),
                ("top", ctypes.c_long),
                ("right", ctypes.c_long),
                ("bottom", ctypes.c_long),
            ]

        # ดึง Process PIDs ของ Roblox / MuMu / Emulator จาก tasklist เพื่อเจาะจงเฉพาะตัวเกมแท้จริง
        target_pids = set()
        try:
            cmd = ["tasklist", "/NH", "/FO", "CSV"]
            output = subprocess.check_output(cmd, text=True, errors="ignore")
            reader = csv.reader(io.StringIO(output))
            targets_lower = {t.lower() for t in DEFAULT_TARGETS}
            for row in reader:
                if row and len(row) >= 2 and row[0].strip().lower() in targets_lower and row[1].strip().isdigit():
                    target_pids.add(int(row[1].strip()))
        except Exception:
            pass

        candidates = []
        fg_hwnd = user32.GetForegroundWindow()

        def enum_proc(hwnd, lparam):
            if not user32.IsWindowVisible(hwnd) or user32.IsIconic(hwnd):
                return True

            rect = RECT()
            res = dwmapi.DwmGetWindowAttribute(hwnd, 9, ctypes.byref(rect), ctypes.sizeof(rect))
            if res != 0:
                user32.GetWindowRect(hwnd, ctypes.byref(rect))

            w = rect.right - rect.left
            h = rect.bottom - rect.top
            if w < 100 or h < 100 or rect.left <= -10000 or rect.top <= -10000:
                return True

            length = user32.GetWindowTextLengthW(hwnd)
            title = ""
            if length > 0:
                buff = ctypes.create_unicode_buffer(length + 1)
                user32.GetWindowTextW(hwnd, buff, length + 1)
                title = buff.value

            pid = wintypes.DWORD()
            user32.GetWindowThreadProcessId(hwnd, ctypes.byref(pid))

            is_direct_target = pid.value in target_pids
            t_low = title.lower()

            if is_direct_target:
                is_fg = (hwnd == fg_hwnd)
                # ให้คะแนนความสำคัญสูงเมื่อเป็น Process ของ Roblox/MuMu โดยตรง
                priority = 10
                candidates.append((priority, hwnd, pid.value, title, rect.left, rect.top, w, h, is_fg))
            elif not target_pids and any(k in t_low for k in ["roblox", "mumu", "bluestacks", "ldplayer"]):
                ignored_titles = ["chrome", "edge", "firefox", "brave", "visual studio", "discord", "notepad"]
                if not any(ig in t_low for ig in ignored_titles):
                    is_fg = (hwnd == fg_hwnd)
                    candidates.append((1, hwnd, pid.value, title, rect.left, rect.top, w, h, is_fg))
            return True

        WNDENUMPROC = ctypes.WINFUNCTYPE(wintypes.BOOL, wintypes.HWND, wintypes.LPARAM)
        user32.EnumWindows(WNDENUMPROC(enum_proc), 0)

        target_desc = "หน้าจอหลัก (Main Screen)"
        prev_fg = user32.GetForegroundWindow()
        target_hwnd = None

        if candidates:
            # เรียงตาม priority สูงสุด -> foreground -> พื้นที่ขนาดหน้าต่างใหญ่สุด
            candidates.sort(key=lambda c: (c[0], 1 if c[8] else 0, c[6] * c[7]), reverse=True)
            best = candidates[0]
            target_hwnd = best[1]
            x, y, w, h = best[4], best[5], best[6], best[7]
            title_clean = best[3].strip() or "Roblox / MuMu Player"
            target_desc = f"แท็บหน้าต่าง {title_clean} ({w}x{h})"

            # ดึงหน้าต่างเกมขึ้นมาด้านหน้าชั่วคราวเพื่อไม่ให้หน้าต่างอื่นบัง
            try:
                user32.ShowWindow(target_hwnd, 9)  # SW_RESTORE
                user32.BringWindowToTop(target_hwnd)
                user32.SetForegroundWindow(target_hwnd)
                time.sleep(0.15)
                # คำนวณพิกัด DWM ที่แม่นยำหลังนำขึ้นมาด้านหน้า
                rect = RECT()
                res = dwmapi.DwmGetWindowAttribute(target_hwnd, 9, ctypes.byref(rect), ctypes.sizeof(rect))
                if res != 0:
                    user32.GetWindowRect(target_hwnd, ctypes.byref(rect))
                w = rect.right - rect.left
                h = rect.bottom - rect.top
                x, y = rect.left, rect.top
                target_desc = f"แท็บหน้าต่าง {title_clean} ({w}x{h})"
            except Exception:
                pass
        else:
            # Fallback แคปเฉพาะ Main Screen (PrimaryScreen)
            x, y = 0, 0
            w = user32.GetSystemMetrics(0)  # SM_CXSCREEN
            h = user32.GetSystemMetrics(1)  # SM_CYSCREEN
            target_desc = f"หน้าจอหลัก Main Screen ({w}x{h})"

        # บันทึกภาพด้วย Pillow และ GDI
        try:
            from PIL import Image

            hwnd_desktop = user32.GetDesktopWindow()
            hdesktop_dc = user32.GetWindowDC(hwnd_desktop)
            hmem_dc = gdi32.CreateCompatibleDC(hdesktop_dc)
            hbitmap = gdi32.CreateCompatibleBitmap(hdesktop_dc, w, h)
            hold_bitmap = gdi32.SelectObject(hmem_dc, hbitmap)

            try:
                gdi32.BitBlt(hmem_dc, 0, 0, w, h, hdesktop_dc, x, y, 0x00CC0020)

                class BITMAPINFOHEADER(ctypes.Structure):
                    _fields_ = [
                        ("biSize", wintypes.DWORD),
                        ("biWidth", wintypes.LONG),
                        ("biHeight", wintypes.LONG),
                        ("biPlanes", wintypes.WORD),
                        ("biBitCount", wintypes.WORD),
                        ("biCompression", wintypes.DWORD),
                        ("biSizeImage", wintypes.DWORD),
                        ("biXPelsPerMeter", wintypes.LONG),
                        ("biYPelsPerMeter", wintypes.LONG),
                        ("biClrUsed", wintypes.DWORD),
                        ("biClrImportant", wintypes.DWORD),
                    ]

                bmi = BITMAPINFOHEADER()
                bmi.biSize = ctypes.sizeof(BITMAPINFOHEADER)
                bmi.biWidth = w
                bmi.biHeight = -h
                bmi.biPlanes = 1
                bmi.biBitCount = 32
                bmi.biCompression = 0

                buffer = ctypes.create_string_buffer(w * h * 4)
                gdi32.GetDIBits(hmem_dc, hbitmap, 0, h, buffer, ctypes.byref(bmi), 0)

                img = Image.frombuffer("RGBA", (w, h), buffer, "raw", "BGRA", 0, 1).convert("RGB")
                os.makedirs(os.path.dirname(os.path.abspath(save_path)), exist_ok=True)
                img.save(save_path)
            finally:
                gdi32.SelectObject(hmem_dc, hold_bitmap)
                gdi32.DeleteObject(hbitmap)
                gdi32.DeleteDC(hmem_dc)
                user32.ReleaseDC(hwnd_desktop, hdesktop_dc)
                if prev_fg and target_hwnd and prev_fg != target_hwnd:
                    try:
                        user32.SetForegroundWindow(prev_fg)
                    except Exception:
                        pass

            return True, target_desc

        except Exception:
            # Fallback ใช้ PowerShell สำหรับ Primary Screen
            try:
                ps_cmd = (
                    "Add-Type -AssemblyName System.Windows.Forms,System.Drawing; "
                    "$bounds = [System.Windows.Forms.Screen]::PrimaryScreen.Bounds; "
                    "$bmp = New-Object System.Drawing.Bitmap $bounds.Width, $bounds.Height; "
                    "$g = [System.Drawing.Graphics]::FromImage($bmp); "
                    "$g.CopyFromScreen($bounds.Location, [System.Drawing.Point]::Empty, $bounds.Size); "
                    f"$bmp.Save('{save_path}', [System.Drawing.Imaging.ImageFormat]::Png); "
                    "$g.Dispose(); $bmp.Dispose();"
                )
                subprocess.run(["powershell", "-NoProfile", "-Command", ps_cmd], check=True, capture_output=True)
                if os.path.exists(save_path) and os.path.getsize(save_path) > 1000:
                    return True, "หน้าจอหลัก Main Screen (PowerShell Fallback)"
            except Exception:
                pass

        return False, "ไม่สามารถจับภาพหน้าจอได้"

    @classmethod
    def capture_screen(cls, save_path: str) -> bool:
        """แคปภาพหน้าจอ (คืนค่า True/False เพื่อความเข้ากันได้)"""
        ok, _ = cls.capture_screen_detailed(save_path)
        return ok
