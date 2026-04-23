(function(){
  const API = '/api';
  let token = null;
  const statusEl = document.getElementById('status');
  const seatmapEl = document.getElementById('seatmap');

  document.getElementById('login').addEventListener('click', async () => {
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    try {
      const r = await fetch(API + '/auth/login', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ email, password }) });
      const j = await r.json();
      if (r.ok) { token = j.token; statusEl.textContent = 'Logged in'; } else { statusEl.textContent = 'Login failed: '+(j.error||j.message); }
    } catch (e) { statusEl.textContent = 'Login error'; }
  });

  document.getElementById('load').addEventListener('click', async () => {
    const eventId = document.getElementById('eventId').value;
    await loadSeatmap(eventId);
    initRealtime();
  });

  async function loadSeatmap(eventId) {
    seatmapEl.innerHTML = 'Loading...';
    try {
      const res = await fetch(API + '/events/' + encodeURIComponent(eventId) + '/seatmap');
      const data = await res.json();
      renderSeatmap(data);
    } catch (e) { seatmapEl.textContent = 'Failed to load'; }
  }

  function renderSeatmap(data) {
    seatmapEl.innerHTML = '';
    data.sections.forEach(sec => {
      const secEl = document.createElement('div'); secEl.className='section';
      const title = document.createElement('div'); title.textContent = sec.section_name + ' ('+sec.section_id+')'; secEl.appendChild(title);
      const seatsWrap = document.createElement('div'); seatsWrap.className='seats';
      sec.seats.forEach(s => {
        const b = document.createElement('div'); b.className='seat '+s.state; b.textContent = s.seat_num;
        b.dataset.seatId = s.seat_id; b.dataset.eventId = data.event_id;
        if (s.state === 'available') b.addEventListener('click', onSeatClick);
        seatsWrap.appendChild(b);
      });
      secEl.appendChild(seatsWrap);
      seatmapEl.appendChild(secEl);
    });
  }

  async function onSeatClick(e) {
    const seatId = e.currentTarget.dataset.seatId;
    const eventId = e.currentTarget.dataset.eventId;
    if (!token) { alert('Please login first'); return; }
    if (!confirm('Book seat '+seatId+'?')) return;
    try {
      // Simulate payment processing first
      const payRes = await fetch(API + '/payments/process', { method: 'POST', headers: { 'Content-Type':'application/json', 'Authorization':'Bearer '+token }, body: JSON.stringify({ amount: 0, method: 'Online Wallet Payment' }) });
      const payJson = await payRes.json();
      if (!payRes.ok) { alert('Payment failed: '+(payJson.error||payJson.message)); return; }

      const body = { event_id: eventId, seat_id: seatId, method: 'Online Wallet Payment', amount: 0, payment_id: payJson.payment_id };
      const r = await fetch(API + '/book', { method: 'POST', headers: { 'Content-Type':'application/json', 'Authorization':'Bearer '+token }, body: JSON.stringify(body) });
      const j = await r.json();
      if (r.ok) { alert('Booked: '+j.ticket_id); await loadSeatmap(eventId); }
      else alert('Booking failed: '+(j.error||j.message));
    } catch (err) { alert('Error booking'); }
  }

  function initRealtime() {
    if (window.__realtime_init) return; window.__realtime_init = true;
    try {
      const socket = io();
      socket.on('connect', () => console.log('socket connected'));
      socket.on('seat-updated', (p) => {
        console.log('seat-updated', p);
        // Simple refresh: reload seatmap for the shown event
        const eid = document.getElementById('eventId').value;
        if (p.event_id && p.event_id === eid) loadSeatmap(eid);
      });
    } catch (e) { console.warn('Realtime not available', e); }
  }
})();
