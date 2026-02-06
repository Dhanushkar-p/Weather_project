/**************************************************************
  Weather Dashboard + Travel Insights (Fixed, Production-ish)
  Requires:
  - index.html with the same IDs used here
  - style.css loaded correctly
**************************************************************/

// ✅ Put your NEW key here (regenerate if you posted it online)
const OWM_API_KEY = "a1f32054d47d4e36f466b2a504059a54";
console.log("API KEY USED:", OWM_API_KEY);


// ---------- DOM ----------
const cityInput = document.getElementById("cityInput");
const autocomplete = document.getElementById("autocomplete");
const searchBtn = document.getElementById("searchBtn");
const useLocationBtn = document.getElementById("useLocationBtn");
const unitsBtn = document.getElementById("unitsBtn");

const placeName = document.getElementById("placeName");
const placeMeta = document.getElementById("placeMeta");
const nowIcon = document.getElementById("nowIcon");
const nowTemp = document.getElementById("nowTemp");
const nowUnits = document.getElementById("nowUnits");
const nowDesc = document.getElementById("nowDesc");
const feelsLike = document.getElementById("feelsLike");
const humidity = document.getElementById("humidity");
const wind = document.getElementById("wind");

const sunriseEl = document.getElementById("sunrise");
const sunsetEl = document.getElementById("sunset");
const visibilityEl = document.getElementById("visibility");
const pressureEl = document.getElementById("pressure");

const forecastEl = document.getElementById("forecast");
const tipsNowEl = document.getElementById("tipsNow");
const bestTimeEl = document.getElementById("bestTime");
const activitiesEl = document.getElementById("activities");
const favoritesEl = document.getElementById("favorites");
const errorsEl = document.getElementById("errors");

// ---------- State ----------
let units = loadUnits();          // "metric" or "imperial"
let lastSelected = null;          // { name, country, state, lat, lon }
let autocompleteTimer = null;

init();

// ---------- Init ----------
function init() {
  setUnitsUI();
  renderFavorites();

  // Default load: favorite or Colombo
  const favs = loadFavorites();
  if (favs.length) {
    fetchByLatLon(favs[0].lat, favs[0].lon, favs[0]);
  } else {
    fetchByLatLon(6.9271, 79.8612, { name: "Colombo", country: "LK", lat: 6.9271, lon: 79.8612 });
  }

  // Search actions
  searchBtn.addEventListener("click", onSearch);
  cityInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") onSearch();
  });

  // Autocomplete
  cityInput.addEventListener("input", onAutocompleteInput);
  document.addEventListener("click", (e) => {
    if (!autocomplete.contains(e.target) && e.target !== cityInput) hideAutocomplete();
  });

  // Units toggle
  unitsBtn.addEventListener("click", () => {
    units = (units === "metric") ? "imperial" : "metric";
    saveUnits(units);
    setUnitsUI();
    if (lastSelected) fetchByLatLon(lastSelected.lat, lastSelected.lon, lastSelected);
  });

  // Location
  useLocationBtn.addEventListener("click", () => {
    if (!navigator.geolocation) return showError("Geolocation not supported.");
    navigator.geolocation.getCurrentPosition(
      (pos) => fetchByLatLon(pos.coords.latitude, pos.coords.longitude, {
        name: "Your location",
        country: "",
        lat: pos.coords.latitude,
        lon: pos.coords.longitude
      }),
      (err) => showError("Location denied or unavailable. Search a city instead.")
    );
  });
}

