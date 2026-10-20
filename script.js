"use strict";

/*
  NOIR MINI THEATRE
  Frontend demo using HTML, CSS and localStorage.

  IMPORTANT:
  localStorage is browser-specific.
  This is not a shared database or secure payment system.
*/

const STORAGE_KEY = "noirMiniTheatre_v1";

const CONFIG = {
  theatreName: "NOIR Cinema Club",
  seatCount: 30,
  ticketPrice: 150,
  currency: "INR",

  // Replace with your actual UPI ID later.
  upiId: "",

  movies: [
    {
      id: "movie-1",
      title: "Midnight Dreams",
      genre: "Drama · Romance",
      duration: "2h 10m",
      symbol: "✦",
      artwork: "art-one"
    },
    {
      id: "movie-2",
      title: "The Last Promise",
      genre: "Romance · Drama",
      duration: "1h 55m",
      symbol: "♡",
      artwork: "art-two"
    },
    {
      id: "movie-3",
      title: "Beyond The Stars",
      genre: "Sci-Fi · Adventure",
      duration: "2h 05m",
      symbol: "✧",
      artwork: "art-three"
    }
  ],

  showTimes: [
    { value: "12:00", label: "12:00 PM" },
    { value: "15:00", label: "3:00 PM" },
    { value: "18:00", label: "6:00 PM" },
    { value: "21:00", label: "9:00 PM" }
  ]
};

const $ = (selector) => document.querySelector(selector);

const elements = {
  movieGrid: $("#movieGrid"),
  movieSelect: $("#movieSelect"),
  showDate: $("#showDate"),
  showTime: $("#showTime"),
  seatLayout: $("#seatLayout"),
  selectedSeats: $("#selectedSeats"),
  totalAmount: $("#totalAmount"),
  continueBooking: $("#continueBooking"),

  bookingModal: $("#bookingModal"),
  bookingForm: $("#bookingForm"),
  modalSummary: $("#modalSummary"),

  myBookingsBtn: $("#myBookingsBtn"),
  myBookingsModal: $("#myBookingsModal"),
  myBookingsList: $("#myBookingsList"),

  privateBookingBtn: $("#privateBookingBtn"),
  privateModal: $("#privateModal"),
  privateForm: $("#privateForm"),

  toast: $("#toast"),
  currentYear: $("#currentYear")
};

let selectedSeats = new Set();
let toastTimer;

const memory = {
  data: null
};


/* ---------------------------------
   STORAGE
---------------------------------- */

function createInitialData() {
  return {
    version: 1,

    settings: {
      theatreName: CONFIG.theatreName,
      ticketPrice: CONFIG.ticketPrice,
      upiId: CONFIG.upiId
    },

    movies: CONFIG.movies.map(movie => ({ ...movie })),

    bookings: [],

    privateBookings: [],

    blockedSeats: [],

    // Store only demo data in this browser.
    demoInitialized: true
  };
}

function loadData() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);

    if (!saved) {
      memory.data = createInitialData();
      saveData();
      return memory.data;
    }

    const parsed = JSON.parse(saved);

    if (
      !parsed ||
      typeof parsed !== "object" ||
      !Array.isArray(parsed.movies) ||
      !Array.isArray(parsed.bookings) ||
      !Array.isArray(parsed.privateBookings)
    ) {
      throw new Error("Invalid saved data");
    }

    memory.data = parsed;

    if (!memory.data.settings) {
      memory.data.settings = createInitialData().settings;
    }

    if (!Array.isArray(memory.data.blockedSeats)) {
      memory.data.blockedSeats = [];
    }

    return memory.data;

  } catch (error) {
    console.error("Unable to load saved data:", error);

    memory.data = createInitialData();

    showToast(
      "Saved data could not be read. Check browser storage."
    );

    return memory.data;
  }
}

