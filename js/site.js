const OFFERINGS = {
  lesson: {
    label: "Lesson",
    minutes: 45,
    days: {
      2: ["16:00", "17:00", "18:00", "19:30"],
      4: ["16:00", "17:00", "18:00", "19:30"],
      6: ["10:00", "11:30", "13:00"]
    }
  },
  consult: {
    label: "Consultation",
    minutes: 60,
    days: {
      3: ["17:00", "18:30"],
      5: ["12:00", "16:00"]
    }
  }
};

const BOOK_KEY = "openhead-bookings";
const NOTE_KEY = "openhead-notes";

const now = new Date();
const state = {
  offer: "lesson",
  month: new Date(now.getFullYear(), now.getMonth(), 1),
  selectedDate: null,
  selectedTime: null
};

const monthLimit = new Date(now.getFullYear(), now.getMonth() + 4, 1);
const cal = document.getElementById("cal");
const slotsEl = document.getElementById("slots");
const monthLabel = document.getElementById("month-label");
const prevBtn = document.getElementById("prev-month");
const nextBtn = document.getElementById("next-month");
const bookForm = document.getElementById("book-form");
const ticket = document.getElementById("ticket");
const prompt = document.getElementById("slot-prompt");
const sessionLabel = document.getElementById("session-label");
const bookError = document.getElementById("book-error");
const holdsWrap = document.getElementById("holds");
const holdsList = document.getElementById("holds-list");
const bookSection = document.getElementById("book");

function load(key) {
  try {
    return JSON.parse(localStorage.getItem(key) || "[]");
  } catch {
    return [];
  }
}
function save(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}
function dateKey(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}
function parseKey(key) {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d);
}
function sameDay(a, b) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}
function slotStamp(date, time) {
  const [h, min] = time.split(":").map(Number);
  const stamp = new Date(date);
  stamp.setHours(h, min, 0, 0);
  return stamp;
}
function formatDay(date) {
  return new Intl.DateTimeFormat("en-GB", { weekday: "long", day: "numeric", month: "long" }).format(date);
}
function formatTime(time) {
  const [h, min] = time.split(":").map(Number);
  const stamp = new Date(2000, 0, 1, h, min);
  return new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit" }).format(stamp);
}
function addMinutes(time, minutes) {
  const [h, min] = time.split(":").map(Number);
  const stamp = new Date(2000, 0, 1, h, min + minutes);
  return `${String(stamp.getHours()).padStart(2, "0")}:${String(stamp.getMinutes()).padStart(2, "0")}`;
}
function seededTaken(key, time, type) {
  const seed = `${key}|${time}|${type}`;
  let n = 0;
  for (let i = 0; i < seed.length; i += 1) n = (n + seed.charCodeAt(i) * (i + 3)) % 97;
  return n % 5 === 0;
}
function bookings() {
  return load(BOOK_KEY);
}
function isHeld(key, time, type) {
  return bookings().some((item) => item.date === key && item.time === time && item.type === type);
}
function slotsFor(date, type) {
  const times = OFFERINGS[type].days[date.getDay()] || [];
  const key = dateKey(date);
  const slots = times.map((time) => {
    const past = slotStamp(date, time) < new Date();
    const held = isHeld(key, time, type);
    const taken = held || seededTaken(key, time, type);
    return { time, past, held, taken: past || taken };
  });
  const future = slots.filter((slot) => !slot.past);
  if (future.length && future.every((slot) => slot.taken)) {
    const last = [...slots].reverse().find((slot) => !slot.past && !slot.held);
    if (last) last.taken = false;
  }
  return slots;
}
function refOf(id) {
  return `OH-${id.replace(/-/g, "").slice(0, 4).toUpperCase()}`;
}
function rangeLabel(time, type) {
  return `${formatTime(time)}–${formatTime(addMinutes(time, OFFERINGS[type].minutes))}`;
}

function render() {
  bookSection.dataset.mode = state.offer;
  document.querySelectorAll(".toggle [data-offer]").forEach((button) => {
    button.setAttribute("aria-pressed", String(button.dataset.offer === state.offer));
  });
  renderMonth();
  renderSlots();
  renderForm();
  renderHolds();
}

