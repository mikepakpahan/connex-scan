document.addEventListener("DOMContentLoaded", () => {
  loadHistory();
});

async function loadHistory() {
  const tableBody = document.getElementById("history-table-body");
  // Panggil fungsi Python 'ambil_riwayat'
  const data = await eel.ambil_riwayat()();

  if (data && data.length > 0) {
    tableBody.innerHTML = ""; // Bersihkan tabel lama

    data.forEach((row) => {
      // Format waktu biar ganteng dikit
      const dateObj = new Date(row.waktu);
      const dateStr = dateObj.toLocaleString("id-ID"); // Format Indo

      // Tentukan status puitis berdasarkan kecepatan
      let statusBadge = "";
      if (row.download > 50) statusBadge = '<span class="text-green-400">🚀 Melaju Kencang</span>';
      else if (row.download > 10) statusBadge = '<span class="text-yellow-400">🚶 Santai Saja</span>';
      else statusBadge = '<span class="text-red-400">🥀 Sedang Rapuh</span>';

      const tr = `
                <tr class="bg-gray-900 border-b border-gray-700 hover:bg-gray-800 transition">
                    <td class="px-6 py-4">${dateStr}</td>
                    <td class="px-6 py-4 font-bold text-white">${row.download.toFixed(2)}</td>
                    <td class="px-6 py-4">${row.upload.toFixed(2)}</td>
                    <td class="px-6 py-4">${statusBadge}</td>
                </tr>
            `;
      tableBody.innerHTML += tr;
    });
  }
}

async function hapusHistory() {
  if (confirm("Yakin ingin melupakan semua kenangan indah ini? (Data akan hilang permanen)")) {
    await eel.hapus_semua_riwayat()();
    loadHistory();
  }
}

// === KONFIGURASI SPIDOMETER (GAUGE) ===
const gaugeOptions = {
  width: 200,
  height: 200,
  units: "Mbps",
  minValue: 0,
  maxValue: 100, // Default, bisa di-set dinamis
  majorTicks: ["0", "10", "20", "30", "40", "50", "60", "70", "80", "90", "100"],
  minorTicks: 2,
  strokeTicks: true,
  highlights: [
    { from: 0, to: 20, color: "rgba(74, 222, 128, .75)" }, // Hijau
    { from: 20, to: 50, color: "rgba(250, 204, 21, .75)" }, // Kuning
    { from: 50, to: 100, color: "rgba(248, 113, 113, .75)" }, // Merah
  ],
  colorPlate: "#27272a", // bg-zinc-800
  colorMajorTicks: "#f9fafb",
  colorMinorTicks: "#f9fafb",
  colorTitle: "#f9fafb",
  colorUnits: "#9ca3af",
  colorNumbers: "#f9fafb",
  colorNeedle: "rgba(59, 130, 246, 1)", // Biru
  colorNeedleEnd: "rgba(45, 208, 201, 1)", // Teal
  valueBox: true,
  animationRule: "elastic",
  animationDuration: 500,
};

const downloadGauge = new RadialGauge({
  ...gaugeOptions,
  renderTo: "gauge-download",
  title: "Download",
}).draw();

const uploadGauge = new RadialGauge({
  ...gaugeOptions,
  renderTo: "gauge-upload",
  title: "Upload",
  maxValue: 50, // Upload biasanya lebih kecil
  majorTicks: ["0", "10", "20", "30", "40", "50"],
  highlights: [
    { from: 0, to: 10, color: "rgba(74, 222, 128, .75)" },
    { from: 10, to: 25, color: "rgba(250, 204, 21, .75)" },
    { from: 25, to: 50, color: "rgba(248, 113, 113, .75)" },
  ],
}).draw();

// === KONFIGURASI CHART LATENSI (Sama kayak sebelumnya) ===
const ctx = document.getElementById("heartbeatChart").getContext("2d");
const gradient = ctx.createLinearGradient(0, 0, 0, 400);
gradient.addColorStop(0, "rgba(59, 130, 246, 0.7)");
gradient.addColorStop(1, "rgba(45, 208, 201, 0.3)");

