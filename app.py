import sys
import os

if getattr(sys, 'frozen', False):
    if sys.stdout is None:
        sys.stdout = open(os.devnull, 'w')
    if sys.stderr is None:
        sys.stderr = open(os.devnull, 'w')

import eel
import platform
import subprocess
import re
import threading
import netifaces
import speedtest
import mysql.connector

DB_CONFIG = {
    'host': 'localhost',
    'user': 'root',
    'password': '',
    'database': 'db_jaringan'
}

eel.init('web')

ping_process = None
ping_thread = None
is_pinging = False

def get_db_connection():
    try:
        conn = mysql.connector.connect(**DB_CONFIG)
        return conn
    except Exception as e:
        print(f"Duh, gagal konek ke database: {e}")
        return None

@eel.expose
def simpan_riwayat(download, upload):
    conn = get_db_connection()
    if conn:
        cursor = conn.cursor()
        query = "INSERT INTO riwayat_speedtest (download, upload) VALUES (%s, %s)"
        cursor.execute(query, (download, upload))
        conn.commit()
        cursor.close()
        conn.close()
        print("Data berhasil disimpan ke kenangan abadi (Database).")
        return True
    return False

@eel.expose
def ambil_riwayat():
    conn = get_db_connection()
    data = []
    if conn:
        cursor = conn.cursor(dictionary=True)
        cursor.execute("SELECT * FROM riwayat_speedtest ORDER BY waktu DESC LIMIT 10")
        data = cursor.fetchall()
    
        for row in data:
            if row['waktu']:
                row['waktu'] = str(row['waktu']) 
        
        cursor.close()
        conn.close()
    return data

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

@eel.expose
def run_speed_test():
    """Menjalankan tes kecepatan dan mengembalikan hasil (Mbps)."""
    try:
        print("Memulai speedtest...")
        eel.update_speedtest_status("Mencari server terbaik...") 
        
        st = speedtest.Speedtest()
        st.get_best_server()
        
        print("Memulai tes download...")
        eel.update_speedtest_status("Tes Download...")
        download_speed = st.download() / 1024 / 1024 
        
        print("Memulai tes upload...")
        eel.update_speedtest_status("Tes Upload...")
        upload_speed = st.upload() / 1024 / 1024
        
        print(f"Download: {download_speed:.2f} Mbps, Upload: {upload_speed:.2f} Mbps")
        eel.update_speedtest_status("Selesai!")

        simpan_riwayat(download_speed, upload_speed)

        return {
            "download": download_speed,
            "upload": upload_speed
        }
    except Exception as e:
        print(f"Error saat speedtest: {e}")
        eel.update_speedtest_status(f"Error: {e}")
        return None

print("Membuka aplikasi... Buka http://localhost:8000/index.html di browser jika tidak terbuka otomatis.")
try:
    eel.start('index.html', size=(1300, 800), port=8000)
except (SystemExit, MemoryError, KeyboardInterrupt):
    if is_pinging:
        stop_ping_thread()
    sys.exit()