function renderMonth() {
  const year = state.month.getFullYear();
  const month = state.month.getMonth();
  monthLabel.textContent = new Intl.DateTimeFormat("en-GB", { month: "long", year: "numeric" }).format(state.month);
  prevBtn.disabled = state.month <= new Date(now.getFullYear(), now.getMonth(), 1);
  nextBtn.disabled = state.month >= monthLimit;

  const first = new Date(year, month, 1);
  const offset = (first.getDay() + 6) % 7;
  const start = new Date(year, month, 1 - offset);
  cal.replaceChildren();

  for (let i = 0; i < 42; i += 1) {
    const date = new Date(start);
    date.setDate(start.getDate() + i);
    const inMonth = date.getMonth() === month;
    const button = document.createElement("button");
    button.type = "button";
    button.className = "day";
    button.setAttribute("role", "gridcell");
    const key = dateKey(date);
    const slots = inMonth ? slotsFor(date, state.offer) : [];
    const open = slots.filter((slot) => !slot.taken);
    const num = document.createElement("span");
    num.className = "num";
    num.textContent = String(date.getDate());
    button.append(num);

    if (!inMonth) {
      button.classList.add("pad");
      button.disabled = true;
      button.tabIndex = -1;
      button.setAttribute("aria-hidden", "true");
    } else if (!slots.length) {
      button.classList.add("shut");
      button.disabled = true;
      button.setAttribute("aria-label", `${formatDay(date)}, closed`);
    } else if (!open.length) {
      button.classList.add("full");
      button.disabled = true;
      button.setAttribute("aria-label", `${formatDay(date)}, full`);
      const count = document.createElement("span");
      count.className = "count";
      count.textContent = "Full";
      button.append(count);
    } else {
      button.classList.add("open");
      button.dataset.date = key;
      button.setAttribute("aria-label", `${formatDay(date)}, ${open.length} open`);
      button.setAttribute("aria-pressed", String(state.selectedDate === key));
      if (state.selectedDate === key) button.classList.add("selected");
      const count = document.createElement("span");
      count.className = "count";
      count.textContent = `${open.length} open`;
      button.append(count);
    }
    if (sameDay(date, now)) button.classList.add("today");
    cal.append(button);
  }
}

function renderSlots() {
  slotsEl.replaceChildren();
  ticket.hidden = true;
  if (!state.selectedDate) {
    prompt.hidden = false;
    prompt.textContent = "Select an open day.";
    bookForm.hidden = true;
    return;
  }
  const date = parseKey(state.selectedDate);
  const slots = slotsFor(date, state.offer);
  prompt.hidden = false;
  prompt.textContent = formatDay(date);
  slots.forEach((slot) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "slot";
    button.setAttribute("role", "listitem");
    const label = document.createElement("span");
    label.textContent = rangeLabel(slot.time, state.offer);
    const meta = document.createElement("small");
    if (slot.past) meta.textContent = "Passed";
    else if (slot.held) meta.textContent = "Held";
    else if (slot.taken) meta.textContent = "Taken";
    else meta.textContent = "Open";
    button.append(label, meta);
    if (slot.taken) {
      button.disabled = true;
    } else {
      button.classList.add("open");
      button.dataset.time = slot.time;
      if (state.selectedTime === slot.time) button.classList.add("selected");
    }
    slotsEl.append(button);
  });
}

function renderForm() {
  const valid = state.selectedDate && state.selectedTime;
  bookForm.hidden = !valid;
  if (!valid) return;
  const date = parseKey(state.selectedDate);
  const offer = OFFERINGS[state.offer];
  sessionLabel.textContent = `${offer.label} · ${formatDay(date)} · ${rangeLabel(state.selectedTime, state.offer)}`;
}

function renderHolds() {
  const items = bookings().sort((a, b) => `${a.date}${a.time}`.localeCompare(`${b.date}${b.time}`));
  holdsWrap.hidden = items.length === 0;
  holdsList.replaceChildren();
  items.forEach((item) => {
    const li = document.createElement("li");
    li.className = "hold";
    const text = document.createElement("span");
    const date = parseKey(item.date);
    text.textContent = `${item.name} · ${OFFERINGS[item.type].label} · ${formatDay(date)} · ${rangeLabel(item.time, item.type)} · ${refOf(item.id)}`;
    const release = document.createElement("button");
    release.type = "button";
    release.textContent = "Release";
    release.dataset.release = item.id;
    li.append(text, release);
    holdsList.append(li);
  });
}