function saveData() {
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(memory.data)
    );

    return true;

  } catch (error) {
    console.error("Unable to save data:", error);

    showToast(
      "Storage failed. Check browser storage availability."
    );

    return false;
  }
}


/* ---------------------------------
   GENERAL HELPERS
---------------------------------- */

function escapeHTML(value) {
  return String(value ?? "").replace(/[&<>"']/g, char => {
    const replacements = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;"
    };

    return replacements[char];
  });
}

function formatMoney(amount) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: CONFIG.currency,
    maximumFractionDigits: 0
  }).format(amount);
}

function generateId(prefix = "BK") {
  return (
    prefix +
    "-" +
    Date.now().toString(36).toUpperCase() +
    "-" +
    Math.random().toString(36).slice(2, 7).toUpperCase()
  );
}

function todayString() {
  const now = new Date();

  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function formatDate(dateString) {
  if (!dateString) return "Not selected";

  const date = new Date(`${dateString}T12:00:00`);

  if (Number.isNaN(date.getTime())) {
    return dateString;
  }

  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric"
  }).format(date);
}

function showToast(message) {
  if (!elements.toast) return;

  elements.toast.textContent = message;
  elements.toast.classList.add("show");

  clearTimeout(toastTimer);

  toastTimer = setTimeout(() => {
    elements.toast.classList.remove("show");
  }, 3200);
}

function openModal(modal) {
  if (!modal) return;

  modal.hidden = false;
  document.body.style.overflow = "hidden";
}

function closeModal(modal) {
  if (!modal) return;

  modal.hidden = true;

  const anyOpen = document.querySelector(
    ".modal-overlay:not([hidden])"
  );

  if (!anyOpen) {
    document.body.style.overflow = "";
  }
}

function setMinimumDate(input) {
  if (!input) return;

  input.min = todayString();
}

function isValidDate(dateString) {
  return /^\d{4}-\d{2}-\d{2}$/.test(dateString) &&
    dateString >= todayString();
}

function isValidPhone(phone) {
  return /^[6-9]\d{9}$/.test(phone);
}

function getMovie(movieId) {
  return memory.data.movies.find(
    movie => movie.id === movieId
  );
}

function getShowLabel(time) {
  const show = CONFIG.showTimes.find(
    item => item.value === time
  );

  return show ? show.label : time;
}

function getSelectedShow() {
  const movieId = elements.movieSelect.value;
  const date = elements.showDate.value;
  const time = elements.showTime.value;

  if (!movieId || !date || !time) {
    return null;
  }

  return {
    movieId,
    date,
    time
  };
}

function getBookingPrice() {
  const price = Number(memory.data.settings.ticketPrice);

  return Number.isFinite(price) && price >= 0
    ? price
    : CONFIG.ticketPrice;
}


/* ---------------------------------
   MOVIES
---------------------------------- */

function renderMovies() {
  elements.movieGrid.innerHTML = memory.data.movies
    .map((movie, index) => {
      const artwork = [
        "art-one",
        "art-two",
        "art-three"
      ][index % 3];

      const symbol = [
        "✦",
        "♡",
        "✧"
      ][index % 3];

      return `
        <article class="movie-card">

          <div class="movie-art ${artwork}">
            <span class="movie-label">NOW SHOWING</span>
            <span class="movie-symbol">${symbol}</span>
          </div>

          <div class="movie-info">

            <h3>${escapeHTML(movie.title)}</h3>

            <div class="movie-meta">
              <span>${escapeHTML(movie.genre || "Cinema")}</span>
              <span>${escapeHTML(movie.duration || "")}</span>
            </div>

            <button
              class="primary-button full-width"
              type="button"
              data-book-movie="${escapeHTML(movie.id)}"
            >
              Select Movie →
            </button>

          </div>
        </article>
      `;
    })
    .join("");

  elements.movieSelect.innerHTML = `
    <option value="">Choose a movie</option>
    ${memory.data.movies.map(movie => `
      <option value="${escapeHTML(movie.id)}">
        ${escapeHTML(movie.title)}
      </option>
    `).join("")}
  `;
}

