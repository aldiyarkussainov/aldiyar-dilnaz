/* ════════════════════════════════════════════════════════════
   SCROLL RESTORATION
   После F5 / возврата по истории — открываем сайт с hero, а не там,
   где пользователь был. Прелоад тоже должен показываться с начала.
   ════════════════════════════════════════════════════════════ */
if ("scrollRestoration" in history) {
  history.scrollRestoration = "manual";
}
window.scrollTo(0, 0);
// дублируем после полной загрузки — некоторые мобильные браузеры
// игнорируют первый scrollTo, если он вызван до layout
window.addEventListener("load", () => window.scrollTo(0, 0));

/* ════════════════════════════════════════════════════════════
   КОНФИГ
   ════════════════════════════════════════════════════════════ */
const CONFIG = {
  // Дата и время свадьбы (Астана UTC+5). Формат ISO с явной зоной.
  weddingISO: "2026-08-11T17:00:00+05:00",

  // URL веб-приложения Google Apps Script для RSVP.
  rsvpEndpoint: "https://script.google.com/macros/s/AKfycbwv15-oIpRybni6xYzKkWZKwNPBZsWsM9kLG_KAAXZ8p6E_G6GP6b51d8mqv_rwKhke/exec",
};

/* ════════════════════════════════════════════════════════════
   1. PRELOAD — авто-таймлайн:
      0.0s   логотип проявляется (CSS, animation-delay 200ms + 900ms)
      ~1.1s  стартует сердцебиение (3 цикла × 1.15s = 3.45s)
      ~4.6s  логотип наезжает и растворяется
      ~5.5s  сайт раскрывается
      Цифры — те же, что в styles.css. Если меняешь там — поправь здесь.
   ════════════════════════════════════════════════════════════ */
const preload  = document.getElementById("preload");
const bgm      = document.getElementById("bgm");
const musicBtn = document.getElementById("musicToggle");
const content  = document.getElementById("content");

const TIMING = {
  fadeIn:    600,             // 100ms задержка + 500ms анимация
  beatCycle: 900,
  beatTimes: 2,
  zoom:      700,
  // полное время прелоада: 600 + 2*900 + 700 = 3100ms
};

function startPreloadTimeline() {
  // фаза 2 — heartbeat
  setTimeout(() => {
    preload.classList.add("is-beating");
  }, TIMING.fadeIn);

  // фаза 3 — zoom + растворение
  const zoomAt = TIMING.fadeIn + TIMING.beatCycle * TIMING.beatTimes;
  setTimeout(() => {
    preload.classList.remove("is-beating");
    preload.classList.add("is-zooming");
  }, zoomAt);

  // фаза 4 — раскрываем контент почти одновременно с зумом
  // (контент проявляется снизу, монограмма уходит вверх по z — глаз получает кроссфейд)
  setTimeout(() => {
    document.body.classList.remove("is-locked");
    content.setAttribute("aria-hidden", "false");
  }, zoomAt + TIMING.zoom * 0.55);

  // фаза 5 — окончательно убираем оверлей
  setTimeout(() => {
    preload.classList.add("is-gone");
  }, zoomAt + TIMING.zoom);
}

// если пользователь зашёл с reduced-motion — пропускаем спектакль
const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
if (prefersReducedMotion) {
  document.body.classList.remove("is-locked");
  content.setAttribute("aria-hidden", "false");
  preload.classList.add("is-gone");
} else {
  startPreloadTimeline();
}

/* ════════════════════════════════════════════════════════════
   2. МУЗЫКА
      Браузер блокирует автоплей. Стратегия:
      - после прелоада показываем иконку в состоянии "выключено"
      - вешаем одноразовый слушатель на ЛЮБОЙ первый жест
        (click/touchstart/keydown) — пробуем стартовать звук
      - дальше иконка работает как обычный toggle
   ════════════════════════════════════════════════════════════ */
let musicReady = false;
const MUSIC_POS_KEY = "music_pos";

function showMusicButton(muted = true) {
  musicBtn.classList.add("is-shown");
  musicBtn.classList.toggle("is-muted", muted);
}

// сохраняем текущую позицию трека — чтобы при следующем заходе
// продолжать с того же места
function saveMusicPos() {
  try {
    const t = bgm.currentTime;
    if (Number.isFinite(t) && t > 0) {
      localStorage.setItem(MUSIC_POS_KEY, String(t));
    }
  } catch (_) {}
}