function setOffer(offer) {
  if (!OFFERINGS[offer] || offer === state.offer) return;
  state.offer = offer;
  state.selectedDate = null;
  state.selectedTime = null;
  bookError.textContent = "";
  render();
}

function clearFieldErrors(form) {
  form.querySelectorAll(".field.error").forEach((field) => field.classList.remove("error"));
  form.querySelectorAll("[aria-invalid]").forEach((input) => input.removeAttribute("aria-invalid"));
}

function markInvalid(input) {
  input.setAttribute("aria-invalid", "true");
  input.closest(".field")?.classList.add("error");
}

function validEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

if (bookSection) {
cal.addEventListener("click", (event) => {
  const button = event.target.closest("[data-date]");
  if (!button) return;
  state.selectedDate = button.dataset.date;
  state.selectedTime = null;
  bookError.textContent = "";
  render();
});

slotsEl.addEventListener("click", (event) => {
  const button = event.target.closest("[data-time]");
  if (!button) return;
  state.selectedTime = button.dataset.time;
  bookError.textContent = "";
  render();
  bookForm.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "nearest" });
});

prevBtn.addEventListener("click", () => {
  state.month = new Date(state.month.getFullYear(), state.month.getMonth() - 1, 1);
  state.selectedDate = null;
  state.selectedTime = null;
  render();
});
nextBtn.addEventListener("click", () => {
  state.month = new Date(state.month.getFullYear(), state.month.getMonth() + 1, 1);
  state.selectedDate = null;
  state.selectedTime = null;
  render();
});

document.querySelectorAll("[data-offer]").forEach((control) => {
  control.addEventListener("click", () => setOffer(control.dataset.offer));
});

bookForm.addEventListener("submit", (event) => {
  event.preventDefault();
  clearFieldErrors(bookForm);
  bookError.textContent = "";
  const nameInput = bookForm.elements.namedItem("name");
  const emailInput = bookForm.elements.namedItem("email");
  const name = nameInput.value.trim();
  const email = emailInput.value.trim();
  if (name.length < 2) {
    markInvalid(nameInput);
    bookError.textContent = "Add your name.";
    nameInput.focus();
    return;
  }
  if (!validEmail(email)) {
    markInvalid(emailInput);
    bookError.textContent = "Add a real email so the hold can be confirmed.";
    emailInput.focus();
    return;
  }
  if (!state.selectedDate || !state.selectedTime) return;
  const chosen = slotsFor(parseKey(state.selectedDate), state.offer).find((slot) => slot.time === state.selectedTime);
  if (!chosen || chosen.taken) {
    bookError.textContent = "That slot was just taken. Pick another.";
    state.selectedTime = null;
    render();
    return;
  }
  const item = {
    id: crypto.randomUUID(),
    type: state.offer,
    date: state.selectedDate,
    time: state.selectedTime,
    name,
    email,
    level: bookForm.elements.namedItem("level").value,
    note: bookForm.elements.namedItem("note").value.trim(),
    created: new Date().toISOString()
  };
  const all = bookings();
  all.push(item);
  save(BOOK_KEY, all);
  bookForm.reset();
  ticket.hidden = false;
  ticket.replaceChildren();
  const kicker = document.createElement("p");
  kicker.className = "kicker";
  kicker.textContent = "Held";
  const title = document.createElement("strong");
  title.textContent = `${OFFERINGS[item.type].label}`;
  const when = document.createElement("p");
  when.textContent = `${formatDay(parseKey(item.date))} · ${rangeLabel(item.time, item.type)}`;
  const who = document.createElement("p");
  who.textContent = `${item.name} · ${item.level}`;
  const ref = document.createElement("p");
  ref.className = "ref";
  ref.textContent = refOf(item.id);
  const fine = document.createElement("p");
  fine.textContent = "Kept on this device. Release it below if the time no longer works.";
  ticket.append(kicker, title, when, who, ref, fine);
  state.selectedTime = null;
  render();
  ticket.hidden = false;
  ticket.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "nearest" });
});

holdsList.addEventListener("click", (event) => {
  const button = event.target.closest("[data-release]");
  if (!button) return;
  save(BOOK_KEY, bookings().filter((item) => item.id !== button.dataset.release));
  render();
});