elements.movieGrid.addEventListener("click", event => {
  const button = event.target.closest("[data-book-movie]");

  if (!button) return;

  elements.movieSelect.value = button.dataset.bookMovie;

  document.querySelector("#booking").scrollIntoView({
    behavior: "smooth"
  });

  renderSeats();
});


/* ---------------------------------
   SEAT MANAGEMENT
---------------------------------- */

function getAllSeatIds() {
  const seats = [];

  const rows = ["A", "B", "C", "D", "E"];

  for (const row of rows) {
    for (let number = 1; number <= 6; number++) {
      seats.push(`${row}${number}`);
    }
  }

  return seats;
}

function getShowKey(show) {
  return `${show.movieId}|${show.date}|${show.time}`;
}

function getBookedSeatIds(show) {
  if (!show) return new Set();

  const key = getShowKey(show);
  const booked = new Set();

  for (const booking of memory.data.bookings) {
    if (
      booking.showKey !== key ||
      booking.status === "cancelled"
    ) {
      continue;
    }

    // Pending payment requests also reserve seats in this demo.
    if (
      booking.status === "pending" ||
      booking.status === "confirmed"
    ) {
      for (const seat of booking.seats || []) {
        booked.add(seat);
      }
    }
  }

  return booked;
}

function getBlockedSeatIds(show) {
  if (!show) return new Set();

  const key = getShowKey(show);

  return new Set(
    memory.data.blockedSeats
      .filter(item => item.showKey === key)
      .map(item => item.seat)
  );
}

function renderSeats() {
  const show = getSelectedShow();

  const seats = getAllSeatIds();

  const booked = getBookedSeatIds(show);
  const blocked = getBlockedSeatIds(show);

  // Discard selections that are no longer available.
  for (const seat of [...selectedSeats]) {
    if (booked.has(seat) || blocked.has(seat)) {
      selectedSeats.delete(seat);
    }
  }

  elements.seatLayout.innerHTML = seats.map(seat => {
    const isBooked = booked.has(seat);
    const isBlocked = blocked.has(seat);

    const isSelected = selectedSeats.has(seat);

    const disabled =
      !show ||
      isBooked ||
      isBlocked;

    let className = "seat";

    if (isBooked || isBlocked) {
      className += " booked";
    } else if (isSelected) {
      className += " selected";
    }

    const title = isBooked
      ? "Already reserved"
      : isBlocked
        ? "Unavailable"
        : !show
          ? "Select movie, date and show first"
          : `Select seat ${seat}`;

    return `
      <button
        type="button"
        class="${className}"
        data-seat="${seat}"
        aria-label="${title}: ${seat}"
        aria-pressed="${isSelected}"
        title="${title}"
        ${disabled ? "disabled" : ""}
      >
        ${seat}
      </button>
    `;
  }).join("");

  updateBookingSummary();
}

function updateBookingSummary() {
  const selected = [...selectedSeats];

  elements.selectedSeats.textContent =
    selected.length
      ? selected.join(", ")
      : "None";

  elements.totalAmount.textContent =
    formatMoney(selected.length * getBookingPrice());

  elements.continueBooking.disabled =
    selected.length === 0 ||
    !getSelectedShow();

  elements.continueBooking.style.opacity =
    elements.continueBooking.disabled ? ".5" : "1";
}

elements.seatLayout.addEventListener("click", event => {
  const button = event.target.closest("[data-seat]");

  if (!button || button.disabled) return;

  const show = getSelectedShow();

  if (!show) {
    showToast("Please select a movie, date and show.");
    return;
  }

  const seat = button.dataset.seat;

  if (selectedSeats.has(seat)) {
    selectedSeats.delete(seat);
  } else {
    selectedSeats.add(seat);
  }

  renderSeats();
});

