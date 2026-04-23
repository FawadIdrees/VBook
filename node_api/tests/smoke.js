(async () => {
  // Simple smoke tests using fetch (Node 18+ has global fetch)
  const base = 'http://localhost:3000/api';
  const log = (...args) => console.log('[smoke]', ...args);
  const nonce = Date.now();

  async function req(path, opts = {}, token) {
    const r = await fetch(base + path, {
      ...opts,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: 'Bearer ' + token } : {}),
        ...(opts.headers || {})
      }
    });
    const body = await r.json().catch(() => ({}));
    return { status: r.status, ok: r.ok, body };
  }

  try {
    // 1) Register user
    const regBody = { username: `smoke_user_${nonce}`, email: `smoke.user.${nonce}@example.com`, password: 'Test1234!' };
    let r = await req('/auth/register', { method: 'POST', body: JSON.stringify(regBody) });
    if (!r.ok && r.status !== 409) throw new Error('User register failed: ' + JSON.stringify(r.body));
    log('user register:', r.status);

    // 2) Login user
    r = await req('/auth/login', { method: 'POST', body: JSON.stringify({ email: regBody.email, password: regBody.password }) });
    if (!r.body.token) throw new Error('User login failed: ' + JSON.stringify(r.body));
    const userToken = r.body.token;
    log('user login: ok');

    // 3) Non-admin access must be blocked
    r = await req('/users/by-email', { method: 'POST', body: JSON.stringify({ email: regBody.email }) }, userToken);
    if (![401, 403].includes(r.status)) throw new Error('Expected /users/by-email to be admin-only');
    log('/users/by-email as user:', r.status);

    // 4) Register + login admin
    const adminBody = { username: `smoke_admin_${nonce}`, email: `smoke.admin.${nonce}@example.com`, password: 'Admin1234!', type: 'admin' };
    r = await req('/auth/register', { method: 'POST', body: JSON.stringify(adminBody) });
    if (!r.ok && r.status !== 409) throw new Error('Admin register failed: ' + JSON.stringify(r.body));
    r = await req('/auth/login', { method: 'POST', body: JSON.stringify({ email: adminBody.email, password: adminBody.password }) });
    if (!r.body.token) throw new Error('Admin login failed: ' + JSON.stringify(r.body));
    const adminToken = r.body.token;
    log('admin login: ok');

    // 5) Admin endpoint should work
    r = await req('/users/by-email', { method: 'POST', body: JSON.stringify({ email: regBody.email }) }, adminToken);
    if (!r.ok) throw new Error('Admin /users/by-email failed: ' + JSON.stringify(r.body));
    log('/users/by-email as admin:', r.status);

    log('Smoke tests completed');
    process.exit(0);
  } catch (err) {
    console.error('[smoke] ERROR', err);
    process.exit(2);
  }
})();
