import { useState, useEffect, useRef, useCallback } from "react";
import { io } from "socket.io-client";

// ─── DESIGN TOKENS ────────────────────────────────────────────────────────────
const T = {
  bg: "#09090F",
  bgCard: "#0E0E1A",
  bgSurface: "#13132B",
  bgHover: "#17172F",
  bgInput: "#0B0B18",
  gold: "#D4A84B",
  goldLight: "#F0CB7A",
  goldDark: "#9B7432",
  goldGlow: "rgba(212,168,75,0.12)",
  accent: "#5B7FFF",
  accentSoft: "rgba(91,127,255,0.12)",
  purple: "#8B65F5",
  purpleSoft: "rgba(139,101,245,0.12)",
  teal: "#2EC4A0",
  tealSoft: "rgba(46,196,160,0.1)",
  rose: "#F06070",
  roseSoft: "rgba(240,96,112,0.1)",
  amber: "#F59E0B",
  amberSoft: "rgba(245,158,11,0.1)",
  text: "#EEEEF5",
  textSub: "#8A8AAA",
  textDim: "#4A4A70",
  border: "rgba(255,255,255,0.06)",
  borderMed: "rgba(255,255,255,0.1)",
  borderGold: "rgba(212,168,75,0.3)",
};

// ─── GLOBAL CSS ───────────────────────────────────────────────────────────────
const STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600&family=Playfair+Display:wght@500;600;700&display=swap');
  *{box-sizing:border-box;margin:0;padding:0;}
  :root{
    --gold:${T.gold};--gold-light:${T.goldLight};--gold-dark:${T.goldDark};
    --accent:${T.accent};--purple:${T.purple};--teal:${T.teal};--rose:${T.rose};--amber:${T.amber};
    --bg:${T.bg};--bgCard:${T.bgCard};--bgSurface:${T.bgSurface};
    --text:${T.text};--textSub:${T.textSub};--textDim:${T.textDim};
    --border:${T.border};--borderMed:${T.borderMed};
    --radius:10px;--radius-lg:14px;--radius-xl:20px;
  }
  body{background:var(--bg);color:var(--text);font-family:'Inter',sans-serif;font-size:14px;line-height:1.5;}
  .serif{font-family:'Playfair Display',serif;}
  ::-webkit-scrollbar{width:3px;height:3px;}
  ::-webkit-scrollbar-track{background:transparent;}
  ::-webkit-scrollbar-thumb{background:rgba(255,255,255,0.1);border-radius:2px;}
  input,textarea,select{
    background:var(--bgSurface);border:1px solid var(--border);color:var(--text);
    border-radius:var(--radius);padding:10px 14px;font-family:'Inter',sans-serif;
    font-size:13px;width:100%;outline:none;transition:border-color .2s,box-shadow .2s;
    -webkit-appearance:none;
  }
  input:focus,textarea:focus,select:focus{border-color:var(--gold);box-shadow:0 0 0 3px rgba(212,168,75,0.08);}
  input::placeholder,textarea::placeholder{color:var(--textDim);}
  select option{background:#1a1a2e;}
  input[type="date"]::-webkit-calendar-picker-indicator,
  input[type="time"]::-webkit-calendar-picker-indicator{filter:invert(0.5);}
  .card{background:var(--bgCard);border:1px solid var(--border);border-radius:var(--radius-lg);}
  .surface{background:var(--bgSurface);border-radius:var(--radius);}
  .btn{border:none;border-radius:var(--radius);padding:10px 20px;font-family:'Inter',sans-serif;font-size:13px;font-weight:500;cursor:pointer;transition:all .18s;display:inline-flex;align-items:center;gap:7px;letter-spacing:.01em;white-space:nowrap;}
  .btn:active{transform:scale(0.98);}
  .btn-primary{background:linear-gradient(135deg,var(--gold),var(--gold-dark));color:#09090F;}
  .btn-primary:hover{background:linear-gradient(135deg,var(--gold-light),var(--gold));box-shadow:0 4px 18px rgba(212,168,75,0.28);}
  .btn-secondary{background:transparent;color:var(--gold);border:1px solid var(--borderGold);}
  .btn-secondary:hover{background:${T.goldGlow};}
  .btn-ghost{background:transparent;color:var(--textSub);border:1px solid var(--border);}
  .btn-ghost:hover{border-color:var(--borderMed);color:var(--text);}
  .btn-danger{background:${T.roseSoft};color:var(--rose);border:1px solid rgba(240,96,112,0.25);}
  .btn-danger:hover{background:rgba(240,96,112,0.18);}
  .btn-sm{padding:6px 14px;font-size:12px;}
  .btn-icon{padding:8px;border-radius:8px;}
  .nav-item{display:flex;align-items:center;gap:9px;padding:8px 12px;border-radius:9px;cursor:pointer;font-size:13px;color:var(--textSub);transition:all .15s;border:none;background:none;font-family:'Inter',sans-serif;text-align:left;width:100%;font-weight:400;}
  .nav-item:hover{background:rgba(255,255,255,0.04);color:var(--text);}
  .nav-item.active{background:${T.goldGlow};color:var(--gold);font-weight:500;}
  .tag{display:inline-flex;align-items:center;gap:4px;padding:3px 9px;border-radius:20px;font-size:11px;font-weight:500;letter-spacing:.02em;}
  .modal-bg{position:fixed;inset:0;background:rgba(0,0,0,0.8);display:flex;align-items:center;justify-content:center;z-index:200;padding:16px;}
  .modal{background:var(--bgCard);border:1px solid var(--borderMed);border-radius:var(--radius-xl);width:100%;max-width:500px;max-height:90vh;overflow-y:auto;animation:mIn .22s ease;}
  @keyframes mIn{from{opacity:0;transform:scale(0.95) translateY(10px)}to{opacity:1;transform:none}}
  .seat{width:26px;height:26px;border-radius:5px;cursor:pointer;transition:transform .12s,box-shadow .12s;display:flex;align-items:center;justify-content:center;font-size:8px;font-weight:600;border:1px solid transparent;flex-shrink:0;}
  .seat:hover:not(.sold):not(.waitlist){transform:scale(1.15);}
  .seat.available{background:rgba(91,127,255,0.15);border-color:rgba(91,127,255,0.35);color:var(--accent);}
  .seat.selected{background:var(--gold);border-color:var(--gold-light);color:#09090F;box-shadow:0 0 8px rgba(212,168,75,0.4);}
  .seat.sold{background:rgba(255,255,255,0.03);border-color:rgba(255,255,255,0.06);color:var(--textDim);cursor:default;}
  .seat.accessible{background:rgba(46,196,160,0.15);border-color:rgba(46,196,160,0.35);color:var(--teal);}
  .seat.waitlist{background:rgba(245,158,11,0.1);border-color:rgba(245,158,11,0.25);color:var(--amber);cursor:default;}
  .seat.held{background:rgba(139,101,245,0.15);border-color:rgba(139,101,245,0.35);color:var(--purple);cursor:default;}
  .progress-bar{height:3px;background:rgba(255,255,255,0.06);border-radius:2px;overflow:hidden;}
  .progress-fill{height:100%;border-radius:2px;transition:width .6s ease;}
  .toggle-wrap{position:relative;width:38px;height:21px;cursor:pointer;flex-shrink:0;}
  .toggle-wrap input{opacity:0;width:0;height:0;position:absolute;}
  .toggle-track{position:absolute;inset:0;background:rgba(255,255,255,0.1);border-radius:21px;transition:.25s;}
  .toggle-thumb{position:absolute;width:15px;height:15px;background:#fff;border-radius:50%;top:3px;left:3px;transition:.25s;}
  .toggle-wrap input:checked~.toggle-track{background:var(--gold);}
  .toggle-wrap input:checked~.toggle-thumb{transform:translateX(17px);}
  .tab-btn{padding:7px 14px;border-radius:7px;cursor:pointer;font-size:13px;font-weight:500;transition:all .15s;border:none;background:none;font-family:'Inter',sans-serif;color:var(--textSub);}
  .tab-btn.active{background:${T.goldGlow};color:var(--gold);}
  .tab-btn:hover:not(.active){color:var(--text);}
  .search-wrap{position:relative;}
  .search-wrap svg{position:absolute;left:11px;top:50%;transform:translateY(-50%);pointer-events:none;}
  .search-input{padding-left:36px;width:220px;transition:width .2s,border-color .2s;}
  .search-input:focus{width:270px;}
  .event-card{background:var(--bgCard);border:1px solid var(--border);border-radius:var(--radius-lg);overflow:hidden;cursor:pointer;transition:border-color .2s,transform .2s;}
  .event-card:hover{border-color:var(--borderMed);transform:translateY(-2px);}
  .table-row{border-bottom:1px solid var(--border);transition:background .1s;}
  .table-row:hover{background:rgba(255,255,255,0.015);}
  .stat-card{background:var(--bgSurface);border:1px solid var(--border);border-radius:var(--radius-lg);padding:18px 22px;}
  .fade-in{animation:fadeIn .3s ease;}
  @keyframes fadeIn{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}
  .spin{animation:spin 1s linear infinite;}
  @keyframes spin{to{transform:rotate(360deg)}}
  .pulse{animation:pulse 2s infinite;}
  @keyframes pulse{0%,100%{opacity:1}50%{opacity:.45}}
  .live-dot::before{content:'';display:inline-block;width:6px;height:6px;background:var(--rose);border-radius:50%;margin-right:5px;animation:pulse 1.5s infinite;}
  .toast-wrap{position:fixed;top:20px;right:20px;z-index:999;display:flex;flex-direction:column;gap:8px;pointer-events:none;}
  .toast{background:var(--bgCard);border:1px solid var(--borderMed);border-radius:var(--radius);padding:12px 18px;font-size:13px;display:flex;align-items:center;gap:10px;animation:toastIn .25s ease;pointer-events:all;min-width:240px;max-width:340px;}
  @keyframes toastIn{from{opacity:0;transform:translateX(20px)}to{opacity:1;transform:none}}
  .ring-timer{position:relative;display:inline-flex;align-items:center;justify-content:center;}
  .ring-timer svg{transform:rotate(-90deg);}
  .section-header{padding:0 0 10px;margin-bottom:16px;border-bottom:1px solid var(--border);}
  @keyframes shimmer{0%{background-position:-400px 0}100%{background-position:400px 0}}
  .shimmer{background:linear-gradient(90deg,transparent,rgba(255,255,255,0.03),transparent);background-size:400px 100%;animation:shimmer 1.8s infinite;}
  .qr-grid{display:grid;grid-template-columns:repeat(10,1fr);gap:2px;}
  .qr-cell{width:100%;aspect-ratio:1;border-radius:1px;}
  ::selection {
  background: var(--gold);
  color: #4a360f; /* darker gold/brown text */
}

::-moz-selection {
  background: var(--gold);
  color: #4a360f;
}
`;

// Simple API helper and realtime hookup (browser environment)
const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:3000/api";
const SOCKET_BASE = import.meta.env.VITE_SOCKET_BASE || "http://localhost:3000";
let socket = null;
function connectRealtime(onSeatUpdate) {
  try {
    socket = io(SOCKET_BASE, { transports: ["websocket", "polling"] });
    socket.on("connect", () => console.log("Realtime connected"));
    socket.on("seat-updated", (payload) => {
      console.log("seat-updated", payload);
      if (onSeatUpdate) onSeatUpdate(payload);
    });
  } catch (e) { console.warn('Realtime init error', e); }
}
function disconnectRealtime() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}

async function apiRequest(path, options = {}, token) {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {})
    }
  });
  let data = null;
  try { data = await res.json(); } catch (e) {}
  if (!res.ok) {
    const msg = data?.error || data?.message || `Request failed (${res.status})`;
    throw new Error(msg);
  }
  return data;
}

function getErrorMessage(error, fallback = "Something went wrong") {
  if (!error) return fallback;
  if (typeof error === "string") return error;
  return error.message || fallback;
}

function isStrongPassword(value) {
  if (!value || value.length < 8) return false;
  const hasLetter = /[A-Za-z]/.test(value);
  const hasNumber = /\d/.test(value);
  return hasLetter && hasNumber;
}

const ROLE_LABELS = { user: "customer", organizer: "organizer", admin: "admin" };

async function loginUser(email, password) {
  const data = await apiRequest("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password })
  });
  return {
    user_id: data.user.user_id,
    name: data.user.username,
    email: data.user.email,
    role: ROLE_LABELS[data.user.type] || data.user.type,
    type: data.user.type,
    token: data.token
  };
}

async function registerUser(name, email, password, role) {
  const type = role === "organizer" ? "organizer" : "user";
  const data = await apiRequest("/auth/register", {
    method: "POST",
    body: JSON.stringify({ username: name, email, password, type })
  });
  return {
    user_id: data.user_id,
    name,
    email,
    role: ROLE_LABELS[type] || type,
    type,
    token: data.token
  };
}

async function requestPasswordReset(email) {
  await apiRequest("/auth/request-password-reset", {
    method: "POST",
    body: JSON.stringify({ email })
  });
}

async function completePasswordReset(token, new_password) {
  await apiRequest("/auth/reset-password", {
    method: "POST",
    body: JSON.stringify({ token, new_password })
  });
}

async function fetchSavedPayments(token) {
  return apiRequest("/saved-payments", {}, token);
}

function mapApiEvent(apiEvent) {
  return {
    id: apiEvent.event_id,
    event_id: apiEvent.event_id,
    name: apiEvent.event_name,
    venue: apiEvent.venue_name || "Venue TBD",
    date: apiEvent.event_date,
    time: "TBA",
    category: apiEvent.type || "Event",
    emoji: "🎟️",
    price: Number(apiEvent.ticket_price || 0),
    status: "on-sale",
    capacity: 1,
    sold: 0,
    color: T.accent,
    desc: apiEvent.event_description || "No description available."
  };
}

async function fetchEventsApi() {
  const events = await apiRequest("/events");
  return events.map(mapApiEvent);
}

async function fetchUserTickets(userId, token) {
  const rows = await apiRequest(`/users/${userId}/tickets`, {}, token);
  return rows.map((t) => ({
    id: t.ticket_id,
    event: t.event_name,
    seats: t.seat_num ? `${t.section_name}-${t.seat_num}` : t.seat_id,
    section: t.section_name || "General",
    amount: Number(t.ticket_price || 0),
    status: new Date(t.event_date) >= new Date() ? "confirmed" : "past",
    date: t.event_date
  }));
}

async function fetchUserProfile(userId, token) {
  return apiRequest(`/profile/${userId}`, {}, token);
}

async function updateUserProfile(userId, payload, token) {
  return apiRequest(`/users/${userId}`, {
    method: "PUT",
    body: JSON.stringify(payload)
  }, token);
}

async function changeUserPassword(current_password, new_password, token) {
  return apiRequest("/auth/change-password", {
    method: "POST",
    body: JSON.stringify({ current_password, new_password })
  }, token);
}

async function fetchUserPurchases(userId, token) {
  return apiRequest(`/users/${userId}/purchases`, {}, token);
}

async function fetchWaitlistForEvent(eventId, token) {
  return apiRequest(`/events/${eventId}/waiting`, {}, token);
}

async function promoteWaitlist(eventId, sectionId, token) {
  return apiRequest(`/waiting/promote/${eventId}/${sectionId}`, { method: "POST" }, token);
}

async function removeWaitlistEntry(waitingId, token) {
  return apiRequest(`/waiting/${waitingId}`, { method: "DELETE" }, token);
}

async function fetchVenuesApi() {
  return apiRequest("/venues");
}

async function createVenueApi(payload, token) {
  return apiRequest("/venues", {
    method: "POST",
    body: JSON.stringify(payload)
  }, token);
}

async function updateVenueApi(venueId, payload, token) {
  return apiRequest(`/venues/${venueId}`, {
    method: "PUT",
    body: JSON.stringify(payload)
  }, token);
}

async function deleteVenueApi(venueId, token) {
  return apiRequest(`/venues/${venueId}`, { method: "DELETE" }, token);
}

async function createEventApi(payload, token) {
  return apiRequest("/events", {
    method: "POST",
    body: JSON.stringify(payload)
  }, token);
}

async function fetchAdminEventsApi(token) {
  return apiRequest("/admin/events", {}, token);
}

async function fetchReportTopEvents() {
  return apiRequest("/reports/top-events");
}

async function fetchReportTopRevenue() {
  return apiRequest("/reports/top-revenue");
}

async function fetchAllPayments(token) {
  return apiRequest("/payments", {}, token);
}

async function fetchAllTickets(token) {
  return apiRequest("/tickets", {}, token);
}

async function fetchAllUsers(token) {
  return apiRequest("/users", {}, token);
}

async function cancelTicketApi(ticketId, token) {
  return apiRequest(`/tickets/${ticketId}/cancel`, { method: "POST" }, token);
}

async function releaseTicketAdmin(ticketId, token) {
  return apiRequest(`/admin/tickets/${ticketId}/release`, { method: "POST" }, token);
}

async function fetchVenueSections(venueId) {
  return apiRequest(`/venues/${venueId}/sections`);
}

async function createSectionApi(payload, token) {
  return apiRequest("/sections", {
    method: "POST",
    body: JSON.stringify(payload)
  }, token);
}

async function createSeatsBulkApi(seats, token) {
  return apiRequest("/seats/bulk", {
    method: "POST",
    body: JSON.stringify({ seats })
  }, token);
}

async function fetchSeatmap(eventId) {
  return apiRequest(`/events/${eventId}/seatmap`);
}

async function bookSeat({ event_id, seat_id, user_id, method, amount, ticket_id, payment_id }, token) {
  const body = { event_id, seat_id, user_id, method, amount };
  if (ticket_id) body.ticket_id = ticket_id;
  if (payment_id) body.payment_id = payment_id;
  const res = await fetch(`${API_BASE}/book`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
    body: JSON.stringify(body)
  });
  if (!res.ok) throw new Error('Booking failed: ' + (await res.text()));
  return res.json();
}



// ─── ICONS ────────────────────────────────────────────────────────────────────
const Ic = ({ n, s = 16, c = "currentColor", sw = 1.7 }) => {
  const paths = {
    home: "M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z",
    calendar: "M3 4h18v18H3zM16 2v4M8 2v4M3 10h18",
    map: "M1 6l7-4 8 4 7-4v16l-7 4-8-4-7 4V6zM8 2v18M16 6v16",
    ticket: "M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 010 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 010-4V7a2 2 0 00-2-2H5z",
    users: "M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M9 7a4 4 0 100 8 4 4 0 000-8zM23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75",
    settings: "M12 15a3 3 0 100-6 3 3 0 000 6zM19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z",
    search: "M21 21l-4.35-4.35M17 11A6 6 0 105 11a6 6 0 0012 0z",
    bell: "M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 01-3.46 0",
    user: "M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2M12 7a4 4 0 100 8 4 4 0 000-8z",
    plus: "M12 5v14M5 12h14",
    edit: "M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z",
    trash: "M3 6h18M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6m3 0V4a1 1 0 011-1h4a1 1 0 011 1v2",
    eye: "M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8zM12 9a3 3 0 100 6 3 3 0 000-6z",
    download: "M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3",
    logout: "M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9",
    building: "M4 2h16a2 2 0 012 2v18H2V4a2 2 0 012-2zM8 6h.01M16 6h.01M12 6h.01M12 10h.01M8 10h.01M16 10h.01M8 14h.01M16 14h.01M12 14h.01",
    star: "M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z",
    clock: "M12 2a10 10 0 100 20A10 10 0 0012 2zM12 6v6l4 2",
    check: "M20 6L9 17l-5-5",
    x: "M18 6L6 18M6 6l12 12",
    chevronR: "M9 18l6-6-6-6",
    chevronL: "M15 18l-6-6 6-6",
    chevronD: "M6 9l6 6 6-6",
    filter: "M22 3H2l8 9.46V19l4 2v-8.54L22 3z",
    grid: "M3 3h7v7H3zM14 3h7v7h-7zM14 14h7v7h-7zM3 14h7v7H3z",
    list: "M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01",
    mail: "M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2zM22 6l-10 7L2 6",
    lock: "M19 11H5a2 2 0 00-2 2v7a2 2 0 002 2h14a2 2 0 002-2v-7a2 2 0 00-2-2zM7 11V7a5 5 0 0110 0v4",
    card: "M1 4h22v16H1zM1 10h22",
    zap: "M13 2L3 14h9l-1 8 10-12h-9l1-8z",
    trend: "M23 6L13.5 15.5 8.5 10.5 1 18M17 6h6v6",
    pin: "M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 0118 0zM12 10a1 1 0 100 2 1 1 0 000-2z",
    chair: "M5 10a7 7 0 0014 0M5 10v1a7 7 0 0014 0v-1M5 21v-3m14 3v-3",
    alert: "M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0zM12 9v4M12 17h.01",
    info: "M12 2a10 10 0 100 20A10 10 0 0012 2zM12 8v4M12 16h.01",
    qr: "M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h3v3h-3zM18 14h3M17 18v3M21 17v.01",
    img: "M21 15l-5-5L5 21M3 3h18a2 2 0 012 2v14a2 2 0 01-2 2H3a2 2 0 01-2-2V5a2 2 0 012-2zM8.5 8.5a1 1 0 100 2 1 1 0 000-2z",
    upload: "M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12",
    copy: "M8 4H6a2 2 0 00-2 2v14a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-2M8 4a2 2 0 002 2h4a2 2 0 002-2M8 4a2 2 0 012-2h4a2 2 0 012 2",
    refresh: "M23 4v6h-6M1 20v-6h6M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15",
    wheelchair: "M12 4a1 1 0 100-2 1 1 0 000 2zM9 7h6M12 7v5l3 2M7.5 19a4.5 4.5 0 009 0",
  };
  return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" style={{flexShrink:0}}>
      <path d={paths[n]} />
    </svg>
  );
};

// ─── TOAST SYSTEM ─────────────────────────────────────────────────────────────
const ToastContext = ({ children }) => {
  const [toasts, setToasts] = useState([]);
  const show = useCallback((msg, type = "info") => {
    const id = Date.now();
    setToasts(t => [...t, { id, msg, type }]);
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 3500);
  }, []);
  const icons = { success: "check", error: "alert", info: "info", warning: "alert" };
  const colors = { success: T.teal, error: T.rose, info: T.accent, warning: T.amber };
  return (
    <toastCtx.Provider value={show}>
      {children}
      <div className="toast-wrap">
        {toasts.map(t => (
          <div key={t.id} className="toast">
            <Ic n={icons[t.type]} s={15} c={colors[t.type]} />
            <span style={{ flex: 1, color: T.text }}>{t.msg}</span>
            <button onClick={() => setToasts(ts => ts.filter(x => x.id !== t.id))} style={{ background: "none", border: "none", cursor: "pointer", color: T.textDim }}><Ic n="x" s={13} /></button>
          </div>
        ))}
      </div>
    </toastCtx.Provider>
  );
};
const toastCtx = { Provider: ({ value, children }) => children };
// Simple global toast
let _toast = () => {};
const useToast = () => _toast;

// ─── DATA ─────────────────────────────────────────────────────────────────────
const EVENTS = [
  { id:1, name:"Neon Frequencies Festival", venue:"Lahore Expo Centre", date:"2025-08-15", time:"8:00 PM", category:"Music", emoji:"🎵", price:4500, status:"on-sale", capacity:2000, sold:1450, color:T.accent, desc:"Pakistan's premier electronic music festival returns with 30+ international and local artists across 4 stages. Expect mind-bending visuals, immersive art installations, and an atmosphere unlike anything else." },
  { id:2, name:"The Phantom of the Opera", venue:"Alhamra Arts Council", date:"2025-08-22", time:"7:30 PM", category:"Theatre", emoji:"🎭", price:3200, status:"on-sale", capacity:800, sold:720, color:T.purple, desc:"Andrew Lloyd Webber's iconic musical comes to Lahore in a breathtaking production with a 40-piece orchestra, stunning sets, and world-class performers flown in from London's West End." },
  { id:3, name:"PSL Championship Finals", venue:"Gaddafi Stadium", date:"2025-09-05", time:"6:00 PM", category:"Sports", emoji:"🏏", price:2800, status:"sold-out", capacity:27000, sold:27000, color:T.gold, desc:"The final showdown of the Pakistan Super League Season 10. Two titans clash for the ultimate prize. Join 27,000 passionate fans in the electric atmosphere of Gaddafi Stadium." },
  { id:4, name:"TEDx Lahore 2025", venue:"Avari Tower", date:"2025-09-12", time:"10:00 AM", category:"Conference", emoji:"💡", price:5500, status:"on-sale", capacity:500, sold:210, color:T.teal, desc:"Ideas worth spreading. TEDx Lahore 2025 features 18 visionary speakers across technology, science, art, and social innovation. A full day of inspiration, networking, and transformation." },
  { id:5, name:"Jazz & Blues Night", venue:"PC Hotel Lahore", date:"2025-09-20", time:"9:00 PM", category:"Music", emoji:"🎷", price:3800, status:"on-sale", capacity:300, sold:180, color:T.rose, desc:"An intimate evening of world-class jazz and blues in the legendary ballroom of PC Hotel. Featuring Grammy-nominated artists and an exquisite 4-course dinner experience." },
  { id:6, name:"Pakistan Art Fair 2025", venue:"Lahore Fort", date:"2025-10-01", time:"11:00 AM", category:"Art", emoji:"🎨", price:800, status:"on-sale", capacity:1500, sold:340, color:T.amber, desc:"A celebration of South Asian contemporary art set against the majestic backdrop of Lahore Fort. Over 200 artists, live performances, curated installations, and exclusive collectors' previews." },
];

const VENUES = [
  { id:1, name:"Lahore Expo Centre", address:"Johar Town, Lahore", capacity:5000, sections:6, events:12, img:"🏟️" },
  { id:2, name:"Alhamra Arts Council", address:"Mall Road, Lahore", capacity:800, sections:3, events:8, img:"🎭" },
  { id:3, name:"Gaddafi Stadium", address:"Gulberg, Lahore", capacity:27000, sections:12, events:5, img:"🏟️" },
  { id:4, name:"Avari Tower", address:"Mall Road, Lahore", capacity:500, sections:2, events:4, img:"🏨" },
];

const BOOKINGS = [
  { id:"VB-2025-001", user:"Ali Hassan", email:"ali@gmail.com", event:"Neon Frequencies Festival", seats:"B12, B13", section:"Premium", amount:9000, status:"confirmed", date:"2025-07-15", eventId:1 },
  { id:"VB-2025-002", user:"Sara Khan", email:"sara@gmail.com", event:"The Phantom of the Opera", seats:"A05", section:"VIP", amount:3200, status:"confirmed", date:"2025-07-14", eventId:2 },
  { id:"VB-2025-003", user:"Omar Malik", email:"omar@gmail.com", event:"TEDx Lahore 2025", seats:"GA-127", section:"General", amount:5500, status:"confirmed", date:"2025-07-13", eventId:4 },
  { id:"VB-2025-004", user:"Fatima Ali", email:"fatima@gmail.com", event:"PSL Championship Finals", seats:"C22, C23, C24", section:"Standard", amount:8400, status:"refunded", date:"2025-07-12", eventId:3 },
  { id:"VB-2025-005", user:"Hamza Raza", email:"hamza@gmail.com", event:"Jazz & Blues Night", seats:"VIP-03", section:"VIP", amount:3800, status:"pending", date:"2025-07-11", eventId:5 },
  { id:"VB-2025-006", user:"Zara Butt", email:"zara@gmail.com", event:"Pakistan Art Fair 2025", seats:"GA-089", section:"General", amount:800, status:"confirmed", date:"2025-07-10", eventId:6 },
];

const USERS_DATA = [
  { id:1, name:"Ali Hassan", email:"ali@gmail.com", role:"customer", joined:"Jan 15, 2025", bookings:8, spent:42000, status:"active" },
  { id:2, name:"Sara Khan", email:"sara@gmail.com", role:"customer", joined:"Feb 20, 2025", bookings:5, spent:18500, status:"active" },
  { id:3, name:"Bilal Ahmed", email:"bilal@email.com", role:"organizer", joined:"Nov 5, 2024", bookings:0, spent:0, status:"active" },
  { id:4, name:"Zara Butt", email:"zara@email.com", role:"customer", joined:"Mar 10, 2025", bookings:12, spent:65000, status:"active" },
  { id:5, name:"Kamran Baig", email:"kamran@email.com", role:"customer", joined:"Apr 2, 2025", bookings:3, spent:12200, status:"suspended" },
];

const WAITLIST = [
  { id:1, user:"Nadia Farooq", email:"nadia@gmail.com", event:"PSL Championship Finals", section:"Standard", position:1, joined:"Jul 10, 2025", status:"promoted", notified:"5 min ago" },
  { id:2, user:"Usman Shah", email:"usman@gmail.com", event:"PSL Championship Finals", section:"VIP", position:2, joined:"Jul 10, 2025", status:"waiting", notified:null },
  { id:3, user:"Maira Aziz", email:"maira@gmail.com", event:"PSL Championship Finals", section:"Standard", position:3, joined:"Jul 11, 2025", status:"waiting", notified:null },
  { id:4, user:"Kamran Baig", email:"kamran@gmail.com", event:"The Phantom of the Opera", section:"Premium", position:1, joined:"Jul 12, 2025", status:"promoted", notified:"2 hr ago" },
  { id:5, user:"Hina Javed", email:"hina@gmail.com", event:"The Phantom of the Opera", section:"Standard", position:2, joined:"Jul 13, 2025", status:"waiting", notified:null },
];

const genSeats = () => {
  const rows = ["A","B","C","D","E","F","G"];
  return rows.flatMap((row, ri) =>
    Array.from({ length: 14 }, (_, i) => {
      const r = Math.random();
      const status = r < 0.32 ? "sold" : r < 0.36 ? "waitlist" : r < 0.38 ? "accessible" : r < 0.40 ? "held" : "available";
      return { id: `${row}${i+1}`, row, num: i+1, status, price: ri < 2 ? 7000 : ri < 4 ? 5000 : 3500 };
    })
  );
};

// ─── AUTH ─────────────────────────────────────────────────────────────────────
// ─── RESET PASSWORD PAGE ──────────────────────────────────────────────────────
const ResetPasswordPage = ({ onDone }) => {
  const [token, setToken] = useState(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      return params.get("token") || "";
    } catch (e) { return ""; }
  });
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [err, setErr] = useState("");

  const submit = async (e) => {
    e.preventDefault();
    setErr("");
    if (!token.trim()) return setErr("Reset token is required");
    if (!isStrongPassword(password)) return setErr("Password must be at least 8 chars and include letters and numbers");
    if (password !== confirm) return setErr("Passwords do not match");
    setLoading(true);
    try {
      await completePasswordReset(token.trim(), password);
      setDone(true);
    } catch (error) {
      setErr(getErrorMessage(error, "Reset failed. The token may have expired."));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight:"100vh", display:"flex", alignItems:"center", justifyContent:"center", background:T.bg, position:"relative", overflow:"hidden" }}>
      <div style={{ position:"absolute", inset:0, background:`radial-gradient(ellipse 60% 50% at 20% 60%, rgba(91,127,255,0.07) 0%, transparent 100%), radial-gradient(ellipse 40% 60% at 80% 20%, rgba(212,168,75,0.06) 0%, transparent 100%)` }} />
      {[500, 700, 900].map(s => (
        <div key={s} style={{ position:"absolute", width:s, height:s, borderRadius:"50%", border:"1px solid rgba(212,168,75,0.04)", top:"50%", left:"50%", transform:"translate(-50%,-50%)", pointerEvents:"none" }} />
      ))}
      <div style={{ width:420, position:"relative", zIndex:1 }}>
        <div style={{ textAlign:"center", marginBottom:36 }}>
          <div style={{ display:"inline-flex", alignItems:"center", gap:11, marginBottom:10 }}>
            <div style={{ width:40, height:40, background:`linear-gradient(135deg,${T.gold},${T.goldDark})`, borderRadius:10, display:"flex", alignItems:"center", justifyContent:"center" }}>
              <Ic n="ticket" s={19} c="#09090F" />
            </div>
            <span className="serif" style={{ fontSize:30, fontWeight:700, color:T.gold, letterSpacing:3 }}>vbook</span>
          </div>
        </div>
        <div className="card" style={{ padding:36 }}>
          {done ? (
            <div style={{ textAlign:"center", padding:"8px 0" }}>
              <div style={{ width:60, height:60, background:T.tealSoft, borderRadius:"50%", display:"flex", alignItems:"center", justifyContent:"center", margin:"0 auto 18px" }}>
                <Ic n="check" s={26} c={T.teal} />
              </div>
              <h3 className="serif" style={{ fontSize:20, marginBottom:8 }}>Password reset!</h3>
              <p style={{ color:T.textSub, fontSize:13, lineHeight:1.6, marginBottom:24 }}>Your password has been updated. You can now sign in with your new password.</p>
              <button className="btn btn-primary" style={{ width:"100%", justifyContent:"center" }} onClick={onDone}>Sign in</button>
            </div>
          ) : (
            <form onSubmit={submit}>
              <h3 className="serif" style={{ fontSize:20, marginBottom:6 }}>Set new password</h3>
              <p style={{ color:T.textSub, fontSize:13, marginBottom:24 }}>Enter the reset token from your email and choose a new password</p>
              <div style={{ marginBottom:14 }}>
                <label style={{ fontSize:12, color:T.textSub, display:"block", marginBottom:6 }}>Reset token</label>
                <input placeholder="Paste token from email" value={token} onChange={e => setToken(e.target.value)} required />
              </div>
              <div style={{ marginBottom:14 }}>
                <label style={{ fontSize:12, color:T.textSub, display:"block", marginBottom:6 }}>New password</label>
                <input type="password" placeholder="Min. 8 characters" value={password} onChange={e => setPassword(e.target.value)} required />
              </div>
              <div style={{ marginBottom:16 }}>
                <label style={{ fontSize:12, color:T.textSub, display:"block", marginBottom:6 }}>Confirm password</label>
                <input type="password" placeholder="Repeat new password" value={confirm} onChange={e => setConfirm(e.target.value)} required />
              </div>
              {err && <p style={{ color:T.rose, fontSize:12, marginBottom:12, display:"flex", alignItems:"center", gap:5 }}><Ic n="alert" s={13} c={T.rose} />{err}</p>}
              <button className="btn btn-primary" type="submit" style={{ width:"100%", justifyContent:"center", padding:"11px 20px", marginBottom:10 }} disabled={loading}>
                {loading ? "Updating…" : "Set new password"}
              </button>
              <button type="button" className="btn btn-ghost" style={{ width:"100%", justifyContent:"center" }} onClick={onDone}>Back to sign in</button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

const AuthPage = ({ onLogin, onResetPassword }) => {
  const [tab, setTab] = useState("login");
  const [form, setForm] = useState({ email:"", password:"", name:"", role:"customer" });
  const [loading, setLoading] = useState(false);
  const [resetMode, setResetMode] = useState(false);
  const [resetDone, setResetDone] = useState(false);
  const [err, setErr] = useState("");

  const F = (k) => (e) => setForm(f => ({...f, [k]: e.target.value}));

  const submit = async (e) => {
    e.preventDefault();
    setErr("");
    if (!form.email) return setErr("Email is required");
    if (!form.password) return setErr("Password is required");
    if (tab === "register" && !form.name) return setErr("Full name is required");
    if (tab === "register" && !isStrongPassword(form.password)) {
      return setErr("Password must be at least 8 chars and include letters and numbers");
    }
    setLoading(true);
    try {
      const user = tab === "login"
        ? await loginUser(form.email, form.password)
        : await registerUser(form.name, form.email, form.password, form.role);
      onLogin(user);
    } catch (error) {
      setErr(getErrorMessage(error, "Authentication failed"));
    } finally {
      setLoading(false);
    }
  };

  const sendReset = async (e) => {
    e.preventDefault();
    setErr("");
    if (!form.email) return setErr("Email is required");
    setLoading(true);
    try {
      await requestPasswordReset(form.email);
      setResetDone(true);
    } catch (error) {
      setErr(getErrorMessage(error, "Failed to send reset link"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight:"100vh", display:"flex", alignItems:"center", justifyContent:"center", background:T.bg, position:"relative", overflow:"hidden" }}>
      <div style={{ position:"absolute", inset:0, background:`radial-gradient(ellipse 60% 50% at 20% 60%, rgba(91,127,255,0.07) 0%, transparent 100%), radial-gradient(ellipse 40% 60% at 80% 20%, rgba(212,168,75,0.06) 0%, transparent 100%)` }} />
      {/* Decorative rings */}
      {[500, 700, 900].map(s => (
        <div key={s} style={{ position:"absolute", width:s, height:s, borderRadius:"50%", border:"1px solid rgba(212,168,75,0.04)", top:"50%", left:"50%", transform:"translate(-50%,-50%)", pointerEvents:"none" }} />
      ))}

      <div style={{ width:420, position:"relative", zIndex:1 }}>
        {/* Logo */}
        <div style={{ textAlign:"center", marginBottom:36 }}>
          <div style={{ display:"inline-flex", alignItems:"center", gap:11, marginBottom:10 }}>
            <div style={{ width:40, height:40, background:`linear-gradient(135deg,${T.gold},${T.goldDark})`, borderRadius:10, display:"flex", alignItems:"center", justifyContent:"center" }}>
              <Ic n="ticket" s={19} c="#09090F" />
            </div>
            <span className="serif" style={{ fontSize:30, fontWeight:700, color:T.gold, letterSpacing:3 }}>vbook</span>
          </div>
          <p style={{ color:T.textSub, fontSize:13 }}>Pakistan's premium ticketing platform</p>
        </div>

        <div className="card" style={{ padding:36 }}>
          {resetMode ? (
            resetDone ? (
              <div style={{ textAlign:"center", padding:"8px 0" }}>
                <div style={{ width:60, height:60, background:T.tealSoft, borderRadius:"50%", display:"flex", alignItems:"center", justifyContent:"center", margin:"0 auto 18px" }}>
                  <Ic n="mail" s={26} c={T.teal} />
                </div>
                <h3 className="serif" style={{ fontSize:20, marginBottom:8 }}>Check your inbox</h3>
                <p style={{ color:T.textSub, fontSize:13, lineHeight:1.6, marginBottom:24 }}>A password reset link has been sent to <strong style={{ color:T.text }}>{form.email || "your email"}</strong>. It expires in 15 minutes.</p>
                <button className="btn btn-ghost" style={{ width:"100%" }} onClick={() => { setResetMode(false); setResetDone(false); }}>Back to sign in</button>
              </div>
            ) : (
              <form onSubmit={sendReset}>
                <h3 className="serif" style={{ fontSize:20, marginBottom:6 }}>Reset password</h3>
                <p style={{ color:T.textSub, fontSize:13, marginBottom:24 }}>Enter your email to receive a secure reset link</p>
                <div style={{ marginBottom:16 }}>
                  <label style={{ fontSize:12, color:T.textSub, display:"block", marginBottom:6 }}>Email address</label>
                  <input type="email" placeholder="you@example.com" value={form.email} onChange={F("email")} required />
                </div>
                <button className="btn btn-primary" type="submit" style={{ width:"100%", justifyContent:"center", marginBottom:10 }} disabled={loading}>
                  {loading ? "Sending…" : "Send reset link"}
                </button>
                <button type="button" className="btn btn-ghost" style={{ width:"100%", justifyContent:"center" }} onClick={() => setResetMode(false)}>Cancel</button>
              </form>
            )
          ) : (
            <>
              <div style={{ display:"flex", gap:3, marginBottom:28, background:T.bgSurface, padding:3, borderRadius:10 }}>
                {["login","register"].map(t => (
                  <button key={t} onClick={() => setTab(t)} style={{ flex:1, padding:"8px", border:"none", borderRadius:8, background:tab===t ? T.bgCard : "transparent", color:tab===t ? T.text : T.textSub, fontFamily:"'Inter',sans-serif", fontSize:13, fontWeight:tab===t?500:400, cursor:"pointer", transition:"all .15s", textTransform:"capitalize" }}>{t === "login" ? "Sign in" : "Create account"}</button>
                ))}
              </div>
              <form onSubmit={submit}>
                {tab === "register" && (
                  <div style={{ marginBottom:14 }}>
                    <label style={{ fontSize:12, color:T.textSub, display:"block", marginBottom:6 }}>Full name</label>
                    <input placeholder="Your full name" value={form.name} onChange={F("name")} />
                  </div>
                )}
                <div style={{ marginBottom:14 }}>
                  <label style={{ fontSize:12, color:T.textSub, display:"block", marginBottom:6 }}>Email address</label>
                  <input type="email" placeholder="you@example.com" value={form.email} onChange={F("email")} />
                </div>
                <div style={{ marginBottom: tab==="register" ? 14 : 6 }}>
                  <label style={{ fontSize:12, color:T.textSub, display:"block", marginBottom:6 }}>Password</label>
                  <input type="password" placeholder={tab==="register" ? "Min. 8 characters" : "Enter password"} value={form.password} onChange={F("password")} />
                </div>
                {tab === "register" && (
                  <div style={{ marginBottom:14 }}>
                    <label style={{ fontSize:12, color:T.textSub, display:"block", marginBottom:6 }}>I want to…</label>
                    <select value={form.role} onChange={F("role")}>
                      <option value="customer">Browse and book tickets</option>
                      <option value="organizer">Create and manage events</option>
                    </select>
                  </div>
                )}
                {tab === "login" && (
                  <div style={{ textAlign:"right", marginBottom:18 }}>
                    <button type="button" onClick={() => onResetPassword ? onResetPassword() : setResetMode(true)} style={{ background:"none", border:"none", color:T.gold, fontSize:12, cursor:"pointer", fontFamily:"'Inter',sans-serif", fontWeight:500 }}>Forgot password?</button>
                  </div>
                )}
                {err && <p style={{ color:T.rose, fontSize:12, marginBottom:12, display:"flex", alignItems:"center", gap:5 }}><Ic n="alert" s={13} c={T.rose} />{err}</p>}
                <button className="btn btn-primary" type="submit" style={{ width:"100%", justifyContent:"center", padding:"11px 20px" }} disabled={loading}>
                  {loading ? "Please wait…" : tab==="login" ? "Sign in to vbook" : "Create my account"}
                </button>
              </form>
              <div style={{ margin:"18px 0", display:"flex", alignItems:"center", gap:10 }}>
                <div style={{ flex:1, height:"1px", background:T.border }} />
                <span style={{ fontSize:11, color:T.textDim }}>or</span>
                <div style={{ flex:1, height:"1px", background:T.border }} />
              </div>
              <button className="btn btn-ghost" style={{ width:"100%", justifyContent:"center", fontSize:13 }} onClick={() => setErr("Use your real admin credentials to continue.")}>
                Continue as Admin (Demo)
              </button>
            </>
          )}
        </div>
        <p style={{ textAlign:"center", marginTop:20, fontSize:11, color:T.textDim }}>
          By continuing you agree to our Terms of Service & Privacy Policy
        </p>
      </div>
    </div>
  );
};

// ─── SIDEBAR ──────────────────────────────────────────────────────────────────
const Sidebar = ({ page, setPage, user, onLogout, open, setOpen }) => {
  const isAdmin = user.role === "admin";
  const isOrg = user.role === "organizer" || isAdmin;
  const sections = [
    { title:"Discover", items:[{ id:"home", icon:"home", label:"Home" }, { id:"events", icon:"calendar", label:"Events" }] },
    ...(isOrg ? [{ title:"Manage", items:[{ id:"venues", icon:"building", label:"Venues" }, { id:"create-event", icon:"plus", label:"New Event" }] }] : []),
    { title:"Account", items:[{ id:"my-tickets", icon:"ticket", label:"My Tickets" }, { id:"profile", icon:"user", label:"Profile" }] },
    ...(isAdmin ? [{ title:"Administration", items:[{ id:"admin", icon:"settings", label:"Dashboard" }, { id:"admin-bookings", icon:"grid", label:"Bookings" }, { id:"admin-users", icon:"users", label:"Users" }, { id:"waitlist", icon:"clock", label:"Waitlist" }] }] : []),
  ];
  const sidebarWidth = 216;

  return (
    <aside
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      style={{ width:sidebarWidth, background:T.bgCard, borderRight:`1px solid ${T.border}`, display:"flex", flexDirection:"column", height:"100vh", position:"fixed", top:0, left:open ? 0 : -sidebarWidth, zIndex:150, transition:"left .24s cubic-bezier(0.34, 1.56, 0.64, 1)", overflow:"hidden" }}>
      <div style={{ padding:"22px 16px 18px", borderBottom:`1px solid ${T.border}`, display:"flex", alignItems:"center", justifyContent:"flex-start" }}>
        <div style={{ display:"flex", alignItems:"center", gap:10 }}>
          <div style={{ width:32, height:32, background:`linear-gradient(135deg,${T.gold},${T.goldDark})`, borderRadius:8, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
            <Ic n="ticket" s={14} c="#09090F" />
          </div>
          <span className="serif" style={{ fontSize:22, fontWeight:700, color:T.gold, letterSpacing:3 }}>vbook</span>
        </div>
      </div>
      <nav style={{ flex:1, overflowY:"auto", padding:"10px 8px" }}>
        {sections.map(sec => (
          <div key={sec.title} style={{ marginBottom:6 }}>
            <p style={{ fontSize:10, fontWeight:600, letterSpacing:1.2, color:T.textDim, padding:"8px 12px 4px", textTransform:"uppercase" }}>{sec.title}</p>
            {sec.items.map(item => (
              <button key={item.id} className={`nav-item ${page===item.id?"active":""}`} onClick={() => setPage(item.id)}>
                <Ic n={item.icon} s={14} c={page===item.id ? T.gold : T.textSub} />
                <span>{item.label}</span>
              </button>
            ))}
          </div>
        ))}
      </nav>
      <div style={{ padding:"10px 8px", borderTop:`1px solid ${T.border}` }}>
        <div style={{ padding:"10px 12px", marginBottom:4, display:"flex", alignItems:"center", gap:10 }}>
          <div style={{ width:33, height:33, borderRadius:"50%", background:`linear-gradient(135deg,${T.accent},${T.purple})`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:13, fontWeight:600, color:"#fff", flexShrink:0 }}>
            {user.name[0]}
          </div>
          <div style={{ minWidth:0 }}>
            <p style={{ fontSize:13, fontWeight:500, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{user.name}</p>
            <span className="tag" style={{ background:T.goldGlow, color:T.gold, fontSize:10, marginTop:2 }}>{user.role}</span>
          </div>
        </div>
        <button className="nav-item" onClick={onLogout}><Ic n="logout" s={14} c={T.textSub} />Sign out</button>
      </div>
    </aside>
  );
};

// ─── TOP BAR ──────────────────────────────────────────────────────────────────
const TopBar = ({ title, sub, actions }) => (
  <header style={{ padding:"18px 28px", borderBottom:`1px solid ${T.border}`, display:"flex", alignItems:"center", justifyContent:"space-between", background:T.bgCard, flexShrink:0 }}>
    <div>
      <h1 className="serif" style={{ fontSize:21, fontWeight:600, color:T.text }}>{title}</h1>
      {sub && <p style={{ fontSize:12, color:T.textSub, marginTop:2 }}>{sub}</p>}
    </div>
    {actions && <div style={{ display:"flex", gap:9, alignItems:"center" }}>{actions}</div>}
  </header>
);

// ─── HOME ─────────────────────────────────────────────────────────────────────
const HomePage = ({ setPage, setSelectedEvent, eventsData = [] }) => {
  const sourceEvents = eventsData.length ? eventsData : EVENTS;
  const featured = sourceEvents[0];
  const trending = sourceEvents.slice(1, 4);
  if (!featured) return null;
  const pct = Math.round(featured.sold / featured.capacity * 100);

  return (
    <div style={{ flex:1, overflowY:"auto", padding:"28px 28px 40px" }} className="fade-in">
      {/* Hero */}
      <div style={{ position:"relative", borderRadius:16, border:`1px solid ${T.border}`, overflow:"hidden", marginBottom:28, background:`linear-gradient(130deg, ${T.bgSurface} 0%, rgba(91,127,255,0.06) 100%)` }}>
        <div style={{ position:"absolute", inset:0, background:`radial-gradient(ellipse 50% 80% at 85% 50%, rgba(91,127,255,0.1) 0%, transparent 60%)`, pointerEvents:"none" }} />
        <div style={{ padding:"36px 40px" }}>
          <div style={{ display:"inline-flex", alignItems:"center", gap:5, background:T.roseSoft, border:`1px solid rgba(240,96,112,0.2)`, borderRadius:20, padding:"4px 12px", marginBottom:16 }}>
            <span className="live-dot" style={{ fontSize:11, color:T.rose, fontWeight:600, letterSpacing:.5 }}>SELLING FAST</span>
          </div>
          <h2 className="serif" style={{ fontSize:34, fontWeight:700, marginBottom:10, lineHeight:1.2, maxWidth:480 }}>{featured.name}</h2>
          <div style={{ display:"flex", flexWrap:"wrap", gap:18, marginBottom:14, color:T.textSub, fontSize:13 }}>
            <span style={{ display:"flex", alignItems:"center", gap:5 }}><Ic n="pin" s={13} />{featured.venue}</span>
            <span style={{ display:"flex", alignItems:"center", gap:5 }}><Ic n="calendar" s={13} />Aug 15, 2025</span>
            <span style={{ display:"flex", alignItems:"center", gap:5 }}><Ic n="clock" s={13} />{featured.time}</span>
          </div>
          <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:22 }}>
            <div style={{ flex:1, maxWidth:260 }}>
              <div style={{ display:"flex", justifyContent:"space-between", marginBottom:5, fontSize:12 }}>
                <span style={{ color:T.textSub }}>{featured.sold.toLocaleString()} sold</span>
                <span style={{ color:T.gold, fontWeight:600 }}>{pct}%</span>
              </div>
              <div className="progress-bar" style={{ height:4 }}>
                <div className="progress-fill" style={{ width:`${pct}%`, background:`linear-gradient(90deg,${T.gold},${T.goldLight})` }} />
              </div>
            </div>
            <span style={{ fontSize:12, color:T.textSub }}>{(featured.capacity - featured.sold).toLocaleString()} remaining</span>
          </div>
          <div style={{ display:"flex", gap:10 }}>
            <button className="btn btn-primary" onClick={() => { setSelectedEvent(featured); setPage("event-detail"); }}>
              <Ic n="ticket" s={14} c="#09090F" />Book Now — PKR {featured.price.toLocaleString()}
            </button>
            <button className="btn btn-secondary" onClick={() => { setSelectedEvent(featured); setPage("seat-map"); }}>
              <Ic n="map" s={14} />Seat Map
            </button>
          </div>
        </div>
        <div style={{ position:"absolute", right:40, top:"50%", transform:"translateY(-50%)", fontSize:96, opacity:.06, pointerEvents:"none", userSelect:"none" }}>{featured.emoji}</div>
      </div>

      {/* Stats row */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:14, marginBottom:28 }}>
        {[
          { label:"Live Events", value:"24", icon:"zap", color:T.gold },
          { label:"Venues", value:"8", icon:"building", color:T.accent },
          { label:"Tickets Sold", value:"29.7K", icon:"ticket", color:T.teal },
          { label:"Happy Fans", value:"18.2K", icon:"star", color:T.purple },
        ].map(s => (
          <div key={s.label} className="stat-card" style={{ padding:"16px 18px" }}>
            <div style={{ display:"flex", alignItems:"center", gap:9, marginBottom:10 }}>
              <div style={{ width:30, height:30, borderRadius:8, background:`${s.color}18`, display:"flex", alignItems:"center", justifyContent:"center" }}>
                <Ic n={s.icon} s={13} c={s.color} />
              </div>
              <span style={{ fontSize:11.5, color:T.textSub }}>{s.label}</span>
            </div>
            <p className="serif" style={{ fontSize:26, fontWeight:600 }}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Trending */}
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16 }}>
        <h3 style={{ fontSize:16, fontWeight:600 }}>Trending Events</h3>
        <button className="btn btn-ghost btn-sm" onClick={() => setPage("events")}>Browse all <Ic n="chevronR" s={13} /></button>
      </div>
      <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:16 }}>
        {trending.map(ev => (
          <div key={ev.id} className="event-card" onClick={() => { setSelectedEvent(ev); setPage("event-detail"); }}>
            <div style={{ height:88, background:`linear-gradient(135deg,${ev.color}20,${ev.color}06)`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:40, position:"relative" }}>
              {ev.emoji}
              <span className="tag" style={{ position:"absolute", top:10, right:10, background:`${ev.color}18`, color:ev.color, border:`1px solid ${ev.color}30`, fontSize:10 }}>{ev.category}</span>
            </div>
            <div style={{ padding:"14px 16px" }}>
              <h4 style={{ fontSize:14, fontWeight:600, marginBottom:5, lineHeight:1.35 }}>{ev.name}</h4>
              <p style={{ fontSize:12, color:T.textSub, marginBottom:10, display:"flex", alignItems:"center", gap:4 }}><Ic n="pin" s={11} />{ev.venue}</p>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                <span style={{ fontSize:15, fontWeight:700, color:T.gold }}>PKR {ev.price.toLocaleString()}</span>
                <span className="tag" style={{ background:ev.status==="sold-out"?T.roseSoft:T.tealSoft, color:ev.status==="sold-out"?T.rose:T.teal, border:`1px solid ${ev.status==="sold-out"?"rgba(240,96,112,.2)":"rgba(46,196,160,.2)"}` }}>
                  {ev.status==="sold-out"?"Sold Out":"Available"}
                </span>
              </div>
              <div style={{ marginTop:10 }}>
                <div className="progress-bar"><div className="progress-fill" style={{ width:`${Math.round(ev.sold/ev.capacity*100)}%`, background:ev.status==="sold-out"?T.rose:T.gold }} /></div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// ─── EVENTS PAGE ──────────────────────────────────────────────────────────────
const EventsPage = ({ setPage, setSelectedEvent, eventsData = [], eventsLoading = false }) => {
  const [search, setSearch] = useState("");
  const [cat, setCat] = useState("All");
  const [view, setView] = useState("grid");
  const [sort, setSort] = useState("date");
  const cats = ["All","Concert","Seminar","Movie Screening","Party"];

  const sourceEvents = eventsData.length ? eventsData : EVENTS;
  const filtered = sourceEvents
    .filter(e => (cat==="All" || e.category===cat) && e.name.toLowerCase().includes(search.toLowerCase()))
    .sort((a,b) => sort==="price" ? a.price-b.price : sort==="popularity" ? (b.sold/b.capacity)-(a.sold/a.capacity) : a.date.localeCompare(b.date));

  return (
    <div style={{ display:"flex", flexDirection:"column", height:"100%", overflow:"hidden" }}>
      <TopBar title="Events" sub={eventsLoading ? "Loading events..." : `${filtered.length} events available`} actions={
        <>
          <div className="search-wrap">
            <Ic n="search" s={13} c={T.textDim} />
            <input className="search-input" placeholder="Search events…" value={search} onChange={e=>setSearch(e.target.value)} />
          </div>
          <select value={sort} onChange={e=>setSort(e.target.value)} style={{ width:"auto", padding:"8px 12px", fontSize:12 }}>
            <option value="date">Sort: Date</option>
            <option value="price">Sort: Price</option>
            <option value="popularity">Sort: Popularity</option>
          </select>
          <button className={`btn btn-icon btn-ghost`} onClick={() => setView(v => v==="grid"?"list":"grid")} title={view==="grid"?"List view":"Grid view"}>
            <Ic n={view==="grid"?"list":"grid"} s={15} />
          </button>
        </>
      } />
      <div style={{ padding:"12px 28px 0", borderBottom:`1px solid ${T.border}`, display:"flex", gap:4, flexShrink:0 }}>
        {cats.map(c => <button key={c} className={`tab-btn ${cat===c?"active":""}`} onClick={()=>setCat(c)}>{c}</button>)}
      </div>
      <div style={{ flex:1, overflowY:"auto", padding:"24px 28px 40px" }} className="fade-in">
        {view==="grid" ? (
          <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:18 }}>
            {filtered.map(ev => (
              <div key={ev.id} className="event-card" onClick={() => { setSelectedEvent(ev); setPage("event-detail"); }}>
                <div style={{ height:100, background:`linear-gradient(135deg,${ev.color}22,${ev.color}08)`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:44, position:"relative" }}>
                  {ev.emoji}
                  <span className="tag" style={{ position:"absolute",top:10,right:10,background:`${ev.color}18`,color:ev.color,border:`1px solid ${ev.color}30`,fontSize:10 }}>{ev.category}</span>
                </div>
                <div style={{ padding:"16px 18px" }}>
                  <h4 style={{ fontSize:14, fontWeight:600, marginBottom:5 }}>{ev.name}</h4>
                  <p style={{ fontSize:12, color:T.textSub, marginBottom:4, display:"flex", alignItems:"center", gap:4 }}><Ic n="pin" s={11} />{ev.venue}</p>
                  <p style={{ fontSize:12, color:T.textSub, marginBottom:12, display:"flex", alignItems:"center", gap:4 }}><Ic n="calendar" s={11} />{new Date(ev.date).toLocaleDateString("en-PK",{day:"numeric",month:"short",year:"numeric"})} · {ev.time}</p>
                  <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                    <span style={{ fontSize:15, fontWeight:700, color:T.gold }}>PKR {ev.price.toLocaleString()}</span>
                    <button className={`btn btn-sm ${ev.status==="sold-out"?"btn-ghost":"btn-primary"}`}
                      onClick={e => { e.stopPropagation(); setSelectedEvent(ev); setPage("event-detail"); }}>
                      {ev.status==="sold-out"?"Waitlist":"Book"}
                    </button>
                  </div>
                  <div style={{ marginTop:10 }}>
                    <div style={{ display:"flex", justifyContent:"space-between", marginBottom:4 }}>
                      <span style={{ fontSize:11, color:T.textDim }}>{ev.sold.toLocaleString()} / {ev.capacity.toLocaleString()}</span>
                      <span style={{ fontSize:11, color:T.textSub }}>{Math.round(ev.sold/ev.capacity*100)}%</span>
                    </div>
                    <div className="progress-bar">
                      <div className="progress-fill" style={{ width:`${Math.round(ev.sold/ev.capacity*100)}%`, background:ev.status==="sold-out"?T.rose:T.gold }} />
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
            {filtered.map(ev => (
              <div key={ev.id} className="card" style={{ padding:"16px 20px", display:"flex", alignItems:"center", gap:18, cursor:"pointer", transition:"border-color .2s" }}
                onMouseEnter={e=>e.currentTarget.style.borderColor=T.borderMed}
                onMouseLeave={e=>e.currentTarget.style.borderColor=T.border}
                onClick={() => { setSelectedEvent(ev); setPage("event-detail"); }}>
                <div style={{ width:54, height:54, background:`${ev.color}18`, borderRadius:10, display:"flex", alignItems:"center", justifyContent:"center", fontSize:24, flexShrink:0 }}>{ev.emoji}</div>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:4 }}>
                    <h4 style={{ fontSize:14, fontWeight:600 }}>{ev.name}</h4>
                    <span className="tag" style={{ background:`${ev.color}15`, color:ev.color, border:`1px solid ${ev.color}25`, fontSize:10 }}>{ev.category}</span>
                  </div>
                  <p style={{ fontSize:12, color:T.textSub }}>{ev.venue} · {ev.date} · {ev.time}</p>
                </div>
                <div style={{ display:"flex", alignItems:"center", gap:16, flexShrink:0 }}>
                  <div style={{ width:90 }}>
                    <div className="progress-bar"><div className="progress-fill" style={{ width:`${Math.round(ev.sold/ev.capacity*100)}%`, background:T.gold }} /></div>
                    <p style={{ fontSize:10, color:T.textDim, marginTop:3, textAlign:"right" }}>{Math.round(ev.sold/ev.capacity*100)}% sold</p>
                  </div>
                  <div style={{ textAlign:"right", minWidth:80 }}>
                    <p style={{ fontSize:15, fontWeight:700, color:T.gold, marginBottom:4 }}>PKR {ev.price.toLocaleString()}</p>
                    <span className="tag" style={{ background:ev.status==="sold-out"?T.roseSoft:T.tealSoft, color:ev.status==="sold-out"?T.rose:T.teal }}>
                      {ev.status==="sold-out"?"Sold Out":"Available"}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

// ─── EVENT DETAIL ─────────────────────────────────────────────────────────────
const EventDetail = ({ event, setPage, user, toast }) => {
  const [qty, setQty] = useState(1);
  const [section, setSection] = useState("Standard");
  const [step, setStep] = useState("detail");
  const [card, setCard] = useState({ num:"", exp:"", cvv:"", name:"" });
  const [errors, setErrors] = useState({});
  const [joined, setJoined] = useState(false);

  if (!event) return null;
  const isSoldOut = event.status === "sold-out";
  const prices = { VIP: event.price*2, Premium: Math.round(event.price*1.5), Standard: event.price, "Gen. Admission": Math.round(event.price*0.6) };
  const subtotal = prices[section] * qty;
  const fee = Math.round(subtotal * 0.05);
  const total = subtotal + fee;

  const validate = () => {
    const e = {};
    if (!card.num || card.num.replace(/\s/g,"").length < 16) e.num = "Enter a valid card number";
    if (!card.exp || !/^\d{2}\/\d{2}$/.test(card.exp)) e.exp = "MM/YY format";
    if (!card.cvv || card.cvv.length < 3) e.cvv = "3-4 digits";
    if (!card.name) e.name = "Required";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const pay = () => {
    if (!validate()) return;
    toast("Payment successful! Tickets sent to " + user.email, "success");
    setStep("confirmed");
  };

  const joinWaitlist = async () => {
    if (!user?.token) { toast("Please sign in to join the waitlist", "error"); return; }
    try {
      await apiRequest("/waiting", {
        method: "POST",
        body: JSON.stringify({
          event_id: event.event_id || event.id,
          section_id: section === "VIP" ? "S001" : section === "Premium" ? "S002" : "S001",
          force: true
        })
      }, user.token);
      setJoined(true);
      toast("You've joined the waitlist! We'll notify you by email.", "success");
    } catch (error) {
      if (error.message?.includes("Already on waitlist")) {
        setJoined(true);
        toast("You're already on the waitlist for this event.", "info");
      } else {
        toast(error.message || "Failed to join waitlist", "error");
      }
    }
  };

  if (step === "confirmed") {
    const ref = "VB-" + Math.floor(Math.random()*90000+10000);
    return (
      <div style={{ flex:1, overflowY:"auto", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", padding:40, textAlign:"center" }} className="fade-in">
        <div style={{ width:72, height:72, background:T.tealSoft, borderRadius:"50%", display:"flex", alignItems:"center", justifyContent:"center", margin:"0 auto 20px" }}>
          <Ic n="check" s={32} c={T.teal} />
        </div>
        <h2 className="serif" style={{ fontSize:28, marginBottom:8 }}>Booking Confirmed!</h2>
        <p style={{ color:T.textSub, marginBottom:6 }}>
          {qty} × {section} ticket{qty>1?"s":""} for <strong style={{ color:T.text }}>{event.name}</strong>
        </p>
        <p style={{ color:T.textSub, fontSize:13, marginBottom:30 }}>Sent to <strong style={{ color:T.text }}>{user.email}</strong></p>
        <div className="card" style={{ padding:24, marginBottom:28, width:"100%", maxWidth:380, textAlign:"left" }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16, paddingBottom:14, borderBottom:`1px solid ${T.border}` }}>
            <span style={{ fontSize:12, color:T.textSub }}>Booking reference</span>
            <span style={{ fontSize:13, fontWeight:700, color:T.gold }}>{ref}</span>
          </div>
          {[["Event", event.name], ["Section", section], ["Quantity", qty.toString()], ["Subtotal", `PKR ${subtotal.toLocaleString()}`], ["Service fee", `PKR ${fee.toLocaleString()}`]].map(([k,v]) => (
            <div key={k} style={{ display:"flex", justifyContent:"space-between", marginBottom:8 }}>
              <span style={{ fontSize:13, color:T.textSub }}>{k}</span>
              <span style={{ fontSize:13 }}>{v}</span>
            </div>
          ))}
          <div style={{ borderTop:`1px solid ${T.border}`, paddingTop:10, marginTop:6, display:"flex", justifyContent:"space-between" }}>
            <span style={{ fontWeight:600 }}>Total paid</span>
            <span style={{ fontWeight:700, color:T.gold, fontSize:15 }}>PKR {total.toLocaleString()}</span>
          </div>
        </div>
        {/* QR Code (decorative) */}
        <div style={{ marginBottom:28 }}>
          <div style={{ background:T.bgCard, border:`1px solid ${T.border}`, borderRadius:12, padding:16, display:"inline-block" }}>
            <div style={{ width:80, height:80, background:`repeating-linear-gradient(0deg, ${T.bgSurface} 0px, ${T.bgSurface} 8px, ${T.bgCard} 8px, ${T.bgCard} 16px), repeating-linear-gradient(90deg, ${T.bgSurface} 0px, ${T.bgSurface} 8px, ${T.bgCard} 8px, ${T.bgCard} 16px)`, borderRadius:4 }}>
              <div style={{ position:"relative", width:"100%", height:"100%", display:"grid", gridTemplateColumns:"repeat(8,1fr)", gap:1 }}>
                {Array.from({length:64},(_, i)=>(
                  <div key={i} style={{ background:Math.random()>0.5?T.textSub:"transparent", borderRadius:1 }} />
                ))}
              </div>
            </div>
            <p style={{ fontSize:10, color:T.textDim, textAlign:"center", marginTop:8 }}>Scan at entry</p>
          </div>
        </div>
        <div style={{ display:"flex", gap:10 }}>
          <button className="btn btn-primary" onClick={() => setPage("my-tickets")}><Ic n="ticket" s={14} c="#09090F" />My Tickets</button>
          <button className="btn btn-ghost" onClick={() => setStep("detail")}>Book More</button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ flex:1, overflowY:"auto" }} className="fade-in">
      {/* Hero banner */}
      <div style={{ background:`linear-gradient(130deg, ${event.color}14, ${event.color}04)`, borderBottom:`1px solid ${T.border}`, padding:"28px 32px 24px", position:"relative" }}>
        <button className="btn btn-ghost btn-sm" onClick={() => setPage("events")} style={{ marginBottom:18, display:"inline-flex" }}>
          <Ic n="chevronL" s={13} />Back to Events
        </button>
        <div style={{ display:"flex", gap:24, alignItems:"flex-start" }}>
          <div style={{ fontSize:62, flexShrink:0, lineHeight:1 }}>{event.emoji}</div>
          <div style={{ flex:1 }}>
            <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:8 }}>
              <span className="tag" style={{ background:`${event.color}18`, color:event.color, border:`1px solid ${event.color}30` }}>{event.category}</span>
              {event.status==="sold-out" && <span className="tag" style={{ background:T.roseSoft, color:T.rose, border:`1px solid rgba(240,96,112,.2)` }}>Sold Out</span>}
            </div>
            <h1 className="serif" style={{ fontSize:28, fontWeight:700, marginBottom:10, lineHeight:1.2 }}>{event.name}</h1>
            <div style={{ display:"flex", flexWrap:"wrap", gap:16, color:T.textSub, fontSize:13 }}>
              <span style={{ display:"flex", alignItems:"center", gap:5 }}><Ic n="pin" s={13} />{event.venue}</span>
              <span style={{ display:"flex", alignItems:"center", gap:5 }}><Ic n="calendar" s={13} />{new Date(event.date).toLocaleDateString("en-PK",{weekday:"long",day:"numeric",month:"long",year:"numeric"})}</span>
              <span style={{ display:"flex", alignItems:"center", gap:5 }}><Ic n="clock" s={13} />{event.time}</span>
            </div>
          </div>
          {!isSoldOut && (
            <button className="btn btn-secondary" onClick={() => setPage("seat-map")} style={{ flexShrink:0 }}>
              <Ic n="map" s={14} />View Seat Map
            </button>
          )}
        </div>
      </div>

      <div style={{ display:"grid", gridTemplateColumns:"1fr 360px", gap:24, padding:"24px 32px 40px", alignItems:"start" }}>
        {/* Left col */}
        <div>
          <div className="card" style={{ padding:24, marginBottom:18 }}>
            <h3 style={{ fontSize:14, fontWeight:600, marginBottom:12 }}>About this event</h3>
            <p style={{ color:T.textSub, fontSize:13.5, lineHeight:1.75 }}>{event.desc}</p>
          </div>
          <div className="card" style={{ padding:24, marginBottom:18 }}>
            <h3 style={{ fontSize:14, fontWeight:600, marginBottom:16 }}>Venue details</h3>
            <div style={{ display:"flex", gap:12, marginBottom:16 }}>
              <div style={{ width:40, height:40, background:T.goldGlow, borderRadius:9, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
                <Ic n="building" s={17} c={T.gold} />
              </div>
              <div>
                <p style={{ fontSize:14, fontWeight:500, marginBottom:2 }}>{event.venue}</p>
                <p style={{ fontSize:12, color:T.textSub }}>Lahore, Punjab, Pakistan</p>
              </div>
            </div>
            <div style={{ display:"grid", gridTemplateColumns:"repeat(2,1fr)", gap:10 }}>
              {[["Total Capacity",event.capacity.toLocaleString()],["Seats Available",(event.capacity-event.sold).toLocaleString()],["Parking","Available"],["Accessibility","Yes — wheelchair"]].map(([k,v]) => (
                <div key={k} className="surface" style={{ padding:"10px 14px" }}>
                  <p style={{ fontSize:11, color:T.textDim, marginBottom:3 }}>{k}</p>
                  <p style={{ fontSize:13, fontWeight:500 }}>{v}</p>
                </div>
              ))}
            </div>
          </div>
          <div className="card" style={{ padding:24 }}>
            <h3 style={{ fontSize:14, fontWeight:600, marginBottom:14 }}>Ticket sections</h3>
            <div style={{ display:"flex", flexDirection:"column", gap:9 }}>
              {Object.entries(prices).map(([name, price]) => (
                <div key={name} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"12px 16px", background:section===name?T.goldGlow:T.bgSurface, border:`1px solid ${section===name?T.borderGold:"transparent"}`, borderRadius:9, cursor:"pointer", transition:"all .15s" }}
                  onClick={() => setSection(name)}>
                  <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                    <div style={{ width:18, height:18, borderRadius:"50%", border:`2px solid ${section===name?T.gold:T.border}`, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
                      {section===name && <div style={{ width:8, height:8, borderRadius:"50%", background:T.gold }} />}
                    </div>
                    <div>
                      <p style={{ fontSize:13, fontWeight:500 }}>{name}</p>
                      <p style={{ fontSize:11, color:T.textDim }}>{name==="VIP"?"Front row · premium service":name==="Premium"?"Excellent view sections":name==="Standard"?"Great value seating":"Open floor access"}</p>
                    </div>
                  </div>
                  <span style={{ fontSize:13, fontWeight:700, color:T.gold }}>PKR {price.toLocaleString()}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right col — booking panel */}
        <div style={{ position:"sticky", top:16 }}>
          <div className="card" style={{ padding:24 }}>
            {isSoldOut ? (
              <div style={{ textAlign:"center", padding:"12px 0" }}>
                <div style={{ width:52, height:52, background:T.amberSoft, borderRadius:"50%", display:"flex", alignItems:"center", justifyContent:"center", margin:"0 auto 14px" }}>
                  <Ic n="clock" s={24} c={T.amber} />
                </div>
                <h3 style={{ fontSize:16, fontWeight:600, marginBottom:8 }}>This event is sold out</h3>
                <p style={{ fontSize:13, color:T.textSub, marginBottom:20, lineHeight:1.6 }}>Join the waitlist and we'll notify you immediately if a seat becomes available. Promoted users get a 15-minute timed hold.</p>
                {joined ? (
                  <div style={{ background:T.tealSoft, border:`1px solid rgba(46,196,160,.2)`, borderRadius:9, padding:14, display:"flex", alignItems:"center", gap:10 }}>
                    <Ic n="check" s={16} c={T.teal} />
                    <p style={{ fontSize:13, color:T.teal }}>You're on the waitlist!</p>
                  </div>
                ) : (
                  <button className="btn btn-primary" style={{ width:"100%", justifyContent:"center" }} onClick={joinWaitlist}>
                    <Ic n="bell" s={14} c="#09090F" />Join Waitlist
                  </button>
                )}
              </div>
            ) : step === "detail" ? (
              <>
                <h3 style={{ fontSize:15, fontWeight:600, marginBottom:18 }}>Book tickets</h3>
                <div style={{ marginBottom:14 }}>
                  <label style={{ fontSize:12, color:T.textSub, display:"block", marginBottom:6 }}>Section</label>
                  <select value={section} onChange={e=>setSection(e.target.value)}>
                    {Object.keys(prices).map(s=><option key={s}>{s}</option>)}
                  </select>
                </div>
                <div style={{ marginBottom:18 }}>
                  <label style={{ fontSize:12, color:T.textSub, display:"block", marginBottom:8 }}>Quantity</label>
                  <div style={{ display:"flex", alignItems:"center", gap:12 }}>
                    <button onClick={()=>setQty(q=>Math.max(1,q-1))} style={{ width:36,height:36,borderRadius:8,background:T.bgSurface,border:`1px solid ${T.border}`,color:T.text,cursor:"pointer",fontSize:18,display:"flex",alignItems:"center",justifyContent:"center" }}>−</button>
                    <span style={{ fontSize:18, fontWeight:600, minWidth:28, textAlign:"center" }}>{qty}</span>
                    <button onClick={()=>setQty(q=>Math.min(8,q+1))} style={{ width:36,height:36,borderRadius:8,background:T.bgSurface,border:`1px solid ${T.border}`,color:T.text,cursor:"pointer",fontSize:18,display:"flex",alignItems:"center",justifyContent:"center" }}>+</button>
                    <span style={{ fontSize:12, color:T.textDim }}>max 8</span>
                  </div>
                </div>
                <div className="surface" style={{ padding:"14px 16px", marginBottom:18 }}>
                  <div style={{ display:"flex", justifyContent:"space-between", marginBottom:7 }}>
                    <span style={{ fontSize:13, color:T.textSub }}>{section} × {qty}</span>
                    <span style={{ fontSize:13 }}>PKR {subtotal.toLocaleString()}</span>
                  </div>
                  <div style={{ display:"flex", justifyContent:"space-between", paddingBottom:10, borderBottom:`1px solid ${T.border}`, marginBottom:10 }}>
                    <span style={{ fontSize:13, color:T.textSub }}>Service fee (5%)</span>
                    <span style={{ fontSize:13 }}>PKR {fee.toLocaleString()}</span>
                  </div>
                  <div style={{ display:"flex", justifyContent:"space-between" }}>
                    <span style={{ fontWeight:600, fontSize:14 }}>Total</span>
                    <span style={{ fontWeight:700, color:T.gold, fontSize:15 }}>PKR {total.toLocaleString()}</span>
                  </div>
                </div>
                <button className="btn btn-primary" style={{ width:"100%", justifyContent:"center", padding:"11px" }} onClick={() => setStep("payment")}>
                  <Ic n="card" s={14} c="#09090F" />Continue to Payment
                </button>
              </>
            ) : (
              <>
                <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:18 }}>
                  <button onClick={()=>setStep("detail")} style={{ background:"none", border:"none", cursor:"pointer", color:T.textSub }}><Ic n="chevronL" s={16} /></button>
                  <h3 style={{ fontSize:15, fontWeight:600 }}>Payment</h3>
                </div>
                <div className="surface" style={{ padding:"12px 16px", marginBottom:16, borderLeft:`3px solid ${T.gold}` }}>
                  <div style={{ display:"flex", justifyContent:"space-between" }}>
                    <span style={{ fontSize:13, color:T.textSub }}>{section} × {qty}</span>
                    <span style={{ fontSize:14, fontWeight:700, color:T.gold }}>PKR {total.toLocaleString()}</span>
                  </div>
                </div>
                <div style={{ marginBottom:12 }}>
                  <label style={{ fontSize:12, color:T.textSub, display:"block", marginBottom:6 }}>Cardholder name</label>
                  <input placeholder="Name on card" value={card.name} onChange={e=>setCard(c=>({...c,name:e.target.value}))} style={{ borderColor:errors.name?"var(--rose)":"" }} />
                  {errors.name && <p style={{ fontSize:11, color:T.rose, marginTop:4 }}>{errors.name}</p>}
                </div>
                <div style={{ marginBottom:12 }}>
                  <label style={{ fontSize:12, color:T.textSub, display:"block", marginBottom:6 }}>Card number</label>
                  <input placeholder="0000 0000 0000 0000" value={card.num}
                    onChange={e=>setCard(c=>({...c,num:e.target.value.replace(/[^\d]/g,"").replace(/(\d{4})(?=\d)/g,"$1 ").trim()}))}
                    maxLength={19} style={{ borderColor:errors.num?"var(--rose)":"", fontFamily:"monospace", letterSpacing:1 }} />
                  {errors.num && <p style={{ fontSize:11, color:T.rose, marginTop:4 }}>{errors.num}</p>}
                </div>
                <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginBottom:18 }}>
                  <div>
                    <label style={{ fontSize:12, color:T.textSub, display:"block", marginBottom:6 }}>Expiry</label>
                    <input placeholder="MM/YY" value={card.exp}
                      onChange={e=>setCard(c=>({...c,exp:e.target.value.replace(/[^\d/]/g,"")}))}
                      maxLength={5} style={{ borderColor:errors.exp?"var(--rose)":"" }} />
                    {errors.exp && <p style={{ fontSize:11, color:T.rose, marginTop:4 }}>{errors.exp}</p>}
                  </div>
                  <div>
                    <label style={{ fontSize:12, color:T.textSub, display:"block", marginBottom:6 }}>CVV</label>
                    <input placeholder="•••" type="password" value={card.cvv}
                      onChange={e=>setCard(c=>({...c,cvv:e.target.value.replace(/\D/g,"")}))}
                      maxLength={4} style={{ borderColor:errors.cvv?"var(--rose)":"" }} />
                    {errors.cvv && <p style={{ fontSize:11, color:T.rose, marginTop:4 }}>{errors.cvv}</p>}
                  </div>
                </div>
                <button className="btn btn-primary" style={{ width:"100%", justifyContent:"center", padding:"11px" }} onClick={pay}>
                  Confirm & Pay — PKR {total.toLocaleString()}
                </button>
                <p style={{ fontSize:11, color:T.textDim, textAlign:"center", marginTop:10, display:"flex", alignItems:"center", justifyContent:"center", gap:4 }}>
                  <Ic n="lock" s={11} c={T.textDim} />256-bit SSL encrypted
                </p>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

// ─── SEAT MAP ─────────────────────────────────────────────────────────────────
const SeatMapPage = ({ event, setPage, toast, user }) => {
  const [seatmap, setSeatmap] = useState(null);
  const [loading, setLoading] = useState(false);
  const [seatError, setSeatError] = useState("");
  const [selected, setSelected] = useState([]);
  const [filter, setFilter] = useState("all");
  const [holdTimer, setHoldTimer] = useState(null);
  const [timeLeft, setTimeLeft] = useState(0);
  const [savedPayments, setSavedPayments] = useState([]);
  const [payMethod, setPayMethod] = useState("Online Wallet Payment");
  const [bookingInProgress, setBookingInProgress] = useState(false);
  const timerRef = useRef(null);
  const eventId = event?.event_id || event?.id;

  const reloadSeatmap = useCallback(async () => {
    if (!eventId) return;
    setLoading(true);
    setSeatError("");
    try {
      const data = await fetchSeatmap(eventId);
      setSeatmap(data);
    } catch (error) {
      setSeatError(error.message || "Failed to load seat map");
    } finally {
      setLoading(false);
    }
  }, [eventId]);

  useEffect(() => {
    reloadSeatmap();
  }, [reloadSeatmap]);

  useEffect(() => {
    if (!eventId) return;
    connectRealtime((payload) => {
      if (payload?.event_id === eventId) reloadSeatmap();
    });
    return () => disconnectRealtime();
  }, [eventId, reloadSeatmap]);

  useEffect(() => {
    if (!user?.token) return;
    fetchSavedPayments(user.token).then(rows => {
      if (rows?.length) setSavedPayments(rows);
    }).catch(() => {});
  }, [user]);

  const startHold = () => {
    setHoldTimer(true);
    setTimeLeft(600);
    toast("Seats held for 10 minutes. Complete purchase before time runs out!", "info");
  };

  useEffect(() => {
    if (holdTimer && timeLeft > 0) {
      timerRef.current = setTimeout(() => setTimeLeft(t => t-1), 1000);
      return () => clearTimeout(timerRef.current);
    }
    if (holdTimer && timeLeft === 0) {
      setSelected([]);
      setHoldTimer(false);
      toast("Your seat hold has expired. Please re-select.", "warning");
    }
  }, [holdTimer, timeLeft]);

  const seats = (seatmap?.sections || []).flatMap((sec) =>
    (sec.seats || []).map((seat) => {
      let status = "available";
      if (seat.state === "purchased" || seat.state === "blocked" || seat.state === "vip_reserved") status = "sold";
      else if (seat.state === "waitlist_held") status = "held";
      else if (seat.accessible) status = "accessible";
      const row = `${sec.section_name}-R${seat.y_coord ?? 0}`;
      const basePrice = Number(event?.price || 0);
      const factor = Number(seat.price_factor || 1);
      return {
        id: seat.seat_id,
        row,
        num: seat.seat_num,
        status,
        price: Math.max(0, Math.round(basePrice * factor)),
        section_name: sec.section_name || seat.section_name || seat.section_id
      };
    })
  );

  const toggle = (seat) => {
    if (seat.status !== "available" && seat.status !== "accessible") return;
    setSelected(s => {
      const next = s.includes(seat.id) ? s.filter(id=>id!==seat.id) : [...s, seat.id];
      if (next.length > 0 && !holdTimer) startHold();
      if (next.length === 0) { setHoldTimer(false); setTimeLeft(0); }
      return next;
    });
  };

  const byRow = {};
  seats.forEach(s => { if (!byRow[s.row]) byRow[s.row]=[]; byRow[s.row].push(s); });

  const counts = { available:0, sold:0, accessible:0, waitlist:0, held:0 };
  seats.forEach(s => counts[s.status]++);

  const fmt = (s) => `${Math.floor(s/60)}:${String(s%60).padStart(2,"0")}`;
  const pct = timeLeft / 600;
  const r = 18, circ = 2*Math.PI*r;

  const selectedTotal = selected.reduce((a, id) => a + (seats.find(s => s.id === id)?.price || 0), 0);

  const checkoutSelected = async () => {
    if (!selected.length || bookingInProgress) return;
    setBookingInProgress(true);
    try {
      for (const seatId of selected) {
        await bookSeat({
          event_id: eventId,
          seat_id: seatId,
          user_id: user.user_id,
          method: payMethod,
          amount: seats.find(s => s.id === seatId)?.price || 0
        }, user.token);
      }
      toast(`${selected.length} seat(s) booked successfully`, "success");
      setSelected([]);
      setHoldTimer(false);
      setTimeLeft(0);
      await reloadSeatmap();
    } catch (error) {
      toast(error.message || "Booking failed", "error");
    } finally {
      setBookingInProgress(false);
    }
  };

  return (
    <div style={{ display:"flex", flexDirection:"column", height:"100%", overflow:"hidden" }}>
      <TopBar
        title="Seat Map"
        sub={event?.name || "Select your seats"}
        actions={
          <>
            <button className="btn btn-ghost btn-sm" onClick={() => setPage("event-detail")}><Ic n="chevronL" s={13} />Back</button>
            {holdTimer && (
              <div style={{ display:"flex", alignItems:"center", gap:8, background:timeLeft<120?T.roseSoft:T.amberSoft, border:`1px solid ${timeLeft<120?"rgba(240,96,112,.25)":"rgba(245,158,11,.25)"}`, borderRadius:9, padding:"6px 12px" }}>
                <svg width={40} height={40} style={{ transform:"rotate(-90deg)" }}>
                  <circle cx={20} cy={20} r={r} fill="none" stroke={T.border} strokeWidth={3}/>
                  <circle cx={20} cy={20} r={r} fill="none" stroke={timeLeft<120?T.rose:T.amber} strokeWidth={3} strokeDasharray={circ} strokeDashoffset={circ*(1-pct)} strokeLinecap="round" style={{ transition:"stroke-dashoffset .9s linear" }}/>
                </svg>
                <div>
                  <p style={{ fontSize:11, color:T.textDim }}>Hold expires</p>
                  <p style={{ fontSize:16, fontWeight:700, color:timeLeft<120?T.rose:T.amber, fontVariantNumeric:"tabular-nums" }}>{fmt(timeLeft)}</p>
                </div>
              </div>
            )}
            {selected.length > 0 && (
              <button className="btn btn-primary" onClick={() => { setPage("event-detail"); toast(`${selected.length} seat(s) added to cart`, "success"); }}>
                {selected.length} Seat{selected.length>1?"s":""} — Continue
              </button>
            )}
          </>
        }
      />
      <div style={{ flex:1, overflowY:"auto", padding:"24px 28px 40px" }} className="fade-in">
        {seatError && <p style={{ color:T.rose, marginBottom:12, fontSize:13 }}>{seatError}</p>}
        {loading && <p style={{ color:T.textSub, marginBottom:12, fontSize:13 }}>Loading seat map...</p>}
        <div style={{ display:"grid", gridTemplateColumns:"1fr 280px", gap:22 }}>
          <div>
            {/* Legend */}
            <div style={{ display:"flex", flexWrap:"wrap", gap:14, marginBottom:22 }}>
              {[
                { s:"available", c:T.accent, soft:T.accentSoft, label:`Available (${counts.available})` },
                { s:"accessible", c:T.teal, soft:T.tealSoft, label:`Accessible (${counts.accessible})` },
                { s:"held", c:T.purple, soft:T.purpleSoft, label:`Held (${counts.held})` },
                { s:"waitlist", c:T.amber, soft:T.amberSoft, label:`Waitlist (${counts.waitlist})` },
                { s:"sold", c:T.textDim, soft:"rgba(255,255,255,0.04)", label:`Sold (${counts.sold})` },
                { s:"selected", c:T.gold, soft:T.goldGlow, label:`Selected (${selected.length})` },
              ].map(l => (
                <div key={l.s} style={{ display:"flex", alignItems:"center", gap:6, cursor:"pointer", opacity:filter!=="all"&&filter!==l.s?0.4:1, transition:"opacity .15s" }} onClick={()=>setFilter(f=>f===l.s?"all":l.s)}>
                  <div style={{ width:14,height:14,borderRadius:3,background:l.soft,border:`1px solid ${l.c}55` }}/>
                  <span style={{ fontSize:12, color:T.textSub }}>{l.label}</span>
                </div>
              ))}
            </div>

            {/* Stage */}
            <div style={{ background:T.goldGlow, border:`1px solid ${T.borderGold}`, borderRadius:8, padding:"9px 20px", textAlign:"center", marginBottom:26, color:T.gold, fontSize:11, fontWeight:600, letterSpacing:3 }}>
              ★ STAGE / PERFORMANCE AREA ★
            </div>

            {/* Seat grid */}
            <div style={{ display:"flex", flexDirection:"column", gap:5, alignItems:"center" }}>
              {Object.entries(byRow).map(([row, rowSeats]) => {
                const mid = Math.ceil(rowSeats.length / 2);
                const left = rowSeats.slice(0, mid);
                const right = rowSeats.slice(mid);
                const shortLabel = row.replace(/^(.+?)-R(\d+)$/, (_, sec, r) =>
                  sec.length > 4 ? sec.slice(0,3).toUpperCase() + r : sec + r
                );
                return (
                  <div key={row} style={{ display:"flex", alignItems:"center", gap:5 }}>
                    <span style={{ fontSize:11, color:T.textDim, width:36, textAlign:"right", fontWeight:600, flexShrink:0, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{shortLabel}</span>
                    <div style={{ display:"flex", gap:4 }}>
                      {left.map(seat => {
                        const isSel = selected.includes(seat.id);
                        const vis = filter==="all"||seat.status===filter||(filter==="selected"&&isSel);
                        return (
                          <div key={seat.id} className={`seat ${isSel?"selected":seat.status}`} onClick={()=>toggle(seat)}
                            title={`Seat ${seat.id} — PKR ${seat.price.toLocaleString()}${seat.status==="accessible"?" · Accessible":""}`}
                            style={{ opacity:vis?1:0.15, position:"relative" }}>
                            {seat.status==="accessible"&&!isSel&&<span style={{fontSize:8}}>♿</span>}
                          </div>
                        );
                      })}
                    </div>
                    {right.length > 0 && <div style={{ width:16 }} />}
                    <div style={{ display:"flex", gap:4 }}>
                      {right.map(seat => {
                        const isSel = selected.includes(seat.id);
                        const vis = filter==="all"||seat.status===filter||(filter==="selected"&&isSel);
                        return (
                          <div key={seat.id} className={`seat ${isSel?"selected":seat.status}`} onClick={()=>toggle(seat)}
                            title={`Seat ${seat.id} — PKR ${seat.price.toLocaleString()}`}
                            style={{ opacity:vis?1:0.15 }}>
                            {seat.status==="accessible"&&!isSel&&<span style={{fontSize:8}}>♿</span>}
                          </div>
                        );
                      })}
                    </div>
                    <span style={{ fontSize:11, color:T.textDim, width:36, textAlign:"left", fontWeight:600, flexShrink:0 }}>{shortLabel}</span>
                  </div>
                );
              })}
            </div>

            {/* Zoom hint */}
            <p style={{ textAlign:"center", fontSize:11, color:T.textDim, marginTop:18 }}>Click any available seat to select · Hover to preview pricing</p>
          </div>

          {/* Selection panel */}
          <div>
            <div className="card" style={{ padding:20, position:"sticky", top:0 }}>
              <h3 style={{ fontSize:14, fontWeight:600, marginBottom:14 }}>Your selection</h3>
              {selected.length === 0 ? (
                <div style={{ textAlign:"center", padding:"28px 0" }}>
                  <Ic n="chair" s={30} c={T.textDim} />
                  <p style={{ fontSize:13, color:T.textDim, marginTop:10 }}>Tap seats to select them</p>
                </div>
              ) : (
                <>
                  <div style={{ display:"flex", flexDirection:"column", gap:7, marginBottom:14 }}>
                    {selected.map(id => {
                      const seat = seats.find(s=>s.id===id);
                      return (
                        <div key={id} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", background:T.bgSurface, borderRadius:8, padding:"9px 12px" }}>
                          <div>
                            <span style={{ fontSize:13, fontWeight:600 }}>Seat {id}</span>
                            <span style={{ fontSize:11, color:T.textDim, marginLeft:6 }}>Row {seat.row}</span>
                          </div>
                          <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                            <span style={{ fontSize:12, color:T.gold, fontWeight:600 }}>PKR {seat.price.toLocaleString()}</span>
                            <button onClick={()=>toggle(seat)} style={{ background:"none",border:"none",cursor:"pointer",color:T.textDim,display:"flex",alignItems:"center" }}>
                              <Ic n="x" s={13} />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <div style={{ borderTop:`1px solid ${T.border}`, paddingTop:10, marginBottom:14 }}>
                    <div style={{ display:"flex", justifyContent:"space-between" }}>
                      <span style={{ fontSize:13, color:T.textSub }}>Subtotal</span>
                      <span style={{ fontSize:13, fontWeight:700, color:T.gold }}>PKR {selected.reduce((a,id)=>a+(seats.find(s=>s.id===id)?.price||0),0).toLocaleString()}</span>
                    </div>
                  </div>
                  <button className="btn btn-primary" style={{ width:"100%", justifyContent:"center", marginBottom:8 }} onClick={checkoutSelected} disabled={bookingInProgress}>
                    {bookingInProgress ? "Booking…" : `Book Selected - PKR ${selectedTotal.toLocaleString()}`}
                  </button>
                  <button className="btn btn-ghost" style={{ width:"100%", justifyContent:"center" }} onClick={()=>{setSelected([]);setHoldTimer(false);setTimeLeft(0);}}>Clear All</button>

                  {/* Payment method selector */}
                  <div style={{ marginTop:16, paddingTop:16, borderTop:`1px solid ${T.border}` }}>
                    <p style={{ fontSize:12, fontWeight:600, color:T.textSub, marginBottom:10, textTransform:"uppercase", letterSpacing:.5 }}>Payment method</p>
                    {["Online Wallet Payment","Bank Payment","Cash","COD"].map(m => (
                      <div key={m} onClick={() => setPayMethod(m)}
                        style={{ display:"flex", alignItems:"center", gap:8, padding:"8px 10px", borderRadius:8, marginBottom:5, cursor:"pointer", background:payMethod===m ? T.goldGlow : "transparent", border:`1px solid ${payMethod===m ? T.borderGold : "transparent"}` }}>
                        <div style={{ width:14, height:14, borderRadius:"50%", border:`2px solid ${payMethod===m ? T.gold : T.border}`, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
                          {payMethod===m && <div style={{ width:6, height:6, borderRadius:"50%", background:T.gold }} />}
                        </div>
                        <span style={{ fontSize:12, color:payMethod===m ? T.gold : T.textSub }}>{m}</span>
                      </div>
                    ))}
                    {savedPayments.length > 0 && (
                      <div style={{ marginTop:8, paddingTop:8, borderTop:`1px solid ${T.border}` }}>
                        <p style={{ fontSize:11, color:T.textDim, marginBottom:6 }}>Saved accounts</p>
                        {savedPayments.map(sp => (
                          <div key={sp.sp_id} onClick={() => setPayMethod("Bank Payment")}
                            style={{ display:"flex", alignItems:"center", gap:8, padding:"8px 10px", borderRadius:8, marginBottom:5, cursor:"pointer", background:T.bgSurface, border:`1px solid ${T.border}` }}>
                            <Ic n="card" s={13} c={T.textSub} />
                            <div style={{ flex:1, minWidth:0 }}>
                              <p style={{ fontSize:12, color:T.text, fontWeight:500, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{sp.bank}</p>
                              <p style={{ fontSize:11, color:T.textDim }}>····{sp.acc_no.slice(-4)}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </>
              )}

              <div style={{ marginTop:20, paddingTop:18, borderTop:`1px solid ${T.border}` }}>
                <h4 style={{ fontSize:12, fontWeight:600, color:T.textSub, marginBottom:12, textTransform:"uppercase", letterSpacing:.5 }}>Section Pricing</h4>
                {(seatmap?.sections || []).map(sec => {
                  const basePrice = Number(event?.price || 0);
                  const factor = Number(sec.seats?.[0]?.price_factor || 1);
                  const sectionPrice = Math.round(basePrice * factor);
                  const available = (sec.seats || []).filter(s => s.state === "available").length;
                  return (
                    <div key={sec.section_id} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:10 }}>
                      <div>
                        <span style={{ fontSize:12, color:T.text, fontWeight:500 }}>{sec.section_name}</span>
                        <span style={{ fontSize:11, color:T.textDim, marginLeft:6 }}>{available} left</span>
                      </div>
                      <span style={{ fontSize:12, fontWeight:600, color:T.gold }}>
                        {sectionPrice > 0 ? `PKR ${sectionPrice.toLocaleString()}` : "Free"}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// ─── MY TICKETS ───────────────────────────────────────────────────────────────
const MyTicketsPage = ({ toast, user }) => {
  const [tab, setTab] = useState("upcoming");
  const [qrModal, setQrModal] = useState(null);
  const [tickets, setTickets] = useState(BOOKINGS);

  useEffect(() => {
    let active = true;
    if (!user?.user_id || !user?.token) return;
    (async () => {
      try {
        const rows = await fetchUserTickets(user.user_id, user.token);
        if (active && rows.length) setTickets(rows);
      } catch (e) {}
    })();
    return () => { active = false; };
  }, [user]);

  const upcoming = tickets.filter(b=>b.status==="confirmed");
  const past = tickets.filter(b=>b.status!=="confirmed");

  const QRModal = ({ booking }) => (
    <div className="modal-bg" onClick={()=>setQrModal(null)}>
      <div className="modal" style={{ maxWidth:340, textAlign:"center" }} onClick={e=>e.stopPropagation()}>
        <div style={{ padding:"28px 28px 0", display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:20 }}>
          <h3 style={{ fontSize:16, fontWeight:600 }}>Ticket QR Code</h3>
          <button onClick={()=>setQrModal(null)} style={{ background:"none", border:"none", cursor:"pointer", color:T.textSub }}><Ic n="x" s={16} /></button>
        </div>
        <div style={{ padding:"0 28px 28px" }}>
          {/* Decorative QR */}
          <div style={{ background:"white", borderRadius:12, padding:20, display:"inline-block", marginBottom:16 }}>
            <div style={{ width:140, height:140, position:"relative" }}>
              {/* Corner markers */}
              {[[0,0],[0,1],[1,0]].map(([r,c],i)=>(
                <div key={i} style={{ position:"absolute", [r?"bottom":"top"]:0, [c?"right":"left"]:0, width:36, height:36, border:"4px solid #09090F", borderRadius:6 }}>
                  <div style={{ width:16, height:16, background:"#09090F", borderRadius:2, margin:"auto", marginTop:6 }} />
                </div>
              ))}
              {/* Fake data grid */}
              <div style={{ position:"absolute", inset:40, display:"grid", gridTemplateColumns:"repeat(7,1fr)", gap:2 }}>
                {Array.from({length:49},(_,i)=>(
                  <div key={i} style={{ background:Math.random()>0.45?"#09090F":"transparent", borderRadius:1 }} />
                ))}
              </div>
            </div>
          </div>
          <p style={{ fontSize:13, color:T.textSub, marginBottom:4 }}>{booking.event}</p>
          <p style={{ fontSize:12, color:T.textDim, marginBottom:14 }}>Seats: {booking.seats}</p>
          <p style={{ fontSize:12, fontWeight:600, color:T.gold, fontFamily:"monospace", letterSpacing:2 }}>{booking.id}</p>
          <p style={{ fontSize:11, color:T.textDim, marginTop:16 }}>Present at entry gate. Valid once only.</p>
        </div>
      </div>
    </div>
  );

  return (
    <div style={{ display:"flex", flexDirection:"column", height:"100%", overflow:"hidden" }}>
      <TopBar title="My Tickets" sub="Your bookings and history" />
      <div style={{ flex:1, overflowY:"auto", padding:"24px 28px 40px" }} className="fade-in">
        <div style={{ display:"flex", gap:4, marginBottom:22 }}>
          {["upcoming","past"].map(t=><button key={t} className={`tab-btn ${tab===t?"active":""}`} onClick={()=>setTab(t)} style={{ textTransform:"capitalize" }}>{t} ({t==="upcoming"?upcoming.length:past.length})</button>)}
        </div>

        {tab==="upcoming" ? (
          upcoming.length > 0 ? upcoming.map(b => (
            <div key={b.id} className="card" style={{ marginBottom:16, overflow:"hidden" }}>
              <div style={{ background:`linear-gradient(90deg, ${T.bgSurface}, ${T.bgCard})`, borderBottom:`1px solid ${T.border}`, padding:"16px 22px", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                <div>
                  <h4 style={{ fontSize:15, fontWeight:600, marginBottom:3 }}>{b.event}</h4>
                  <p style={{ fontSize:12, color:T.textSub }}>Ref: <span style={{ color:T.gold, fontFamily:"monospace", fontWeight:600 }}>{b.id}</span></p>
                </div>
                <span className="tag" style={{ background:T.tealSoft, color:T.teal, border:`1px solid rgba(46,196,160,.2)` }}>Confirmed</span>
              </div>
              <div style={{ padding:"16px 22px", display:"flex", flexWrap:"wrap", gap:24, alignItems:"center" }}>
                <div>
                  <p style={{ fontSize:11, color:T.textDim, marginBottom:3 }}>Section</p>
                  <p style={{ fontSize:13, fontWeight:500 }}>{b.section}</p>
                </div>
                <div>
                  <p style={{ fontSize:11, color:T.textDim, marginBottom:3 }}>Seats</p>
                  <p style={{ fontSize:13, fontWeight:500 }}>{b.seats}</p>
                </div>
                <div>
                  <p style={{ fontSize:11, color:T.textDim, marginBottom:3 }}>Booked</p>
                  <p style={{ fontSize:13, fontWeight:500 }}>{b.date}</p>
                </div>
                <div>
                  <p style={{ fontSize:11, color:T.textDim, marginBottom:3 }}>Total Paid</p>
                  <p style={{ fontSize:13, fontWeight:700, color:T.gold }}>PKR {b.amount.toLocaleString()}</p>
                </div>
                <div style={{ marginLeft:"auto", display:"flex", gap:9 }}>
                  <button className="btn btn-ghost btn-sm" onClick={()=>{ toast("Ticket downloaded as PDF","success"); }}>
                    <Ic n="download" s={13} />Download
                  </button>
                  <button className="btn btn-secondary btn-sm" onClick={()=>setQrModal(b)}>
                    <Ic n="qr" s={13} />QR Code
                  </button>
                  <button className="btn btn-danger btn-sm" onClick={async ()=>{
                    if (!user?.token) return toast("Not signed in","error");
                    try {
                      await cancelTicketApi(b.id, user.token);
                      setTickets(ts => ts.filter(t => t.id !== b.id));
                      toast("Ticket cancelled and seat released","success");
                    } catch(e){ toast(e.message||"Cancel failed","error"); }
                  }}>
                    <Ic n="x" s={13} />Cancel
                  </button>
                </div>
              </div>
            </div>
          )) : (
            <div style={{ textAlign:"center", padding:60 }}>
              <Ic n="ticket" s={42} c={T.textDim} />
              <p style={{ color:T.textSub, marginTop:16, fontSize:14 }}>No upcoming tickets</p>
              <p style={{ color:T.textDim, fontSize:13, marginTop:6 }}>Explore events and book your first ticket</p>
            </div>
          )
        ) : (
          past.map(b => (
            <div key={b.id} className="card" style={{ padding:"16px 22px", marginBottom:10, display:"flex", justifyContent:"space-between", alignItems:"center", opacity:.65 }}>
              <div>
                <h4 style={{ fontSize:14, fontWeight:500, marginBottom:3 }}>{b.event}</h4>
                <p style={{ fontSize:12, color:T.textSub }}>{b.id} · {b.seats}</p>
              </div>
              <div style={{ textAlign:"right" }}>
                <p style={{ fontSize:13, fontWeight:500, marginBottom:5 }}>PKR {b.amount.toLocaleString()}</p>
                <span className="tag" style={{ background:b.status==="pending"?T.amberSoft:T.roseSoft, color:b.status==="pending"?T.amber:T.rose }}>
                  {b.status==="pending"?"Pending":"Refunded"}
                </span>
              </div>
            </div>
          ))
        )}
      </div>
      {qrModal && <QRModal booking={qrModal} />}
    </div>
  );
};

// ─── PROFILE ──────────────────────────────────────────────────────────────────
const ProfilePage = ({ user, toast }) => {
  const [form, setForm] = useState({ name:user.name, email:user.email, phone:"+92 300 1234567", city:"Lahore" });
  const [notifs, setNotifs] = useState({ bookings:true, sms:true, waitlist:true, marketing:false });
  const [pwd, setPwd] = useState({ current: "", next: "", confirm: "" });
  const [stats, setStats] = useState({ bookings: 0, spent: 0 });
  const [profileLoading, setProfileLoading] = useState(false);
  const F = k => e => setForm(f=>({...f,[k]:e.target.value}));

  useEffect(() => {
    let active = true;
    if (!user?.user_id || !user?.token) return;
    (async () => {
      setProfileLoading(true);
      try {
        const [profile, purchases] = await Promise.all([
          fetchUserProfile(user.user_id, user.token),
          fetchUserPurchases(user.user_id, user.token)
        ]);
        if (!active) return;
        setForm((f) => ({
          ...f,
          name: profile.username || user.name,
          email: profile.email || user.email
        }));
        const spent = (purchases || []).reduce((sum, p) => sum + Number(p.amount || 0), 0);
        setStats({ bookings: (purchases || []).length, spent });
      } catch (e) {
        toast("Could not load full profile details", "warning");
      } finally {
        if (active) setProfileLoading(false);
      }
    })();
    return () => { active = false; };
  }, [user, toast]);

  const saveProfile = async () => {
    if (!user?.user_id || !user?.token) return;
    if (!form.name || !form.email) return toast("Name and email are required", "error");
    try {
      const type = user.type || (user.role === "organizer" ? "organizer" : user.role === "admin" ? "admin" : "user");
      await updateUserProfile(user.user_id, {
        username: form.name,
        email: form.email,
        type
      }, user.token);
      toast("Profile saved successfully", "success");
    } catch (e) {
      toast(getErrorMessage(e, "Failed to save profile"), "error");
    }
  };

  const updatePassword = async () => {
    if (!pwd.current || !pwd.next || !pwd.confirm) return toast("Please fill all password fields", "error");
    if (pwd.next !== pwd.confirm) return toast("New password and confirm password must match", "error");
    if (!isStrongPassword(pwd.next)) return toast("New password must be at least 8 chars with letters and numbers", "error");
    try {
      await changeUserPassword(pwd.current, pwd.next, user.token);
      setPwd({ current: "", next: "", confirm: "" });
      toast("Password updated successfully", "success");
    } catch (e) {
      toast(getErrorMessage(e, "Password update failed"), "error");
    }
  };

  return (
    <div style={{ display:"flex", flexDirection:"column", height:"100%", overflow:"hidden" }}>
      <TopBar title="Profile" sub="Manage your account settings" actions={
        <button className="btn btn-primary" onClick={saveProfile}>Save Changes</button>
      } />
      <div style={{ flex:1, overflowY:"auto", padding:"24px 28px 40px" }} className="fade-in">
        {profileLoading && <p style={{ color:T.textSub, marginBottom:10, fontSize:13 }}>Loading profile...</p>}
        <div style={{ display:"grid", gridTemplateColumns:"320px 1fr", gap:22, alignItems:"start", maxWidth:900 }}>
          {/* Left panel */}
          <div>
            <div className="card" style={{ padding:24, marginBottom:16, textAlign:"center" }}>
              <div style={{ width:76, height:76, borderRadius:"50%", background:`linear-gradient(135deg,${T.accent},${T.purple})`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:28, fontWeight:700, color:"#fff", margin:"0 auto 14px" }}>
                {user.name[0]}
              </div>
              <h3 style={{ fontSize:17, fontWeight:600, marginBottom:4 }}>{user.name}</h3>
              <p style={{ color:T.textSub, fontSize:13, marginBottom:12 }}>{user.email}</p>
              <span className="tag" style={{ background:T.goldGlow, color:T.gold }}>
                {user.role.charAt(0).toUpperCase()+user.role.slice(1)}
              </span>
              <div style={{ marginTop:18, paddingTop:18, borderTop:`1px solid ${T.border}`, display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
                {[["Bookings", stats.bookings], ["Spent", `PKR ${(stats.spent/1000).toFixed(1)}K`]].map(([k,v]) => (
                  <div key={k} className="surface" style={{ padding:"10px", textAlign:"center" }}>
                    <p style={{ fontSize:11, color:T.textDim, marginBottom:4 }}>{k}</p>
                    <p style={{ fontSize:16, fontWeight:600, color:T.gold }}>{v}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Right panel */}
          <div>
            <div className="card" style={{ padding:24, marginBottom:16 }}>
              <h3 style={{ fontSize:14, fontWeight:600, marginBottom:18 }}>Personal information</h3>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:14 }}>
                <div style={{ gridColumn:"1/-1" }}>
                  <label style={{ fontSize:12, color:T.textSub, display:"block", marginBottom:6 }}>Full name</label>
                  <input value={form.name} onChange={F("name")} />
                </div>
                <div>
                  <label style={{ fontSize:12, color:T.textSub, display:"block", marginBottom:6 }}>Email address</label>
                  <input type="email" value={form.email} onChange={F("email")} />
                </div>
                <div>
                  <label style={{ fontSize:12, color:T.textSub, display:"block", marginBottom:6 }}>Phone number</label>
                  <input value={form.phone} onChange={F("phone")} />
                </div>
                <div>
                  <label style={{ fontSize:12, color:T.textSub, display:"block", marginBottom:6 }}>City</label>
                  <select value={form.city} onChange={F("city")}>
                    {["Lahore","Karachi","Islamabad","Rawalpindi","Faisalabad"].map(c=><option key={c}>{c}</option>)}
                  </select>
                </div>
              </div>
            </div>

            <div className="card" style={{ padding:24, marginBottom:16 }}>
              <h3 style={{ fontSize:14, fontWeight:600, marginBottom:18 }}>Change password</h3>
              <div style={{ display:"grid", gap:14 }}>
                <div>
                  <label style={{ fontSize:12, color:T.textSub, display:"block", marginBottom:6 }}>Current password</label>
                  <input type="password" placeholder="Current password" value={pwd.current} onChange={(e)=>setPwd(p=>({ ...p, current: e.target.value }))} />
                </div>
                <div>
                  <label style={{ fontSize:12, color:T.textSub, display:"block", marginBottom:6 }}>New password</label>
                  <input type="password" placeholder="Min. 8 characters" value={pwd.next} onChange={(e)=>setPwd(p=>({ ...p, next: e.target.value }))} />
                </div>
                <div>
                  <label style={{ fontSize:12, color:T.textSub, display:"block", marginBottom:6 }}>Confirm password</label>
                  <input type="password" placeholder="Repeat new password" value={pwd.confirm} onChange={(e)=>setPwd(p=>({ ...p, confirm: e.target.value }))} />
                </div>
              </div>
              <button className="btn btn-secondary" style={{ marginTop:16 }} onClick={updatePassword}>Update password</button>
            </div>

            <div className="card" style={{ padding:24 }}>
              <h3 style={{ fontSize:14, fontWeight:600, marginBottom:18 }}>Notification preferences</h3>
              {[["Booking confirmations","Email me when a booking is confirmed","bookings"],["SMS reminders","Text alerts 24h before events","sms"],["Waitlist promotions","Notify when a waitlisted seat opens","waitlist"],["Marketing emails","Promotions, early access, news","marketing"]].map(([title,desc,key]) => (
                <div key={key} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:18 }}>
                  <div>
                    <p style={{ fontSize:13, fontWeight:500 }}>{title}</p>
                    <p style={{ fontSize:12, color:T.textDim, marginTop:2 }}>{desc}</p>
                  </div>
                  <label className="toggle-wrap">
                    <input type="checkbox" checked={notifs[key]} onChange={()=>setNotifs(n=>({...n,[key]:!n[key]}))} />
                    <div className="toggle-track" />
                    <div className="toggle-thumb" />
                  </label>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// ─── VENUES ───────────────────────────────────────────────────────────────────
const VenuesPage = ({ toast, user }) => {
  const [venues, setVenues] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editVenue, setEditVenue] = useState(null);
  const [form, setForm] = useState({ name:"", address:"", capacity:"", sections:"" });
  const [seatMapVenue, setSeatMapVenue] = useState(null);
  const [sections, setSections] = useState([]);
  const [sectionForm, setSectionForm] = useState({ section_name: "", capacity: 50, factor: 1 });
  const [bulkForm, setBulkForm] = useState({ section_id: "", rows: 5, seats_per_row: 10 });
  const F = k => e => setForm(f=>({...f,[k]:e.target.value}));

  const loadVenues = useCallback(async () => {
    setLoading(true);
    try {
      const rows = await fetchVenuesApi();
      const mapped = rows.map((v) => ({
        id: v.venue_id,
        venue_id: v.venue_id,
        name: v.venue_name,
        address: v.venue_description || "No description",
        capacity: 0,
        sections: Number(v.section_count || 0),
        events: Number(v.event_count || 0),
        img: "🏟️"
      }));
      setVenues(mapped);
    } catch (e) {
      toast(getErrorMessage(e, "Failed to load venues"), "error");
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    loadVenues();
  }, [loadVenues]);

  const save = async () => {
    if (!form.name || !form.address) return toast("Please fill all required fields","error");
    if (!user?.token) return toast("You must be signed in", "error");
    try {
      if (editVenue) {
        await updateVenueApi(editVenue.venue_id, {
          venue_name: form.name,
          venue_description: form.address
        }, user.token);
        toast("Venue updated successfully","success");
      } else {
        await createVenueApi({
          venue_name: form.name,
          venue_description: form.address
        }, user.token);
        toast("Venue created successfully","success");
      }
      await loadVenues();
    } catch (e) {
      return toast(getErrorMessage(e, "Venue save failed"), "error");
    }
    setShowModal(false);
    setForm({ name:"",address:"",capacity:"",sections:"" });
    setEditVenue(null);
  };

  const del = async (venueId) => {
    if (!user?.token) return toast("You must be signed in", "error");
    try {
      await deleteVenueApi(venueId, user.token);
      toast("Venue removed", "info");
      await loadVenues();
    } catch (e) {
      toast(getErrorMessage(e, "Failed to delete venue"), "error");
    }
  };

  const openSeatEditor = async (venue) => {
    setSeatMapVenue(venue);
    try {
      const rows = await fetchVenueSections(venue.venue_id);
      setSections(rows || []);
      setBulkForm((b) => ({ ...b, section_id: rows?.[0]?.section_id || "" }));
    } catch (e) {
      toast(e.message || "Failed to load sections", "error");
    }
  };

  const addSection = async () => {
    if (!seatMapVenue) return;
    if (!sectionForm.section_name) return toast("Section name is required", "error");
    try {
      await createSectionApi({
        section_name: sectionForm.section_name,
        section_description: `${sectionForm.section_name} section`,
        venue_id: seatMapVenue.venue_id,
        capacity: Number(sectionForm.capacity || 0),
        factor: Number(sectionForm.factor || 1)
      }, user.token);
      const rows = await fetchVenueSections(seatMapVenue.venue_id);
      setSections(rows || []);
      setSectionForm({ section_name: "", capacity: 50, factor: 1 });
      toast("Section created", "success");
    } catch (e) {
      toast(e.message || "Failed to create section", "error");
    }
  };

  const addBulkSeats = async () => {
    if (!bulkForm.section_id) return toast("Select a section first", "error");
    const rows = Math.max(1, Number(bulkForm.rows || 1));
    const seatsPerRow = Math.max(1, Number(bulkForm.seats_per_row || 1));
    const payload = [];
    for (let r = 1; r <= rows; r++) {
      for (let n = 1; n <= seatsPerRow; n++) {
        payload.push({
          x_coord: n,
          y_coord: r,
          section_id: bulkForm.section_id,
          seat_num: (r - 1) * seatsPerRow + n,
          accessible: false,
          obstructed: false,
          blocked: false
        });
      }
    }
    try {
      await createSeatsBulkApi(payload, user.token);
      const refreshed = await fetchVenueSections(seatMapVenue.venue_id);
      setSections(refreshed || []);
      toast(`${payload.length} seats added`, "success");
    } catch (e) {
      toast(e.message || "Failed to create seats", "error");
    }
  };

  return (
    <div style={{ display:"flex", flexDirection:"column", height:"100%", overflow:"hidden" }}>
      <TopBar title="Venues" sub={`${venues.length} venues managed`} actions={
        <button className="btn btn-primary" onClick={()=>{setShowModal(true);setEditVenue(null);setForm({name:"",address:"",capacity:"",sections:""})}}>
          <Ic n="plus" s={14} c="#09090F" />Add Venue
        </button>
      } />
      <div style={{ flex:1, overflowY:"auto", padding:"24px 28px 40px" }} className="fade-in">
        {loading && <p style={{ color:T.textSub, marginBottom:12, fontSize:13 }}>Loading venues...</p>}
        <div style={{ display:"grid", gridTemplateColumns:"repeat(2,1fr)", gap:18 }}>
          {venues.map(v => (
            <div key={v.id} className="card" style={{ padding:24 }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:18 }}>
                <div style={{ display:"flex", gap:12, alignItems:"center" }}>
                  <div style={{ width:44, height:44, background:T.bgSurface, borderRadius:10, display:"flex", alignItems:"center", justifyContent:"center", fontSize:22 }}>{v.img}</div>
                  <div>
                    <h3 style={{ fontSize:15, fontWeight:600, marginBottom:3 }}>{v.name}</h3>
                    <p style={{ fontSize:12, color:T.textSub, display:"flex", alignItems:"center", gap:4 }}><Ic n="pin" s={11} />{v.address}</p>
                  </div>
                </div>
                <div style={{ display:"flex", gap:6 }}>
                  <button className="btn btn-icon btn-ghost" onClick={()=>{setEditVenue(v);setForm({name:v.name,address:v.address,capacity:v.capacity,sections:v.sections});setShowModal(true);}}><Ic n="edit" s={14} /></button>
                  <button className="btn btn-icon btn-danger" onClick={()=>del(v.venue_id)}><Ic n="trash" s={14} /></button>
                </div>
              </div>
              <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:10, marginBottom:16 }}>
                {[["Capacity",v.capacity.toLocaleString()],["Sections",v.sections],["Events",v.events]].map(([k,val]) => (
                  <div key={k} className="surface" style={{ padding:"10px 12px", textAlign:"center" }}>
                    <p style={{ fontSize:11, color:T.textDim, marginBottom:4 }}>{k}</p>
                    <p style={{ fontSize:18, fontWeight:600 }}>{val}</p>
                  </div>
                ))}
              </div>
              <div style={{ display:"flex", gap:9 }}>
                <button className="btn btn-ghost btn-sm" style={{ flex:1, justifyContent:"center" }} onClick={()=>openSeatEditor(v)}>
                  <Ic n="map" s={13} />Edit Seat Map
                </button>
                <button className="btn btn-ghost btn-sm" style={{ flex:1, justifyContent:"center" }} onClick={()=>toast("Use Create Event to schedule events for this venue","info")}>
                  <Ic n="eye" s={13} />View Events
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
      {showModal && (
        <div className="modal-bg" onClick={()=>setShowModal(false)}>
          <div className="modal" onClick={e=>e.stopPropagation()}>
            <div style={{ padding:"28px 28px 0", display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:22 }}>
              <h3 className="serif" style={{ fontSize:20 }}>{editVenue?"Edit Venue":"Add New Venue"}</h3>
              <button onClick={()=>setShowModal(false)} style={{ background:"none",border:"none",cursor:"pointer",color:T.textSub }}><Ic n="x" s={18} /></button>
            </div>
            <div style={{ padding:"0 28px 28px", display:"flex", flexDirection:"column", gap:14 }}>
              {[["Venue name *","name","e.g. Lahore Expo Centre","text"],["Full address *","address","Street, City","text"],["Total capacity","capacity","e.g. 5000","number"],["Number of sections","sections","e.g. 6","number"]].map(([label,key,ph,type])=>(
                <div key={key}>
                  <label style={{ fontSize:12, color:T.textSub, display:"block", marginBottom:6 }}>{label}</label>
                  <input type={type} placeholder={ph} value={form[key]} onChange={F(key)} />
                </div>
              ))}
              <div style={{ display:"flex", gap:10, marginTop:8 }}>
                <button className="btn btn-primary" style={{ flex:1, justifyContent:"center" }} onClick={save}>{editVenue?"Save Changes":"Create Venue"}</button>
                <button className="btn btn-ghost" onClick={()=>setShowModal(false)}>Cancel</button>
              </div>
            </div>
          </div>
        </div>
      )}
      {seatMapVenue && (
        <div className="modal-bg" onClick={()=>setSeatMapVenue(null)}>
          <div className="modal" style={{ maxWidth: 760 }} onClick={e=>e.stopPropagation()}>
            <div style={{ padding:"24px 24px 0", display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16 }}>
              <h3 className="serif" style={{ fontSize:20 }}>Seat Map Builder - {seatMapVenue.name}</h3>
              <button onClick={()=>setSeatMapVenue(null)} style={{ background:"none",border:"none",cursor:"pointer",color:T.textSub }}><Ic n="x" s={18} /></button>
            </div>
            <div style={{ padding:"0 24px 24px", display:"grid", gridTemplateColumns:"1fr 1fr", gap:16 }}>
              <div className="card" style={{ padding:16 }}>
                <h4 style={{ fontSize:13, fontWeight:600, marginBottom:10 }}>Create section</h4>
                <div style={{ display:"grid", gap:10 }}>
                  <input placeholder="Section name" value={sectionForm.section_name} onChange={(e)=>setSectionForm(s=>({ ...s, section_name: e.target.value }))} />
                  <input type="number" placeholder="Capacity" value={sectionForm.capacity} onChange={(e)=>setSectionForm(s=>({ ...s, capacity: e.target.value }))} />
                  <input type="number" step="0.1" placeholder="Price factor" value={sectionForm.factor} onChange={(e)=>setSectionForm(s=>({ ...s, factor: e.target.value }))} />
                  <button className="btn btn-primary" onClick={addSection}>Add Section</button>
                </div>
              </div>
              <div className="card" style={{ padding:16 }}>
                <h4 style={{ fontSize:13, fontWeight:600, marginBottom:10 }}>Bulk add seats</h4>
                <div style={{ display:"grid", gap:10 }}>
                  <select value={bulkForm.section_id} onChange={(e)=>setBulkForm(b=>({ ...b, section_id: e.target.value }))}>
                    <option value="">Select section</option>
                    {sections.map((s)=><option key={s.section_id} value={s.section_id}>{s.section_name}</option>)}
                  </select>
                  <input type="number" min="1" placeholder="Rows" value={bulkForm.rows} onChange={(e)=>setBulkForm(b=>({ ...b, rows: e.target.value }))} />
                  <input type="number" min="1" placeholder="Seats per row" value={bulkForm.seats_per_row} onChange={(e)=>setBulkForm(b=>({ ...b, seats_per_row: e.target.value }))} />
                  <button className="btn btn-primary" onClick={addBulkSeats}>Create Seats</button>
                </div>
              </div>
              <div className="card" style={{ gridColumn:"1 / -1", padding:16, maxHeight:260, overflowY:"auto" }}>
                <h4 style={{ fontSize:13, fontWeight:600, marginBottom:10 }}>Sections and seat totals</h4>
                {sections.length ? sections.map((s) => (
                  <div key={s.section_id} style={{ display:"flex", justifyContent:"space-between", padding:"8px 0", borderBottom:`1px solid ${T.border}` }}>
                    <span style={{ fontSize:13 }}>{s.section_name}</span>
                    <span style={{ fontSize:12, color:T.textSub }}>{(s.seats || []).length} seats</span>
                  </div>
                )) : <p style={{ fontSize:12, color:T.textDim }}>No sections yet.</p>}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ─── CREATE EVENT ─────────────────────────────────────────────────────────────
const CreateEventPage = ({ toast, user, venuesData = [] }) => {
  const [step, setStep] = useState(1);
  const [form, setForm] = useState({ name:"",venue:"",date:"",time:"",category:"Music",type:"assigned",price:"",capacity:"",desc:"" });
  const [submitting, setSubmitting] = useState(false);
  const F = k => e => setForm(f=>({...f,[k]:e.target.value}));
  const steps = ["Event details","Ticketing","Review & publish"];
  const venueOptions = venuesData.length ? venuesData : VENUES.map((v) => ({ venue_id: v.id, name: v.name }));

  const next = () => {
    if (step===1 && (!form.name||!form.venue||!form.date)) return toast("Please fill all required fields","error");
    if (step===2 && !form.price) return toast("Set a base ticket price","error");
    if (step===2 && Number(form.price) < 0) return toast("Price cannot be negative", "error");
    setStep(s=>s+1);
  };

  const saveDraft = () => {
    try {
      localStorage.setItem("vbook_event_draft", JSON.stringify(form));
      toast("Draft saved locally", "success");
    } catch (e) {
      toast("Failed to save draft", "error");
    }
  };

  useEffect(() => {
    try {
      const raw = localStorage.getItem("vbook_event_draft");
      if (raw) {
        const draft = JSON.parse(raw);
        if (draft && draft.name) setForm((f) => ({ ...f, ...draft }));
      }
    } catch (e) {}
  }, []);

  return (
    <div style={{ display:"flex", flexDirection:"column", height:"100%", overflow:"hidden" }}>
      <TopBar title="Create Event" sub="Set up a new event for your venue" />
      <div style={{ flex:1, overflowY:"auto", padding:"28px 28px 40px" }} className="fade-in">
        {/* Stepper */}
        <div style={{ display:"flex", alignItems:"center", marginBottom:32, maxWidth:520 }}>
          {steps.map((s,i)=>(
            <div key={s} style={{ display:"flex", alignItems:"center", flex:i<steps.length-1?1:"none" }}>
              <div style={{ display:"flex", alignItems:"center", gap:9, flexShrink:0 }}>
                <div style={{ width:28, height:28, borderRadius:"50%", background:step>i+1?T.gold:step===i+1?T.goldGlow:T.bgSurface, border:`1px solid ${step>=i+1?T.gold:T.border}`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:12, fontWeight:600, color:step>i+1?"#09090F":step===i+1?T.gold:T.textDim, flexShrink:0 }}>
                  {step>i+1?<Ic n="check" s={13} c="#09090F" />:i+1}
                </div>
                <span style={{ fontSize:13, color:step===i+1?T.text:T.textSub, fontWeight:step===i+1?500:400, whiteSpace:"nowrap" }}>{s}</span>
              </div>
              {i<steps.length-1 && <div style={{ flex:1, height:1, background:step>i+1?T.gold:T.border, margin:"0 12px" }}/>}
            </div>
          ))}
        </div>

        <div style={{ maxWidth:580 }}>
          {step===1 && (
            <div className="card" style={{ padding:28 }}>
              <h3 style={{ fontSize:15, fontWeight:600, marginBottom:20 }}>Event details</h3>
              <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
                <div>
                  <label style={{ fontSize:12, color:T.textSub, display:"block", marginBottom:6 }}>Event name *</label>
                  <input placeholder="e.g. Summer Music Festival 2025" value={form.name} onChange={F("name")} />
                </div>
                <div>
                  <label style={{ fontSize:12, color:T.textSub, display:"block", marginBottom:6 }}>Description</label>
                  <textarea placeholder="Describe your event for potential attendees…" value={form.desc} onChange={F("desc")} style={{ resize:"vertical", minHeight:90 }} />
                </div>
                <div>
                  <label style={{ fontSize:12, color:T.textSub, display:"block", marginBottom:6 }}>Venue *</label>
                  <select value={form.venue} onChange={F("venue")}>
                    <option value="">Select a venue</option>
                    {venueOptions.map(v=><option key={v.venue_id || v.id} value={v.venue_id || v.id}>{v.name || v.venue_name}</option>)}
                  </select>
                </div>
                <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:14 }}>
                  <div>
                    <label style={{ fontSize:12, color:T.textSub, display:"block", marginBottom:6 }}>Event date *</label>
                    <input type="date" value={form.date} onChange={F("date")} />
                  </div>
                  <div>
                    <label style={{ fontSize:12, color:T.textSub, display:"block", marginBottom:6 }}>Start time</label>
                    <input type="time" value={form.time} onChange={F("time")} />
                  </div>
                </div>
                <div>
                  <label style={{ fontSize:12, color:T.textSub, display:"block", marginBottom:6 }}>Category</label>
                  <select value={form.category} onChange={F("category")}>
                    {["Concert","Seminar","Movie Screening","Party"].map(c=><option key={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize:12, color:T.textSub, display:"block", marginBottom:8 }}>Seating type</label>
                  <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
                    {[["assigned","Assigned seating","Customers choose specific seats"],["general","General admission","First come, first served"]].map(([val,title,desc])=>(
                      <div key={val} style={{ padding:"14px 16px", background:form.type===val?T.goldGlow:T.bgSurface, border:`1px solid ${form.type===val?T.borderGold:"transparent"}`, borderRadius:10, cursor:"pointer", transition:"all .15s" }} onClick={()=>setForm(f=>({...f,type:val}))}>
                        <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:4 }}>
                          <div style={{ width:16, height:16, borderRadius:"50%", border:`2px solid ${form.type===val?T.gold:T.border}`, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
                            {form.type===val&&<div style={{ width:7, height:7, borderRadius:"50%", background:T.gold }}/>}
                          </div>
                          <p style={{ fontSize:13, fontWeight:500 }}>{title}</p>
                        </div>
                        <p style={{ fontSize:11, color:T.textDim, paddingLeft:24 }}>{desc}</p>
                      </div>
                    ))}
                  </div>
                </div>
                <div>
                  <label style={{ fontSize:12, color:T.textSub, display:"block", marginBottom:8 }}>Event banner</label>
                  <div style={{ border:`2px dashed ${T.border}`, borderRadius:10, padding:"28px 20px", textAlign:"center", cursor:"pointer", transition:"border-color .15s" }}
                    onMouseEnter={e=>e.currentTarget.style.borderColor=T.borderMed}
                    onMouseLeave={e=>e.currentTarget.style.borderColor=T.border}>
                    <Ic n="upload" s={24} c={T.textDim} />
                    <p style={{ fontSize:13, color:T.textSub, marginTop:8 }}>Drop an image here or <span style={{ color:T.gold }}>browse</span></p>
                    <p style={{ fontSize:11, color:T.textDim, marginTop:4 }}>JPG, PNG or WebP — max 5MB</p>
                  </div>
                </div>
                <button className="btn btn-primary" style={{ alignSelf:"flex-start" }} onClick={next}>Continue →</button>
              </div>
            </div>
          )}

          {step===2 && (
            <div className="card" style={{ padding:28 }}>
              <h3 style={{ fontSize:15, fontWeight:600, marginBottom:20 }}>Ticketing configuration</h3>
              <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
                <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:14 }}>
                  <div>
                    <label style={{ fontSize:12, color:T.textSub, display:"block", marginBottom:6 }}>Base price (PKR) *</label>
                    <input type="number" placeholder="e.g. 3000" value={form.price} onChange={F("price")} />
                  </div>
                  <div>
                    <label style={{ fontSize:12, color:T.textSub, display:"block", marginBottom:6 }}>Total capacity</label>
                    <input type="number" placeholder="e.g. 500" value={form.capacity} onChange={F("capacity")} />
                  </div>
                </div>
                <div>
                  <label style={{ fontSize:12, color:T.textSub, display:"block", marginBottom:10 }}>Section pricing</label>
                  <div style={{ display:"flex", flexDirection:"column", gap:9 }}>
                    {[["VIP","2× base","#",T.gold],["Premium","1.5× base","#",T.accent],["Standard","Base price","#",T.teal],["Gen. Admission","0.6× base","#",T.textSub]].map(([name,hint,_,color])=>(
                      <div key={name} style={{ display:"flex", alignItems:"center", gap:12, background:T.bgSurface, borderRadius:9, padding:"12px 16px" }}>
                        <span style={{ fontSize:12, fontWeight:600, color, width:100, flexShrink:0 }}>{name}</span>
                        <span style={{ fontSize:11, color:T.textDim, flex:1 }}>{hint}</span>
                        <input style={{ width:130 }} type="number" placeholder={`PKR ${form.price?Math.round(form.price*(name==="VIP"?2:name==="Premium"?1.5:name==="Standard"?1:0.6)).toLocaleString():"auto"}`} />
                      </div>
                    ))}
                  </div>
                </div>
                <div>
                  <label style={{ fontSize:12, color:T.textSub, display:"block", marginBottom:10 }}>Waitlist options</label>
                  <div style={{ background:T.bgSurface, borderRadius:9, padding:"14px 16px" }}>
                    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:12 }}>
                      <div>
                        <p style={{ fontSize:13, fontWeight:500 }}>Enable waitlist</p>
                        <p style={{ fontSize:11, color:T.textDim, marginTop:2 }}>Allow customers to join when sold out</p>
                      </div>
                      <label className="toggle-wrap"><input type="checkbox" defaultChecked/><div className="toggle-track"/><div className="toggle-thumb"/></label>
                    </div>
                    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                      <div>
                        <p style={{ fontSize:13, fontWeight:500 }}>Auto-promotion</p>
                        <p style={{ fontSize:11, color:T.textDim, marginTop:2 }}>Automatically notify next person in queue</p>
                      </div>
                      <label className="toggle-wrap"><input type="checkbox" defaultChecked/><div className="toggle-track"/><div className="toggle-thumb"/></label>
                    </div>
                  </div>
                </div>
                <div style={{ display:"flex", gap:10 }}>
                  <button className="btn btn-ghost" onClick={()=>setStep(1)}>← Back</button>
                  <button className="btn btn-primary" onClick={next}>Continue →</button>
                </div>
              </div>
            </div>
          )}

          {step===3 && (
            <div className="card" style={{ padding:28 }}>
              <h3 style={{ fontSize:15, fontWeight:600, marginBottom:20 }}>Review & publish</h3>
              <div className="surface" style={{ padding:20, borderRadius:10, marginBottom:20 }}>
                {[["Event name",form.name||"—"],["Description",form.desc?form.desc.slice(0,60)+"…":"—"],["Venue",venueOptions.find(v => (v.venue_id || v.id) === form.venue)?.name || form.venue || "—"],["Date",form.date||"—"],["Time",form.time||"—"],["Category",form.category],["Seating",form.type==="assigned"?"Assigned seating":"General admission"],["Base price",form.price?`PKR ${Number(form.price).toLocaleString()}`:"—"],["Capacity",form.capacity||"—"]].map(([k,v])=>(
                  <div key={k} style={{ display:"flex", justifyContent:"space-between", padding:"9px 0", borderBottom:`1px solid ${T.border}` }}>
                    <span style={{ fontSize:13, color:T.textSub }}>{k}</span>
                    <span style={{ fontSize:13, fontWeight:500 }}>{v}</span>
                  </div>
                ))}
              </div>
              <div style={{ background:T.amberSoft, border:`1px solid rgba(245,158,11,.2)`, borderRadius:9, padding:"12px 16px", marginBottom:20, display:"flex", gap:10 }}>
                <Ic n="info" s={16} c={T.amber} />
                <p style={{ fontSize:13, color:T.amber, lineHeight:1.5 }}>Publishing will make this event live and bookable immediately.</p>
              </div>
              <div style={{ display:"flex", gap:10 }}>
                <button className="btn btn-ghost" onClick={()=>setStep(2)}>← Back</button>
                <button className="btn btn-primary" disabled={submitting} onClick={async ()=>{
                  if (!user?.token) return toast("You must be signed in", "error");
                  if (!form.venue) return toast("Select a venue", "error");
                  try {
                    setSubmitting(true);
                    await createEventApi({
                      event_name: form.name,
                      event_description: form.desc,
                      event_date: form.date,
                      venue_id: form.venue,
                      organizer_id: user.user_id,
                      ticket_price: Number(form.price || 0),
                      type: form.category
                    }, user.token);
                    toast("Event published successfully", "success");
                    setStep(1);
                    setForm({ name:"",venue:"",date:"",time:"",category:"Music",type:"assigned",price:"",capacity:"",desc:"" });
                    localStorage.removeItem("vbook_event_draft");
                  } catch (e) {
                    toast(getErrorMessage(e, "Failed to publish event"), "error");
                  } finally {
                    setSubmitting(false);
                  }
                }}>{submitting ? "Publishing..." : "Publish Event"}</button>
                <button className="btn btn-ghost" onClick={saveDraft}>Save as Draft</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// ─── ADMIN DASHBOARD ──────────────────────────────────────────────────────────
const AdminDashboard = ({ toast, user }) => {
  const [stats, setStats] = useState([
    { label:"Total Revenue", value:"PKR 0", change:"", up:true, icon:"trend", color:T.gold },
    { label:"Tickets Sold", value:"0", change:"", up:true, icon:"ticket", color:T.accent },
    { label:"Active Events", value:"0", change:"", up:true, icon:"calendar", color:T.teal },
    { label:"Pending Refunds", value:"0", change:"", up:false, icon:"alert", color:T.rose },
  ]);
  const [topEvents, setTopEvents] = useState([]);
  const [topRevenue, setTopRevenue] = useState([]);
  const [loading, setLoading] = useState(false);

  // Mini bar chart data
  const monthData = [65,82,74,91,88,73,95,82,78,92,87,100];
  const months = ["J","F","M","A","M","J","J","A","S","O","N","D"];
  const maxVal = Math.max(...monthData);

  useEffect(() => {
    let active = true;
    if (!user?.token) return;
    (async () => {
      setLoading(true);
      try {
        const [adminEvents, topEv, topRev] = await Promise.all([
          fetchAdminEventsApi(user.token),
          fetchReportTopEvents(),
          fetchReportTopRevenue()
        ]);
        if (!active) return;
        const revenue = adminEvents.reduce((sum, e) => sum + Number(e.revenue || 0), 0);
        const sold = adminEvents.reduce((sum, e) => sum + Number(e.tickets_sold || 0), 0);
        setStats([
          { label:"Total Revenue", value:`PKR ${Math.round(revenue).toLocaleString()}`, change:"Live", up:true, icon:"trend", color:T.gold },
          { label:"Tickets Sold", value:`${sold.toLocaleString()}`, change:"Live", up:true, icon:"ticket", color:T.accent },
          { label:"Active Events", value:`${adminEvents.length}`, change:"Live", up:true, icon:"calendar", color:T.teal },
          { label:"Pending Refunds", value:"0", change:"N/A", up:false, icon:"alert", color:T.rose },
        ]);
        setTopEvents(topEv || []);
        setTopRevenue(topRev || []);
      } catch (e) {
        toast(e.message || "Failed to load dashboard metrics", "error");
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [user, toast]);

  return (
    <div style={{ display:"flex", flexDirection:"column", height:"100%", overflow:"hidden" }}>
      <TopBar title="Admin Dashboard" sub="Platform overview and analytics" />
      <div style={{ flex:1, overflowY:"auto", padding:"24px 28px 40px" }} className="fade-in">
        {loading && <p style={{ color:T.textSub, marginBottom:12, fontSize:13 }}>Loading dashboard metrics...</p>}
        {/* Stats */}
        <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:14, marginBottom:24 }}>
          {stats.map(s=>(
            <div key={s.label} className="stat-card">
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:14 }}>
                <div style={{ width:36, height:36, borderRadius:9, background:`${s.color}14`, display:"flex", alignItems:"center", justifyContent:"center" }}>
                  <Ic n={s.icon} s={15} c={s.color} />
                </div>
                <span style={{ fontSize:12, color:s.up?T.teal:T.rose, fontWeight:600 }}>{s.change}</span>
              </div>
              <p className="serif" style={{ fontSize:22, fontWeight:600, marginBottom:4 }}>{s.value}</p>
              <p style={{ fontSize:12, color:T.textSub }}>{s.label}</p>
            </div>
          ))}
        </div>

        {/* Revenue chart */}
        <div style={{ display:"grid", gridTemplateColumns:"2fr 1fr", gap:20, marginBottom:20 }}>
          <div className="card" style={{ padding:24 }}>
            <h3 style={{ fontSize:14, fontWeight:600, marginBottom:20 }}>Revenue — 2025</h3>
            <div style={{ display:"flex", alignItems:"flex-end", gap:6, height:120 }}>
              {monthData.map((v,i)=>(
                <div key={i} style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center", gap:4 }}>
                  <div style={{ width:"100%", borderRadius:"3px 3px 0 0", background:i===7?T.gold:`${T.gold}35`, height:`${(v/maxVal)*100}%`, transition:"height .5s ease", position:"relative" }}>
                    {i===7&&<div style={{ position:"absolute",top:-20,left:"50%",transform:"translateX(-50%)",fontSize:10,color:T.gold,whiteSpace:"nowrap",fontWeight:600 }}>{v}%</div>}
                  </div>
                  <span style={{ fontSize:10, color:T.textDim }}>{months[i]}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="card" style={{ padding:24 }}>
            <h3 style={{ fontSize:14, fontWeight:600, marginBottom:16 }}>Quick actions</h3>
            <div style={{ display:"flex", flexDirection:"column", gap:9 }}>
              {[["Override booking","edit",T.accent],["Release blocked seats","zap",T.teal],["Process refund","card",T.rose],["Send announcement","mail",T.purple],["Export report","download",T.gold]].map(([label,icon,color])=>(
                <button key={label} className="btn btn-ghost" style={{ textAlign:"left", justifyContent:"flex-start", gap:10, padding:"8px 12px" }} onClick={()=>toast(`${label} action is available via admin APIs`, "info")}>
                  <Ic n={icon} s={14} c={color} />{label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:20 }}>
          <div className="card" style={{ padding:22 }}>
            <h3 style={{ fontSize:14, fontWeight:600, marginBottom:16 }}>Top events by fill rate</h3>
            {(topEvents.length ? topEvents : EVENTS).map((ev,i)=>(
              <div key={ev.id || ev.event_id || i} style={{ display:"flex", alignItems:"center", gap:12, marginBottom:14 }}>
                <span style={{ fontSize:12, color:T.textDim, width:16, textAlign:"center" }}>#{i+1}</span>
                <span style={{ fontSize:18, flexShrink:0 }}>{ev.emoji || "🎟️"}</span>
                <div style={{ flex:1, minWidth:0 }}>
                  <p style={{ fontSize:13, fontWeight:500, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", marginBottom:5 }}>{ev.name || ev.event_name}</p>
                  <div className="progress-bar">
                    <div className="progress-fill" style={{ width:`${Math.min(100, Number(ev.tickets_sold || 0))}%`, background:ev.color || T.accent }} />
                  </div>
                </div>
                <span style={{ fontSize:12, color:T.textSub, flexShrink:0 }}>{Number(ev.tickets_sold || 0)}</span>
              </div>
            ))}
          </div>
          <div className="card" style={{ padding:22 }}>
            <h3 style={{ fontSize:14, fontWeight:600, marginBottom:16 }}>Top revenue events</h3>
            {(topRevenue.length ? topRevenue : []).map((a,i)=>(
              <div key={i} className="table-row" style={{ display:"flex", gap:10, padding:"11px 0", alignItems:"flex-start" }}>
                <div style={{ width:7, height:7, borderRadius:"50%", marginTop:5, flexShrink:0, background:T.gold }} />
                <span style={{ flex:1, fontSize:13, lineHeight:1.5 }}>{a.event_name}</span>
                <span style={{ fontSize:11, color:T.textDim, flexShrink:0 }}>PKR {Math.round(Number(a.revenue || 0)).toLocaleString()}</span>
              </div>
            ))}
            {!topRevenue.length && <p style={{ color:T.textDim, fontSize:13 }}>No revenue data yet.</p>}
          </div>
        </div>
      </div>
    </div>
  );
};

// ─── ADMIN BOOKINGS ───────────────────────────────────────────────────────────
const AdminBookings = ({ toast, user }) => {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [bookings, setBookings] = useState(BOOKINGS);
  const [loading, setLoading] = useState(false);

  const loadBookings = useCallback(async () => {
    if (!user?.token) return;
    setLoading(true);
    try {
      const [payments, tickets, events, users] = await Promise.all([
        fetchAllPayments(user.token),
        fetchAllTickets(user.token),
        fetchEventsApi(),
        fetchAllUsers(user.token)
      ]);
      const ticketById = new Map((tickets || []).map((t) => [t.ticket_id, t]));
      const eventById = new Map((events || []).map((e) => [e.event_id || e.id, e]));
      const userById = new Map((users || []).map((u) => [u.user_id, u]));
      const merged = (payments || []).map((p) => {
        const t = ticketById.get(p.ticket_id) || {};
        const ev = eventById.get(t.event_id) || {};
        const u = userById.get(p.user_id) || {};
        return {
          id: p.payment_id,
          payment_id: p.payment_id,
          ticket_id: p.ticket_id,
          user: u.username || p.user_id,
          email: u.email || "—",
          event: ev.event_name || ev.name || t.event_id || "Event",
          seats: t.seat_id || "—",
          amount: Number(p.amount || 0),
          status: "confirmed",
          paid_at: p.paid_at
        };
      });
      setBookings(merged);
    } catch (e) {
      toast(e.message || "Failed to load bookings", "error");
    } finally {
      setLoading(false);
    }
  }, [user, toast]);

  useEffect(() => {
    loadBookings();
  }, [loadBookings]);

  const filtered = bookings.filter(b => (filter==="all"||b.status===filter) && (b.user.toLowerCase().includes(search.toLowerCase())||b.id.toLowerCase().includes(search.toLowerCase())||b.event.toLowerCase().includes(search.toLowerCase())));

  const refund = async (id) => {
    const booking = bookings.find((b) => b.id === id);
    if (!booking?.ticket_id) return toast("Missing ticket link for refund", "error");
    try {
      await cancelTicketApi(booking.ticket_id, user.token);
      setBookings(bs=>bs.map(b=>b.id===id?{...b,status:"refunded"}:b));
      toast("Refund initiated successfully","success");
    } catch (e) {
      toast(e.message || "Refund failed", "error");
    }
  };

  const statusColor = { confirmed:[T.teal,T.tealSoft], pending:[T.amber,T.amberSoft], refunded:[T.rose,T.roseSoft] };

  return (
    <div style={{ display:"flex", flexDirection:"column", height:"100%", overflow:"hidden" }}>
      <TopBar title="Bookings" sub={`${filtered.length} bookings shown`} actions={
        <div className="search-wrap">
          <Ic n="search" s={13} c={T.textDim} />
          <input className="search-input" placeholder="Search by name, ref, event…" value={search} onChange={e=>setSearch(e.target.value)} />
        </div>
      } />
      <div style={{ padding:"12px 28px 0", borderBottom:`1px solid ${T.border}`, display:"flex", gap:4, flexShrink:0 }}>
        {["all","confirmed","pending","refunded"].map(f=>(
          <button key={f} className={`tab-btn ${filter===f?"active":""}`} onClick={()=>setFilter(f)} style={{ textTransform:"capitalize" }}>{f}</button>
        ))}
      </div>
      <div style={{ flex:1, overflowY:"auto", padding:"24px 28px 40px" }} className="fade-in">
        {loading && <p style={{ color:T.textSub, marginBottom:12, fontSize:13 }}>Loading bookings...</p>}
        <div className="card" style={{ overflow:"hidden" }}>
          <table style={{ width:"100%", borderCollapse:"collapse" }}>
            <thead>
              <tr style={{ borderBottom:`1px solid ${T.border}` }}>
                {["Reference","Customer","Event","Seats","Amount","Status","Actions"].map(h=>(
                  <th key={h} style={{ padding:"12px 16px", textAlign:"left", fontSize:11, fontWeight:600, color:T.textDim, letterSpacing:.8, textTransform:"uppercase" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(b=>{
                const [color,bg]=statusColor[b.status]||[T.textSub,"transparent"];
                return (
                  <tr key={b.id} className="table-row">
                    <td style={{ padding:"13px 16px", fontSize:12, fontWeight:700, color:T.gold, fontFamily:"monospace" }}>{b.id}</td>
                    <td style={{ padding:"13px 16px" }}>
                      <div>
                        <p style={{ fontSize:13, fontWeight:500 }}>{b.user}</p>
                        <p style={{ fontSize:11, color:T.textDim }}>{b.email}</p>
                      </div>
                    </td>
                    <td style={{ padding:"13px 16px", fontSize:13, color:T.textSub, maxWidth:180 }}>
                      <p style={{ overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{b.event}</p>
                    </td>
                    <td style={{ padding:"13px 16px", fontSize:12, color:T.textSub }}>{b.seats}</td>
                    <td style={{ padding:"13px 16px", fontSize:13, fontWeight:600 }}>PKR {b.amount.toLocaleString()}</td>
                    <td style={{ padding:"13px 16px" }}>
                      <span className="tag" style={{ background:bg, color, border:`1px solid ${color}33` }}>
                        {b.status.charAt(0).toUpperCase()+b.status.slice(1)}
                      </span>
                    </td>
                    <td style={{ padding:"13px 16px" }}>
                      <div style={{ display:"flex", gap:6 }}>
                        <button className="btn btn-ghost btn-sm" onClick={async ()=>{
                          if (!b.ticket_id) return toast("Missing ticket information", "error");
                          try {
                            await releaseTicketAdmin(b.ticket_id, user.token);
                            toast("Ticket released by admin", "success");
                            await loadBookings();
                          } catch (e) {
                            toast(e.message || "Failed to release ticket", "error");
                          }
                        }}>Release</button>
                        {b.status==="confirmed"&&<button className="btn btn-danger btn-sm" onClick={()=>refund(b.id)}>Refund</button>}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {filtered.length===0&&<div style={{ textAlign:"center", padding:40, color:T.textDim, fontSize:13 }}>No bookings match your search</div>}
        </div>
      </div>
    </div>
  );
};

// ─── ADMIN USERS ──────────────────────────────────────────────────────────────
const AdminUsers = ({ toast, user }) => {
  const [users, setUsers] = useState(USERS_DATA);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const filtered = users.filter(u=>u.name.toLowerCase().includes(search.toLowerCase())||u.email.toLowerCase().includes(search.toLowerCase()));

  useEffect(() => {
    let active = true;
    if (!user?.token) return;
    (async () => {
      setLoading(true);
      try {
        const rows = await fetchAllUsers(user.token);
        if (!active) return;
        setUsers(rows.map((u) => ({
          id: u.user_id,
          name: u.username,
          email: u.email,
          role: ROLE_LABELS[u.type] || u.type,
          joined: "—",
          bookings: 0,
          spent: 0,
          status: "active"
        })));
      } catch (e) {
        toast(e.message || "Failed to load users", "error");
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [user, toast]);

  const toggleStatus = (id) => {
    setUsers(us=>us.map(u=>u.id===id?{...u,status:u.status==="active"?"suspended":"active"}:u));
    const u=users.find(u=>u.id===id);
    toast(`${u.name} ${u.status==="active"?"suspended":"restored"}`,"info");
  };

  const cycleRole = async (target) => {
    const nextRole = target.role === "customer" ? "organizer" : target.role === "organizer" ? "admin" : "customer";
    const nextType = nextRole === "customer" ? "user" : nextRole;
    try {
      await updateUserProfile(target.id, {
        username: target.name,
        email: target.email,
        type: nextType
      }, user.token);
      setUsers((rows) => rows.map((r) => r.id === target.id ? { ...r, role: nextRole } : r));
      toast(`${target.name} role updated to ${nextRole}`, "success");
    } catch (e) {
      toast(e.message || "Failed to update role", "error");
    }
  };

  return (
    <div style={{ display:"flex", flexDirection:"column", height:"100%", overflow:"hidden" }}>
      <TopBar title="Users" sub={`${filtered.length} users`} actions={
        <>
          <div className="search-wrap">
            <Ic n="search" s={13} c={T.textDim} />
            <input className="search-input" placeholder="Search users…" value={search} onChange={e=>setSearch(e.target.value)} />
          </div>
          <button className="btn btn-primary" onClick={()=>toast("User invite sent","success")}><Ic n="plus" s={14} c="#09090F" />Add User</button>
        </>
      } />
      <div style={{ flex:1, overflowY:"auto", padding:"24px 28px 40px" }} className="fade-in">
        {loading && <p style={{ color:T.textSub, marginBottom:12, fontSize:13 }}>Loading users...</p>}
        <div className="card" style={{ overflow:"hidden" }}>
          <table style={{ width:"100%", borderCollapse:"collapse" }}>
            <thead>
              <tr style={{ borderBottom:`1px solid ${T.border}` }}>
                {["User","Role","Joined","Bookings","Total Spent","Status","Actions"].map(h=>(
                  <th key={h} style={{ padding:"12px 16px", textAlign:"left", fontSize:11, fontWeight:600, color:T.textDim, letterSpacing:.8, textTransform:"uppercase" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(u=>(
                <tr key={u.id} className="table-row">
                  <td style={{ padding:"13px 16px" }}>
                    <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                      <div style={{ width:32, height:32, borderRadius:"50%", background:`linear-gradient(135deg,${T.accent},${T.purple})`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:12, fontWeight:600, color:"#fff", flexShrink:0 }}>
                        {u.name[0]}
                      </div>
                      <div>
                        <p style={{ fontSize:13, fontWeight:500 }}>{u.name}</p>
                        <p style={{ fontSize:11, color:T.textDim }}>{u.email}</p>
                      </div>
                    </div>
                  </td>
                  <td style={{ padding:"13px 16px" }}>
                    <span className="tag" style={{ background:u.role==="admin"?T.roseSoft:u.role==="organizer"?T.goldGlow:T.tealSoft, color:u.role==="admin"?T.rose:u.role==="organizer"?T.gold:T.teal }}>
                      {u.role}
                    </span>
                  </td>
                  <td style={{ padding:"13px 16px", fontSize:13, color:T.textSub }}>{u.joined}</td>
                  <td style={{ padding:"13px 16px", fontSize:13 }}>{u.bookings}</td>
                  <td style={{ padding:"13px 16px", fontSize:13, fontWeight:600, color:u.spent>0?T.gold:T.textDim }}>{u.spent>0?`PKR ${u.spent.toLocaleString()}`:"—"}</td>
                  <td style={{ padding:"13px 16px" }}>
                    <span className="tag" style={{ background:u.status==="active"?T.tealSoft:T.roseSoft, color:u.status==="active"?T.teal:T.rose }}>
                      {u.status.charAt(0).toUpperCase()+u.status.slice(1)}
                    </span>
                  </td>
                  <td style={{ padding:"13px 16px" }}>
                    <div style={{ display:"flex", gap:6 }}>
                      <button className="btn btn-ghost btn-sm" onClick={()=>cycleRole(u)}>Change Role</button>
                      <button className={`btn btn-sm ${u.status==="active"?"btn-danger":"btn-secondary"}`} onClick={()=>toggleStatus(u.id)}>
                        {u.status==="active"?"Suspend":"Restore"}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

// ─── WAITLIST ─────────────────────────────────────────────────────────────────
const WaitlistPage = ({ toast, user, eventsData = [] }) => {
  const [items, setItems] = useState([]);
  const [selectedEventId, setSelectedEventId] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!selectedEventId && eventsData.length) setSelectedEventId(eventsData[0].event_id || eventsData[0].id);
  }, [eventsData, selectedEventId]);

  const loadWaitlist = useCallback(async () => {
    if (!selectedEventId || !user?.token) return;
    setLoading(true);
    try {
      const rows = await fetchWaitlistForEvent(selectedEventId, user.token);
      const selectedEvent = (eventsData.length ? eventsData : EVENTS).find((ev) => (ev.event_id || ev.id) === selectedEventId);
      const mapped = rows.map((w, idx) => ({
        id: w.waiting_id,
        waiting_id: w.waiting_id,
        user: w.username || w.user_id,
        user_id: w.user_id,
        email: w.user_id,
        event: selectedEvent?.name || selectedEventId,
        section: w.section_id,
        section_id: w.section_id,
        position: idx + 1,
        joined: w.created_at ? new Date(w.created_at).toLocaleString() : "—",
        status: "waiting",
        notified: null
      }));
      setItems(mapped);
    } catch (e) {
      toast(e.message || "Could not load waitlist", "error");
    } finally {
      setLoading(false);
    }
  }, [selectedEventId, user, toast, eventsData]);

  useEffect(() => {
    loadWaitlist();
  }, [loadWaitlist]);

  const promote = async (id) => {
    const row = items.find(w => w.id === id);
    if (!row) return;
    try {
      await promoteWaitlist(selectedEventId, row.section_id, user.token);
      toast(`${row.user} promoted and notified by email`, "success");
      await loadWaitlist();
    } catch (e) {
      toast(e.message || "Promotion failed", "error");
    }
  };

  const remove = async (id) => {
    try {
      await removeWaitlistEntry(id, user.token);
      toast("User removed from waitlist", "info");
      await loadWaitlist();
    } catch (e) {
      toast(e.message || "Failed to remove waitlist entry", "error");
    }
  };

  return (
    <div style={{ display:"flex", flexDirection:"column", height:"100%", overflow:"hidden" }}>
      <TopBar title="Waitlist Manager" sub="Monitor and promote waitlisted customers" actions={
        <>
          <select value={selectedEventId} onChange={(e)=>setSelectedEventId(e.target.value)} style={{ width:"auto", minWidth:200, padding:"8px 12px", fontSize:12 }}>
            {(eventsData.length ? eventsData : EVENTS).map((ev) => (
              <option key={ev.event_id || ev.id} value={ev.event_id || ev.id}>{ev.name}</option>
            ))}
          </select>
          <button className="btn btn-primary" onClick={()=>{ const next=items.find(w=>w.status==="waiting"); if(next)promote(next.id); else toast("No one waiting","info"); }}>
            Promote Next
          </button>
        </>
      } />
      <div style={{ flex:1, overflowY:"auto", padding:"24px 28px 40px" }} className="fade-in">
        {loading && <p style={{ color:T.textSub, marginBottom:12, fontSize:13 }}>Loading waitlist...</p>}
        <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:14, marginBottom:24 }}>
          {[["Total waiting", items.filter(w=>w.status==="waiting").length, T.amber],["Promoted today", items.filter(w=>w.status==="promoted").length, T.teal],["Events with waitlist","2",T.accent],["Avg. hold time","15 min",T.purple]].map(([label,val,color])=>(
            <div key={label} className="stat-card" style={{ textAlign:"center" }}>
              <p style={{ fontSize:11, color:T.textDim, marginBottom:8 }}>{label}</p>
              <p className="serif" style={{ fontSize:24, fontWeight:600, color }}>{val}</p>
            </div>
          ))}
        </div>
        <div className="card" style={{ overflow:"hidden" }}>
          <div style={{ padding:"16px 20px", borderBottom:`1px solid ${T.border}`, display:"flex", justifyContent:"space-between", alignItems:"center" }}>
            <h3 style={{ fontSize:14, fontWeight:600 }}>Queue</h3>
            <span style={{ fontSize:12, color:T.textSub }}>{items.length} entries</span>
          </div>
          <table style={{ width:"100%", borderCollapse:"collapse" }}>
            <thead>
              <tr style={{ borderBottom:`1px solid ${T.border}` }}>
                {["Pos","Customer","Event","Section","Joined","Notified","Status","Actions"].map(h=>(
                  <th key={h} style={{ padding:"12px 16px", textAlign:"left", fontSize:11, fontWeight:600, color:T.textDim, letterSpacing:.8, textTransform:"uppercase" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {items.map(w=>(
                <tr key={w.id} className="table-row">
                  <td style={{ padding:"13px 16px", fontSize:13, fontWeight:700, color:w.position===1?T.gold:T.textSub }}>#{w.position}</td>
                  <td style={{ padding:"13px 16px" }}>
                    <p style={{ fontSize:13, fontWeight:500 }}>{w.user}</p>
                    <p style={{ fontSize:11, color:T.textDim }}>{w.email}</p>
                  </td>
                  <td style={{ padding:"13px 16px", fontSize:13, color:T.textSub, maxWidth:160 }}><p style={{ overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{w.event}</p></td>
                  <td style={{ padding:"13px 16px", fontSize:13 }}>{w.section}</td>
                  <td style={{ padding:"13px 16px", fontSize:12, color:T.textSub }}>{w.joined}</td>
                  <td style={{ padding:"13px 16px", fontSize:12, color:T.textDim }}>{w.notified||"—"}</td>
                  <td style={{ padding:"13px 16px" }}>
                    <span className="tag" style={{ background:w.status==="promoted"?T.tealSoft:T.amberSoft, color:w.status==="promoted"?T.teal:T.amber }}>
                      {w.status==="promoted"?"Promoted":"Waiting"}
                    </span>
                  </td>
                  <td style={{ padding:"13px 16px" }}>
                    <div style={{ display:"flex", gap:6 }}>
                      {w.status==="waiting"&&<button className="btn btn-secondary btn-sm" onClick={()=>promote(w.id)}>Promote</button>}
                      <button className="btn btn-danger btn-sm" onClick={()=>remove(w.id)}>Remove</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {items.length===0&&<div style={{ textAlign:"center", padding:40, color:T.textDim, fontSize:13 }}>Waitlist is empty</div>}
        </div>
      </div>
    </div>
  );
};

// ─── ROOT APP ─────────────────────────────────────────────────────────────────
export default function App() {
  const [user, setUser] = useState(() => {
    try {
      const raw = localStorage.getItem("vbook_user");
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  });
  const [page, setPage] = useState("home");
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [eventsData, setEventsData] = useState([]);
  const [venuesData, setVenuesData] = useState([]);
  const [eventsLoading, setEventsLoading] = useState(false);
  const [toasts, setToasts] = useState([]);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const toast = useCallback((msg, type="info") => {
    const id = Date.now() + Math.random();
    setToasts(t => [...t, {id, msg, type}]);
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 3800);
  }, []);

  useEffect(() => {
    if (!user) return;
    localStorage.setItem("vbook_user", JSON.stringify(user));
  }, [user]);

  useEffect(() => {
    if (!user) return;
    let active = true;
    (async () => {
      setEventsLoading(true);
      try {
        const apiEvents = await fetchEventsApi();
        if (active) setEventsData(apiEvents);
      } catch (e) {
        if (active) toast("Unable to load live events, showing demo data", "warning");
      } finally {
        if (active) setEventsLoading(false);
      }
    })();
    return () => { active = false; };
  }, [user, toast]);

  useEffect(() => {
    if (!user) return;
    let active = true;
    (async () => {
      try {
        const venues = await fetchVenuesApi();
        if (active) {
          setVenuesData(venues.map((v) => ({
            venue_id: v.venue_id,
            name: v.venue_name,
            venue_description: v.venue_description
          })));
        }
      } catch (e) {}
    })();
    return () => { active = false; };
  }, [user]);

  if (!user) return (
    <>
      <style>{STYLES}</style>
      {page === "reset-password"
        ? <ResetPasswordPage onDone={() => setPage("home")} />
        : <AuthPage onLogin={(u) => { setUser(u); setPage("home"); }} onResetPassword={() => setPage("reset-password")} />
      }
    </>
  );

  const renderPage = () => {
    const props = { setPage, setSelectedEvent, user, toast, eventsData, eventsLoading, venuesData };
    switch(page) {
      case "home": return <HomePage {...props} />;
      case "events": return <EventsPage {...props} />;
      case "event-detail": return <EventDetail event={selectedEvent} {...props} />;
      case "seat-map": return <SeatMapPage event={selectedEvent} {...props} />;
      case "my-tickets": return <MyTicketsPage {...props} />;
      case "profile": return <ProfilePage {...props} />;
      case "venues": return <VenuesPage {...props} />;
      case "create-event": return <CreateEventPage {...props} />;
      case "admin": return <AdminDashboard {...props} />;
      case "admin-bookings": return <AdminBookings {...props} />;
      case "admin-users": return <AdminUsers {...props} />;
      case "waitlist": return <WaitlistPage {...props} />;
      default: return <HomePage {...props} />;
    }
  };

  const toastIcons = { success:"check", error:"alert", info:"info", warning:"alert" };
  const toastColors = { success:T.teal, error:T.rose, info:T.accent, warning:T.amber };

  return (
    <>
      <style>{STYLES}</style>
      <div style={{ display:"flex", height:"100vh", overflow:"hidden", background:T.bg, position:"relative" }}>
        {/* Left edge hover trigger */}
        <div
          onMouseEnter={() => setSidebarOpen(true)}
          onMouseLeave={() => setSidebarOpen(false)}
          style={{ width:4, position:"fixed", top:0, left:0, height:"100vh", zIndex:140, cursor:"w-resize" }}
        />
        <Sidebar page={page} setPage={setPage} user={user} onLogout={()=>{localStorage.removeItem("vbook_user");setUser(null);setPage("home");}} open={sidebarOpen} setOpen={setSidebarOpen} />
        <main style={{ flex:1, display:"flex", flexDirection:"column", overflow:"hidden", minWidth:0, marginLeft:sidebarOpen ? 216 : 0, transition:"margin-left .24s cubic-bezier(0.34, 1.56, 0.64, 1)" }}>
          {renderPage()}
        </main>
      </div>
      {/* Toast container */}
      <div style={{ position:"fixed", top:20, right:20, zIndex:999, display:"flex", flexDirection:"column", gap:8, pointerEvents:"none" }}>
        {toasts.map(t=>(
          <div key={t.id} style={{ background:T.bgCard, border:`1px solid ${T.borderMed}`, borderRadius:10, padding:"12px 16px", fontSize:13, display:"flex", alignItems:"center", gap:10, pointerEvents:"all", minWidth:240, maxWidth:360, animation:"toastIn .25s ease" }}>
            <Ic n={toastIcons[t.type]} s={15} c={toastColors[t.type]} />
            <span style={{ flex:1, color:T.text }}>{t.msg}</span>
            <button onClick={()=>setToasts(ts=>ts.filter(x=>x.id!==t.id))} style={{ background:"none",border:"none",cursor:"pointer",color:T.textDim,display:"flex" }}><Ic n="x" s={13} /></button>
          </div>
        ))}
      </div>
    </>
  );
}