render();
}

const contactForm = document.getElementById("contact-form");
const contactError = document.getElementById("contact-error");
const contactSuccess = document.getElementById("contact-success");
const contactSuccessCopy = document.getElementById("contact-success-copy");

if (contactForm) {
contactForm.addEventListener("submit", (event) => {
  event.preventDefault();
  clearFieldErrors(contactForm);
  contactError.textContent = "";
  const nameInput = contactForm.elements.namedItem("name");
  const emailInput = contactForm.elements.namedItem("email");
  const messageInput = contactForm.elements.namedItem("message");
  const about = contactForm.elements.namedItem("about").value;
  const name = nameInput.value.trim();
  const email = emailInput.value.trim();
  const message = messageInput.value.trim();
  if (name.length < 2) {
    markInvalid(nameInput);
    contactError.textContent = "Add your name.";
    nameInput.focus();
    return;
  }
  if (!validEmail(email)) {
    markInvalid(emailInput);
    contactError.textContent = "Add a real email.";
    emailInput.focus();
    return;
  }
  if (message.length < 12) {
    markInvalid(messageInput);
    contactError.textContent = "Give the note a little more to work with.";
    messageInput.focus();
    return;
  }
  const notes = load(NOTE_KEY);
  notes.push({
    name,
    email,
    about,
    message,
    created: new Date().toISOString()
  });
  save(NOTE_KEY, notes);
  contactForm.hidden = true;
  contactSuccess.hidden = false;
  contactSuccessCopy.textContent = `${name}, the note about ${about.toLowerCase()} is saved on this browser.`;
});

document.getElementById("contact-reset").addEventListener("click", () => {
  contactForm.reset();
  contactForm.hidden = false;
  contactSuccess.hidden = true;
});
}

const lightbox = document.getElementById("lightbox");
const lightboxImg = document.getElementById("lightbox-img");
const lightboxCaption = document.getElementById("lightbox-caption");

const gallery = document.querySelector(".gallery-grid");
if (lightbox && gallery) {
gallery.addEventListener("click", (event) => {
  const shot = event.target.closest(".shot");
  if (!shot) return;
  lightboxImg.src = shot.dataset.src;
  lightboxImg.alt = shot.querySelector("img").alt;
  lightboxCaption.textContent = shot.dataset.caption;
  lightbox.showModal();
});
document.getElementById("lightbox-close").addEventListener("click", () => lightbox.close());
lightbox.addEventListener("click", (event) => {
  if (event.target === lightbox) lightbox.close();
});
}

const navToggle = document.querySelector(".nav-toggle");
const navPanel = document.getElementById("nav-panel");
navToggle.addEventListener("click", () => {
  const open = navPanel.classList.toggle("open");
  navToggle.setAttribute("aria-expanded", String(open));
  navToggle.textContent = open ? "Close" : "Menu";
});
navPanel.addEventListener("click", (event) => {
  if (event.target.closest("a")) {
    navPanel.classList.remove("open");
    navToggle.setAttribute("aria-expanded", "false");
    navToggle.textContent = "Menu";
  }
});

const sections = [...document.querySelectorAll("main section[id]")];
const navLinks = [...navPanel.querySelectorAll("a")];
if ("IntersectionObserver" in window) {
  const watcher = new IntersectionObserver((entries) => {
    const visible = entries.filter((entry) => entry.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
    if (!visible) return;
    navLinks.forEach((link) => {
      const href = link.getAttribute("href") || "";
      if (!href.startsWith("#")) return;
      const on = href === `#${visible.target.id}`;
      if (on) link.setAttribute("aria-current", "true");
      else link.removeAttribute("aria-current");
    });
  }, { rootMargin: "-40% 0px -50% 0px", threshold: [0.1, 0.3] });
  sections.forEach((section) => watcher.observe(section));
}

const paidReturn = new URL("downloads.html", window.location.href).href;
document.querySelectorAll("form.paypal-buy").forEach((form) => {
  const add = (name, value) => {
    if (form.querySelector(`[name="${name}"]`)) return;
    const input = document.createElement("input");
    input.type = "hidden";
    input.name = name;
    input.value = value;
    form.append(input);
  };
  add("return", paidReturn);
  add("cancel_return", paidReturn);
});
