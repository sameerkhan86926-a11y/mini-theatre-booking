"use strict";

/*
  NOIR MINI THEATRE
  Frontend demo with UPI payment interface.

  IMPORTANT:
  - localStorage is browser-specific.
  - UTR submission does not verify payment.
  - Never confirm a payment without checking your bank/UPI app.
  - Production requires a shared database and secure backend.
*/

const STORAGE_KEY = "noirMiniTheatre_v1";

const CONFIG = {
  theatreName: "NOIR Cinema Club",
  seatCount: 30,
  ticketPrice: 150,
  currency: "INR",
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

const $ = selector => document.querySelector(selector);

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
let activePaymentBookingId = null;

const memory = { data: null };

/* ---------------- STORAGE ---------------- */

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

    if (!Number.isFinite(Number(memory.data.settings.ticketPrice))) {
      memory.data.settings.ticketPrice = CONFIG.ticketPrice;
    }

    if (typeof memory.data.settings.upiId !== "string") {
      memory.data.settings.upiId = CONFIG.upiId;
    }

    return memory.data;
  } catch (error) {
    console.error("Unable to load saved data:", error);

    memory.data = createInitialData();

    showToast("Saved data could not be read. Check browser storage.");

    return memory.data;
  }
}

function saveData() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(memory.data));
    return true;
  } catch (error) {
    console.error("Unable to save data:", error);
    showToast("Storage failed. Check browser storage availability.");
    return false;
  }
}

/* ---------------- HELPERS ---------------- */

function escapeHTML(value) {
  return String(value ?? "").replace(/[&<>"']/g, char => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  })[char]);
}

function formatMoney(amount) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: CONFIG.currency,
    maximumFractionDigits: 0
  }).format(Number(amount) || 0);
}

function generateId(prefix = "BK") {
  return prefix + "-" +
    Date.now().toString(36).toUpperCase() + "-" +
    Math.random().toString(36).slice(2, 7).toUpperCase();
}

