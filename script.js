/* =====================================================================
   Flowmodoro — app logic
   =====================================================================
   Structure of this file (read top to bottom, it's written like a
   walkthrough since this project doubles as a learning exercise):

   1. State           — the single source of truth for the whole app
   2. DOM references  — grab elements once, reuse everywhere
   3. Break presets    — the "twist": break length scales with work length
   4. Timer engine     — start/pause/reset/skip, tick loop
   5. Session map      — renders + updates the visual strip
   6. Settings panel    — open/close, applying new settings
   7. Alarm handling    — default chime + custom upload via localStorage
   8. Init             — wire everything up on page load
   ===================================================================== */

/* ---------------------------------------------------------------------
   1. STATE
   --------------------------------------------------------------------- */
const state = {
  workMinutes: 25,
  breakMinutes: 5,
  breakPresetKey: "medium", // 'small' | 'medium' | 'large'
  mode: "work",             // 'work' | 'break'
  secondsLeft: 25 * 60,
  totalSecondsForPhase: 25 * 60,
  isRunning: false,
  intervalId: null,
  sessionNumber: 1,
};

/* ---------------------------------------------------------------------
   2. DOM REFERENCES
   --------------------------------------------------------------------- */
const appEl = document.querySelector(".app");
const timeTextEl = document.getElementById("timeText");
const stateLabelEl = document.getElementById("stateLabel");
const startPauseBtn = document.getElementById("startPauseBtn");
const resetBtn = document.getElementById("resetBtn");
const skipBtn = document.getElementById("skipBtn");
const sessionMapEl = document.getElementById("sessionMap");
const cycleCountEl = document.getElementById("cycleCount");

const settingsBtn = document.getElementById("settingsBtn");
const closeSettingsBtn = document.getElementById("closeSettingsBtn");
const settingsOverlay = document.getElementById("settingsOverlay");
const workMinutesInput = document.getElementById("workMinutesInput");
const breakOptionsEl = document.getElementById("breakOptions");
const applySettingsBtn = document.getElementById("applySettingsBtn");

const alarmUploadInput = document.getElementById("alarmUpload");
const alarmFileNameEl = document.getElementById("alarmFileName");
const testAlarmBtn = document.getElementById("testAlarmBtn");
const clearAlarmBtn = document.getElementById("clearAlarmBtn");
const alarmAudioEl = document.getElementById("alarmAudio");

/* ---------------------------------------------------------------------
   3. BREAK PRESETS — the twist
   ---------------------------------------------------------------------
   Instead of a fixed 25/5 split, the break is a percentage of whatever
   work length you choose. Three presets give you control over how
   generous the break is, instead of one fixed formula.

   small  -> 15% of work time
   medium -> 20% of work time
   large  -> 25% of work time

   Minimum of 1 minute so a tiny work session doesn't round to 0.
   --------------------------------------------------------------------- */
const BREAK_PRESETS = {
  small: { label: "Short break", percent: 0.15 },
  medium: { label: "Medium break", percent: 0.20 },
  large: { label: "Long break", percent: 0.25 },
};

function calculateBreakMinutes(workMinutes, presetKey) {
  const percent = BREAK_PRESETS[presetKey].percent;
  return Math.max(1, Math.round(workMinutes * percent));
}

/* ---------------------------------------------------------------------
   4. TIMER ENGINE
   --------------------------------------------------------------------- */
