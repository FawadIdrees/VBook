(async () => {
  const base = 'http://localhost:3000/api';
  const seat = { event_id: 'E001', seat_id: 'SEAT-S001-04', amount: 50.00, method: 'Online Wallet Payment' };
  const users = Array.from({ length: 6 }, (_, i) => ({ username: `conc_user_${Date.now()}_${i}`, email: `conc.user.${Date.now()}_${i}@example.com`, password: 'ConcPass123!' }));
  const log = (...a) => console.log('[concurrency]', ...a);

  try {
    // Register users and obtain tokens
    const tokens = [];
    for (const u of users) {
      let r = await fetch(base + '/auth/register', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(u) });
      let j = await r.json();
      if (r.status === 409) {
        // already exists? try login
        r = await fetch(base + '/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: u.email, password: u.password }) });
        j = await r.json();
      }
      if (!j.token) throw new Error('Failed to register/login: ' + JSON.stringify(j));
      tokens.push(j.token);
    }

    log('Registered', tokens.length, 'test users');

    // Fire concurrent booking attempts
    const attempts = tokens.map(token => (async () => {
      try {
        // Simulate payment processing
        const pay = await fetch(base + '/payments/process', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token }, body: JSON.stringify({ amount: seat.amount, method: seat.method }) });
        const pj = await pay.json(); if (!pay.ok) return { ok:false, status: pay.status, body: pj };
        const payment_id = pj.payment_id;

        const b = await fetch(base + '/book', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token }, body: JSON.stringify({ event_id: seat.event_id, seat_id: seat.seat_id, method: seat.method, amount: seat.amount, payment_id }) });
        const bj = await b.json(); return { ok: b.status === 201, status: b.status, body: bj };
      } catch (err) { return { ok:false, error: err.message }; }
    })());

    const results = await Promise.all(attempts);
    const success = results.filter(r => r.ok).length;
    log('Results:', results.map(r => ({ status: r.status, ok: r.ok, error: r.error || r.body && r.body.error })));
    log('Summary: attempted', results.length, 'concurrent bookings → successes:', success);
    process.exit(0);
  } catch (err) {
    console.error('[concurrency] ERROR', err);
    process.exit(2);
  }
})();