function todayString() {
  const now = new Date();

  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

function formatDate(dateString) {
  if (!dateString) return "Not selected";

  const date = new Date(`${dateString}T12:00:00`);

  if (Number.isNaN(date.getTime())) return dateString;

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

  if (!document.querySelector(".modal-overlay:not([hidden])")) {
    document.body.style.overflow = "";
  }
}

function setMinimumDate(input) {
  if (input) input.min = todayString();
}

function isValidDate(dateString) {
  return /^\d{4}-\d{2}-\d{2}$/.test(dateString) &&
    dateString >= todayString();
}

function isValidPhone(phone) {
  return /^[6-9]\d{9}$/.test(phone);
}

function getMovie(movieId) {
  return memory.data.movies.find(movie => movie.id === movieId);
}

function getShowLabel(time) {
  const show = CONFIG.showTimes.find(item => item.value === time);
  return show ? show.label : time;
}

function getSelectedShow() {
  const movieId = elements.movieSelect.value;
  const date = elements.showDate.value;
  const time = elements.showTime.value;

  if (!movieId || !date || !time) return null;

  return { movieId, date, time };
}

function getBookingPrice() {
  const price = Number(memory.data.settings.ticketPrice);

  return Number.isFinite(price) && price >= 0
    ? price
    : CONFIG.ticketPrice;
}

function getReceivingUpiId() {
  return String(memory.data.settings.upiId || "").trim();
}

/* ---------------- PAYMENT UI ---------------- */

function ensurePaymentUI() {
  if ($("#noirPaymentPanel")) return;

  const style = document.createElement("style");

  style.textContent = `
    #noirPaymentPanel {
      margin-top:18px;
      padding:18px;
      border:1px solid #38313f;
      border-radius:14px;
      background:#100f17;
      color:#f5f3fa;
    }

    #noirPaymentPanel h3 {
      margin:0 0 8px;
      font-size:21px;
    }

    #noirPaymentPanel p {
      color:#b9b4c5;
      line-height:1.6;
      font-size:13px;
    }

    #noirPaymentPanel .payment-amount {
      font-size:25px;
      font-weight:800;
      color:#d7bdff;
      margin:12px 0;
    }

    #noirPaymentPanel .payment-actions {
      display:grid;
      gap:10px;
      margin-top:14px;
    }

    #noirPaymentPanel .payment-action {
      display:flex;
      justify-content:center;
      align-items:center;
      gap:8px;
      box-sizing:border-box;
      width:100%;
      min-height:45px;
      padding:12px;
      border:1px solid #51445f;
      border-radius:9px;
      background:#21182c;
      color:white;
      font:inherit;
      font-weight:700;
      text-decoration:none;
      cursor:pointer;
    }

    #noirPaymentPanel .payment-action.primary {
      background:#c9a5ff;
      color:#180d25;
      border-color:#c9a5ff;
    }

    #noirPaymentPanel .payment-action:disabled {
      opacity:.5;
      cursor:not-allowed;
    }

    #noirPaymentPanel .payment-qr {
      display:block;
      width:min(240px,100%);
      height:auto;
      margin:15px auto;
      padding:10px;
      background:white;
      border-radius:12px;
      box-sizing:border-box;
    }

    #noirPaymentPanel .payment-field {
      display:block;
      margin-top:14px;
    }

    #noirPaymentPanel .payment-field label {
      display:block;
      color:#ded8e9;
      margin-bottom:7px;
      font-size:13px;
    }

    #noirPaymentPanel .payment-field input {
      width:100%;
      box-sizing:border-box;
      padding:12px;
      color:white;
      background:#08080d;
      border:1px solid #4a4353;
      border-radius:8px;
      font:inherit;
    }

    #noirPaymentPanel .payment-message {
      min-height:18px;
      margin-top:10px;
      font-size:13px;
    }

    #noirPaymentPanel .payment-divider {
      height:1px;
      background:#393140;
      margin:18px 0;
    }

    #noirPaymentPanel .payment-warning {
      color:#ffd58b;
      font-size:12px;
    }

    #noirPaymentPanel .payment-status {
      display:inline-block;
      padding:6px 9px;
      border-radius:7px;
      background:#2c2435;
      color:#dfc9ff;
      font-size:12px;
    }

    @media(min-width:560px) {
      #noirPaymentPanel .payment-actions.two {
        grid-template-columns:1fr 1fr;
      }
    }
  `;

  document.head.appendChild(style);

  const panel = document.createElement("section");

  panel.id = "noirPaymentPanel";
  panel.hidden = true;

  panel.innerHTML = `
    <h3>Complete your payment</h3>
    <p>Booking ID: <strong id="paymentBookingId"></strong></p>

    <div class="payment-amount" id="paymentAmount">₹0</div>

    <span class="payment-status" id="paymentStatusLabel">
      Payment pending
    </span>

    <div id="paymentInstructions">
      <p>Scan this QR code using a supported UPI app, or tap Pay via UPI.</p>

      <div id="paymentQrContainer"></div>

      <div class="payment-actions two">
        <a class="payment-action primary" id="payViaUpi" href="#">
          Pay via UPI
        </a>

        <button class="payment-action" id="copyUpiDetails" type="button">
          Copy UPI details
        </button>
      </div>

      <div class="payment-divider"></div>

      <form id="utrForm">
        <div class="payment-field">
          <label for="utrInput">UPI transaction reference / UTR</label>

          <input
            id="utrInput"
            type="text"
            minlength="6"
            maxlength="80"
            autocomplete="off"
            placeholder="Enter transaction reference"
            required
          >
        </div>

        <button class="payment-action primary" type="submit">
          Submit payment reference
        </button>

        <p id="utrMessage" class="payment-message" aria-live="polite"></p>
      </form>
    </div>

    <p class="payment-warning">
      Important: Submitting a UTR does not verify payment. Your booking remains
      pending until the theatre verifies the payment. Never pay an ID you have
      not checked.
    </p>
  `;

  const bookingModalContent = elements.bookingModal?.querySelector(".modal");

  if (!bookingModalContent) {
    console.error("Booking modal content was not found.");
    return;
  }

  bookingModalContent.appendChild(panel);

  $("#copyUpiDetails").addEventListener("click", copyPaymentDetails);
  $("#utrForm").addEventListener("submit", submitUtr);
}

function makeUpiIntent(booking) {
  const upiId = getReceivingUpiId();

  if (!upiId || !upiId.includes("@")) return "";

  const params = new URLSearchParams({
    pa: upiId,
    pn: memory.data.settings.theatreName || CONFIG.theatreName,
    am: Number(booking.amount).toFixed(2),
    cu: "INR",
    tn: `NOIR ${booking.id}`
  });

  return `upi://pay?${params.toString()}`;
}

function makeQrUrl(booking) {
  const intent = makeUpiIntent(booking);

  if (!intent) return "";

  return "https://api.qrserver.com/v1/create-qr-code/?" +
    new URLSearchParams({
      size: "260x260",
      data: intent
    }).toString();
}

function openPaymentPanel(booking) {
  ensurePaymentUI();

  const panel = $("#noirPaymentPanel");

  if (!panel) {
    showToast("Payment panel could not be loaded. Please refresh.");
    return;
  }

  activePaymentBookingId = booking.id;

  $("#paymentBookingId").textContent = booking.id;
  $("#paymentAmount").textContent = formatMoney(booking.amount);

  $("#paymentStatusLabel").textContent =
    booking.paymentStatus === "verification_pending"
      ? "Reference submitted · Verification pending"
      : booking.paymentStatus === "verified"
        ? "Payment verified"
        : "Payment pending";

  $("#utrInput").value = booking.utr || "";
  $("#utrMessage").textContent = "";

  const upiId = getReceivingUpiId();
  const intent = makeUpiIntent(booking);
  const qrUrl = makeQrUrl(booking);

  $("#paymentQrContainer").innerHTML = "";

  if (upiId && intent && qrUrl) {
    const qr = document.createElement("img");

    qr.className = "payment-qr";
    qr.alt = "UPI payment QR code";
    qr.src = qrUrl;
    qr.referrerPolicy = "no-referrer";

    qr.onerror = () => {
      $("#paymentQrContainer").textContent =
        "QR image could not load. Use Pay via UPI or copy the details.";
    };

    $("#paymentQrContainer").appendChild(qr);

    $("#payViaUpi").href = intent;
    $("#payViaUpi").style.display = "flex";
    $("#copyUpiDetails").disabled = false;
  } else {
    $("#paymentQrContainer").innerHTML = `
      <p>
        UPI ID is not configured yet. Ask the theatre administrator
        to set the receiving UPI ID in Admin Settings.
      </p>
    `;

    $("#payViaUpi").removeAttribute("href");
    $("#payViaUpi").style.display = "none";
    $("#copyUpiDetails").disabled = true;
  }

  const alreadySubmitted =
    booking.paymentStatus === "verification_pending" ||
    booking.paymentStatus === "verified";

  $("#utrForm").hidden = alreadySubmitted;

  $("#paymentInstructions").hidden =
    booking.paymentStatus === "verified";

  /*
    FIX:
    Always make the booking modal visible before showing its payment panel.
    This is needed when the customer opens payment from My Bookings.
  */
  closeModal(elements.myBookingsModal);
  openModal(elements.bookingModal);

  panel.hidden = false;

  // Scroll the booking modal to the payment panel.
  setTimeout(() => {
    panel.scrollIntoView({
      behavior: "smooth",
      block: "start"
    });
  }, 100);
}

async function copyPaymentDetails() {
  const booking = memory.data.bookings.find(
    item => item.id === activePaymentBookingId
  );

  if (!booking) {
    showToast("Booking not found.");
    return;
  }

  const details = [
    `UPI ID: ${getReceivingUpiId()}`,
    `Amount: ${Number(booking.amount).toFixed(2)} INR`,
    `Reference: NOIR ${booking.id}`
  ].join("\n");

  try {
    await navigator.clipboard.writeText(details);
    showToast("UPI details copied.");
  } catch {
    window.prompt("Copy these payment details:", details);
  }
}

function submitUtr(event) {
  event.preventDefault();

  const utr = $("#utrInput").value.trim();

  if (utr.length < 6 || utr.length > 80) {
    $("#utrMessage").textContent =
      "Enter a valid transaction reference.";
    return;
  }

  const booking = memory.data.bookings.find(
    item => item.id === activePaymentBookingId
  );

  if (!booking) {
    $("#utrMessage").textContent = "Booking not found.";
    return;
  }

  if (booking.status === "cancelled") {
    $("#utrMessage").textContent =
      "This booking was cancelled. Contact the theatre.";
    return;
  }

  const oldStatus = booking.paymentStatus;
  const oldUtr = booking.utr;
  const oldBookingStatus = booking.status;
  const oldMethod = booking.paymentMethod;
  const oldSubmittedAt = booking.utrSubmittedAt;

  booking.utr = utr;
  booking.paymentMethod = "upi";
  booking.paymentStatus = "verification_pending";
  booking.status = "pending";
  booking.utrSubmittedAt = new Date().toISOString();

  if (!saveData()) {
    booking.paymentStatus = oldStatus;
    booking.utr = oldUtr;
    booking.status = oldBookingStatus;
    booking.paymentMethod = oldMethod;

    if (oldSubmittedAt === undefined) {
      delete booking.utrSubmittedAt;
    } else {
      booking.utrSubmittedAt = oldSubmittedAt;
    }

    return;
  }

  $("#paymentStatusLabel").textContent =
    "Reference submitted · Verification pending";

  $("#utrForm").hidden = true;

  $("#utrMessage").textContent =
    "Reference saved on this device. Payment is not yet verified.";

  showToast("UTR submitted. Awaiting manual verification.");

  renderMyBookings();
}

/* ---------------- MOVIES ---------------- */

function renderMovies() {
  elements.movieGrid.innerHTML = memory.data.movies.map((movie, index) => {
    const artwork = ["art-one", "art-two", "art-three"][index % 3];
    const symbol = ["✦", "♡", "✧"][index % 3];

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

          <button class="primary-button full-width"
            type="button" data-book-movie="${escapeHTML(movie.id)}">
            Select Movie →
          </button>
        </div>
      </article>
    `;
  }).join("");

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

/* ---------------- SEATS ---------------- */

function getAllSeatIds() {
  const seats = [];

  for (const row of ["A", "B", "C", "D", "E"]) {
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

    if (["pending", "confirmed"].includes(booking.status)) {
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

  for (const seat of [...selectedSeats]) {
    if (booked.has(seat) || blocked.has(seat)) {
      selectedSeats.delete(seat);
    }
  }

  elements.seatLayout.innerHTML = seats.map(seat => {
    const isBooked = booked.has(seat);
    const isBlocked = blocked.has(seat);
    const isSelected = selectedSeats.has(seat);
    const disabled = !show || isBooked || isBlocked;

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
      <button type="button" class="${className}"
        data-seat="${seat}"
        aria-label="${escapeHTML(title)}: ${seat}"
        aria-pressed="${isSelected}"
        title="${escapeHTML(title)}"
        ${disabled ? "disabled" : ""}>
        ${seat}
      </button>
    `;
  }).join("");

  updateBookingSummary();
}

function updateBookingSummary() {
  const selected = [...selectedSeats];

  elements.selectedSeats.textContent =
    selected.length ? selected.join(", ") : "None";

  elements.totalAmount.textContent =
    formatMoney(selected.length * getBookingPrice());

  elements.continueBooking.disabled =
    selected.length === 0 || !getSelectedShow();

  elements.continueBooking.style.opacity =
    elements.continueBooking.disabled ? ".5" : "1";
}

elements.seatLayout.addEventListener("click", event => {
  const button = event.target.closest("[data-seat]");

  if (!button || button.disabled) return;

  if (!getSelectedShow()) {
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

/* ---------------- PUBLIC BOOKING ---------------- */

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

  if (!selectedSeats.size) {
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

  ensurePaymentUI();

  const panel = $("#noirPaymentPanel");

  if (panel) panel.hidden = true;

  openModal(elements.bookingModal);
}

elements.continueBooking.addEventListener("click", openPublicBooking);

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

  const booked = getBookedSeatIds(show);
  const blocked = getBlockedSeatIds(show);

  for (const seat of selectedSeats) {
    if (booked.has(seat) || blocked.has(seat)) {
      showToast(`${seat} is no longer available. Please choose again.`);

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
    paymentMethod: "upi",
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

  renderSeats();

  showToast("Booking created. Complete payment if UPI is configured.");

  openPaymentPanel(booking);
});

function showBookingDetails(booking) {
  openPaymentPanel(booking);
}

/* ---------------- MY BOOKINGS ---------------- */

function renderMyBookings() {
  const allBookings = [
    ...memory.data.bookings.map(booking => ({
      ...booking,
      _type: "public"
    })),

    ...memory.data.privateBookings.map(booking => ({
      ...booking,
      _type: "private"
    }))
  ];

  if (!allBookings.length) {
    elements.myBookingsList.innerHTML = `
      <p class="small-note">No bookings found in this browser yet.</p>
    `;

    return;
  }

  elements.myBookingsList.innerHTML = allBookings.reverse().map(booking => {
    const isPrivate = booking._type === "private";

    const details = isPrivate
      ? `
        <p>Private theatre · ${escapeHTML(booking.occasion)}</p>

        <p>
          ${escapeHTML(formatDate(booking.date))} ·
          ${escapeHTML(booking.startTime)} ·
          ${escapeHTML(String(booking.duration))} hours
        </p>
      `
      : `
        <p>
          ${escapeHTML(booking.movieTitle || "Movie")} ·
          ${escapeHTML(formatDate(booking.date))}
        </p>

        <p>
          ${escapeHTML(getShowLabel(booking.time))} ·
          Seats: ${escapeHTML((booking.seats || []).join(", "))}
        </p>

        <p>${escapeHTML(formatMoney(booking.amount))}</p>

        <button
          type="button"
          class="primary-button"
          data-open-payment="${escapeHTML(booking.id)}">
          View Payment / Booking
        </button>
      `;

    return `
      <article class="booking-record">
        <strong>${escapeHTML(booking.id)}</strong>

        <p>${escapeHTML(booking.customerName || "Customer")}</p>

        ${details}

        <p>Status: ${escapeHTML(booking.status || "pending")}</p>

        <p>Payment: ${escapeHTML(booking.paymentStatus || "unpaid")}</p>
      </article>
    `;
  }).join("");
}

elements.myBookingsBtn.addEventListener("click", () => {
  renderMyBookings();
  openModal(elements.myBookingsModal);
});

/*
  FIXED VIEW PAYMENT BUTTON

  1. Find the selected booking.
  2. Close the My Bookings modal.
  3. Open the Booking modal.
  4. Display the payment panel for the selected booking.
*/

elements.myBookingsList.addEventListener("click", event => {
  const button = event.target.closest("[data-open-payment]");

  if (!button) return;

  const bookingId = button.dataset.openPayment;

  const booking = memory.data.bookings.find(
    item => item.id === bookingId
  );

  if (!booking) {
    showToast("Booking not found.");
    return;
  }

  closeModal(elements.myBookingsModal);

  openModal(elements.bookingModal);

  openPaymentPanel(booking);
});

/* ---------------- PRIVATE BOOKINGS ---------------- */

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
      ["cancelled", "rejected"].includes(booking.status)
    ) {
      return false;
    }

    const existingStart = timeToMinutes(booking.startTime);
    const existingEnd = existingStart + Number(booking.duration) * 60;
    const buffer = 30;

    return requestedStart < existingEnd + buffer &&
      requestedEnd + buffer > existingStart;
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
    const showEnd = showStart + 150;
    const buffer = 30;

    return requestedStart < showEnd + buffer &&
      requestedEnd + buffer > showStart;
  });
}

function openPrivateBooking() {
  setMinimumDate($("#privateDate"));
  openModal(elements.privateModal);
}

elements.privateBookingBtn.addEventListener("click", openPrivateBooking);

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

  const end = timeToMinutes(startTime) + duration * 60;

  if (end > 24 * 60) {
    showToast("Choose an earlier starting time.");
    return;
  }

  if (hasPrivateBookingConflict(date, startTime, duration)) {
    showToast("This time overlaps another private reservation.");
    return;
  }

  if (hasPublicShowConflict(date, startTime, duration)) {
    showToast("This time conflicts with a public show reservation.");
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

/* ---------------- MODALS ---------------- */

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

/* ---------------- INITIALIZE ---------------- */

function initialize() {
  loadData();

  ensurePaymentUI();

  if (elements.currentYear) {
    elements.currentYear.textContent = new Date().getFullYear();
  }

  setMinimumDate(elements.showDate);
  setMinimumDate($("#privateDate"));

  elements.showDate.value = todayString();

  renderMovies();
  renderSeats();

  console.info("NOIR Cinema Club initialized with 30 seats.");
}

initialize();