const chartConfig = {
  type: "line",
  data: {
    labels: Array(50).fill(""),
    datasets: [
      {
        label: "Latency (ms)",
        data: Array(50).fill(null),
        borderColor: gradient,
        borderWidth: 2,
        pointRadius: 0,
        tension: 0.3,
        fill: false,
      },
    ],
  },
  options: {
    responsive: true,
    scales: {
      y: { min: 0, max: 100, ticks: { color: "#9CA3AF" }, grid: { color: "#4B5563" } },
      x: { ticks: { display: false }, grid: { display: false } },
    },
    plugins: { legend: { display: false } },
    animation: { duration: 200 },
  },
};
const heartbeatChart = new Chart(ctx, chartConfig);

// --- Variabel Global & Logika Aplikasi ---
const hostInput = document.getElementById("host-input");
const gatewayBtn = document.getElementById("gateway-btn");
const togglePingBtn = document.getElementById("toggle-ping-btn");
const poeticAlert = document.getElementById("poetic-alert");
const speedtestBtn = document.getElementById("speedtest-btn");
const speedtestStatus = document.getElementById("speedtest-status");

let isPinging = false;
let alertTimeout;

// --- Fungsi Logika Latensi (Sama) ---
function updateDynamicYAxis() {
  const dataPoints = heartbeatChart.data.datasets[0].data.filter((val) => val !== null);
  if (dataPoints.length === 0) return;
  const dataMin = Math.min(...dataPoints);
  const dataMax = Math.max(...dataPoints);
  const dataRange = dataMax - dataMin;
  const MIN_VISIBLE_RANGE = 20;
  let newMin, newMax;
  if (dataRange < MIN_VISIBLE_RANGE) {
    const midpoint = (dataMax + dataMin) / 2;
    newMin = midpoint - MIN_VISIBLE_RANGE / 2;
    newMax = midpoint + MIN_VISIBLE_RANGE / 2;
  } else {
    const padding = dataRange * 0.2;
    newMin = dataMin - padding;
    newMax = dataMax + padding;
  }
  heartbeatChart.options.scales.y.min = Math.max(0, newMin);
  heartbeatChart.options.scales.y.max = newMax;
}

eel.expose(update_chart_data);
function update_chart_data(latency) {
  if (!isPinging) return;
  const data = heartbeatChart.data.datasets[0].data;
  const labels = heartbeatChart.data.labels;
  data.push(latency);
  labels.push("");
  data.shift();
  labels.shift();
  updateDynamicYAxis();
  heartbeatChart.update("quiet");
  checkPoeticAlert(latency);
  addPingLog(latency);
}

function checkPoeticAlert(latency) {
  // --- PENGAMAN ---
  // Kalau elemennya gak ada, mending diem aja daripada bikin error
  if (!poeticAlert) return;
  // ----------------

  clearTimeout(alertTimeout);
  poeticAlert.classList.add("opacity-0");

  let message = "";
  if (latency > 200) message = "Napas jaringanmu sedang sesak...";
  else if (latency > 100) message = "Jaringanmu sedang menghela napas...";

  if (message) {
    poeticAlert.innerText = message;
    poeticAlert.classList.remove("opacity-0");
    alertTimeout = setTimeout(() => {
      poeticAlert.classList.add("opacity-0");
    }, 3000);
  }
}

gatewayBtn.addEventListener("click", async () => {
  gatewayBtn.disabled = true;
  const ip = await eel.get_default_gateway()();
  if (ip) hostInput.value = ip;
  else alert("Tidak dapat menemukan Default Gateway.");
  gatewayBtn.disabled = false;
});