elements.movieSelect.addEventListener("change", () => {
  selectedSeats.clear();
  renderSeats();
});

elements.showDate.addEventListener("change", () => {
  selectedSeats.clear();
  renderSeats();
});

elements.showTime.addEventListener("change", () => {
  selectedSeats.clear();
  renderSeats();
});


/* ---------------------------------
   PUBLIC BOOKING
---------------------------------- */

function validateShow(show) {
  if (!show) {
    showToast("Select a movie, date and show timing.");
    return false;
  }

  if (!isValidDate(show.date)) {
    showToast("Please select today or a future date.");
    return false;
  }

  return true;
}

function openPublicBooking() {
  const show = getSelectedShow();

  if (!validateShow(show)) return;

  if (selectedSeats.size === 0) {
    showToast("Please select at least one seat.");
    return;
  }

  const booked = getBookedSeatIds(show);
  const blocked = getBlockedSeatIds(show);

  for (const seat of selectedSeats) {
    if (booked.has(seat) || blocked.has(seat)) {
      showToast(`${seat} is no longer available.`);
      renderSeats();
      return;
    }
  }

  const movie = getMovie(show.movieId);

  if (!movie) {
    showToast("Please select a valid movie.");
    return;
  }

  elements.modalSummary.innerHTML = `
    <strong>${escapeHTML(movie.title)}</strong><br>
    Date: ${escapeHTML(formatDate(show.date))}<br>
    Time: ${escapeHTML(getShowLabel(show.time))}<br>
    Seats: ${escapeHTML([...selectedSeats].join(", "))}<br>
    Total: <strong>${escapeHTML(
      formatMoney(selectedSeats.size * getBookingPrice())
    )}</strong>
  `;

  openModal(elements.bookingModal);
}

elements.continueBooking.addEventListener(
  "click",
  openPublicBooking
);

elements.bookingForm.addEventListener("submit", event => {
  event.preventDefault();

  const name = $("#customerName").value.trim();
  const phone = $("#customerPhone").value.trim();

  const show = getSelectedShow();

  if (!name || name.length > 100) {
    showToast("Enter a valid name.");
    return;
  }

  if (!isValidPhone(phone)) {
    showToast("Enter a valid 10-digit Indian mobile number.");
    return;
  }

  if (!validateShow(show)) return;

  if (!selectedSeats.size) {
    showToast("Please select your seats again.");
    closeModal(elements.bookingModal);
    renderSeats();
    return;
  }

  /*
    Recheck availability immediately before creating the request.
    This protects against stale data in this browser only.
    It does NOT provide cross-device concurrency protection.
  */

  const booked = getBookedSeatIds(show);
  const blocked = getBlockedSeatIds(show);

  for (const seat of selectedSeats) {
    if (booked.has(seat) || blocked.has(seat)) {
      showToast(
        `${seat} is no longer available. Please choose again.`
      );

      selectedSeats.delete(seat);

      closeModal(elements.bookingModal);
      renderSeats();

      return;
    }
  }

  const seats = [...selectedSeats].sort();

  const booking = {
    id: generateId("BK"),
    type: "public",

    customerName: name,
    phone,

    movieId: show.movieId,
    movieTitle: getMovie(show.movieId)?.title || "",

    date: show.date,
    time: show.time,
    showKey: getShowKey(show),

    seats,
    amount: seats.length * getBookingPrice(),

    paymentMethod: "upi_or_cash",
    paymentStatus: "unpaid",

    status: "pending",

    createdAt: new Date().toISOString()
  };

  memory.data.bookings.push(booking);

  if (!saveData()) {
    memory.data.bookings.pop();

    showToast("Could not save booking. Try again.");
    return;
  }

  selectedSeats.clear();

  elements.bookingForm.reset();

  closeModal(elements.bookingModal);

  renderSeats();

  showToast("Booking request saved on this device.");

  showBookingDetails(booking);
});


