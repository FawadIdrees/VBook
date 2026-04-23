(async () => {
  const base = 'http://localhost:3000/api';
  const nonce = Date.now();
  const log = (...a) => console.log('[admin-flow]', ...a);

  async function req(path, opts = {}, token) {
    const res = await fetch(base + path, {
      ...opts,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: 'Bearer ' + token } : {}),
        ...(opts.headers || {})
      }
    });
    const body = await res.json().catch(() => ({}));
    return { ok: res.ok, status: res.status, body };
  }

  try {
    // 1) Organizer register/login
    const org = {
      username: `org_${nonce}`,
      email: `org.${nonce}@example.com`,
      password: 'OrgPass123!',
      type: 'organizer'
    };
    let r = await req('/auth/register', { method: 'POST', body: JSON.stringify(org) });
    if (!r.ok && r.status !== 409) throw new Error('Organizer register failed');
    r = await req('/auth/login', { method: 'POST', body: JSON.stringify({ email: org.email, password: org.password }) });
    if (!r.body?.token || !r.body?.user?.user_id) throw new Error('Organizer login failed');
    const organizerToken = r.body.token;
    const organizerId = r.body.user.user_id;

    // 2) Create venue
    r = await req('/venues', {
      method: 'POST',
      body: JSON.stringify({
        venue_name: `Venue ${nonce}`,
        venue_description: 'Integration test venue'
      })
    }, organizerToken);
    if (!r.ok || !r.body?.venue_id) throw new Error('Venue create failed: ' + JSON.stringify(r.body));
    const venueId = r.body.venue_id;

    // 3) Create section
    r = await req('/sections', {
      method: 'POST',
      body: JSON.stringify({
        section_name: 'Test Section',
        section_description: 'Test section',
        venue_id: venueId,
        capacity: 20,
        factor: 1.0
      })
    }, organizerToken);
    if (!r.ok || !r.body?.section_id) throw new Error('Section create failed: ' + JSON.stringify(r.body));
    const sectionId = r.body.section_id;

    // 4) Create seats
    const seatsPayload = [
      { x_coord: 1, y_coord: 1, section_id: sectionId, seat_num: 1, accessible: false, obstructed: false, blocked: false },
      { x_coord: 2, y_coord: 1, section_id: sectionId, seat_num: 2, accessible: false, obstructed: false, blocked: false }
    ];
    r = await req('/seats/bulk', { method: 'POST', body: JSON.stringify({ seats: seatsPayload }) }, organizerToken);
    if (!r.ok || !Array.isArray(r.body?.seat_ids) || r.body.seat_ids.length < 2) {
      throw new Error('Bulk seats create failed: ' + JSON.stringify(r.body));
    }
    const seatId = r.body.seat_ids[0];

    // 5) Create event
    r = await req('/events', {
      method: 'POST',
      body: JSON.stringify({
        event_name: `Event ${nonce}`,
        event_description: 'Integration test event',
        event_date: '2026-12-31',
        venue_id: venueId,
        organizer_id: organizerId,
        ticket_price: 100,
        type: 'Concert'
      })
    }, organizerToken);
    if (!r.ok || !r.body?.event_id) throw new Error('Event create failed: ' + JSON.stringify(r.body));
    const eventId = r.body.event_id;

    // 6) Customer register/login
    const customer = { username: `cust_${nonce}`, email: `cust.${nonce}@example.com`, password: 'CustPass123!' };
    await req('/auth/register', { method: 'POST', body: JSON.stringify(customer) });
    r = await req('/auth/login', { method: 'POST', body: JSON.stringify({ email: customer.email, password: customer.password }) });
    if (!r.body?.token) throw new Error('Customer login failed');
    const customerToken = r.body.token;

    // 7) Book seat
    r = await req('/book', {
      method: 'POST',
      body: JSON.stringify({
        event_id: eventId,
        seat_id: seatId,
        method: 'Cash',
        amount: 100
      })
    }, customerToken);
    if (!r.ok || !r.body?.ticket_id) throw new Error('Booking failed: ' + JSON.stringify(r.body));
    const ticketId = r.body.ticket_id;

    // 8) Admin register/login
    const admin = { username: `admin_${nonce}`, email: `admin.${nonce}@example.com`, password: 'AdminPass123!', type: 'admin' };
    await req('/auth/register', { method: 'POST', body: JSON.stringify(admin) });
    r = await req('/auth/login', { method: 'POST', body: JSON.stringify({ email: admin.email, password: admin.password }) });
    if (!r.body?.token) throw new Error('Admin login failed');
    const adminToken = r.body.token;

    // 9) Admin events report
    r = await req('/admin/events', {}, adminToken);
    if (!r.ok) throw new Error('Admin events failed');

    // 10) Admin release booking
    r = await req(`/admin/tickets/${ticketId}/release`, { method: 'POST' }, adminToken);
    if (!r.ok) throw new Error('Admin release failed: ' + JSON.stringify(r.body));

    // 11) Waitlist join + promote
    r = await req('/waiting', {
      method: 'POST',
      body: JSON.stringify({
        section_id: sectionId,
        event_id: eventId,
        force: true
      })
    }, customerToken);
    if (!r.ok) throw new Error('Waitlist join failed: ' + JSON.stringify(r.body));
    r = await req(`/waiting/promote/${eventId}/${sectionId}`, { method: 'POST' }, adminToken);
    if (!r.ok || !r.body?.hold_id) throw new Error('Waitlist promote failed: ' + JSON.stringify(r.body));

    log('Organizer/admin integration flow passed');
    process.exit(0);
  } catch (err) {
    console.error('[admin-flow] ERROR', err.message || err);
    process.exit(2);
  }
})();
