import sys
import os

if getattr(sys, 'frozen', False):
    # Cek apakah 'wastafel' (stdout) kita beneran 'None' (hilang)
    # Ini biasanya terjadi kalo pake mode --noconsole atau --windowed
    if sys.stdout is None:
        # Kalo ilang, kita alihin 'curhatan' ke 'lubang hitam'
        sys.stdout = open(os.devnull, 'w')
    if sys.stderr is None:
        # Sama buat 'curhatan' error
        sys.stderr = open(os.devnull, 'w')

import eel
import platform
import subprocess
import re
import threading
import netifaces
import speedtest

# Inisialisasi Eel dengan folder 'web'
eel.init('web')

# Variabel global untuk mengontrol thread ping
ping_process = None
ping_thread = None
is_pinging = False

# ... (Fungsi parse_ping_output, run_ping, start_ping_thread, stop_ping_thread, get_default_gateway... SAMA SEPERTI SEBELUMNYA) ...
# ... (Saya tidak akan salin ulang fungsi yang sama persis ya, Mike) ...

def parse_ping_output(line):
    line = line.decode('utf-8', errors='ignore')
    match = re.search(r'time[=<]([\d\.]+)\s*ms', line)
    if match:
        try:
            latency = float(match.group(1))
            return latency
        except ValueError:
            return None
    return None

def run_ping(host):
    global ping_process, is_pinging
    is_pinging = True
    system = platform.system()
    if system == 'Windows':
        command = ['ping', '-t', host]
    else:
        command = ['ping', host]
        
    try:
        ping_process = subprocess.Popen(
            command,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            creationflags=subprocess.CREATE_NO_WINDOW if system == 'Windows' else 0
        )
        for line in iter(ping_process.stdout.readline, b''):
            if not is_pinging:
                break
            latency = parse_ping_output(line)
            if latency is not None:
                eel.update_chart_data(latency)
            eel.sleep(0.1)
            
        ping_process.stdout.close()
        ping_process.terminate()
        ping_process = None
    except Exception as e:
        print(f"Error di run_ping: {e}")
    finally:
        is_pinging = False
        print("Ping dihentikan.")

@eel.expose
def start_ping_thread(host):
    global ping_thread, is_pinging
    if is_pinging:
        return
    print(f"Memulai ping ke {host}...")
    eel.spawn(run_ping, host)

@eel.expose
def stop_ping_thread():
    global ping_process, is_pinging
    if not is_pinging:
        return
    is_pinging = False
    if ping_process:
        ping_process.terminate()
    print("Sinyal stop ping dikirim.")

@eel.expose
def get_default_gateway():
    try:
        gateways = netifaces.gateways()
        if 'default' in gateways and netifaces.AF_INET in gateways['default']:
            ip = gateways['default'][netifaces.AF_INET][0]
            print(f"Gateway terdeteksi: {ip}")
            return ip
        else:
            print("Tidak ada default gateway IPv4 yang ditemukan.")
            return None
    except Exception as e:
        print(f"Gagal mendeteksi gateway: {e}")
        return None

# --- FUNGSI BARU UNTUK SPEEDTEST ---
@eel.expose
def run_speed_test():
    """Menjalankan tes kecepatan dan mengembalikan hasil (Mbps)."""
    try:
        print("Memulai speedtest...")
        eel.update_speedtest_status("Mencari server terbaik...") # Kirim status ke JS
        
        st = speedtest.Speedtest()
        st.get_best_server() # Cari server terdekat
        
        print("Memulai tes download...")
        eel.update_speedtest_status("Tes Download...")
        download_speed = st.download() / 1024 / 1024  # Konversi ke Mbps
        
        print("Memulai tes upload...")
        eel.update_speedtest_status("Tes Upload...")
        upload_speed = st.upload() / 1024 / 1024  # Konversi ke Mbps
        
        print(f"Download: {download_speed:.2f} Mbps, Upload: {upload_speed:.2f} Mbps")
        eel.update_speedtest_status("Selesai!")

        return {
            "download": download_speed,
            "upload": upload_speed
        }
    except Exception as e:
        print(f"Error saat speedtest: {e}")
        eel.update_speedtest_status(f"Error: {e}")
        return None
# --- AKHIR FUNGSI BARU ---


# Memulai aplikasi Eel
print("Membuka aplikasi... Buka http://localhost:8000/index.html di browser jika tidak terbuka otomatis.")
try:
    eel.start('index.html', size=(1300, 800), port=8000) # <- Ukurannya kita lebarkan
except (SystemExit, MemoryError, KeyboardInterrupt):
    # Handle exit
    if is_pinging:
        stop_ping_thread()
    sys.exit()