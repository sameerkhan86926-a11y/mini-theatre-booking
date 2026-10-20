"use strict";

const STORAGE_KEY = "noirMiniTheatre_v1";
const DEMO_PIN = "2468";

const $ = (id) => document.getElementById(id);

function readData() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return {
        movies: [],
        settings: { ticketPrice: 150, upiId: "" },
        bookings: [],
        privateBookings: [],
        blockedSeats: []
      };
    }

    const data = JSON.parse(raw);

    return {
      movies: Array.isArray(data.movies) ? data.movies : [],
      settings: {
        ...(data.settings || {}),
        ticketPrice: Number(data.settings?.ticketPrice) || 150,
        upiId: data.settings?.upiId || ""
      },
      bookings: Array.isArray(data.bookings) ? data.bookings : [],
      privateBookings: Array.isArray(data.privateBookings) ? data.privateBookings : [],
      blockedSeats: Array.isArray(data.blockedSeats) ? data.blockedSeats : []
    };
  } catch (error) {
    console.error("Could not read booking data:", error);
    alert("Booking data read nahi ho pa raha. Browser storage check karo.");
    return null;
  }
}

function saveData(data) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    return true;
  } catch (error) {
    console.error("Could not save booking data:", error);
    alert("Data save nahi hua. Browser storage available hai ya nahi check karo.");
    return false;
  }
}

function escapeHTML(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[char]);
}

function formatMoney(amount) {
  return "₹" + (Number(amount) || 0).toLocaleString("en-IN");
}

function statusClass(status) {
  if (status === "confirmed") return "confirmed";
  if (status === "cancelled" || status === "rejected") return "cancelled";
  return "pending";
}

function displayStatus(status) {
  return escapeHTML(status || "pending");
}

function paymentVerified(booking) {
  return booking.paymentStatus === "verified" ||
         booking.paymentStatus === "paid" ||
         booking.paymentVerified === true;
}

function renderDashboard() {
  const data = readData();
  if (!data) return;

  const bookings = data.bookings;
  const privateBookings = data.privateBookings;

  $("totalBookings").textContent = bookings.length;
  $("pendingBookings").textContent =
    bookings.filter((b) => !["confirmed", "cancelled", "rejected"].includes(b.status)).length;
  $("confirmedBookings").textContent =
    bookings.filter((b) => b.status === "confirmed").length;

  const revenue = bookings
    .filter((b) => paymentVerified(b) && b.status !== "cancelled")
    .reduce((sum, b) => sum + (Number(b.total ?? b.amount) || 0), 0);

  $("verifiedRevenue").textContent = formatMoney(revenue);

  $("bookingRows").innerHTML = bookings.length
    ? bookings.map((booking, index) => {
        const seats = Array.isArray(booking.seats)
          ? booking.seats.join(", ")
          : (booking.seats || "—");

        const customer = booking.customerName || booking.name || "Customer";
        const phone = booking.customerPhone || booking.phone || "";
        const movie = booking.movieTitle || booking.movieName || booking.movie || "Show";
        const date = booking.date || booking.showDate || "—";
        const time = booking.time || booking.showTime || "—";
        const amount = Number(booking.total ?? booking.amount) || 0;
        const status = booking.status || "pending";
        const payment = paymentVerified(booking) ? "Verified" : (booking.paymentStatus || "unpaid");

        return `
          <tr>
            <td>${escapeHTML(customer)}<br><small>${escapeHTML(phone)}</small></td>
            <td>${escapeHTML(movie)}<br><small>${escapeHTML(date)} · ${escapeHTML(time)}</small></td>
            <td>${escapeHTML(seats)}</td>
            <td>${formatMoney(amount)}</td>
            <td><span class="status ${statusClass(status)}">${displayStatus(status)}</span></td>
            <td>${escapeHTML(payment)}</td>
            <td>
              <div class="action-row">
                <button class="action-btn approve" data-type="public" data-action="confirm" data-index="${index}">Confirm</button>
                <button class="action-btn neutral" data-type="public" data-action="paid" data-index="${index}">Verify payment</button>
                <button class="action-btn reject" data-type="public" data-action="cancel" data-index="${index}">Reject</button>
              </div>
            </td>
          </tr>
        `;
      }).join("")
    : "";

  $("noBookings").hidden = bookings.length > 0;

  $("privateRows").innerHTML = privateBookings.length
    ? privateBookings.map((booking, index) => {
        const customer = booking.privateName || booking.customerName || booking.name || "Customer";
        const phone = booking.privatePhone || booking.customerPhone || booking.phone || "";
        const occasion = booking.privateOccasion || booking.occasion || "Private event";
        const date = booking.privateDate || booking.date || "—";
        const time = booking.privateTime || booking.time || "—";
        const duration = booking.privateDuration || booking.duration || "—";
        const status = booking.status || "pending";

        return `
          <tr>
            <td>${escapeHTML(customer)}<br><small>${escapeHTML(phone)}</small></td>
            <td>${escapeHTML(occasion)}</td>
            <td>${escapeHTML(date)}</td>
            <td>${escapeHTML(time)}</td>
            <td>${escapeHTML(duration)}</td>
            <td><span class="status ${statusClass(status)}">${displayStatus(status)}</span></td>
            <td>
              <div class="action-row">
                <button class="action-btn approve" data-type="private" data-action="confirm" data-index="${index}">Confirm</button>
                <button class="action-btn reject" data-type="private" data-action="cancel" data-index="${index}">Reject</button>
              </div>
            </td>
          </tr>
        `;
      }).join("")
    : "";

  $("noPrivate").hidden = privateBookings.length > 0;

  $("ticketPrice").value = data.settings.ticketPrice;
  $("upiId").value = data.settings.upiId;
}

