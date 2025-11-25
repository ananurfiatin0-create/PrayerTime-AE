// 1. kls & data dasar (abstraksi & polimorfisme)
class Reminder {  //reminder=kls abstrak (tdk bs lngsng digunakan) harus diimplementasikan olh turunan
  constructor(name) { this.name = name; }
  notify() { throw new Error("Method notify() harus diimplementasikan"); }
}

//pewarisan & enkapsulasi
class PrayerTime extends Reminder {  //prayertime=mewarisi reminder (pewarisan)
  #time; #icon;  //#=private (hnya bs d akses dr dlm kls)
  constructor(name, time, icon) {
    super(name);
    this.#time = time; this.#icon = icon;
  }
  getTime() { return this.#time; }  //akses properti private (enkapsulasi)
  getIcon() { return this.#icon; }
  //polimorfisme: prayertime punya method render sendiri, bd dr reminder
  render() {
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
  Imsak: "https://img.icons8.com/ios/50/alarm.png",
  Subuh: "https://img.icons8.com/ios/50/mosque.png",
  Terbit: "https://img.icons8.com/ios/50/sunrise.png",
  Dhuha: "https://img.icons8.com/ios/50/sun--v1.png",
  Dzuhur: "https://img.icons8.com/ios/50/sun--v1.png",
  Ashar: "https://img.icons8.com/ios/50/clouds.png",
  Maghrib: "https://img.icons8.com/ios/50/sunset.png",
  Isya: "https://img.icons8.com/ios-filled/50/moon-symbol.png"
};

let prayerSchedule = [];
let lastAdzanMinute = null;
let lastReminderMinute = null;

// 2. Audio Mapping
const prayerAudios = {
  imsak: document.getElementById("audio-imsak"),
  subuh: document.getElementById("audio-subuh"),
  dzuhur: document.getElementById("audio-dhuhur"),
  ashar: document.getElementById("audio-ashar"),
  maghrib: document.getElementById("audio-maghrib"),
  isya: document.getElementById("audio-isya")
};
const adzanAudio = document.getElementById("adzan-biasa");
let soundEnabled = false;

// 3. Pengaturan Waktu
let demoMode = false;
let demoTime = "04:13";

function updateClock() {
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

function getCurrentMinutes() {
  if (demoMode) {
    const [hour, minute] = demoTime.split(":").map(Number);
    return hour * 60 + minute;
  } else {
    const now = new Date();
    return now.getHours() * 60 + now.getMinutes();
  }
}

// 4. Fetch Data Waktu Sholat
function fetchPrayerTimes(lat, long) {
  const today = new Date();
  const date = today.toISOString().split("T")[0];
  const url = `https://api.aladhan.com/v1/timings/${date}?latitude=${lat}&longitude=${long}&method=11`;

  fetch(url)
    .then(res => res.json())
    .then(data => {
      const timings = data.data.timings;
      const prayerList = [
        new PrayerTime("Imsak", timings.Imsak, icons.Imsak),
        new PrayerTime("Subuh", timings.Fajr, icons.Subuh),
        new PrayerTime("Terbit", timings.Sunrise, icons.Terbit),
        new PrayerTime("Dhuha", "07:00", icons.Dhuha),
        new PrayerTime("Dzuhur", timings.Dhuhr, icons.Dzuhur),
        new PrayerTime("Ashar", timings.Asr, icons.Ashar),
        new PrayerTime("Maghrib", timings.Maghrib, icons.Maghrib),
        new PrayerTime("Isya", timings.Isha, icons.Isya)
      ];
      document.getElementById("prayer-list").innerHTML = prayerList.map(p => p.render()).join("");
      prayerSchedule = prayerList.map(p => ({ name: p.name, time: p.getTime() }));
      highlightCurrentPrayer();
    })
    .catch(() => {
      document.getElementById("prayer-list").innerHTML = "<p>Gagal memuat jadwal sholat</p>";
    });
}

// 5. Lokasi (Nama Kota)
function getLocationName(lat, lon) {
  const url = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json&accept-language=id`;
  fetch(url)
    .then(res => res.json())
    .then(data => {
      const address = data.address;
      const city = address.city || address.town || address.village || address.state || "Tidak diketahui";
      document.getElementById("location-info").textContent = `📍 Lokasi: ${city}`;
    })
    .catch(() => {
      document.getElementById("location-info").textContent = "📍 Lokasi: gagal memuat nama";
    });
}

// 6. Highlight Waktu Sholat Aktif
function highlightCurrentPrayer() {
  const currentMinutes = getCurrentMinutes();
  let activeIndex = -1;

  for (let i = 0; i < prayerSchedule.length - 1; i++) {
    const [startHour, startMinute] = prayerSchedule[i].time.split(":").map(Number);
    const [endHour, endMinute] = prayerSchedule[i + 1].time.split(":").map(Number);
    const startMinutes = startHour * 60 + startMinute;
    const endMinutes = endHour * 60 + endMinute;
    if (currentMinutes >= startMinutes && currentMinutes < endMinutes) {
      activeIndex = i; break;
    }
  }

  const [lastHour, lastMinute] = prayerSchedule[prayerSchedule.length - 1].time.split(":").map(Number);
  const lastMinutes = lastHour * 60 + lastMinute;
  if (currentMinutes >= lastMinutes) activeIndex = prayerSchedule.length - 1;

  const cards = document.querySelectorAll(".prayer-card");
  cards.forEach((card, index) => card.classList.toggle("active", index === activeIndex));
}

// 7. Notifikasi & Audio
function getAudioKey(name) {
  switch(name) {
    case "Imsak": return "imsak";
    case "Subuh": return "subuh";
    case "Dzuhur": return "dzuhur";
    case "Ashar": return "ashar";
    case "Maghrib": return "maghrib";
    case "Isya": return "isya";
    default: return null;
  }
}

function checkNotifications() {
  const currentMinutes = getCurrentMinutes();
  prayerSchedule.forEach(item => {
    const [hour, minute] = item.time.split(":").map(Number);
    const prayerMinutes = hour * 60 + minute;

    if (prayerMinutes === currentMinutes && lastAdzanMinute !== currentMinutes) {
      const message = `Waktu ${item.name} telah tiba`;
      showNotification(message);
      showVisualAlert(message);

      if (soundEnabled) {
        const key = getAudioKey(item.name);
        if (key && prayerAudios[key]) {
          prayerAudios[key].play().catch(err => console.log("Gagal memutar audio:", err));
        }
      }
      lastAdzanMinute = currentMinutes;
    }

    if (prayerMinutes - currentMinutes === 10 && lastReminderMinute !== currentMinutes) {
      const message = `10 menit lagi menuju waktu ${item.name}`;
      showNotification(message);
      showVisualAlert(message);
      lastReminderMinute = currentMinutes;
    }
  });
}

function showNotification(message) {
  if ("Notification" in window && Notification.permission === "granted") {
    new Notification("Pengingat Sholat", {
      body: message,
      icon: "https://img.icons8.com/ios/50/mosque.png"
    });
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

// 8. Countdown Sholat Berikutnya
function updateNextPrayerCountdown() {
  if (prayerSchedule.length === 0) return;

  const now = new Date();
  const currentMinutes = getCurrentMinutes();
  let nextPrayer = null;
  let targetTime = null;

  // cari sholat berikutnya
  for (let i = 0; i < prayerSchedule.length; i++) {
    const [hour, minute] = prayerSchedule[i].time.split(":").map(Number);
    const prayerDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hour, minute, 0);
    const prayerMinutes = hour * 60 + minute;

    if (prayerMinutes > currentMinutes) {
      nextPrayer = prayerSchedule[i];
      targetTime = prayerDate;
      break;
    }
  }

  // jika semua sudah lewat, targetkan ke imsak besok
  if (!targetTime) {
    const [hour, minute] = prayerSchedule[0].time.split(":").map(Number);
    targetTime = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, hour, minute, 0);
    nextPrayer = prayerSchedule[0];
  }

  const diffMs = targetTime - now;
  const totalSeconds = Math.floor(diffMs / 1000);
  const hours = String(Math.floor(totalSeconds / 3600)).padStart(2, '0');
  const minutes = String(Math.floor((totalSeconds % 3600) / 60)).padStart(2, '0');
  const seconds = String(totalSeconds % 60).padStart(2, '0');

  document.getElementById("next-prayer-time").textContent =
    `${nextPrayer.name} ${nextPrayer.time}`;
  document.getElementById("next-prayer-countdown").textContent =
    `${hours} : ${minutes} : ${seconds}`;
}

// 9. Interaksi User
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

function stopAllAdzan() {
  adzanAudio.pause();
  adzanAudio.currentTime = 0;
  Object.values(prayerAudios).forEach(audio => {
    if (audio) {
      audio.pause();
      audio.currentTime = 0;
    }
  });
}

// 10. Inisialisasi Aplikasi
function initApp() {
  soundEnabled = true; // memastikan adzan asli berbunyi pd waktunya

  updateClock();
  setInterval(updateClock, 1000);

  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(pos => {
      const lat = pos.coords.latitude;
      const lon = pos.coords.longitude;
      fetchPrayerTimes(lat, lon);
      getLocationName(lat, lon); // tampilkan lokasi
    }, () => {
      document.getElementById("location-info").textContent = "📍 Lokasi: gagal memuat";
    });
  }

  setInterval(checkNotifications, 60000);
  setInterval(highlightCurrentPrayer, 30000);
  setInterval(updateNextPrayerCountdown, 1000);

  document.getElementById("notif-button").onclick = () => {
    requestNotificationPermission();
    soundEnabled = true; // tombol ini juga bisa mengaktifkan suara
  };

  document.getElementById("stop-adzan").onclick = () => stopAllAdzan();
  document.getElementById("theme-toggle").onclick = () => {
    document.body.classList.toggle("dark-mode");
  };

  document.getElementById("back-to-real").onclick = () => {
    demoMode = false; // balik ke jam asli
    highlightCurrentPrayer();
    updateNextPrayerCountdown();
    alert("Mode asli diaktifkan kembali");
  };

  document.getElementById("apply-demo").onclick = () => {
    const input = document.getElementById("demo-time").value;
    if (input) {
      demoMode = true;
      demoTime = input;
      highlightCurrentPrayer();
      soundEnabled = true; // demo juga aktifkan suara
      checkNotifications();
      updateNextPrayerCountdown();
      alert(`Jam simulasi diubah ke ${demoTime}`);
    }
  };
}

  const accentSelect = document.getElementById("accent-select");
  if (accentSelect) {
    accentSelect.onchange = (e) => {
      document.body.classList.remove("accent-blue", "accent-green", "accent-purple", "accent-gold");
      document.body.classList.add(e.target.value);
    };
  }

// Jalankan aplikasi setelah halaman selesai dimuat
window.onload = initApp;

// 1. Abstraksi: kls reminder hanya mendefinisikan struktur dasar pengingat, method notify wajib diimplementasikan olh turunan
// 2. Pewarisan: PrayerTime mewarisi Reminder, sehingga dpt menggunakan properti dan method dari Reminder
// 3. Enkapsulasi: PrayerTime menggunakan properti private (#time, #icon), hanya bisa diakses lwt method dlm kls
// 4. Polimorfisme: PrayerTime mengimplementasikan method render sendiri, berbeda dr Reminder. Jika ada turunan lain dr Reminder, bs punya method berbeda sesuai kebutuhan