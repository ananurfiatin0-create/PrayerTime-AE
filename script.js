// 1. kls n data dasar
class Reminder {  //inheritance/pewarisan
  constructor(name) { this.name = name; }  // atribut publik
  notify() { throw new Error("Method notify() harus diimplementasikan"); }   // polimorfisme diimplemmentasikan olh subclass
}  
// subclass waktu sholat
class PrayerTime extends Reminder {  //enkapsulasi
  #time; #icon; //
  constructor(name, time, icon) {  
    super(name); 
    this.#time = time; //enkapsulasi
    this.#icon = icon;  
  }
  // getter (kontrol akses data privat)
  getTime() { return this.#time; }  
  getIcon() { return this.#icon; }
  render() {  //abstraksi
    return `
      <div class="prayer-card">  
        <img src="${this.getIcon()}" alt="${this.name}">  
        <h3>${this.name}</h3>
        <p>${this.getTime()}</p>
      </div>
    `;
  }
}

const icons = {  
  imsak: "https://img.icons8.com/ios/50/alarm.png",
  subuh: "https://img.icons8.com/ios/50/mosque.png",
  terbit: "https://img.icons8.com/ios/50/sunrise.png",
  dhuha: "https://img.icons8.com/ios/50/sun--v1.png",
  dzuhur: "https://img.icons8.com/ios/50/sun--v1.png",
  ashar: "https://img.icons8.com/ios/50/clouds.png",
  maghrib: "https://img.icons8.com/ios/50/sunset.png",
  isya: "https://img.icons8.com/ios-filled/50/moon-symbol.png"
};

let prayerSchedule = [];  // array jadwal sholat
let lastAdzanMinute = null;  
let lastReminderMinute = null;  

// 2. audio mapping
const prayerAudios = {  //abstraksi audio(menyebunyikan DOM )
  imsak: document.getElementById("audio-imsak"),
  subuh: document.getElementById("audio-subuh"),
  terbit: document.getElementById("suara-bedug"),   
  dhuha: document.getElementById("suara-bedug"),   
  dzuhur: document.getElementById("audio-dhuhur"),
  ashar: document.getElementById("audio-ashar"),
  maghrib: document.getElementById("audio-maghrib"),
  isya: document.getElementById("audio-isya")
};

let soundEnabled = false;  

// 3. waktu n jam
let demoMode = false;  
let demoTime = "04:13";  

function updateClock() {  // abstraksi; memperbarui jam n tgl
  const now = new Date();  
  document.getElementById("clock").textContent = now.toLocaleTimeString('id-ID');  
  document.getElementById("date").textContent = now.toLocaleDateString('id-ID', {  
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
  });
  const hijriDate = new Intl.DateTimeFormat('ar-TN-u-ca-islamic', {
    day: 'numeric', month: 'long', year: 'numeric'
  }).format(now); 
  document.getElementById("hijri").textContent = `Kalender Hijriyah: ${hijriDate}`;
}

function getCurrentMinutes() {  //abstraksi; mnt skrng
  if (demoMode) {  
    const [hour, minute] = demoTime.split(":").map(Number);
    return hour * 60 + minute;
  } else {  
    const now = new Date();
    return now.getHours() * 60 + now.getMinutes();
  }
}

// 4. cache n fallback jadwal
const CACHE_KEY = 'prayerScheduleCache';  // kunci localStorage

function saveScheduleCache(schedule, meta = {}) {  //abstraksi; simpan cache
  const payload = { schedule, meta, savedAt: Date.now() }; 
  try { localStorage.setItem(CACHE_KEY, JSON.stringify(payload)); }
  catch (e) { console.warn('Gagal simpan cache:', e); }
}

function loadScheduleCache() {  //abstraksi; muat cache
  try {
    const raw = localStorage.getItem(CACHE_KEY);  //ambil data
    if (!raw) return null;  
    return JSON.parse(raw);  
  } catch (e) {
    console.warn('Gagal baca cache:', e);
    return null;
  }
}

function isCacheFresh(cache, maxHours = 24) {  //abbstraksi; cek cache
  if (!cache) return false;  
  const ageMs = Date.now() - cache.savedAt;
  return ageMs < maxHours * 3600 * 1000;
}

function getDefaultSchedule() {  //abstraksi; jdwl default
  return [
    { name: 'Imsak',  time: '03:32' },
    { name: 'Subuh',  time: '03:42' },
    { name: 'Terbit', time: '05:07' },
    { name: 'Dhuha',  time: '07:00' },
    { name: 'Dzuhur', time: '11:23' },
    { name: 'Ashar',  time: '14:50' },
    { name: 'Maghrib',time: '17:39' },
    { name: 'Isya',   time: '18:55' },
  ];
}

function renderScheduleFromArray(arr) { //abstraksi; render jdwl dr array
  const prayerList = arr.map(item => {  // map ke PrayerTime
    const key = item.name.toLowerCase();
    return new PrayerTime(item.name, item.time, icons[key] || icons.dzuhur);
  });
  const list = document.getElementById("prayer-list");
  // hapus skeleton
  list.innerHTML = "";
  // render jadwal asli
  list.innerHTML = prayerList.map(p => p.render()).join("");

  prayerSchedule = arr.slice();
  highlightCurrentPrayer(); // abstraksi UI
  updateNextPrayerCountdown();  // abstraksi countdown
}

function useCachedOrDefaultSchedule() {  //abstraksi; cache/jdwl default
  const cache = loadScheduleCache();
  const si = document.getElementById('status-info');

  if (isCacheFresh(cache, 24)) {  // cache skrng
    renderScheduleFromArray(cache.schedule);
    if (si) si.textContent = 'Sumber: Cache (≤24 jam)';
    showVisualAlert('Jadwal ditampilkan dari cache terakhir.');  
    return;
  }
  if (cache) {  // cache lama
    renderScheduleFromArray(cache.schedule);
    if (si) si.textContent = 'Sumber: Cache lama';
    showVisualAlert('Jadwal dari cache lama—periksa koneksi.');
    return;
  }
  const def = getDefaultSchedule();  // jdwl default
  renderScheduleFromArray(def);
  if (si) si.textContent = 'Sumber: Default lokal';
  showVisualAlert('Jadwal default digunakan.');
}

// 5. fetch data waktu sholat
function fetchPrayerTimes(lat, long) {  //data  dr API(abstraksi)
  const today = new Date();  
  const dateISO = today.toISOString().split("T")[0];
  const method = 11; //kalkulasi
  const url = `https://api.aladhan.com/v1/timings/${dateISO}?latitude=${lat}&longitude=${long}&method=${method}`;

  fetch(url)
    .then(res => res.json())  //mengambil json
    .then(data => { 
      const timings = data.data.timings;
      const prayerList = [
        new PrayerTime("Imsak", timings.Imsak, icons.imsak),
        new PrayerTime("Subuh", timings.Fajr, icons.subuh),
        new PrayerTime("Terbit", timings.Sunrise, icons.terbit),
        new PrayerTime("Dhuha", "07:00", icons.dhuha),
        new PrayerTime("Dzuhur", timings.Dhuhr, icons.dzuhur), 
        new PrayerTime("Ashar", timings.Asr, icons.ashar),
        new PrayerTime("Maghrib", timings.Maghrib, icons.maghrib),
        new PrayerTime("Isya", timings.Isha, icons.isya)
      ];

      const list = document.getElementById("prayer-list");
      list.innerHTML = ""; // hapus skeleton
      list.innerHTML = prayerList.map(p => p.render()).join("");

      prayerSchedule =
        prayerList.map(p => ({ name: p.name, time: p.getTime() })); // array sederhana

      saveScheduleCache(prayerSchedule, { dateISO, lat, lon: long, method }); 

      highlightCurrentPrayer(); 
      updateNextPrayerCountdown();

      const si = document.getElementById('status-info');
      if (si) si.textContent = 'Sumber: API (online)';
    })
    .catch(err => {
      console.warn('Fetch API gagal:', err);
      useCachedOrDefaultSchedule();
    });
}

// 6. lok; abstraksi
function getLocationName(lat, lon) {  // lokasi dr koordinat
  const url = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json&accept-language=id`;
  fetch(url)
    .then(res => res.json())
    .then(data => {
      const address = data.address;// ambil alamat
      const city = address.city || address.town || address.village || address.state || "Tidak diketahui";
      document.getElementById("location-info").textContent = `📍 Lokasi: ${city}`;
    })
    .catch(() => {
      document.getElementById("location-info").textContent = "📍 Lokasi: gagal memuat nama";
    });
}

// 7. highlight waktu sholat aktif
// abstraksi; sorot jdwl aktif
function highlightCurrentPrayer() {
  const currentMinutes = getCurrentMinutes();
  let activeIndex = -1;
// cari waktu sholat aktif
  for (let i = 0; i < prayerSchedule.length - 1; i++) {
    const [startHour, startMinute] = prayerSchedule[i].time.split(":").map(Number);
    const [endHour, endMinute] = prayerSchedule[i + 1].time.split(":").map(Number);
    const startMinutes = startHour * 60 + startMinute;
    const endMinutes = endHour * 60 + endMinute;
    if (currentMinutes >= startMinutes && currentMinutes < endMinutes) {
      activeIndex = i; break;
    }
  }
// khusus u/ waktu setelah sholat terakhir
  const [lastHour, lastMinute] = prayerSchedule[prayerSchedule.length - 1].time.split(":").map(Number);
  const lastMinutes = lastHour * 60 + lastMinute;
  if (currentMinutes >= lastMinutes) activeIndex = prayerSchedule.length - 1;

  const cards = document.querySelectorAll(".prayer-card");
  cards.forEach((card, index) => card.classList.toggle("active", index === activeIndex));
}

// 8. notifikasi
// abstraksi; mapping pemilihan audio
function getAudioKey(name) {
  switch(name) {
    case "Imsak": return "imsak";
    case "Subuh": return "subuh";
    case "Terbit": return "terbit";
    case "Dhuha": return "dhuha"; 
    case "Dzuhur": return "dzuhur";
    case "Ashar": return "ashar";
    case "Maghrib": return "maghrib";
    case "Isya": return "isya";
    default: return null;
  }
}

function checkNotifications() { // abstraksi; cek notifikasi
  const currentMinutes = getCurrentMinutes();
  prayerSchedule.forEach(item => {
    const [hour, minute] = item.time.split(":").map(Number);
    const prayerMinutes = hour * 60 + minute;
// notifikasi adzan
    if (prayerMinutes === currentMinutes && lastAdzanMinute !== currentMinutes) {
      const message = `Waktu ${item.name} telah tiba`;
      showNotification(message);
      showVisualAlert(message);
// putar audio adzan
      if (soundEnabled) {
        const key = getAudioKey(item.name);
        if (key && prayerAudios[key]) {
          prayerAudios[key].play().catch(err => console.log("Gagal memutar audio:", err));
        }
      }
      lastAdzanMinute = currentMinutes;
    }
// notifikasi 10 mnt sebelum
    if (prayerMinutes - currentMinutes === 10 && lastReminderMinute !== currentMinutes) {
      const message = `10 menit lagi menuju waktu ${item.name}`;
      showNotification(message);
      showVisualAlert(message);
      lastReminderMinute = currentMinutes;
    }
  });
}
// tampilkan notifikasi
function showNotification(message) {
  if ("Notification" in window) {
    if (Notification.permission === "granted") {
      new Notification("Pengingat Sholat", {
        body: message,
        icon: "https://img.icons8.com/ios/100/mosque.png" 
      });
    }
  }
}

function showVisualAlert(message) {
  const alertBox = document.createElement("div");
  alertBox.textContent = message;
  alertBox.className = "alert-box";
  document.body.appendChild(alertBox);

  setTimeout(() => alertBox.classList.add("show"), 100);
  setTimeout(() => {
    alertBox.classList.remove("show");
    setTimeout(() => alertBox.remove(), 500);
  }, 5000);
}

// 9. countdown abstrasi
function updateNextPrayerCountdown() {
  if (prayerSchedule.length === 0) return;

  const now = new Date();
  const currentMinutes = getCurrentMinutes();
  let nextPrayer = null;
  let targetTime = null;
// cari waktu sholat berikutnya
  for (let i = 0; i < prayerSchedule.length; i++) {
    const [hour, minute] = prayerSchedule[i].time.split(":").map(Number);
    const prayerDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hour, minute, 0);
    const prayerMinutes = hour * 60 + minute;
// jika ditemukan
    if (prayerMinutes > currentMinutes) {
      nextPrayer = prayerSchedule[i];
      targetTime = prayerDate;
      break;
    }
  }
// jika semua waktu sholat sudah lewat, ambil sholat pertama besok
  if (!targetTime) {
    const [hour, minute] = prayerSchedule[0].time.split(":").map(Number);
    targetTime = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, hour, minute, 0);
    nextPrayer = prayerSchedule[0];
  }
// hitung selisih waktu
  const diffMs = targetTime - now;
  const totalSeconds = Math.floor(diffMs / 1000);
  const hours = String(Math.floor(totalSeconds / 3600)).padStart(2, '0');
  const minutes = String(Math.floor((totalSeconds % 3600) / 60)).padStart(2, '0');
  const seconds = String(totalSeconds % 60).padStart(2, '0');
// tampilkan countdown
  document.getElementById("next-prayer-time").textContent =
    `${nextPrayer.name} ${nextPrayer.time}`;
  document.getElementById("next-prayer-countdown").textContent =
    `${hours} : ${minutes} : ${seconds}`;
}

// 10. init
function requestNotificationPermission() {
  if ("Notification" in window) {
    Notification.requestPermission().then(permission => {
      if (permission === "granted") {
        alert("Notifikasi diaktifkan!");
      } else {
        alert("Notifikasi ditolak!");
      }
    });
  } else {  
    alert("Browser tidak mendukung notifikasi.");
  }
}
// hentikan semua suara
function stopAllAdzan() {
  Object.values(prayerAudios).forEach(audio => {
    if (audio) {
      audio.pause();
      audio.currentTime = 0;
    }
  });
}

function initApp() {
  soundEnabled = true;
  updateClock();
  setInterval(updateClock, 1000);
// dapatkan lokasi
  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(pos => {
      const lat = pos.coords.latitude;
      const lon = pos.coords.longitude;
      fetchPrayerTimes(lat, lon);
      getLocationName(lat, lon);
    }, () => {
      document.getElementById("location-info").textContent = "📍 Lokasi: gagal memuat";
      useCachedOrDefaultSchedule();
    }, { timeout: 10000 });
  } else { 
    useCachedOrDefaultSchedule();
  }

  setInterval(checkNotifications, 60000);
  setInterval(highlightCurrentPrayer, 30000);
  setInterval(updateNextPrayerCountdown, 1000);

document.getElementById("notif-button").onclick = () => { 
  requestNotificationPermission();
  soundEnabled = true;
};

  document.getElementById("stop-adzan").onclick = () => stopAllAdzan();// stop adzan

  document.getElementById("theme-toggle").onclick = () => {// toggle tema
    document.body.classList.toggle("dark-mode");
  };

  document.getElementById("back-to-real").onclick = () => {// mode asli
    demoMode = false;
    highlightCurrentPrayer();// highlight
    updateNextPrayerCountdown();
    alert("Mode asli diaktifkan kembali");
  };
// terapkan waktu demo
  document.getElementById("apply-demo").onclick = () => {
    const input = document.getElementById("demo-time").value;
    if (input) {
      demoMode = true;
      demoTime = input;
      highlightCurrentPrayer();
      soundEnabled = true;
      checkNotifications();
      updateNextPrayerCountdown();
      alert(`Jam simulasi diubah ke ${demoTime}`);
    }
  };
}

window.onload = initApp;