togglePingBtn.addEventListener("click", () => {
  isPinging = !isPinging;
  if (isPinging) {
    const host = hostInput.value;
    if (!host) {
      isPinging = false;
      return;
    }
    heartbeatChart.data.datasets[0].data = Array(50).fill(null);
    heartbeatChart.options.scales.y.min = 0;
    heartbeatChart.options.scales.y.max = 100;
    heartbeatChart.update();
    eel.start_ping_thread(host);
    togglePingBtn.innerText = "Berhenti";
    togglePingBtn.classList.replace("bg-blue-600", "bg-red-600");
    hostInput.disabled = true;
    speedtestBtn.disabled = true; // Nonaktifkan speedtest saat ping
  } else {
    eel.stop_ping_thread();
    togglePingBtn.innerText = "Mulai";
    togglePingBtn.classList.replace("bg-red-600", "bg-blue-600");
    hostInput.disabled = false;
    speedtestBtn.disabled = false; // Aktifkan lagi
  }
});

// --- LOGIKA BARU UNTUK SPEEDTEST ---

// Fungsi ini dipanggil dari Python
eel.expose(update_speedtest_status);
function update_speedtest_status(message) {
  speedtestStatus.innerText = message;
}

speedtestBtn.addEventListener("click", async () => {
  if (isPinging) {
    // Ini seharusnya tidak terjadi karena tombol di-disable, tapi jaga-jaga
    alert("Hentikan 'Detak Jantung' (ping) dahulu!");
    return;
  }

  // Reset UI
  speedtestBtn.disabled = true;
  speedtestBtn.innerText = "Running...";
  speedtestBtn.classList.replace("bg-teal-600", "bg-gray-500");
  downloadGauge.value = 0;
  uploadGauge.value = 0;
  togglePingBtn.disabled = true; // Matikan tombol ping

  try {
    // Panggil fungsi Python yang 'mahal' ini
    const results = await eel.run_speed_test()();

    if (results) {
      // Update spidometer dengan hasil!
      downloadGauge.value = results.download.toFixed(2);
      uploadGauge.value = results.upload.toFixed(2);
      speedtestStatus.innerText = `Hasil: ${results.download.toFixed(2)} / ${results.upload.toFixed(2)} Mbps`;
      loadHistory();
    } else {
      speedtestStatus.innerText = "Tes Gagal.";
    }
  } catch (error) {
    console.error("Error Speedtest:", error);
    speedtestStatus.innerText = "Error Kritis.";
  }

  // Kembalikan UI
  speedtestBtn.disabled = false;
  speedtestBtn.innerText = "Mulai Tes Lari";
  speedtestBtn.classList.replace("bg-gray-500", "bg-teal-600");
  togglePingBtn.disabled = false; // Nyalakan lagi tombol ping
});

const pingConsole = document.getElementById("ping-console");

function addPingLog(latency) {
  if (!pingConsole) {
    console.warn("Waduh, elemen 'ping-console' gak ketemu nih!");
    return;
  }

  // 1. Bikin elemen baris baru
  const logLine = document.createElement("div");

  // 2. Bikin Timestamp (Jam:Menit:Detik)
  const now = new Date();
  const timeStr = now.toLocaleTimeString("id-ID", { hour12: false });

  // 3. Tentukan warna berdasarkan kecepatan (Biar makin informatif)
  let colorClass = "text-green-400"; // Default Hijau (Ngebut)
  let statusText = "OK";

  if (latency > 100) {
    colorClass = "text-yellow-400"; // Kuning (Hati-hati)
    statusText = "LAG";
  }
  if (latency > 200) {
    colorClass = "text-red-500"; // Merah (Bahaya)
    statusText = "SLOW";
  }

  // 4. Susun isi teksnya ala CMD Windows / Terminal Linux
  logLine.className = `${colorClass} hover:bg-gray-900 px-1`;
  logLine.innerHTML = `<span class="text-gray-600">[${timeStr}]</span> Reply from target: time=${latency.toFixed(1)}ms <span class="font-bold border border-gray-700 text-[10px] px-1 ml-2 rounded">${statusText}</span>`;

  // 5. Masukin ke kotak console
  pingConsole.appendChild(logLine);

  // 6. AUTO SCROLL KE BAWAH (PENTING!)
  // Biar user gak perlu scroll manual buat liat yang terbaru
  pingConsole.scrollTop = pingConsole.scrollHeight;
}

function clearConsole() {
  pingConsole.innerHTML = '<div class="text-gray-500 italic">>> Console dibersihkan.</div>';
}