// ---------- API helper (shows real errors) ----------
async function apiFetch(url) {
  const res = await fetch(url);
  const text = await res.text();
  if (!res.ok) {
    // OpenWeather returns JSON text with message
    throw new Error(`HTTP ${res.status}: ${text}`);
  }
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function requireKey() {
  if (!OWM_API_KEY || OWM_API_KEY.includes("PASTE")) {
    throw new Error("Missing API key. Add your OpenWeatherMap key in script.js (OWM_API_KEY).");
  }
}

// ---------- Autocomplete ----------
async function onAutocompleteInput() {
  const q = cityInput.value.trim();
  lastSelected = null;

  if (autocompleteTimer) clearTimeout(autocompleteTimer);
  if (q.length < 2) return hideAutocomplete();

  autocompleteTimer = setTimeout(async () => {
    try {
      const results = await geoAutocomplete(q);
      renderAutocomplete(results);
    } catch (e) {
      // don't spam UI
      hideAutocomplete();
    }
  }, 250);
}

function renderAutocomplete(items) {
  if (!items || items.length === 0) return hideAutocomplete();

  autocomplete.innerHTML = "";
  items.slice(0, 7).forEach((c) => {
    const div = document.createElement("div");
    div.className = "suggestion";

    const left = document.createElement("div");
    left.textContent = `${c.name}${c.state ? ", " + c.state : ""}`;

    const right = document.createElement("small");
    right.textContent = c.country || "";

    div.appendChild(left);
    div.appendChild(right);

    div.addEventListener("click", () => {
      lastSelected = c;
      cityInput.value = `${c.name}${c.state ? ", " + c.state : ""}${c.country ? ", " + c.country : ""}`;
      hideAutocomplete();
      fetchByLatLon(c.lat, c.lon, c);
    });

    autocomplete.appendChild(div);
  });

  autocomplete.classList.remove("hidden");
}

function hideAutocomplete() {
  autocomplete.classList.add("hidden");
  autocomplete.innerHTML = "";
}

// ---------- Search ----------
async function onSearch() {
  const q = cityInput.value.trim();
  if (!q) return;

  try {
    clearError();

    if (lastSelected) {
      await fetchByLatLon(lastSelected.lat, lastSelected.lon, lastSelected);
      return;
    }

    const results = await geoAutocomplete(q);
    if (!results.length) {
      showError("No city found. Try 'Colombo, LK' or 'Paris, FR'.");
      return;
    }

    const pick = results[0];
    lastSelected = pick;
    await fetchByLatLon(pick.lat, pick.lon, pick);

  } catch (e) {
    showError(String(e.message || e));
    console.error(e);
  }
}

// ---------- OpenWeather endpoints ----------
async function geoAutocomplete(query) {
  requireKey();
  const url = new URL("https://api.openweathermap.org/geo/1.0/direct");
  url.searchParams.set("q", query);
  url.searchParams.set("limit", "7");
  url.searchParams.set("appid", OWM_API_KEY);

  const data = await apiFetch(url);
  return (data || []).map((d) => ({
    name: d.name,
    state: d.state || "",
    country: d.country || "",
    lat: d.lat,
    lon: d.lon
  }));
}

async function fetchCurrent(lat, lon) {
  const url = new URL("https://api.openweathermap.org/data/2.5/weather");
  url.searchParams.set("lat", lat);
  url.searchParams.set("lon", lon);
  url.searchParams.set("appid", OWM_API_KEY);
  url.searchParams.set("units", units);
  return apiFetch(url);
}

async function fetchForecast(lat, lon) {
  const url = new URL("https://api.openweathermap.org/data/2.5/forecast");
  url.searchParams.set("lat", lat);
  url.searchParams.set("lon", lon);
  url.searchParams.set("appid", OWM_API_KEY);
  url.searchParams.set("units", units);
  return apiFetch(url);
}

// ---------- Load & Render ----------
async function fetchByLatLon(lat, lon, placeHint) {
  try {
    requireKey();
    clearError();

    const [current, forecast] = await Promise.all([
      fetchCurrent(lat, lon),
      fetchForecast(lat, lon)
    ]);

    const place = {
      name: placeHint?.name || current.name,
      country: placeHint?.country || current.sys?.country || "",
      state: placeHint?.state || "",
      lat, lon
    };
    lastSelected = place;

    renderCurrent(current, place);
    const daily = aggregateForecastToDays(forecast);
    renderForecast(daily);
    renderTravelInsights(current, daily);
    renderFavorites();

  } catch (e) {
    // ✅ show real error in Notes
    showError(String(e.message || e));
    console.error(e);
  }
}

function renderCurrent(current, place) {
  const w = current.weather?.[0] || { main: "—", description: "—" };
  const temp = round(current.main?.temp);
  const feels = round(current.main?.feels_like);
  const hum = current.main?.humidity;
  const windVal = current.wind?.speed;
  const vis = current.visibility;
  const pres = current.main?.pressure;

  placeName.textContent = `${place.name}${place.country ? ", " + place.country : ""}`;
  placeMeta.textContent = `${formatLocalDateTime(current.dt, current.timezone)} • ${capitalize(w.description)}`;

  nowTemp.textContent = temp ?? "—";
  nowUnits.textContent = units === "metric" ? "°C" : "°F";
  nowDesc.textContent = capitalize(w.description);

  feelsLike.textContent = `Feels like ${feels ?? "—"}${units === "metric" ? "°C" : "°F"}`;
  humidity.textContent = `Humidity ${hum ?? "—"}%`;
  wind.textContent = `Wind ${formatWind(windVal)}`;

  sunriseEl.textContent = current.sys?.sunrise ? formatLocalTime(current.sys.sunrise, current.timezone) : "—";
  sunsetEl.textContent = current.sys?.sunset ? formatLocalTime(current.sys.sunset, current.timezone) : "—";
  visibilityEl.textContent = (typeof vis === "number") ? `${(vis / 1000).toFixed(1)} km` : "—";
  pressureEl.textContent = pres ? `${pres} hPa` : "—";

  const night = isNight(current.dt, current.sys?.sunrise, current.sys?.sunset);
  nowIcon.innerHTML = renderAnimatedIcon(w.main, night);
  setThemeFromWeather(w.main, night);
}

function renderForecast(days) {
  forecastEl.innerHTML = "";
  if (!days.length) return;

  for (const d of days) {
    const rep = d.rep;
    const w = rep.weather?.[0] || { main: "—", description: "—" };
    const popPct = Math.round((d.pop || 0) * 100);

    const card = document.createElement("div");
    card.className = "dayCard";

    card.innerHTML = `
      <div class="dayTop">
        <div class="dayName">${formatDayLabel(d.dateKey)}</div>
        <div class="dayIcon">${renderMiniIcon(w.main)}</div>
      </div>
      <div class="dayTemps">
        <span>Min ${round(d.min)}${units === "metric" ? "°C" : "°F"}</span>
        <span>Max ${round(d.max)}${units === "metric" ? "°C" : "°F"}</span>
      </div>
      <div class="dayDesc">${capitalize(w.description || w.main)} • Rain chance ${popPct}%</div>
    `;

    forecastEl.appendChild(card);
  }
}

// ---------- Forecast aggregation ----------
function aggregateForecastToDays(forecastJson) {
  const list = forecastJson?.list || [];
  if (!list.length) return [];

  const byDate = new Map();

  for (const item of list) {
    const dateKey = new Date(item.dt * 1000).toISOString().slice(0, 10);
    if (!byDate.has(dateKey)) byDate.set(dateKey, []);
    byDate.get(dateKey).push(item);
  }

  const days = [];
  for (const [dateKey, items] of byDate.entries()) {
    let min = Infinity, max = -Infinity;
    let best = null;
    let noonDiff = Infinity;
    let popMax = 0;

    for (const it of items) {
      const t = it.main?.temp;
      if (typeof t === "number") {
        min = Math.min(min, t);
        max = Math.max(max, t);
      }

      const hour = new Date(it.dt * 1000).getHours();
      const diff = Math.abs(hour - 12);
      if (diff < noonDiff) {
        noonDiff = diff;
        best = it;
      }

      if (typeof it.pop === "number") popMax = Math.max(popMax, it.pop);
    }

    if (!best) best = items[Math.floor(items.length / 2)];

    days.push({ dateKey, min, max, pop: popMax, rep: best });
  }

  days.sort((a, b) => a.dateKey.localeCompare(b.dateKey));
  return days.slice(0, 5);
}

// ---------- Travel Insights ----------
function renderTravelInsights(current, days) {
  const w = current.weather?.[0] || { main: "—", description: "—" };
  const temp = current.main?.temp;
  const hum = current.main?.humidity;
  const windVal = current.wind?.speed;
  const popToday = days?.[0]?.pop ?? 0;

  // Tips
  const tips = buildTravelTips({
    condition: w.main,
    temp,
    humidity: hum,
    wind: windVal,
    pop: popToday
  });

  tipsNowEl.innerHTML = "";
  tips.forEach(t => {
    const li = document.createElement("li");
    li.textContent = t;
    tipsNowEl.appendChild(li);
  });

  // Activities
  const acts = suggestActivities(w.main, temp, popToday);
  activitiesEl.innerHTML = "";
  acts.forEach(a => {
    const pill = document.createElement("div");
    pill.className = "pill";
    pill.textContent = a;
    activitiesEl.appendChild(pill);
  });

  // Best day
  bestTimeEl.textContent = computeBestVisitWindow(days);
}

function buildTravelTips({ condition, temp, humidity, wind, pop }) {
  const tips = [];
  const c = (condition || "").toLowerCase();
  const t = (typeof temp === "number") ? temp : null;

  const windy = (typeof wind === "number") && wind > (units === "metric" ? 8 : 18);
  const rainyChance = pop >= 0.35;

  const comfortable = units === "metric"
    ? (t !== null && t >= 18 && t <= 28)
    : (t !== null && t >= 64 && t <= 82);

  if (comfortable) tips.push("Comfortable weather for walking tours, markets, and city exploration.");
  if (t !== null) {
    if (units === "metric" ? t >= 32 : t >= 90) tips.push("High heat: drink water, use sunscreen, plan outdoors morning/evening.");
    if (units === "metric" ? t <= 12 : t <= 54) tips.push("Chilly: pack a light jacket, evenings may feel cooler.");
  }

  if (humidity !== null && humidity >= 80) tips.push("High humidity: wear breathable clothing and take shaded breaks.");
  if (windy) tips.push("Windy: a windbreaker helps; good time for coastal viewpoints (expect chill).");

  if (c.includes("rain") || c.includes("drizzle") || rainyChance) tips.push("Bring an umbrella/rain jacket; plan indoor backups (museums/cafés).");
  if (c.includes("snow")) tips.push("Snow: waterproof shoes + check transport conditions.");
  if (c.includes("thunder")) tips.push("Thunderstorms: avoid exposed areas, postpone hikes/boat trips.");
  if (c.includes("mist") || c.includes("fog") || c.includes("haze")) tips.push("Low visibility: take care when driving; great for cozy city spots.");

  tips.push("Save this city as a favorite to track it over the week.");
  return tips.slice(0, 6);
}

function suggestActivities(condition, temp, pop) {
  const c = (condition || "").toLowerCase();
  const t = (typeof temp === "number") ? temp : null;

  const likelyWet = pop >= 0.35 || c.includes("rain") || c.includes("drizzle") || c.includes("thunder");
  const comfyOutdoor = (units === "metric")
    ? (t !== null && t >= 18 && t <= 30)
    : (t !== null && t >= 64 && t <= 86);

  const list = [];

  if (likelyWet) {
    list.push("Museums & galleries", "Cafés & food tour", "Covered markets", "Shopping streets");
  } else if (c.includes("snow") || (units === "metric" ? (t !== null && t <= 2) : (t !== null && t <= 35))) {
    list.push("Scenic neighborhoods", "Indoor viewpoints", "Spa / relaxation", "Warm cafés");
  } else if (comfyOutdoor) {
    list.push("Walking tour", "Parks & gardens", "Beach / waterfront", "Sunset viewpoint", "Outdoor markets");
  } else if (t !== null && (units === "metric" ? t >= 31 : t >= 88)) {
    list.push("Early sightseeing", "Water activities", "Indoor midday", "Evening street food");
  } else {
    list.push("City exploration", "Photography walk", "Local culture spots", "Short hike");
  }

  return [...new Set(list)].slice(0, 8);
}

function computeBestVisitWindow(days) {
  if (!days || !days.length) return "—";

  let bestIdx = 0;
  let bestScore = -Infinity;

  for (let i = 0; i < days.length; i++) {
    const d = days[i];
    const rep = d.rep;
    const pop = d.pop || 0;
    const main = (rep.weather?.[0]?.main || "").toLowerCase();
    const t = rep.main?.temp;

    const tempScore = tempComfortScore(t);
    const rainPenalty = pop * 2.2;
    const stormPenalty = main.includes("thunder") ? 2.0 : 0;

    const score = tempScore - rainPenalty - stormPenalty;

    if (score > bestScore) {
      bestScore = score;
      bestIdx = i;
    }
  }

  const bestDay = days[bestIdx];
  const rep = bestDay.rep;
  const main = rep.weather?.[0]?.main || "Weather";
  const popPct = Math.round((bestDay.pop || 0) * 100);

  return `${formatDayLabel(bestDay.dateKey)} looks best: ${main}, ${round(rep.main?.temp)}${units === "metric" ? "°C" : "°F"}, ~${popPct}% rain chance.`;
}

function tempComfortScore(t) {
  if (typeof t !== "number") return 0.5;
  const ideal = (units === "metric") ? 24 : 75;
  const dist = Math.abs(t - ideal);
  return Math.max(-2, 2 - (dist / (units === "metric" ? 6 : 12)));
}

// ---------- Favorites ----------
function loadFavorites() {
  try { return JSON.parse(localStorage.getItem("wx_favorites") || "[]"); }
  catch { return []; }
}
function saveFavorites(favs) {
  localStorage.setItem("wx_favorites", JSON.stringify(favs));
}

function renderFavorites() {
  const favs = loadFavorites();
  favoritesEl.innerHTML = "";

  if (lastSelected?.lat && lastSelected?.lon) {
    const saveChip = document.createElement("div");
    saveChip.className = "chip";
    saveChip.textContent = "⭐ Save current";
    saveChip.addEventListener("click", () => addFavorite(lastSelected));
    favoritesEl.appendChild(saveChip);
  }

  favs.forEach((f) => {
    const chip = document.createElement("div");
    chip.className = "chip";

    const label = document.createElement("span");
    label.textContent = `${f.name}${f.country ? ", " + f.country : ""}`;
    chip.appendChild(label);

    const x = document.createElement("span");
    x.className = "x";
    x.textContent = "×";
    x.title = "Remove";
    x.addEventListener("click", (e) => {
      e.stopPropagation();
      removeFavorite(f);
    });
    chip.appendChild(x);

    chip.addEventListener("click", () => fetchByLatLon(f.lat, f.lon, f));
    favoritesEl.appendChild(chip);
  });
}

function addFavorite(place) {
  const favs = loadFavorites();
  const key = `${place.lat.toFixed(4)},${place.lon.toFixed(4)}`;
  if (favs.some(f => `${f.lat.toFixed(4)},${f.lon.toFixed(4)}` === key)) {
    showError("Already in favorites.");
    return;
  }
  favs.unshift({
    name: place.name,
    country: place.country || "",
    state: place.state || "",
    lat: place.lat,
    lon: place.lon
  });
  saveFavorites(favs.slice(0, 12));
  renderFavorites();
}

function removeFavorite(place) {
  const favs = loadFavorites().filter(f => !(nearlyEqual(f.lat, place.lat) && nearlyEqual(f.lon, place.lon)));
  saveFavorites(favs);
  renderFavorites();
}

function nearlyEqual(a, b) {
  return Math.abs(a - b) < 0.0001;
}

// ---------- Units ----------
function loadUnits() {
  return localStorage.getItem("wx_units") || "metric";
}
function saveUnits(u) {
  localStorage.setItem("wx_units", u);
}
function setUnitsUI() {
  unitsBtn.textContent = (units === "metric") ? "°C" : "°F";
  nowUnits.textContent = (units === "metric") ? "°C" : "°F";
}

// ---------- Theme + Icons ----------
function setThemeFromWeather(main, night) {
  const m = (main || "").toLowerCase();
  let theme = "clouds";

  if (m.includes("clear")) theme = night ? "clear-night" : "clear-day";
  else if (m.includes("cloud")) theme = "clouds";
  else if (m.includes("rain") || m.includes("drizzle")) theme = "rain";
  else if (m.includes("snow")) theme = "snow";
  else if (m.includes("thunder")) theme = "storm";
  else if (m.includes("mist") || m.includes("fog") || m.includes("haze") || m.includes("smoke")) theme = "mist";

  document.body.setAttribute("data-theme", theme);
}

function renderAnimatedIcon(main, night) {
  const m = (main || "").toLowerCase();

  if (m.includes("clear")) {
    return `<div class="icon">${night ? `<div class="sun" style="background: rgba(200,210,255,.95)"></div>` : `<div class="sun"></div>`}</div>`;
  }
  if (m.includes("cloud")) {
    return `<div class="icon"><div class="cloud"></div></div>`;
  }
  if (m.includes("rain") || m.includes("drizzle")) {
    return `<div class="icon">
      <div class="cloud"></div>
      <div class="rainDrop"></div><div class="rainDrop"></div><div class="rainDrop"></div>
    </div>`;
  }
  if (m.includes("snow")) {
    return `<div class="icon">
      <div class="cloud"></div>
      <div class="snowFlake"></div><div class="snowFlake"></div><div class="snowFlake"></div>
    </div>`;
  }
  if (m.includes("thunder")) {
    return `<div class="icon">
      <div class="cloud"></div>
      <div class="bolt"></div>
    </div>`;
  }
  if (m.includes("mist") || m.includes("fog") || m.includes("haze") || m.includes("smoke")) {
    return `<div class="icon">
      <div class="cloud" style="opacity:.65"></div>
      <div class="cloud" style="top:28px; left:10px; opacity:.35"></div>
    </div>`;
  }
  return `<div class="icon"><div class="cloud"></div></div>`;
}

function renderMiniIcon(main) {
  const m = (main || "").toLowerCase();
  if (m.includes("clear")) return "☀️";
  if (m.includes("cloud")) return "☁️";
  if (m.includes("rain") || m.includes("drizzle")) return "🌧️";
  if (m.includes("snow")) return "❄️";
  if (m.includes("thunder")) return "⛈️";
  if (m.includes("mist") || m.includes("fog") || m.includes("haze")) return "🌫️";
  return "🌡️";
}

// ---------- Helpers ----------
function showError(msg) {
  errorsEl.textContent = msg;
}
function clearError() {
  errorsEl.textContent = "";
}

function round(n) {
  return (typeof n === "number") ? Math.round(n) : null;
}

function formatWind(speed) {
  if (typeof speed !== "number") return "—";
  return units === "metric" ? `${speed.toFixed(1)} m/s` : `${speed.toFixed(1)} mph`;
}

function capitalize(s) {
  if (!s) return "—";
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function formatDayLabel(dateKey) {
  const d = new Date(dateKey + "T00:00:00");
  return d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
}

function formatLocalTime(unixSeconds, timezoneShiftSeconds) {
  const d = new Date((unixSeconds + timezoneShiftSeconds) * 1000);
  return d.toUTCString().slice(17, 22); // HH:MM
}

function formatLocalDateTime(unixSeconds, timezoneShiftSeconds) {
  const d = new Date((unixSeconds + timezoneShiftSeconds) * 1000);
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  const hh = String(d.getUTCHours()).padStart(2, "0");
  const mi = String(d.getUTCMinutes()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd} ${hh}:${mi}`;
}

function isNight(nowDt, sunrise, sunset) {
  if (!nowDt || !sunrise || !sunset) return false;
  return (nowDt < sunrise || nowDt > sunset);
}