function formatTime(totalSeconds) {
  const m = Math.floor(totalSeconds / 60).toString().padStart(2, "0");
  const s = Math.floor(totalSeconds % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

function renderTime() {
  timeTextEl.textContent = formatTime(state.secondsLeft);
  document.title = `${formatTime(state.secondsLeft)} · ${state.mode === "work" ? "Work" : "Break"} — Flowmodoro`;
}

function renderModeUI() {
  appEl.dataset.mode = state.mode;
  stateLabelEl.textContent = state.mode === "work" ? "Focus time" : "Break time";
  cycleCountEl.textContent = `Session ${state.sessionNumber}`;
}

function tick() {
  state.secondsLeft -= 1;
  renderTime();
  updateSessionMapFill();

  if (state.secondsLeft <= 0) {
    handlePhaseComplete();
  }
}

function startTimer() {
  if (state.isRunning) return;
  state.isRunning = true;
  startPauseBtn.textContent = "Pause";
  state.intervalId = setInterval(tick, 1000);
  requestNotificationPermissionIfNeeded();
  stopAlarm();
}

function pauseTimer() {
  state.isRunning = false;
  startPauseBtn.textContent = "Start";
  clearInterval(state.intervalId);
}

function toggleStartPause() {
  if (state.isRunning) {
    pauseTimer();
  } else {
    startTimer();
  }
}

function resetTimer() {
  pauseTimer();
  stopAlarm();
  state.mode = "work";
  state.secondsLeft = state.workMinutes * 60;
  state.totalSecondsForPhase = state.secondsLeft;
  renderTime();
  renderModeUI();
  rebuildSessionMap();
}

function skipPhase() {
  pauseTimer();
  stopAlarm();
  switchPhase();
}

function handlePhaseComplete() {
  pauseTimer();
  playAlarm();
  showPhaseCompleteNotification();
  switchPhase();
}

function switchPhase() {
  if (state.mode === "work") {
    state.mode = "break";
    state.secondsLeft = state.breakMinutes * 60;
  } else {
    state.mode = "work";
    state.secondsLeft = state.workMinutes * 60;
    state.sessionNumber += 1;
  }
  state.totalSecondsForPhase = state.secondsLeft;
  renderTime();
  renderModeUI();
  rebuildSessionMap();
}

/* ---------------------------------------------------------------------
   5. SESSION MAP
   ---------------------------------------------------------------------
   A simple two-segment strip: work block, break block. Sized
   proportionally to time so a 60/12 split visually looks different
   from a 25/5 split. The active segment fills in as time elapses.
   --------------------------------------------------------------------- */
function rebuildSessionMap() {
  sessionMapEl.innerHTML = "";

  const workSegment = document.createElement("div");
  workSegment.className = "segment work";
  workSegment.style.flexGrow = state.workMinutes;
  workSegment.innerHTML = '<div class="fill"></div>';

  const breakSegment = document.createElement("div");
  breakSegment.className = "segment break";
  breakSegment.style.flexGrow = state.breakMinutes;
  breakSegment.innerHTML = '<div class="fill"></div>';

  if (state.mode === "work") {
    workSegment.classList.remove("complete");
  } else {
    workSegment.classList.add("complete");
  }

  sessionMapEl.appendChild(workSegment);
  sessionMapEl.appendChild(breakSegment);

  updateSessionMapFill();
}

function updateSessionMapFill() {
  const activeSelector = state.mode === "work" ? ".segment.work .fill" : ".segment.break .fill";
  const fillEl = sessionMapEl.querySelector(activeSelector);
  if (!fillEl) return;

  const elapsed = state.totalSecondsForPhase - state.secondsLeft;
  const percent = Math.min(100, (elapsed / state.totalSecondsForPhase) * 100);
  fillEl.style.width = `${percent}%`;
}

/* ---------------------------------------------------------------------
   6. SETTINGS PANEL
   --------------------------------------------------------------------- */
function openSettings() {
  appEl.classList.add("settings-open");
  settingsOverlay.setAttribute("aria-hidden", "false");
  renderBreakOptions(); // refresh percentages against current input value
}

function closeSettings() {
  appEl.classList.remove("settings-open");
  settingsOverlay.setAttribute("aria-hidden", "true");
}

function renderBreakOptions() {
  const workMinutes = parseInt(workMinutesInput.value, 10) || 1;
  breakOptionsEl.innerHTML = "";

  Object.entries(BREAK_PRESETS).forEach(([key, preset]) => {
    const minutes = calculateBreakMinutes(workMinutes, key);

    const option = document.createElement("label");
    option.className = "break-option" + (key === state.breakPresetKey ? " selected" : "");
    option.innerHTML = `
      <span>
        <input type="radio" name="breakPreset" value="${key}" ${key === state.breakPresetKey ? "checked" : ""} />
        ${preset.label}
      </span>
      <span class="break-len">${minutes} min</span>
    `;

    option.querySelector("input").addEventListener("change", () => {
      state.breakPresetKey = key;
      document.querySelectorAll(".break-option").forEach((el) => el.classList.remove("selected"));
      option.classList.add("selected");
    });

    breakOptionsEl.appendChild(option);
  });
}

function applySettings() {
  const workMinutes = Math.max(1, Math.min(240, parseInt(workMinutesInput.value, 10) || 25));
  workMinutesInput.value = workMinutes;

  state.workMinutes = workMinutes;
  state.breakMinutes = calculateBreakMinutes(workMinutes, state.breakPresetKey);
  state.sessionNumber = 1;

  resetTimer();
  closeSettings();
}

/* ---------------------------------------------------------------------
   7. ALARM HANDLING
   ---------------------------------------------------------------------
   Custom alarms are stored in localStorage as a base64 data URL so
   they persist across reloads without needing a backend.
   --------------------------------------------------------------------- */
const ALARM_STORAGE_KEY = "flowmodoro_custom_alarm";
const ALARM_NAME_STORAGE_KEY = "flowmodoro_custom_alarm_name";
const DEFAULT_ALARM_SRC = "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=";

function loadStoredAlarm() {
  const storedAlarm = localStorage.getItem(ALARM_STORAGE_KEY);
  const storedName = localStorage.getItem(ALARM_NAME_STORAGE_KEY);

  if (storedAlarm) {
    alarmAudioEl.src = storedAlarm;
    alarmFileNameEl.textContent = storedName || "Custom sound";
  } else {
    alarmAudioEl.src = DEFAULT_ALARM_SRC;
    alarmFileNameEl.textContent = "Default chime";
  }
}

function handleAlarmUpload(event) {
  const file = event.target.files[0];
  if (!file) return;

  if (!file.type.startsWith("audio/")) {
    alert("Please choose an audio file.");
    return;
  }

  // 2MB limit keeps localStorage usage sane (it caps around 5-10MB total)
  if (file.size > 2 * 1024 * 1024) {
    alert("That file is a bit large for browser storage. Please choose a clip under 2MB.");
    return;
  }

  const reader = new FileReader();
  reader.onload = () => {
    const dataUrl = reader.result;
    try {
      localStorage.setItem(ALARM_STORAGE_KEY, dataUrl);
      localStorage.setItem(ALARM_NAME_STORAGE_KEY, file.name);
      alarmAudioEl.src = dataUrl;
      alarmFileNameEl.textContent = file.name;
    } catch (err) {
      alert("Couldn't save that sound — it may be too large for browser storage.");
    }
  };
  reader.readAsDataURL(file);
}

function clearCustomAlarm() {
  localStorage.removeItem(ALARM_STORAGE_KEY);
  localStorage.removeItem(ALARM_NAME_STORAGE_KEY);
  alarmUploadInput.value = "";
  loadStoredAlarm();
}

function playAlarm() {
  alarmAudioEl.currentTime = 0;
  alarmAudioEl.play().catch(() => {
    // Autoplay can be blocked until the user has interacted with the page;
    // the Start button click earlier in the session satisfies that in practice.
  });
}

function stopAlarm() {
  alarmAudioEl.pause();
  alarmAudioEl.currentTime = 0;
}

/* ---------------------------------------------------------------------
   7b. NOTIFICATIONS
   ---------------------------------------------------------------------
   Desktop notifications so a phase change is noticeable even if the
   tab isn't focused. This is purely additive: if the browser doesn't
   support the API, or the user denies/ignores the permission prompt,
   the app keeps working exactly as before (audio alarm only).

   We deliberately do NOT ask for permission on page load — that's a
   common dark pattern users have learned to reflexively dismiss.
   Instead we ask the first time the user presses Start, since that's
   a genuine signal they intend to use the timer.
   --------------------------------------------------------------------- */
function requestNotificationPermissionIfNeeded() {
  if (!("Notification" in window)) return; // unsupported browser, just skip

  if (Notification.permission === "default") {
    Notification.requestPermission();
  }
}

function showPhaseCompleteNotification() {
  if (!("Notification" in window)) return;
  if (Notification.permission !== "granted") return;

  // state.mode at this point still reflects the phase that JUST ended,
  // since switchPhase() hasn't run yet when this is called.
  const isWorkEnding = state.mode === "work";
  const title = isWorkEnding ? "Nice work! Time for a break" : "Break's done, let's get back to it";
  const body = isWorkEnding
    ? `You focused for ${state.workMinutes} minutes. Take ${state.breakMinutes} to recharge.`
    : "Ready to start your next focus session?";

  try {
    new Notification(title, {
      body,
      // A simple inline SVG icon keeps this self-contained with no extra
      // image file to manage. Optional — notifications work without one.
      tag: "flowmodoro-phase-complete", // re-using the tag prevents stacking duplicates
    });
  } catch (err) {
    // Some browsers (rarely) throw if called outside a user-gesture context
    // in certain configurations. Failing silently is fine here since the
    // audio alarm has already played.
  }
}

/* ---------------------------------------------------------------------
   8. INIT
   --------------------------------------------------------------------- */
function init() {
  loadStoredAlarm();
  renderTime();
  renderModeUI();
  rebuildSessionMap();
  renderBreakOptions();

  startPauseBtn.addEventListener("click", toggleStartPause);
  resetBtn.addEventListener("click", resetTimer);
  skipBtn.addEventListener("click", skipPhase);

  settingsBtn.addEventListener("click", openSettings);
  closeSettingsBtn.addEventListener("click", closeSettings);
  settingsOverlay.addEventListener("click", closeSettings);
  workMinutesInput.addEventListener("input", renderBreakOptions);
  applySettingsBtn.addEventListener("click", applySettings);

  alarmUploadInput.addEventListener("change", handleAlarmUpload);
  clearAlarmBtn.addEventListener("click", clearCustomAlarm);
  testAlarmBtn.addEventListener("click", playAlarm);
}

document.addEventListener("DOMContentLoaded", init);