function updateBooking(type, index, action) {
  const data = readData();
  if (!data) return;

  const list = type === "private" ? data.privateBookings : data.bookings;
  const booking = list[index];

  if (!booking) {
    alert("Booking nahi mili. Dashboard refresh karo.");
    renderDashboard();
    return;
  }

  if (action === "paid") {
    if (type === "private") return;

    const approved = confirm(
      "Kya tumne customer ka payment apne UPI/bank app mein verify kar liya hai?"
    );

    if (!approved) return;

    booking.paymentStatus = "verified";
    booking.paymentVerified = true;
    booking.paymentVerifiedAt = new Date().toISOString();

    if (!booking.status || booking.status === "pending") {
      booking.status = "confirmed";
    }
  } else if (action === "confirm") {
    if (booking.status === "cancelled" || booking.status === "rejected") {
      alert("Rejected booking ko dobara confirm karne se pehle customer se details verify karo.");
      return;
    }

    if (!confirm("Is booking ko confirm karna hai?")) return;
    booking.status = "confirmed";
    booking.updatedAt = new Date().toISOString();
  } else if (action === "cancel") {
    if (!confirm("Is booking ko reject/cancel karna hai?")) return;
    booking.status = "cancelled";
    booking.updatedAt = new Date().toISOString();
  }

  if (saveData(data)) renderDashboard();
}

$("loginForm").addEventListener("submit", (event) => {
  event.preventDefault();

  if ($("adminPin").value === DEMO_PIN) {
    $("loginBox").hidden = true;
    $("adminApp").hidden = false;
    sessionStorage.setItem("noirAdminDemoUnlocked", "yes");
    renderDashboard();
  } else {
    $("loginError").textContent = "PIN galat hai. Dobara try karo.";
  }
});

$("logoutBtn").addEventListener("click", () => {
  sessionStorage.removeItem("noirAdminDemoUnlocked");
  $("adminPin").value = "";
  $("adminApp").hidden = true;
  $("loginBox").hidden = false;
});

$("refreshBtn").addEventListener("click", renderDashboard);

$("settingsForm").addEventListener("submit", (event) => {
  event.preventDefault();

  const price = Number($("ticketPrice").value);
  const upiId = $("upiId").value.trim();

  if (!Number.isFinite(price) || price < 1) {
    alert("Ticket price ₹1 ya usse zyada honi chahiye.");
    return;
  }

  const data = readData();
  if (!data) return;

  data.settings.ticketPrice = Math.round(price);
  data.settings.upiId = upiId;

  if (saveData(data)) {
    $("settingsMessage").textContent =
      "Settings save ho gayi. Ye isi browser ke data par apply hongi.";
    renderDashboard();
  }
});

document.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-action]");
  if (!button) return;

  updateBooking(
    button.dataset.type,
    Number(button.dataset.index),
    button.dataset.action
  );
});

if (sessionStorage.getItem("noirAdminDemoUnlocked") === "yes") {
  $("loginBox").hidden = true;
  $("adminApp").hidden = false;
  renderDashboard();
}