/* ---------------------------------
   BOOKING DETAILS
---------------------------------- */

function showBookingDetails(booking) {
  const paymentInstructions = `
    <div class="booking-record">

      <strong>Booking ID: ${escapeHTML(booking.id)}</strong>

      <p>
        Status: ${escapeHTML(booking.status.toUpperCase())}
      </p>

      <p>
        Payment: ${escapeHTML(booking.paymentStatus)}
      </p>

      <p>
        Amount: ${escapeHTML(formatMoney(booking.amount))}
      </p>

      <p>
        This is a local demo reservation.
        Payment has not been verified.
      </p>

    </div>
  `;

  elements.myBookingsList.innerHTML = paymentInstructions;

  openModal(elements.myBookingsModal);
}


/* ---------------------------------
   MY BOOKINGS
---------------------------------- */

function renderMyBookings() {
  if (!memory.data.bookings.length &&
      !memory.data.privateBookings.length) {
    elements.myBookingsList.innerHTML = `
      <p class="small-note">
        No bookings found in this browser yet.
      </p>
    `;

    return;
  }

  const publicHTML = memory.data.bookings
    .slice()
    .reverse()
    .map(booking => `
      <article class="booking-record">

        <strong>${escapeHTML(booking.id)}</strong>

        <p>${escapeHTML(booking.customerName)}</p>

        <p>
          ${escapeHTML(booking.movieTitle || "Movie")}
          · ${escapeHTML(formatDate(booking.date))}
        </p>

        <p>
          ${escapeHTML(getShowLabel(booking.time))}
          · Seats: ${escapeHTML((booking.seats || []).join(", "))}
        </p>

        <p>
          ${escapeHTML(formatMoney(booking.amount))}
          · ${escapeHTML(booking.status)}
        </p>

        <p>
          Payment: ${escapeHTML(booking.paymentStatus)}
        </p>

      </article>
    `)
    .join("");

  const privateHTML = memory.data.privateBookings
    .slice()
    .reverse()
    .map(booking => `
      <article class="booking-record">

        <strong>${escapeHTML(booking.id)}</strong>

        <p>${escapeHTML(booking.customerName)}</p>

        <p>
          Private theatre · ${escapeHTML(booking.occasion)}
        </p>

        <p>
          ${escapeHTML(formatDate(booking.date))}
          · ${escapeHTML(booking.startTime)}
          · ${escapeHTML(String(booking.duration))} hours
        </p>

        <p>
          ${escapeHTML(booking.status)}
        </p>

      </article>
    `)
    .join("");

  elements.myBookingsList.innerHTML =
    publicHTML + privateHTML;
}

elements.myBookingsBtn.addEventListener("click", () => {
  renderMyBookings();
  openModal(elements.myBookingsModal);
});


/* ---------------------------------
   PRIVATE BOOKINGS
---------------------------------- */

function timeToMinutes(time) {
  const [hours, minutes] = time.split(":").map(Number);

  return hours * 60 + minutes;
}

function hasPrivateBookingConflict(date, startTime, duration) {
  const requestedStart = timeToMinutes(startTime);
  const requestedEnd = requestedStart + duration * 60;

  return memory.data.privateBookings.some(booking => {
    if (
      booking.date !== date ||
      booking.status === "cancelled" ||
      booking.status === "rejected"
    ) {
      return false;
    }

    const existingStart = timeToMinutes(booking.startTime);
    const existingEnd =
      existingStart + Number(booking.duration) * 60;

    // Include a 30-minute setup/cleanup buffer.
    const buffer = 30;

    return (
      requestedStart < existingEnd + buffer &&
      requestedEnd + buffer > existingStart
    );
  });
}