// восстанавливаем позицию из localStorage. Вызывать ДО play().
function restoreMusicPos() {
  try {
    const saved = parseFloat(localStorage.getItem(MUSIC_POS_KEY) || "");
    if (Number.isFinite(saved) && saved > 0) {
      bgm.currentTime = saved;
    }
  } catch (_) {}
}

function tryStartMusic() {
  if (musicReady) return;
  bgm.volume = 0.55;
  restoreMusicPos();
  const p = bgm.play();
  if (p && typeof p.then === "function") {
    p.then(() => {
      musicReady = true;
      showMusicButton(false);
    }).catch(() => {
      // файла нет или браузер всё-таки не дал — оставляем muted-кнопку
      showMusicButton(true);
    });
  }
}

// Показываем кнопку уже после того, как прелоад полностью ушёл
const showMusicAt = TIMING.fadeIn + TIMING.beatCycle * TIMING.beatTimes + TIMING.zoom;
setTimeout(() => showMusicButton(true), prefersReducedMotion ? 0 : showMusicAt);

// Первый жест → пробуем включить
const FIRST_GESTURE_EVENTS = ["pointerdown", "touchstart", "keydown"];
const onFirstGesture = () => {
  tryStartMusic();
  FIRST_GESTURE_EVENTS.forEach((ev) =>
    document.removeEventListener(ev, onFirstGesture, true)
  );
};
FIRST_GESTURE_EVENTS.forEach((ev) =>
  document.addEventListener(ev, onFirstGesture, { capture: true, passive: true })
);

// Кнопка-тогглер: явный контроль пользователем
musicBtn.addEventListener("click", (e) => {
  e.stopPropagation();
  if (bgm.paused) {
    const p = bgm.play();
    if (p && typeof p.then === "function") {
      p.then(() => musicBtn.classList.remove("is-muted"))
       .catch(() => musicBtn.classList.add("is-muted"));
    }
  } else {
    bgm.pause();
    musicBtn.classList.add("is-muted");
  }
});

// Останавливаем музыку при уходе со страницы. Перед паузой ЗАПОМИНАЕМ
// позицию в localStorage — при следующем заходе продолжим с того же
// места (restoreMusicPos() в tryStartMusic).
const stopMusic = () => {
  try {
    saveMusicPos();
    bgm.pause();
    musicBtn.classList.add("is-muted");
  } catch (_) {}
};
// pagehide — главный: закрытие вкладки, навигация на другой URL,
// swipe-out на мобильном, попадание страницы в BFCache.
window.addEventListener("pagehide", stopMusic);
// beforeunload — дублёр для старых браузеров
window.addEventListener("beforeunload", stopMusic);

// Параллельно сохраняем позицию каждые несколько секунд, пока играет, —
// на случай, если pagehide вдруг не успеет сработать (бывает на iOS Safari).
let lastSavedAt = 0;
bgm.addEventListener("timeupdate", () => {
  const now = performance.now();
  if (now - lastSavedAt > 4000) {
    lastSavedAt = now;
    saveMusicPos();
  }
});

// «Картаны ашу» — открывается в новом табе, наша вкладка не уходит,
// pagehide не сработает; глушим явно перед переходом на карту.
const mapLink = document.getElementById("openMap");
if (mapLink) {
  mapLink.addEventListener("click", stopMusic);
}

/* ════════════════════════════════════════════════════════════
   3. COUNTDOWN
   ════════════════════════════════════════════════════════════ */
const target = new Date(CONFIG.weddingISO).getTime();
const cdEls = {
  days:    document.querySelector('[data-unit="days"]'),
  hours:   document.querySelector('[data-unit="hours"]'),
  minutes: document.querySelector('[data-unit="minutes"]'),
  seconds: document.querySelector('[data-unit="seconds"]'),
};

function pad(n) { return String(Math.max(0, n)).padStart(2, "0"); }

function tick() {
  const diff = target - Date.now();
  if (diff <= 0) {
    cdEls.days.textContent    = "00";
    cdEls.hours.textContent   = "00";
    cdEls.minutes.textContent = "00";
    cdEls.seconds.textContent = "00";
    return;
  }
  const d = Math.floor(diff / 86_400_000);
  const h = Math.floor((diff % 86_400_000) / 3_600_000);
  const m = Math.floor((diff % 3_600_000) / 60_000);
  const s = Math.floor((diff % 60_000) / 1000);

  cdEls.days.textContent    = pad(d);
  cdEls.hours.textContent   = pad(h);
  cdEls.minutes.textContent = pad(m);
  cdEls.seconds.textContent = pad(s);
}
tick();
setInterval(tick, 1000);

/* ════════════════════════════════════════════════════════════
   4. CALENDAR — мини-сетка августа 2026 с обведённым 11-м
   ════════════════════════════════════════════════════════════ */
(function renderCalendar() {
  const grid = document.getElementById("calendarGrid");
  if (!grid) return;

  // заголовки дней недели (казахский, с понедельника)
  ["Дс", "Сс", "Ср", "Бс", "Жм", "Сб", "Жс"].forEach((d) => {
    const el = document.createElement("div");
    el.className = "calendar__dow";
    el.textContent = d;
    grid.appendChild(el);
  });

  const year = 2026, month = 7; // август (0-индексация)
  const first = new Date(year, month, 1);
  // приводим к Mon=0…Sun=6
  const firstDow = (first.getDay() + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const targetDay = 11;

  for (let i = 0; i < firstDow; i++) {
    const cell = document.createElement("div");
    cell.className = "calendar__day calendar__day--empty";
    cell.textContent = "·";
    grid.appendChild(cell);
  }
  for (let d = 1; d <= daysInMonth; d++) {
    const cell = document.createElement("div");
    cell.className = "calendar__day";
    if (d === targetDay) cell.classList.add("calendar__day--target");
    cell.textContent = d;
    grid.appendChild(cell);
  }
})();

/* ════════════════════════════════════════════════════════════
   5. REVEAL ON SCROLL
   ════════════════════════════════════════════════════════════ */
const io = new IntersectionObserver(
  (entries) => {
    for (const e of entries) {
      if (e.isIntersecting) {
        e.target.classList.add("is-in");
        io.unobserve(e.target);
      }
    }
  },
  { threshold: 0.12, rootMargin: "0px 0px -40px 0px" }
);
document.querySelectorAll(".reveal").forEach((el) => io.observe(el));

/* ════════════════════════════════════════════════════════════
   7. RSVP — показ/скрытие поля «адам саны»
   ════════════════════════════════════════════════════════════ */
const form     = document.getElementById("rsvpForm");
const guestRow = form.querySelector('[data-show-if-attending="yes"]');

function syncGuestVisibility() {
  const yes = form.querySelector('input[name="attending"][value="yes"]').checked;
  guestRow.classList.toggle("is-visible", yes);
}
form.querySelectorAll('input[name="attending"]').forEach((r) =>
  r.addEventListener("change", syncGuestVisibility)
);

/* ════════════════════════════════════════════════════════════
   8. RSVP submit → Google Apps Script
   ════════════════════════════════════════════════════════════ */
const statusEl = document.getElementById("formStatus");
const submitBtn = form.querySelector(".submit");

form.addEventListener("submit", async (e) => {
  e.preventDefault();

  statusEl.classList.remove("is-error", "is-success");

  const fd = new FormData(form);
  const data = Object.fromEntries(fd.entries());

  if (!data.name || !data.attending) {
    statusEl.textContent = "Есім мен жауапты толтырыңыз.";
    statusEl.classList.add("is-error");
    return;
  }

  submitBtn.disabled = true;
  submitBtn.querySelector(".submit__label").textContent = "Жіберілуде…";

  // helper: пишем в localStorage на случай, если сеть отвалится
  const cacheKey = "rsvp_unsent";
  try {
    const payload = {
      ...data,
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent,
    };

    if (CONFIG.rsvpEndpoint.startsWith("http")) {
      // text/plain — чтобы избежать preflight CORS в Apps Script
      const res = await fetch(CONFIG.rsvpEndpoint, {
        method: "POST",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error("Network response not ok");
    } else {
      // endpoint ещё не задан — кладём в localStorage и предупреждаем в консоль
      const stash = JSON.parse(localStorage.getItem(cacheKey) || "[]");
      stash.push(payload);
      localStorage.setItem(cacheKey, JSON.stringify(stash));
      console.warn("[RSVP] endpoint not configured — saved to localStorage:", payload);
    }

    // показываем success-overlay
    showSuccess(data.attending === "yes");

    form.reset();
    syncGuestVisibility();
    statusEl.textContent = "";
  } catch (err) {
    console.error(err);
    statusEl.textContent = "Қате болды. Сәл кейінірек қайталап көріңіз.";
    statusEl.classList.add("is-error");
  } finally {
    submitBtn.disabled = false;
    submitBtn.querySelector(".submit__label").textContent = "Жіберу";
  }
});

/* ════════════════════════════════════════════════════════════
   9. SUCCESS SCREEN + ХЛОПУШКА
   ════════════════════════════════════════════════════════════ */
const successScreen = document.getElementById("successScreen");
const successBack   = document.getElementById("successBack");
const successSub    = document.getElementById("successSub");
const confettiBox   = document.getElementById("confetti");

function showSuccess(attending) {
  // подгоняем текст под ответ
  if (successSub) {
    successSub.textContent = attending
      ? "Тойымызда сізді күтеміз"
      : "Жауабыңыз үшін рахмет";
  }

  successScreen.classList.add("is-shown");
  successScreen.setAttribute("aria-hidden", "false");
  successScreen.scrollTop = 0;
  document.body.style.overflow = "hidden";

  // конфетти только при «Иә, келемін»
  if (attending) {
    requestAnimationFrame(spawnConfetti);
  }
}

function hideSuccess() {
  successScreen.classList.remove("is-shown");
  successScreen.setAttribute("aria-hidden", "true");
  document.body.style.overflow = "";
  // чистим частицы конфетти, чтобы при повторном вызове ничего не висело
  if (confettiBox) confettiBox.innerHTML = "";
}

if (successBack) {
  successBack.addEventListener("click", hideSuccess);
}

// Хлопушка: 60 частиц, две стороны (низ-лево / низ-право).
// У каждой свой целевой вектор, поворот и продолжительность.
function spawnConfetti() {
  if (!confettiBox) return;
  confettiBox.innerHTML = "";

  // палитра — графит + accent + cream + золотистый + белый.
  // двадцатые годы XXI, не радуга.
  const colors = ["#B98E84", "#D4A574", "#EFEAE2", "#FFFFFF", "#1F1F20"];
  const total  = 60;
  const vw     = window.innerWidth;
  const vh     = window.innerHeight;

  for (let i = 0; i < total; i++) {
    const piece = document.createElement("div");
    piece.className = "confetti__piece";

    // чередуем стороны
    const fromLeft = i % 2 === 0;
    piece.classList.add(fromLeft ? "confetti__piece--left" : "confetti__piece--right");

    // углы вылета: от 35° до 85° от горизонтали, к центру
    const angleDeg = 35 + Math.random() * 50;
    const angleRad = (angleDeg * Math.PI) / 180;
    const power    = vw * 0.5 + Math.random() * (vh * 0.4);

    const dx = Math.cos(angleRad) * power * (fromLeft ? 1 : -1);
    const dy = -Math.sin(angleRad) * power - 60 - Math.random() * 60;

    const rot      = Math.random() * 1080 - 540;
    const duration = 1500 + Math.random() * 1100;
    const delay    = Math.random() * 240;
    const color    = colors[Math.floor(Math.random() * colors.length)];
    // некоторым частицам даём вытянутую форму, некоторым квадратную
    const w = 6 + Math.random() * 6;
    const h = 10 + Math.random() * 8;

    piece.style.setProperty("--tx", `${dx.toFixed(0)}px`);
    piece.style.setProperty("--ty", `${dy.toFixed(0)}px`);
    piece.style.setProperty("--rot", `${rot.toFixed(0)}deg`);
    piece.style.setProperty("--dur", `${duration.toFixed(0)}ms`);
    piece.style.setProperty("--delay", `${delay.toFixed(0)}ms`);
    piece.style.setProperty("--bg-c", color);
    piece.style.width  = `${w.toFixed(0)}px`;
    piece.style.height = `${h.toFixed(0)}px`;

    confettiBox.appendChild(piece);
  }

  // подчищаем DOM через ~3.5 сек после старта последней частицы
  setTimeout(() => {
    if (confettiBox) confettiBox.innerHTML = "";
  }, 3600);
}

// ESC закрывает success
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && successScreen.classList.contains("is-shown")) {
    hideSuccess();
  }
});