function hasPublicShowConflict(date, startTime, duration) {
  const requestedStart = timeToMinutes(startTime);
  const requestedEnd = requestedStart + duration * 60;

  return memory.data.bookings.some(booking => {
    if (
      booking.date !== date ||
      booking.status === "cancelled"
    ) {
      return false;
    }

    const showStart = timeToMinutes(booking.time);

    // Demo assumption: each public show occupies 2.5 hours.
    const showEnd = showStart + 150;

    const buffer = 30;

    return (
      requestedStart < showEnd + buffer &&
      requestedEnd + buffer > showStart
    );
  });
}

function openPrivateBooking() {
  setMinimumDate($("#privateDate"));

  openModal(elements.privateModal);
}

elements.privateBookingBtn.addEventListener(
  "click",
  openPrivateBooking
);

elements.privateForm.addEventListener("submit", event => {
  event.preventDefault();

  const customerName = $("#privateName").value.trim();
  const phone = $("#privatePhone").value.trim();
  const occasion = $("#privateOccasion").value;

  const date = $("#privateDate").value;
  const startTime = $("#privateTime").value;
  const duration = Number($("#privateDuration").value);

  if (!customerName || customerName.length > 100) {
    showToast("Enter a valid name.");
    return;
  }

  if (!isValidPhone(phone)) {
    showToast("Enter a valid 10-digit Indian mobile number.");
    return;
  }

  if (!occasion) {
    showToast("Select an occasion.");
    return;
  }

  if (!isValidDate(date)) {
    showToast("Choose today or a future date.");
    return;
  }

  if (!startTime || ![2, 3, 4].includes(duration)) {
    showToast("Select a valid time and duration.");
    return;
  }

  const start = timeToMinutes(startTime);
  const end = start + duration * 60;

  // Do not allow private reservations past midnight.
  if (end > 24 * 60) {
    showToast("Choose an earlier starting time.");
    return;
  }

  if (hasPrivateBookingConflict(date, startTime, duration)) {
    showToast(
      "This time overlaps another private reservation."
    );

    return;
  }

  if (hasPublicShowConflict(date, startTime, duration)) {
    showToast(
      "This time conflicts with a public show reservation."
    );

    return;
  }

  const reservation = {
    id: generateId("PR"),

    type: "private",

    customerName,
    phone,
    occasion,

    date,
    startTime,
    duration,

    amount: null,

    paymentStatus: "unpaid",

    status: "pending",

    createdAt: new Date().toISOString()
  };

  memory.data.privateBookings.push(reservation);

  if (!saveData()) {
    memory.data.privateBookings.pop();

    showToast("Could not save request. Try again.");
    return;
  }

  elements.privateForm.reset();

  closeModal(elements.privateModal);

  showToast("Private booking request saved.");

  renderMyBookings();

  openModal(elements.myBookingsModal);
});


/* ---------------------------------
   MODAL CONTROLS
---------------------------------- */

$("#closeBookingModal").addEventListener("click", () => {
  closeModal(elements.bookingModal);
});

$("#closeMyBookings").addEventListener("click", () => {
  closeModal(elements.myBookingsModal);
});

$("#closePrivateModal").addEventListener("click", () => {
  closeModal(elements.privateModal);
});

document.querySelectorAll(".modal-overlay").forEach(modal => {
  modal.addEventListener("click", event => {
    if (event.target === modal) {
      closeModal(modal);
    }
  });
});

document.addEventListener("keydown", event => {
  if (event.key !== "Escape") return;

  document.querySelectorAll(".modal-overlay").forEach(modal => {
    if (!modal.hidden) {
      closeModal(modal);
    }
  });
});


/* ---------------------------------
   INITIALIZATION
---------------------------------- */

function initialize() {
  loadData();

  elements.currentYear.textContent =
    new Date().getFullYear();

  setMinimumDate(elements.showDate);
  setMinimumDate($("#privateDate"));

  // Default date: today.
  elements.showDate.value = todayString();

  renderMovies();
  renderSeats();

  console.info(
    "NOIR Cinema Club initialized.",
    `${CONFIG.seatCount} seats configured.`
  );
}

initialize();
