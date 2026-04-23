/**
 * routes.js  –  Complete Event Ticketing Portal API
 *
 * Sections:
 *  1.  Middleware / helpers
 *  2.  Auth  (register, login, password-reset)
 *  3.  Users  (CRUD + profile + saved payments)
 *  4.  Events  (CRUD + rich query endpoints)
 *  5.  Venues  (CRUD)
 *  6.  Sections  (CRUD)
 *  7.  Seats  (CRUD + bulk create + seat-map)
 *  8.  Tickets  (CRUD + cancel-with-refund)
 *  9.  Transactional Booking  (atomic seat + payment)
 * 10.  Payments  (CRUD)
 * 11.  Saved Payments  (CRUD)
 * 12.  Waitlist  (join, list, promote, remove)
 * 13.  Feedback  (CRUD)
 * 14.  Admin / Organizer tools
 * 15.  Reports  (analytics)
 * 16.  Debug helpers
 */

let holdWorkerStarted = false;

module.exports = (io) => {

const express  = require('express');
const router   = express.Router();
const bcrypt   = require('bcryptjs');
const jwt      = require('jsonwebtoken');
const crypto   = require('crypto');
const { poolPromise, sql } = require('./db');
const { sendMail } = require('./mail');

// ─────────────────────────────────────────────
// 1.  HELPERS
// ─────────────────────────────────────────────

const JWT_SECRET       = process.env.JWT_SECRET;
const JWT_EXPIRES_IN   = process.env.JWT_EXPIRES_IN   || '24h';
const SALT_ROUNDS      = 10;
if (!JWT_SECRET) throw new Error('JWT_SECRET is required');

// Token/hold persistence: store in DB (PasswordResetTokens, WaitlistHolds)
const HOLD_TTL_MS   = 15 * 60 * 1000; // 15 minutes

async function createResetToken(pool, token, user_id, expiresAt) {
  await pool.request()
    .input('token', sql.VarChar(128), token)
    .input('user_id', sql.VarChar(20), user_id)
    .input('expires_at', sql.DateTime, new Date(expiresAt))
    .query('INSERT INTO PasswordResetTokens (token,user_id,expires_at) VALUES (@token,@user_id,@expires_at)');
}

async function getResetEntry(pool, token) {
  const r = await pool.request()
    .input('token', sql.VarChar(128), token)
    .query('SELECT token, user_id, expires_at FROM PasswordResetTokens WHERE token = @token');
  return r.recordset[0];
}

async function deleteResetToken(pool, token) {
  await pool.request()
    .input('token', sql.VarChar(128), token)
    .query('DELETE FROM PasswordResetTokens WHERE token = @token');
}

async function createHold(pool, hold_id, user_id, event_id, section_id, seat_id, expiresAt) {
  await pool.request()
    .input('hold_id', sql.VarChar(20), hold_id)
    .input('user_id', sql.VarChar(20), user_id)
    .input('event_id', sql.VarChar(20), event_id)
    .input('section_id', sql.VarChar(20), section_id)
    .input('seat_id', sql.VarChar(20), seat_id)
    .input('expires_at', sql.DateTime, new Date(expiresAt))
    .query('INSERT INTO WaitlistHolds (hold_id,user_id,event_id,section_id,seat_id,expires_at) VALUES (@hold_id,@user_id,@event_id,@section_id,@seat_id,@expires_at)');
}

async function deleteHoldsFor(pool, user_id, event_id, seat_id) {
  const req = pool.request()
    .input('user_id', sql.VarChar(20), user_id)
    .input('event_id', sql.VarChar(20), event_id);
  if (seat_id) req.input('seat_id', sql.VarChar(20), seat_id).query('DELETE FROM WaitlistHolds WHERE user_id=@user_id AND event_id=@event_id AND seat_id=@seat_id');
  else req.query('DELETE FROM WaitlistHolds WHERE user_id=@user_id AND event_id=@event_id');
}

async function getActiveHoldsForEvent(pool, event_id) {
  const r = await pool.request()
    .input('event_id', sql.VarChar(20), event_id)
    .query('SELECT hold_id, user_id, event_id, section_id, seat_id, expires_at FROM WaitlistHolds WHERE event_id=@event_id AND expires_at > GETDATE()');
  return r.recordset;
}

async function getActiveHolds(pool) {
  const r = await pool.request().query('SELECT hold_id, user_id, event_id, section_id, seat_id, expires_at FROM WaitlistHolds WHERE expires_at > GETDATE()');
  return r.recordset;
}

async function getHoldById(pool, hold_id) {
  const r = await pool.request()
    .input('hold_id', sql.VarChar(20), hold_id)
    .query('SELECT hold_id, user_id, event_id, section_id, seat_id, expires_at FROM WaitlistHolds WHERE hold_id=@hold_id');
  return r.recordset[0] || null;
}

/** Standard error wrapper */
const wrap = fn => async (req, res, next) => {
  try { await fn(req, res, next); }
  catch (err) { res.status(500).json({ error: err.message }); }
};

/** JWT auth middleware */
function authenticate(req, res, next) {
  const header = req.headers['authorization'] || '';
  const token  = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Missing token' });
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
}

/** Role-guard middleware factory */
function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'Not authenticated' });
    if (!roles.includes(req.user.type))
      return res.status(403).json({ error: `Requires role: ${roles.join(' or ')}` });
    next();
  };
}

/** Generate a random varchar-safe ID */
function genId(prefix, len = 8) {
  return prefix + crypto.randomBytes(len).toString('hex').toUpperCase().slice(0, len);
}

// Allowed column names for user search (SQL-injection safe)
const USER_SEARCH_COLUMNS = ['user_id', 'username', 'email', 'type'];

// ─────────────────────────────────────────────
// 2.  AUTH
// ─────────────────────────────────────────────

/**
 * POST /api/auth/register
 * Body: { user_id?, username, email, password, type? }
 * Creates a new user with a bcrypt-hashed password.
 */
router.post('/auth/register', wrap(async (req, res) => {
  let { user_id, username, email, password, type } = req.body;
  if (!username || !email || !password)
    return res.status(400).json({ error: 'username, email and password are required' });

  const allowedTypes = ['admin', 'user', 'organizer'];
  type = allowedTypes.includes(type) ? type : 'user';

  // Auto-generate id if not supplied
  if (!user_id) user_id = genId('U');

  const pool = await poolPromise;

  // Check duplicate email
  const dup = await pool.request()
    .input('email', sql.VarChar(100), email)
    .query('SELECT user_id FROM Users WHERE email = @email');
  if (dup.recordset.length)
    return res.status(409).json({ error: 'Email already registered' });

  const hashed = await bcrypt.hash(password, SALT_ROUNDS);

  await pool.request()
    .input('user_id',  sql.VarChar(20),  user_id)
    .input('username', sql.VarChar(50),  username)
    .input('email',    sql.VarChar(100), email)
    .input('password', sql.VarChar(255), hashed)
    .input('type',     sql.VarChar(10),  type)
    .query('INSERT INTO Users (user_id,username,email,password,type) VALUES (@user_id,@username,@email,@password,@type)');

  const token = jwt.sign({ user_id, username, email, type }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
  res.status(201).json({ message: 'Registration successful', user_id, token });
}));

/**
 * POST /api/auth/login
 * Body: { email, password }
 */
router.post('/auth/login', wrap(async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password)
    return res.status(400).json({ error: 'email and password are required' });

  const pool = await poolPromise;
  const r = await pool.request()
    .input('email', sql.VarChar(100), email)
    .query('SELECT user_id, username, email, password, type FROM Users WHERE email = @email');

  if (!r.recordset.length)
    return res.status(401).json({ error: 'Invalid credentials' });

  const user = r.recordset[0];
  const match = await bcrypt.compare(password, user.password);
  if (!match)
    return res.status(401).json({ error: 'Invalid credentials' });

  const token = jwt.sign(
    { user_id: user.user_id, username: user.username, email: user.email, type: user.type },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN }
  );

  res.json({
    message: 'Login successful',
    token,
    user: { user_id: user.user_id, username: user.username, email: user.email, type: user.type }
  });
}));

/**
 * POST /api/auth/request-password-reset
 * Body: { email }
 * In a real app, send the token via email. Here it is returned in the response for testing.
 */
router.post('/auth/request-password-reset', wrap(async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'email is required' });

  const pool = await poolPromise;
  const r = await pool.request()
    .input('email', sql.VarChar(100), email)
    .query('SELECT user_id FROM Users WHERE email = @email');

  // Always respond 200 to prevent user enumeration
  if (!r.recordset.length)
    return res.json({ message: 'If that email is registered you will receive a reset link.' });

  const user_id = r.recordset[0].user_id;
  const token   = crypto.randomBytes(32).toString('hex');
  const expiresAt = Date.now() + 3600_000; // 1 hour
  await createResetToken(pool, token, user_id, expiresAt);
  // Only return token in explicit development mode for easier local testing
  if (process.env.EXPOSE_RESET_TOKEN === 'true') {
    return res.json({ message: 'Password reset token generated', reset_token: token });
  }
  res.json({ message: 'If that email is registered you will receive a reset link.' });
}));

/**
 * POST /api/auth/reset-password
 * Body: { token, new_password }
 */
router.post('/auth/reset-password', wrap(async (req, res) => {
  const { token, new_password } = req.body;
  if (!token || !new_password)
    return res.status(400).json({ error: 'token and new_password are required' });

  const pool = await poolPromise;
  const entry = await getResetEntry(pool, token);
  if (!entry || new Date(entry.expires_at) < new Date()) {
    if (entry) await deleteResetToken(pool, token);
    return res.status(400).json({ error: 'Invalid or expired reset token' });
  }

  const hashed = await bcrypt.hash(new_password, SALT_ROUNDS);
  await pool.request()
    .input('user_id',  sql.VarChar(20),  entry.user_id)
    .input('password', sql.VarChar(255), hashed)
    .query('UPDATE Users SET password=@password WHERE user_id=@user_id');

  await deleteResetToken(pool, token);
  res.json({ message: 'Password updated successfully' });
}));

/**
 * POST /api/auth/change-password  (authenticated)
 * Body: { current_password, new_password }
 */
router.post('/auth/change-password', authenticate, wrap(async (req, res) => {
  const { current_password, new_password } = req.body;
  if (!current_password || !new_password)
    return res.status(400).json({ error: 'current_password and new_password are required' });

  const pool = await poolPromise;
  const r = await pool.request()
    .input('id', sql.VarChar(20), req.user.user_id)
    .query('SELECT password FROM Users WHERE user_id = @id');

  if (!r.recordset.length) return res.status(404).json({ error: 'User not found' });

  const match = await bcrypt.compare(current_password, r.recordset[0].password);
  if (!match) return res.status(403).json({ error: 'Current password is incorrect' });

  const hashed = await bcrypt.hash(new_password, SALT_ROUNDS);
  await pool.request()
    .input('id',       sql.VarChar(20),  req.user.user_id)
    .input('password', sql.VarChar(255), hashed)
    .query('UPDATE Users SET password=@password WHERE user_id=@id');

  res.json({ message: 'Password changed successfully' });
}));

// ─────────────────────────────────────────────
// 3.  USERS
// ─────────────────────────────────────────────

// List all users (admin only)
router.get('/users', authenticate, requireRole('admin'), wrap(async (req, res) => {
  const pool = await poolPromise;
  const r = await pool.request().query('SELECT user_id, username, email, type FROM Users');
  res.json(r.recordset);
}));

// Generic search: /api/users/search?column=<col>&value=<val>
router.get('/users/search', authenticate, requireRole('admin'), wrap(async (req, res) => {
  const { column, value } = req.query;
  if (!column || !value)
    return res.status(400).json({ error: 'column and value query parameters required' });
  if (!USER_SEARCH_COLUMNS.includes(column))
    return res.status(400).json({ error: 'invalid column' });

  const pool = await poolPromise;
  const r = await pool.request()
    .input('value', sql.VarChar(200), value)
    .query(`SELECT user_id, username, email, type FROM Users WHERE ${column} = @value`);
  res.json(r.recordset);
}));

// Convenience: /api/users/by-<column>?<column>=<value>
router.get('/users/by-:column', authenticate, requireRole('admin'), wrap(async (req, res) => {
  const column = req.params.column;
  const value  = req.query[column];
  if (!value)
    return res.status(400).json({ error: `${column} query parameter required` });
  if (!USER_SEARCH_COLUMNS.includes(column))
    return res.status(400).json({ error: 'invalid column' });

  const pool = await poolPromise;
  const r = await pool.request()
    .input('value', sql.VarChar(200), value)
    .query(`SELECT user_id, username, email, type FROM Users WHERE ${column} = @value`);
  res.json(r.recordset);
}));

/**
 * GET /api/users/:id
 * Returns own profile (any authenticated user) or any profile (admin).
 */
router.get('/users/:id', authenticate, wrap(async (req, res) => {
  if (req.user.user_id !== req.params.id && req.user.type !== 'admin')
    return res.status(403).json({ error: 'Access denied' });

  const pool = await poolPromise;
  const r = await pool.request()
    .input('id', sql.VarChar(20), req.params.id)
    .query('SELECT user_id, username, email, type FROM Users WHERE user_id = @id');
  res.json(r.recordset[0] || null);
}));

/**
 * POST /api/users  (admin: create user directly; bypasses hashing if password already hashed)
 * For self-registration use /api/auth/register instead.
 */
router.post('/users', authenticate, requireRole('admin'), wrap(async (req, res) => {
  const { user_id, username, email, password, type } = req.body;
  const hashed = await bcrypt.hash(password, SALT_ROUNDS);
  const pool = await poolPromise;
  await pool.request()
    .input('user_id',  sql.VarChar(20),  user_id)
    .input('username', sql.VarChar(50),  username)
    .input('email',    sql.VarChar(100), email)
    .input('password', sql.VarChar(255), hashed)
    .input('type',     sql.VarChar(10),  type)
    .query('INSERT INTO Users (user_id,username,email,password,type) VALUES (@user_id,@username,@email,@password,@type)');
  res.status(201).json({ message: 'User created' });
}));

/**
 * PUT /api/users/:id  (self or admin)
 * Allows updating username, email, type (admin only for type).
 */
router.put('/users/:id', authenticate, wrap(async (req, res) => {
  const isSelf  = req.user.user_id === req.params.id;
  const isAdmin = req.user.type === 'admin';
  if (!isSelf && !isAdmin) return res.status(403).json({ error: 'Access denied' });

  let { username, email, type } = req.body;
  if (!isAdmin) type = req.user.type; // non-admins cannot elevate their own role

  const pool = await poolPromise;
  await pool.request()
    .input('id',       sql.VarChar(20),  req.params.id)
    .input('username', sql.VarChar(50),  username)
    .input('email',    sql.VarChar(100), email)
    .input('type',     sql.VarChar(10),  type)
    .query('UPDATE Users SET username=@username, email=@email, type=@type WHERE user_id=@id');
  res.json({ message: 'User updated' });
}));

/** DELETE /api/users/:id  (admin only) */
router.delete('/users/:id', authenticate, requireRole('admin'), wrap(async (req, res) => {
  const pool = await poolPromise;
  await pool.request()
    .input('id', sql.VarChar(20), req.params.id)
    .query('DELETE FROM Users WHERE user_id = @id');
  res.json({ message: 'User deleted' });
}));

/**
 * GET /api/profile/:id  – rich user profile (self or admin)
 * Returns user info + payment count + ticket count + saved payment methods.
 */
router.get('/profile/:id', authenticate, wrap(async (req, res) => {
  const isSelf  = req.user.user_id === req.params.id;
  const isAdmin = req.user.type === 'admin';
  if (!isSelf && !isAdmin) return res.status(403).json({ error: 'Access denied' });

  const pool = await poolPromise;
  const profileR = await pool.request()
    .input('id', sql.VarChar(20), req.params.id)
    .query(`SELECT u.user_id, u.username, u.email, u.type,
              (SELECT COUNT(*) FROM Payments p WHERE p.user_id = u.user_id) AS payments_count,
              (SELECT COUNT(*) FROM Tickets  t WHERE t.purchased_by = u.user_id) AS tickets_count
            FROM Users u WHERE u.user_id = @id`);

  const savedR = await pool.request()
    .input('id', sql.VarChar(20), req.params.id)
    .query('SELECT sp_id, acc_no, bank FROM SavedPayments WHERE user_id = @id');

  if (!profileR.recordset.length) return res.status(404).json({ error: 'User not found' });

  res.json({ ...profileR.recordset[0], saved_payments: savedR.recordset });
}));

/**
 * GET /api/users/:id/purchases  – full purchase history
 */
router.get('/users/:id/purchases', authenticate, wrap(async (req, res) => {
  const isSelf  = req.user.user_id === req.params.id;
  const isAdmin = req.user.type === 'admin';
  if (!isSelf && !isAdmin) return res.status(403).json({ error: 'Access denied' });

  const pool = await poolPromise;
  const r = await pool.request()
    .input('user_id', sql.VarChar(20), req.params.id)
    .query(`SELECT p.payment_id, p.amount, p.paid_at, p.method,
                   e.event_id, e.event_name, e.event_date,
                   t.ticket_id, t.seat_id,
                   s.seat_num, sec.section_name
            FROM Payments p
            JOIN Tickets  t   ON p.ticket_id   = t.ticket_id
            JOIN Events   e   ON t.event_id    = e.event_id
            JOIN Seats    s   ON t.seat_id     = s.seat_id
            JOIN Sections sec ON s.section_id  = sec.section_id
            WHERE p.user_id = @user_id
            ORDER BY p.paid_at DESC`);
  res.json(r.recordset);
}));

/**
 * GET /api/users/:id/tickets  – all tickets for a user
 */
router.get('/users/:id/tickets', authenticate, wrap(async (req, res) => {
  const isSelf  = req.user.user_id === req.params.id;
  const isAdmin = req.user.type === 'admin';
  if (!isSelf && !isAdmin) return res.status(403).json({ error: 'Access denied' });

  const pool = await poolPromise;
  const r = await pool.request()
    .input('uid', sql.VarChar(20), req.params.id)
    .query(`SELECT t.ticket_id, t.event_id, e.event_name, e.event_date,
                   t.seat_id, s.seat_num, sec.section_name, v.venue_name
            FROM Tickets  t
            JOIN Events   e   ON t.event_id   = e.event_id
            JOIN Seats    s   ON t.seat_id    = s.seat_id
            JOIN Sections sec ON s.section_id = sec.section_id
            JOIN Venues   v   ON e.venue_id   = v.venue_id
            WHERE t.purchased_by = @uid
            ORDER BY e.event_date DESC`);
  res.json(r.recordset);
}));

// ─────────────────────────────────────────────
// 4.  EVENTS
// ─────────────────────────────────────────────

/** GET /api/events  – list all events with venue name */
router.get('/events', wrap(async (req, res) => {
  const pool = await poolPromise;
  const r = await pool.request().query(`
    SELECT e.*, v.venue_name
    FROM Events e
    JOIN Venues v ON e.venue_id = v.venue_id
    ORDER BY e.event_date ASC
  `);
  res.json(r.recordset);
}));

/** GET /api/events/:id */
router.get('/events/:id', wrap(async (req, res) => {
  const pool = await poolPromise;
  const r = await pool.request()
    .input('id', sql.VarChar(20), req.params.id)
    .query(`SELECT e.*, v.venue_name
            FROM Events e
            JOIN Venues v ON e.venue_id = v.venue_id
            WHERE e.event_id = @id`);
  res.json(r.recordset[0] || null);
}));

/** POST /api/events  (organizer or admin) */
router.post('/events', authenticate, requireRole('organizer', 'admin'), wrap(async (req, res) => {
  let { event_id, event_name, event_description, event_date, venue_id, organizer_id, ticket_price, type } = req.body;
  if (!event_id) event_id = genId('E');
  // Organizers can only create events for themselves
  if (req.user.type === 'organizer') organizer_id = req.user.user_id;

  const pool = await poolPromise;
  await pool.request()
    .input('event_id',          sql.VarChar(20),   event_id)
    .input('event_name',        sql.VarChar(200),  event_name)
    .input('event_description', sql.VarChar(2000), event_description)
    .input('event_date',        sql.Date,          event_date)
    .input('venue_id',          sql.VarChar(20),   venue_id)
    .input('organizer_id',      sql.VarChar(20),   organizer_id)
    .input('ticket_price',      sql.Float,         ticket_price)
    .input('type',              sql.VarChar(50),   type)
    .query(`INSERT INTO Events
              (event_id,event_name,event_description,event_date,venue_id,organizer_id,ticket_price,type)
            VALUES
              (@event_id,@event_name,@event_description,@event_date,@venue_id,@organizer_id,@ticket_price,@type)`);
  res.status(201).json({ message: 'Event created', event_id });
}));

/** PUT /api/events/:id  (owner organizer or admin) */
router.put('/events/:id', authenticate, requireRole('organizer', 'admin'), wrap(async (req, res) => {
  const { event_name, event_description, event_date, venue_id, ticket_price, type } = req.body;
  const pool = await poolPromise;

  // Verify ownership for organizers
  if (req.user.type === 'organizer') {
    const own = await pool.request()
      .input('id', sql.VarChar(20), req.params.id)
      .query('SELECT organizer_id FROM Events WHERE event_id = @id');
    if (!own.recordset.length || own.recordset[0].organizer_id !== req.user.user_id)
      return res.status(403).json({ error: 'You can only edit your own events' });
  }

  await pool.request()
    .input('id',                sql.VarChar(20),   req.params.id)
    .input('event_name',        sql.VarChar(200),  event_name)
    .input('event_description', sql.VarChar(2000), event_description)
    .input('event_date',        sql.Date,          event_date)
    .input('venue_id',          sql.VarChar(20),   venue_id)
    .input('ticket_price',      sql.Float,         ticket_price)
    .input('type',              sql.VarChar(50),   type)
    .query(`UPDATE Events SET
              event_name=@event_name, event_description=@event_description,
              event_date=@event_date, venue_id=@venue_id,
              ticket_price=@ticket_price, type=@type
            WHERE event_id=@id`);
  res.json({ message: 'Event updated' });
}));

/** DELETE /api/events/:id  (admin only) */
router.delete('/events/:id', authenticate, requireRole('admin'), wrap(async (req, res) => {
  const pool = await poolPromise;
  await pool.request()
    .input('id', sql.VarChar(20), req.params.id)
    .query('DELETE FROM Events WHERE event_id=@id');
  res.json({ message: 'Event deleted' });
}));

/** GET /api/events/:id/details  – rich event detail with tickets_sold */
router.get('/events/:id/details', wrap(async (req, res) => {
  const pool = await poolPromise;
  const r = await pool.request()
    .input('event_id', sql.VarChar(20), req.params.id)
    .query(`SELECT e.event_id, e.event_name, e.event_description, e.event_date,
                   e.ticket_price, e.type, v.venue_name, v.venue_description,
                   ISNULL(SUM(CASE WHEN t.purchased_by IS NOT NULL THEN 1 ELSE 0 END),0) AS tickets_sold
            FROM Events e
            LEFT JOIN Venues  v ON e.venue_id = v.venue_id
            LEFT JOIN Tickets t ON e.event_id = t.event_id
            WHERE e.event_id = @event_id
            GROUP BY e.event_id, e.event_name, e.event_description,
                     e.event_date, e.ticket_price, e.type,
                     v.venue_name, v.venue_description`);
  res.json(r.recordset[0] || null);
}));

/** GET /api/events/:id/ratings */
router.get('/events/:id/ratings', wrap(async (req, res) => {
  const pool = await poolPromise;
  const r = await pool.request()
    .input('event_id', sql.VarChar(20), req.params.id)
    .query(`SELECT e.event_id, e.event_name,
                   ISNULL(AVG(CAST(f.rating AS FLOAT)),0) AS avg_rating,
                   COUNT(f.feedback_id) AS reviews
            FROM Events e
            LEFT JOIN Feedback f ON e.event_id = f.event_id
            WHERE e.event_id = @event_id
            GROUP BY e.event_id, e.event_name`);
  res.json(r.recordset[0] || null);
}));

/** GET /api/events/:id/feedback */
router.get('/events/:id/feedback', wrap(async (req, res) => {
  const pool = await poolPromise;
  const r = await pool.request()
    .input('event_id', sql.VarChar(20), req.params.id)
    .query(`SELECT f.feedback_id, f.user_id, u.username, f.rating, f.comment, f.created_at
            FROM Feedback f
            JOIN Users u ON f.user_id = u.user_id
            WHERE f.event_id = @event_id
            ORDER BY f.created_at DESC`);
  res.json(r.recordset);
}));

/**
 * GET /api/events/:id/available-seats
 * Returns seats that have not been purchased for this event,
 * with section info and seat attributes.
 */
router.get('/events/:id/available-seats', wrap(async (req, res) => {
  const pool = await poolPromise;
  const r = await pool.request()
    .input('event_id', sql.VarChar(20), req.params.id)
    .query(`SELECT s.seat_id, s.seat_num, s.x_coord, s.y_coord,
                   s.section_id, sec.section_name, sec.factor,
                   s.accessible, s.obstructed, s.blocked
            FROM Seats s
            JOIN Sections sec ON s.section_id = sec.section_id
            WHERE sec.venue_id = (SELECT venue_id FROM Events WHERE event_id = @event_id)
              AND s.seat_id NOT IN (
                SELECT t.seat_id FROM Tickets t
                WHERE t.event_id = @event_id AND t.purchased_by IS NOT NULL
              )
              AND (s.blocked IS NULL OR s.blocked = 0)`);
  res.json(r.recordset);
}));

/**
 * GET /api/events/:id/seats-remaining
 * Remaining capacity per section.
 */
router.get('/events/:id/seats-remaining', wrap(async (req, res) => {
  const pool = await poolPromise;
  const r = await pool.request()
    .input('event_id', sql.VarChar(20), req.params.id)
    .query(`SELECT sec.section_id, sec.section_name, sec.capacity,
                   ISNULL(sold.cnt,0)                            AS tickets_sold,
                   (sec.capacity - ISNULL(sold.cnt,0))           AS seats_remaining
            FROM Sections sec
            LEFT JOIN (
              SELECT ss.section_id, COUNT(t.ticket_id) AS cnt
              FROM Seats ss
              JOIN Tickets t ON ss.seat_id = t.seat_id
                             AND t.event_id = @event_id
                             AND t.purchased_by IS NOT NULL
              GROUP BY ss.section_id
            ) sold ON sec.section_id = sold.section_id
            WHERE sec.venue_id = (SELECT venue_id FROM Events WHERE event_id = @event_id)`);
  res.json(r.recordset);
}));

/**
 * GET /api/events/:id/seatmap
 * Full interactive seat map: every seat with its current state
 * (available | purchased | waitlist_held | blocked) for the event.
 */
router.get('/events/:id/seatmap', wrap(async (req, res) => {
  const pool = await poolPromise;

  // All seats for the venue of this event
  const seatsR = await pool.request()
    .input('event_id', sql.VarChar(20), req.params.id)
    .query(`SELECT s.seat_id, s.seat_num, s.x_coord, s.y_coord,
                   s.section_id, sec.section_name, sec.factor,
                   s.accessible, s.obstructed, s.blocked,
                   t.purchased_by, t.reserved AS vip_only
            FROM Seats s
            JOIN Sections sec ON s.section_id = sec.section_id
            LEFT JOIN Tickets t ON t.seat_id = s.seat_id AND t.event_id = @event_id
            WHERE sec.venue_id = (SELECT venue_id FROM Events WHERE event_id = @event_id)
            ORDER BY sec.section_id, s.seat_num`);

  // Determine hold states from in-memory store
  const holds = await getActiveHoldsForEvent(pool, req.params.id);
  const heldSeatIds = new Set(holds.map(h => h.seat_id).filter(Boolean));

  const seats = seatsR.recordset.map(s => {
    let state = 'available';
    if (s.blocked)            state = 'blocked';
    else if (s.purchased_by)  state = 'purchased';
    else if (heldSeatIds.has(s.seat_id)) state = 'waitlist_held';
    else if (s.vip_only === 'Y') state = 'vip_reserved';

    return {
      seat_id:      s.seat_id,
      seat_num:     s.seat_num,
      x_coord:      s.x_coord,
      y_coord:      s.y_coord,
      section_id:   s.section_id,
      section_name: s.section_name,
      price_factor: s.factor,
      accessible:   !!s.accessible,
      obstructed:   !!s.obstructed,
      blocked:      !!s.blocked,
      state
    };
  });

  // Group by section
  const sections = {};
  for (const seat of seats) {
    if (!sections[seat.section_id]) {
      sections[seat.section_id] = { section_id: seat.section_id, section_name: seat.section_name, seats: [] };
    }
    sections[seat.section_id].seats.push(seat);
  }

  res.json({ event_id: req.params.id, sections: Object.values(sections) });
}));

/** GET /api/events/:id/waiting  – waiting list for an event */
router.get('/events/:id/waiting', wrap(async (req, res) => {
  const pool = await poolPromise;
  const r = await pool.request()
    .input('event_id', sql.VarChar(20), req.params.id)
    .query(`SELECT w.waiting_id, w.user_id, u.username, w.section_id, w.created_at
            FROM Waiting w JOIN Users u ON w.user_id = u.user_id
            WHERE w.event_id = @event_id
            ORDER BY w.created_at ASC`);
  res.json(r.recordset);
}));

// ─────────────────────────────────────────────
// 5.  VENUES
// ─────────────────────────────────────────────

router.get('/venues', wrap(async (req, res) => {
  const pool = await poolPromise;
  const r = await pool.request().query('SELECT * FROM Venues');
  res.json(r.recordset);
}));

router.get('/venues/:id', wrap(async (req, res) => {
  const pool = await poolPromise;
  const r = await pool.request()
    .input('id', sql.VarChar(20), req.params.id)
    .query('SELECT * FROM Venues WHERE venue_id = @id');
  res.json(r.recordset[0] || null);
}));

/** GET /api/venues/:id/sections  – sections + seats for a venue */
router.get('/venues/:id/sections', wrap(async (req, res) => {
  const pool = await poolPromise;
  const sections = await pool.request()
    .input('id', sql.VarChar(20), req.params.id)
    .query('SELECT * FROM Sections WHERE venue_id = @id ORDER BY section_name');

  const seats = await pool.request()
    .input('id', sql.VarChar(20), req.params.id)
    .query(`SELECT s.* FROM Seats s
            JOIN Sections sec ON s.section_id = sec.section_id
            WHERE sec.venue_id = @id
            ORDER BY sec.section_id, s.seat_num`);

  const seatsMap = {};
  for (const s of seats.recordset) {
    if (!seatsMap[s.section_id]) seatsMap[s.section_id] = [];
    seatsMap[s.section_id].push(s);
  }

  res.json(sections.recordset.map(sec => ({
    ...sec,
    seats: seatsMap[sec.section_id] || []
  })));
}));

router.post('/venues', authenticate, requireRole('organizer', 'admin'), wrap(async (req, res) => {
  let { venue_id, venue_name, venue_description } = req.body;
  if (!venue_id) venue_id = genId('V');
  const pool = await poolPromise;
  await pool.request()
    .input('venue_id',          sql.VarChar(20),   venue_id)
    .input('venue_name',        sql.VarChar(100),  venue_name)
    .input('venue_description', sql.VarChar(1000), venue_description)
    .query('INSERT INTO Venues (venue_id,venue_name,venue_description) VALUES (@venue_id,@venue_name,@venue_description)');
  res.status(201).json({ message: 'Venue created', venue_id });
}));

router.put('/venues/:id', authenticate, requireRole('organizer', 'admin'), wrap(async (req, res) => {
  const { venue_name, venue_description } = req.body;
  const pool = await poolPromise;
  await pool.request()
    .input('id',                sql.VarChar(20),   req.params.id)
    .input('venue_name',        sql.VarChar(100),  venue_name)
    .input('venue_description', sql.VarChar(1000), venue_description)
    .query('UPDATE Venues SET venue_name=@venue_name, venue_description=@venue_description WHERE venue_id=@id');
  res.json({ message: 'Venue updated' });
}));

router.delete('/venues/:id', authenticate, requireRole('admin'), wrap(async (req, res) => {
  const pool = await poolPromise;
  await pool.request()
    .input('id', sql.VarChar(20), req.params.id)
    .query('DELETE FROM Venues WHERE venue_id = @id');
  res.json({ message: 'Venue deleted' });
}));

// ─────────────────────────────────────────────
// 6.  SECTIONS
// ─────────────────────────────────────────────

router.get('/sections', wrap(async (req, res) => {
  const pool = await poolPromise;
  const r = await pool.request().query('SELECT * FROM Sections');
  res.json(r.recordset);
}));

router.get('/sections/:id', wrap(async (req, res) => {
  const pool = await poolPromise;
  const r = await pool.request()
    .input('id', sql.VarChar(20), req.params.id)
    .query('SELECT * FROM Sections WHERE section_id = @id');
  res.json(r.recordset[0] || null);
}));

router.post('/sections', authenticate, requireRole('organizer', 'admin'), wrap(async (req, res) => {
  let { section_id, section_name, section_description, venue_id, capacity, factor } = req.body;
  if (!section_id) section_id = genId('SEC');
  const pool = await poolPromise;
  await pool.request()
    .input('section_id',          sql.VarChar(20),   section_id)
    .input('section_name',        sql.VarChar(100),  section_name)
    .input('section_description', sql.VarChar(1000), section_description)
    .input('venue_id',            sql.VarChar(20),   venue_id)
    .input('capacity',            sql.Int,           capacity)
    .input('factor',              sql.Float,         factor)
    .query(`INSERT INTO Sections (section_id,section_name,section_description,venue_id,capacity,factor)
            VALUES (@section_id,@section_name,@section_description,@venue_id,@capacity,@factor)`);
  res.status(201).json({ message: 'Section created', section_id });
}));

router.put('/sections/:id', authenticate, requireRole('organizer', 'admin'), wrap(async (req, res) => {
  const { section_name, section_description, venue_id, capacity, factor } = req.body;
  const pool = await poolPromise;
  await pool.request()
    .input('id',                  sql.VarChar(20),   req.params.id)
    .input('section_name',        sql.VarChar(100),  section_name)
    .input('section_description', sql.VarChar(1000), section_description)
    .input('venue_id',            sql.VarChar(20),   venue_id)
    .input('capacity',            sql.Int,           capacity)
    .input('factor',              sql.Float,         factor)
    .query(`UPDATE Sections SET section_name=@section_name, section_description=@section_description,
                                venue_id=@venue_id, capacity=@capacity, factor=@factor
            WHERE section_id=@id`);
  res.json({ message: 'Section updated' });
}));

router.delete('/sections/:id', authenticate, requireRole('admin'), wrap(async (req, res) => {
  const pool = await poolPromise;
  await pool.request()
    .input('id', sql.VarChar(20), req.params.id)
    .query('DELETE FROM Sections WHERE section_id = @id');
  res.json({ message: 'Section deleted' });
}));

// ─────────────────────────────────────────────
// 7.  SEATS
// ─────────────────────────────────────────────

router.get('/seats', wrap(async (req, res) => {
  const pool = await poolPromise;
  const r = await pool.request().query('SELECT * FROM Seats ORDER BY section_id, seat_num');
  res.json(r.recordset);
}));

router.get('/seats/:id', wrap(async (req, res) => {
  const pool = await poolPromise;
  const r = await pool.request()
    .input('id', sql.VarChar(20), req.params.id)
    .query('SELECT * FROM Seats WHERE seat_id = @id');
  res.json(r.recordset[0] || null);
}));

/** POST /api/seats  – create one seat */
router.post('/seats', authenticate, requireRole('organizer', 'admin'), wrap(async (req, res) => {
  let { seat_id, x_coord, y_coord, section_id, seat_num, accessible, obstructed, blocked } = req.body;
  if (!seat_id) seat_id = genId('SEAT');
  const pool = await poolPromise;
  await pool.request()
    .input('seat_id',    sql.VarChar(20), seat_id)
    .input('x_coord',   sql.Int,         x_coord)
    .input('y_coord',   sql.Int,         y_coord)
    .input('section_id',sql.VarChar(20), section_id)
    .input('seat_num',  sql.Int,         seat_num)
    .input('accessible',sql.Bit,         accessible ? 1 : 0)
    .input('obstructed',sql.Bit,         obstructed ? 1 : 0)
    .input('blocked',   sql.Bit,         blocked    ? 1 : 0)
    .query(`INSERT INTO Seats (seat_id,x_coord,y_coord,section_id,seat_num,accessible,obstructed,blocked)
            VALUES (@seat_id,@x_coord,@y_coord,@section_id,@seat_num,@accessible,@obstructed,@blocked)`);
  res.status(201).json({ message: 'Seat created', seat_id });
}));

/**
 * POST /api/seats/bulk
 * Body: { seats: [ { x_coord, y_coord, section_id, seat_num, accessible?, obstructed?, blocked? }, … ] }
 * Creates multiple seats in one request; auto-generates seat_ids.
 */
router.post('/seats/bulk', authenticate, requireRole('organizer', 'admin'), wrap(async (req, res) => {
  const { seats } = req.body;
  if (!Array.isArray(seats) || !seats.length)
    return res.status(400).json({ error: 'seats array is required' });

  const pool = await poolPromise;
  const created = [];

  for (const seat of seats) {
    const seat_id = seat.seat_id || genId('SEAT');
    await pool.request()
      .input('seat_id',    sql.VarChar(20), seat_id)
      .input('x_coord',   sql.Int,         seat.x_coord)
      .input('y_coord',   sql.Int,         seat.y_coord)
      .input('section_id',sql.VarChar(20), seat.section_id)
      .input('seat_num',  sql.Int,         seat.seat_num)
      .input('accessible',sql.Bit,         seat.accessible ? 1 : 0)
      .input('obstructed',sql.Bit,         seat.obstructed ? 1 : 0)
      .input('blocked',   sql.Bit,         seat.blocked    ? 1 : 0)
      .query(`INSERT INTO Seats (seat_id,x_coord,y_coord,section_id,seat_num,accessible,obstructed,blocked)
              VALUES (@seat_id,@x_coord,@y_coord,@section_id,@seat_num,@accessible,@obstructed,@blocked)`);
    created.push(seat_id);
  }

  res.status(201).json({ message: `${created.length} seat(s) created`, seat_ids: created });
}));

router.put('/seats/:id', authenticate, requireRole('organizer', 'admin'), wrap(async (req, res) => {
  const { x_coord, y_coord, section_id, seat_num, accessible, obstructed, blocked } = req.body;
  const pool = await poolPromise;
  await pool.request()
    .input('id',         sql.VarChar(20), req.params.id)
    .input('x_coord',   sql.Int,         x_coord)
    .input('y_coord',   sql.Int,         y_coord)
    .input('section_id',sql.VarChar(20), section_id)
    .input('seat_num',  sql.Int,         seat_num)
    .input('accessible',sql.Bit,         accessible ? 1 : 0)
    .input('obstructed',sql.Bit,         obstructed ? 1 : 0)
    .input('blocked',   sql.Bit,         blocked    ? 1 : 0)
    .query(`UPDATE Seats SET x_coord=@x_coord, y_coord=@y_coord, section_id=@section_id,
                             seat_num=@seat_num, accessible=@accessible, obstructed=@obstructed, blocked=@blocked
            WHERE seat_id=@id`);
  res.json({ message: 'Seat updated' });
}));

router.delete('/seats/:id', authenticate, requireRole('admin'), wrap(async (req, res) => {
  const pool = await poolPromise;
  await pool.request()
    .input('id', sql.VarChar(20), req.params.id)
    .query('DELETE FROM Seats WHERE seat_id = @id');
  res.json({ message: 'Seat deleted' });
}));

// ─────────────────────────────────────────────
// 8.  TICKETS  (CRUD + cancel-with-refund)
// ─────────────────────────────────────────────

router.get('/tickets', authenticate, requireRole('admin'), wrap(async (req, res) => {
  const pool = await poolPromise;
  const r = await pool.request().query('SELECT * FROM Tickets');
  res.json(r.recordset);
}));

router.get('/tickets/:id', authenticate, wrap(async (req, res) => {
  const pool = await poolPromise;
  const r = await pool.request()
    .input('id', sql.VarChar(20), req.params.id)
    .query('SELECT * FROM Tickets WHERE ticket_id = @id');
  const ticket = r.recordset[0];
  if (!ticket) return res.status(404).json({ error: 'Ticket not found' });

  // Only owner or admin may view
  if (req.user.type !== 'admin' && ticket.purchased_by !== req.user.user_id)
    return res.status(403).json({ error: 'Access denied' });

  res.json(ticket);
}));

router.post('/tickets', authenticate, requireRole('admin'), wrap(async (req, res) => {
  const { ticket_id, event_id, seat_id, reserved, purchased_by } = req.body;
  if (purchased_by && reserved === 'Y')
    return res.status(400).json({ error: "Cannot set reserved='Y' on a purchased ticket" });

  const pool = await poolPromise;
  await pool.request()
    .input('ticket_id',   sql.VarChar(20), ticket_id)
    .input('event_id',    sql.VarChar(20), event_id)
    .input('seat_id',     sql.VarChar(20), seat_id)
    .input('reserved',    sql.Char(1),     reserved)
    .input('purchased_by',sql.VarChar(20), purchased_by || null)
    .query('INSERT INTO Tickets (ticket_id,event_id,seat_id,reserved,purchased_by) VALUES (@ticket_id,@event_id,@seat_id,@reserved,@purchased_by)');
  res.status(201).json({ message: 'Ticket created' });
}));

router.put('/tickets/:id', authenticate, requireRole('admin'), wrap(async (req, res) => {
  const { reserved, purchased_by } = req.body;
  if (purchased_by && reserved === 'Y')
    return res.status(400).json({ error: "Cannot mark a purchased ticket reserved='Y'" });

  const pool = await poolPromise;
  await pool.request()
    .input('id',          sql.VarChar(20), req.params.id)
    .input('reserved',    sql.Char(1),     reserved)
    .input('purchased_by',sql.VarChar(20), purchased_by || null)
    .query('UPDATE Tickets SET reserved=@reserved, purchased_by=@purchased_by WHERE ticket_id=@id');
  res.json({ message: 'Ticket updated' });
}));

router.delete('/tickets/:id', authenticate, requireRole('admin'), wrap(async (req, res) => {
  const pool = await poolPromise;
  await pool.request()
    .input('id', sql.VarChar(20), req.params.id)
    .query('DELETE FROM Tickets WHERE ticket_id = @id');
  res.json({ message: 'Ticket deleted' });
}));

/**
 * POST /api/tickets/:id/cancel
 * Cancels a purchased ticket: deletes payment record and releases the seat.
 * Authenticated user must own the ticket, or be admin.
 * After cancellation, automatically checks waitlist and promotes first user.
 */
router.post('/tickets/:id/cancel', authenticate, wrap(async (req, res) => {
  const pool = await poolPromise;
  const transaction = new sql.Transaction(pool);

  try {
    await transaction.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);

    // Fetch ticket
    const tR = await transaction.request()
      .input('id', sql.VarChar(20), req.params.id)
      .query('SELECT * FROM Tickets WHERE ticket_id = @id');

    if (!tR.recordset.length) {
      await transaction.rollback();
      return res.status(404).json({ error: 'Ticket not found' });
    }

    const ticket = tR.recordset[0];

    // Ownership check
    if (req.user.type !== 'admin' && ticket.purchased_by !== req.user.user_id) {
      await transaction.rollback();
      return res.status(403).json({ error: 'You can only cancel your own tickets' });
    }

    if (!ticket.purchased_by) {
      await transaction.rollback();
      return res.status(400).json({ error: 'Ticket is not purchased' });
    }

    // Delete payment
    await transaction.request()
      .input('ticket_id', sql.VarChar(20), req.params.id)
      .query('DELETE FROM Payments WHERE ticket_id = @ticket_id');

    // Release seat
    await transaction.request()
      .input('id', sql.VarChar(20), req.params.id)
      .query("UPDATE Tickets SET reserved='N', purchased_by=NULL WHERE ticket_id=@id");

    await transaction.commit();

    // Promote first waitlist user for this section/event (async, best-effort)
    _promoteFromWaitlist(ticket.event_id, ticket.seat_id, pool).catch(() => {});

    // Emit seat update to connected clients
    try { if (io) io.emit('seat-updated', { event_id: ticket.event_id, seat_id: ticket.seat_id, status: 'released', ticket_id: req.params.id }); } catch (e) {}

    res.json({ message: 'Ticket cancelled and seat released', ticket_id: req.params.id });
  } catch (err) {
    try { await transaction.rollback(); } catch {}
    res.status(500).json({ error: err.message });
  }
}));

// ─────────────────────────────────────────────
// 9.  TRANSACTIONAL BOOKING
// ─────────────────────────────────────────────

/**
 * POST /api/book
 * Atomically: validates seat availability → inserts Ticket → inserts Payment.
 * Uses SERIALIZABLE isolation to prevent double-booking.
 * Body: { ticket_id?, event_id, seat_id, user_id, payment_id?, method, amount }
 */
router.post('/book', authenticate, wrap(async (req, res) => {
  let { ticket_id, event_id, seat_id, user_id, payment_id, method, amount, hold_id } = req.body;

  // Authenticated user can only book for themselves (or admin can book for anyone)
  if (req.user.type !== 'admin') user_id = req.user.user_id;

  if (!event_id || !seat_id || !user_id || !method || amount === undefined)
    return res.status(400).json({ error: 'event_id, seat_id, user_id, method, amount are required' });

  const allowedMethods = ['Bank Payment', 'Online Wallet Payment', 'Cash', 'COD'];
  if (!allowedMethods.includes(method))
    return res.status(400).json({ error: `method must be one of: ${allowedMethods.join(', ')}` });

  const parsedAmount = Number(amount);
  if (isNaN(parsedAmount) || parsedAmount < 0)
    return res.status(400).json({ error: 'amount must be a non-negative number' });

  if (!ticket_id)  ticket_id  = genId('T');
  if (!payment_id) payment_id = genId('P');

  const pool = await poolPromise;
  const transaction = new sql.Transaction(pool);

  try {
    await transaction.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);

    // Event exists?
    const evR = await transaction.request()
      .input('event_id', sql.VarChar(20), event_id)
      .query('SELECT event_id, ticket_price FROM Events WHERE event_id = @event_id');
    if (!evR.recordset.length) {
      await transaction.rollback();
      return res.status(404).json({ error: 'Event not found' });
    }

    // Seat availability for this event
    const seatR = await transaction.request()
      .input('event_id', sql.VarChar(20), event_id)
      .input('seat_id',  sql.VarChar(20), seat_id)
      .query('SELECT ticket_id, reserved, purchased_by FROM Tickets WHERE event_id=@event_id AND seat_id=@seat_id');

    if (seatR.recordset.some(r => r.purchased_by !== null)) {
      await transaction.rollback();
      return res.status(409).json({ error: 'Seat already purchased for this event' });
    }
    if (seatR.recordset.some(r => r.reserved === 'Y' && r.purchased_by === null)) {
      await transaction.rollback();
      return res.status(403).json({ error: 'Seat is VIP-only and not available for general booking' });
    }

    // Check the seat is not blocked and fetch section for hold validation
    const blockedR = await transaction.request()
      .input('seat_id', sql.VarChar(20), seat_id)
      .query('SELECT blocked, section_id FROM Seats WHERE seat_id=@seat_id');
    const seatRow = blockedR.recordset[0];
    if (!seatRow) {
      await transaction.rollback();
      return res.status(404).json({ error: 'Seat not found' });
    }
    if (seatRow.blocked) {
      await transaction.rollback();
      return res.status(403).json({ error: 'Seat is blocked' });
    }

    // Hold validation:
    // - If hold_id is supplied, it must be active and belong to this user/event and seat/section.
    // - If any active hold exists for this seat/section, a valid matching hold_id is required.
    const holdRows = (await transaction.request()
      .input('event_id', sql.VarChar(20), event_id)
      .input('seat_id', sql.VarChar(20), seat_id)
      .input('section_id', sql.VarChar(20), seatRow.section_id)
      .query(`SELECT hold_id, user_id, event_id, section_id, seat_id, expires_at
              FROM WaitlistHolds
              WHERE event_id=@event_id
                AND expires_at > GETDATE()
                AND (seat_id=@seat_id OR (seat_id IS NULL AND section_id=@section_id))`)).recordset;

    if (hold_id) {
      const hold = holdRows.find(h => h.hold_id === hold_id) || await getHoldById(pool, hold_id);
      if (!hold) {
        await transaction.rollback();
        return res.status(400).json({ error: 'Invalid hold_id' });
      }
      if (new Date(hold.expires_at) <= new Date()) {
        await transaction.rollback();
        return res.status(400).json({ error: 'hold_id has expired' });
      }
      const holdMatchesSeat = hold.seat_id ? hold.seat_id === seat_id : hold.section_id === seatRow.section_id;
      if (hold.event_id !== event_id || !holdMatchesSeat || hold.user_id !== user_id) {
        await transaction.rollback();
        return res.status(403).json({ error: 'hold_id does not match booking scope or user' });
      }
    } else if (holdRows.length > 0 && req.user.type !== 'admin') {
      await transaction.rollback();
      return res.status(423).json({ error: 'A waitlist hold exists for this seat/section. Provide a valid hold_id.' });
    }

    // Use existing unpurchased ticket row if present; otherwise create a new one.
    const reusableTicket = seatR.recordset.find(r => r.purchased_by === null && r.reserved !== 'Y');
    if (reusableTicket) {
      ticket_id = reusableTicket.ticket_id;
      await transaction.request()
        .input('ticket_id', sql.VarChar(20), ticket_id)
        .input('purchased_by', sql.VarChar(20), user_id)
        .query("UPDATE Tickets SET reserved='N', purchased_by=@purchased_by WHERE ticket_id=@ticket_id");
    } else {
      await transaction.request()
        .input('ticket_id',   sql.VarChar(20), ticket_id)
        .input('event_id',    sql.VarChar(20), event_id)
        .input('seat_id',     sql.VarChar(20), seat_id)
        .input('reserved',    sql.Char(1),     'N')
        .input('purchased_by',sql.VarChar(20), user_id)
        .query('INSERT INTO Tickets (ticket_id,event_id,seat_id,reserved,purchased_by) VALUES (@ticket_id,@event_id,@seat_id,@reserved,@purchased_by)');
    }

    // Insert payment
    await transaction.request()
      .input('payment_id', sql.VarChar(20), payment_id)
      .input('user_id',    sql.VarChar(20), user_id)
      .input('ticket_id',  sql.VarChar(20), ticket_id)
      .input('method',     sql.VarChar(50), method)
      .input('amount',     sql.Float,       parsedAmount)
      .query('INSERT INTO Payments (payment_id,user_id,ticket_id,method,amount) VALUES (@payment_id,@user_id,@ticket_id,@method,@amount)');

    await transaction.commit();

    // Remove any waitlist hold for this user/event/seat and consumed hold id
    try { await deleteHoldsFor(pool, user_id, event_id, seat_id); } catch (e) {}
    if (hold_id) {
      try {
        await pool.request().input('hold_id', sql.VarChar(20), hold_id).query('DELETE FROM WaitlistHolds WHERE hold_id=@hold_id');
      } catch (e) {}
    }

    // Emit seat update so connected frontends can refresh
    try { if (io) io.emit('seat-updated', { event_id, seat_id, status: 'purchased', ticket_id, user_id }); } catch (e) {}

    res.status(201).json({ message: 'Booking successful', ticket_id, payment_id });
  } catch (err) {
    try { await transaction.rollback(); } catch {}
    const msg = err.message || '';
    if (msg.includes('PRIMARY') || msg.includes('UNIQUE'))
      return res.status(409).json({ error: 'Ticket or Payment ID already exists' });
    if (msg.includes('FOREIGN'))
      return res.status(400).json({ error: 'Foreign key constraint failed – check user/event/seat IDs' });
    res.status(500).json({ error: msg });
  }
}));

// ─────────────────────────────────────────────
// 10. PAYMENTS
// ─────────────────────────────────────────────

router.get('/payments', authenticate, requireRole('admin'), wrap(async (req, res) => {
  const pool = await poolPromise;
  const r = await pool.request().query('SELECT * FROM Payments ORDER BY paid_at DESC');
  res.json(r.recordset);
}));

router.get('/payments/:id', authenticate, wrap(async (req, res) => {
  const pool = await poolPromise;
  const r = await pool.request()
    .input('id', sql.VarChar(20), req.params.id)
    .query('SELECT * FROM Payments WHERE payment_id = @id');
  const pay = r.recordset[0];
  if (!pay) return res.status(404).json({ error: 'Payment not found' });
  if (req.user.type !== 'admin' && pay.user_id !== req.user.user_id)
    return res.status(403).json({ error: 'Access denied' });
  res.json(pay);
}));

router.post('/payments', authenticate, requireRole('admin'), wrap(async (req, res) => {
  const { payment_id, user_id, ticket_id, method, amount } = req.body;
  const pool = await poolPromise;
  await pool.request()
    .input('payment_id', sql.VarChar(20), payment_id)
    .input('user_id',    sql.VarChar(20), user_id)
    .input('ticket_id',  sql.VarChar(20), ticket_id)
    .input('method',     sql.VarChar(50), method)
    .input('amount',     sql.Float,       amount)
    .query('INSERT INTO Payments (payment_id,user_id,ticket_id,method,amount) VALUES (@payment_id,@user_id,@ticket_id,@method,@amount)');
  res.status(201).json({ message: 'Payment recorded' });
}));

/** POST /api/payments/process  (authenticated)
 * Simulate an external payment provider. Returns a generated `payment_id` that can
 * be passed to `/book` to complete linking payment->ticket. Does not insert a Payments row.
 */
router.post('/payments/process', authenticate, wrap(async (req, res) => {
  const { amount, method } = req.body;
  if (amount === undefined || !method) return res.status(400).json({ error: 'amount and method required' });
  const allowedMethods = ['Bank Payment', 'Online Wallet Payment', 'Cash', 'COD'];
  if (!allowedMethods.includes(method)) return res.status(400).json({ error: 'invalid method' });
  const payment_id = genId('P');
  // In production integrate provider here and return provider id/token. For demo, we return generated id.
  res.json({ payment_id, message: 'Simulated payment accepted. Pass this payment_id to /book.' });
}));

router.delete('/payments/:id', authenticate, requireRole('admin'), wrap(async (req, res) => {
  const pool = await poolPromise;
  await pool.request()
    .input('id', sql.VarChar(20), req.params.id)
    .query('DELETE FROM Payments WHERE payment_id = @id');
  res.json({ message: 'Payment deleted' });
}));

// ─────────────────────────────────────────────
// 11. SAVED PAYMENTS
// ─────────────────────────────────────────────

router.get('/saved-payments', authenticate, wrap(async (req, res) => {
  const pool = await poolPromise;
  const uid = req.user.type === 'admin' ? null : req.user.user_id;
  const q   = uid
    ? 'SELECT * FROM SavedPayments WHERE user_id = @uid'
    : 'SELECT * FROM SavedPayments';
  const req2 = pool.request();
  if (uid) req2.input('uid', sql.VarChar(20), uid);
  const r = await req2.query(q);
  res.json(r.recordset);
}));

router.get('/users/:id/saved-payments', authenticate, wrap(async (req, res) => {
  if (req.user.type !== 'admin' && req.user.user_id !== req.params.id)
    return res.status(403).json({ error: 'Access denied' });
  const pool = await poolPromise;
  const r = await pool.request()
    .input('uid', sql.VarChar(20), req.params.id)
    .query('SELECT * FROM SavedPayments WHERE user_id = @uid');
  res.json(r.recordset);
}));

router.post('/saved-payments', authenticate, wrap(async (req, res) => {
  let { sp_id, user_id, acc_no, bank } = req.body;
  if (req.user.type !== 'admin') user_id = req.user.user_id;
  if (!sp_id) sp_id = genId('SP');
  const pool = await poolPromise;
  await pool.request()
    .input('sp_id',   sql.VarChar(20),  sp_id)
    .input('user_id', sql.VarChar(20),  user_id)
    .input('acc_no',  sql.VarChar(100), acc_no)
    .input('bank',    sql.VarChar(100), bank)
    .query('INSERT INTO SavedPayments (sp_id,user_id,acc_no,bank) VALUES (@sp_id,@user_id,@acc_no,@bank)');
  res.status(201).json({ message: 'Saved payment added', sp_id });
}));

router.delete('/saved-payments/:id', authenticate, wrap(async (req, res) => {
  const pool = await poolPromise;
  // Only owner or admin may delete
  if (req.user.type !== 'admin') {
    const r = await pool.request()
      .input('id', sql.VarChar(20), req.params.id)
      .query('SELECT user_id FROM SavedPayments WHERE sp_id = @id');
    if (!r.recordset.length || r.recordset[0].user_id !== req.user.user_id)
      return res.status(403).json({ error: 'Access denied' });
  }
  await pool.request()
    .input('id', sql.VarChar(20), req.params.id)
    .query('DELETE FROM SavedPayments WHERE sp_id = @id');
  res.json({ message: 'Saved payment deleted' });
}));

// ─────────────────────────────────────────────
// 12. WAITLIST
// ─────────────────────────────────────────────

/**
 * POST /api/waiting
 * Join waitlist for a section/event.
 * Rejects if there are still seats available (unless forced by admin).
 */
router.post('/waiting', authenticate, wrap(async (req, res) => {
  let { waiting_id, section_id, event_id, user_id, force } = req.body;
  if (req.user.type !== 'admin') user_id = req.user.user_id;
  if (!waiting_id) waiting_id = genId('W');

  const pool = await poolPromise;

  // Prevent duplicate waitlist entry
  const dup = await pool.request()
    .input('section_id', sql.VarChar(20), section_id)
    .input('event_id',   sql.VarChar(20), event_id)
    .input('user_id',    sql.VarChar(20), user_id)
    .query('SELECT waiting_id FROM Waiting WHERE section_id=@section_id AND event_id=@event_id AND user_id=@user_id');
  if (dup.recordset.length)
    return res.status(409).json({ error: 'Already on waitlist for this section/event' });

  // Optional: check if section actually has seats remaining
  if (!force) {
    const remaining = await pool.request()
      .input('event_id',   sql.VarChar(20), event_id)
      .input('section_id', sql.VarChar(20), section_id)
      .query(`SELECT (sec.capacity - ISNULL(cnt.c,0)) AS remaining
              FROM Sections sec
              LEFT JOIN (
                SELECT ss.section_id, COUNT(t.ticket_id) AS c
                FROM Seats ss
                JOIN Tickets t ON ss.seat_id=t.seat_id AND t.event_id=@event_id AND t.purchased_by IS NOT NULL
                WHERE ss.section_id = @section_id
                GROUP BY ss.section_id
              ) cnt ON sec.section_id = cnt.section_id
              WHERE sec.section_id = @section_id`);
    const rem = remaining.recordset[0]?.remaining ?? 0;
    if (rem > 0)
      return res.status(400).json({ error: `Section still has ${rem} seat(s) available. Use force:true to override.` });
  }

  await pool.request()
    .input('waiting_id', sql.VarChar(20), waiting_id)
    .input('section_id', sql.VarChar(20), section_id)
    .input('event_id',   sql.VarChar(20), event_id)
    .input('user_id',    sql.VarChar(20), user_id)
    .query('INSERT INTO Waiting (waiting_id,section_id,event_id,user_id) VALUES (@waiting_id,@section_id,@event_id,@user_id)');

  res.status(201).json({ message: 'Added to waiting list', waiting_id });
}));

router.delete('/waiting/:id', authenticate, wrap(async (req, res) => {
  const pool = await poolPromise;
  if (req.user.type !== 'admin') {
    const r = await pool.request()
      .input('id', sql.VarChar(20), req.params.id)
      .query('SELECT user_id FROM Waiting WHERE waiting_id = @id');
    if (!r.recordset.length || r.recordset[0].user_id !== req.user.user_id)
      return res.status(403).json({ error: 'Access denied' });
  }
  await pool.request()
    .input('id', sql.VarChar(20), req.params.id)
    .query('DELETE FROM Waiting WHERE waiting_id = @id');
  res.json({ message: 'Removed from waiting list' });
}));

/**
 * POST /api/waiting/promote/:event_id/:section_id  (admin)
 * Manually promotes the first person on the waitlist for a given section/event.
 * Grants a 15-minute timed hold (in-memory) so they can complete booking.
 */
router.post('/waiting/promote/:event_id/:section_id', authenticate, requireRole('admin'), wrap(async (req, res) => {
  const { event_id, section_id } = req.params;
  const pool = await poolPromise;

  const r = await pool.request()
    .input('event_id',   sql.VarChar(20), event_id)
    .input('section_id', sql.VarChar(20), section_id)
    .query(`SELECT TOP 1 w.waiting_id, w.user_id, u.username, u.email
            FROM Waiting w JOIN Users u ON w.user_id = u.user_id
            WHERE w.event_id=@event_id AND w.section_id=@section_id
            ORDER BY w.created_at ASC`);

  if (!r.recordset.length)
    return res.status(404).json({ error: 'No one on waitlist for this section/event' });

  const entry   = r.recordset[0];
  const hold_id = genId('HOLD');
  const expires = Date.now() + HOLD_TTL_MS;

  await createHold(pool, hold_id, entry.user_id, event_id, section_id, null, expires);

  // Remove from waitlist
  await pool.request()
    .input('id', sql.VarChar(20), entry.waiting_id)
    .query('DELETE FROM Waiting WHERE waiting_id = @id');

  res.json({
    message:    'User promoted from waitlist',
    hold_id,
    user_id:    entry.user_id,
    username:   entry.username,
    expires_at: new Date(expires).toISOString(),
    note:       'User has 15 minutes to complete booking. Use hold_id to verify during booking.'
  });
}));

/**
 * GET /api/waiting/holds
 * Returns all active timed holds (admin only).
 */
router.get('/waiting/holds', authenticate, requireRole('admin'), wrap(async (req, res) => {
  const pool = await poolPromise;
  const rows = await getActiveHolds(pool);
  res.json(rows.map(r => ({ hold_id: r.hold_id, user_id: r.user_id, event_id: r.event_id, section_id: r.section_id, seat_id: r.seat_id, expires_at: r.expires_at })));
}));

// Internal helper: auto-promote first waitlist user after a cancellation
async function _promoteFromWaitlist(event_id, seat_id, pool) {
  // Find section for this seat
  const sR = await pool.request()
    .input('seat_id', sql.VarChar(20), seat_id)
    .query('SELECT section_id FROM Seats WHERE seat_id = @seat_id');
  if (!sR.recordset.length) return;
  const section_id = sR.recordset[0].section_id;

  const r = await pool.request()
    .input('event_id',   sql.VarChar(20), event_id)
    .input('section_id', sql.VarChar(20), section_id)
    .query(`SELECT TOP 1 waiting_id, user_id FROM Waiting
            WHERE event_id=@event_id AND section_id=@section_id
            ORDER BY created_at ASC`);
  if (!r.recordset.length) return;

  const entry   = r.recordset[0];
  const hold_id = genId('HOLD');
  const expiresAt = Date.now() + HOLD_TTL_MS;
  await createHold(pool, hold_id, entry.user_id, event_id, section_id, seat_id, expiresAt);

  await pool.request()
    .input('id', sql.VarChar(20), entry.waiting_id)
    .query('DELETE FROM Waiting WHERE waiting_id = @id');

  // Notify promoted user (dev: send email stub)
  try {
    const u = await pool.request().input('uid', sql.VarChar(20), entry.user_id).query('SELECT email, username FROM Users WHERE user_id=@uid');
    if (u.recordset[0]) {
      const to = u.recordset[0].email;
      const name = u.recordset[0].username || 'Customer';
      await sendMail({ to, subject: `You've been promoted from the waitlist`, text: `Hi ${name},\n\nYou've been promoted for event ${event_id}. You have 15 minutes to complete booking using hold id ${hold_id}.` });
    }
  } catch (e) { console.warn('notify-promote failed', e.message||e); }
}

async function _promoteFromWaitlistSection(event_id, section_id, pool) {
  const r = await pool.request()
    .input('event_id', sql.VarChar(20), event_id)
    .input('section_id', sql.VarChar(20), section_id)
    .query(`SELECT TOP 1 waiting_id, user_id FROM Waiting
            WHERE event_id=@event_id AND section_id=@section_id
            ORDER BY created_at ASC`);
  if (!r.recordset.length) return;

  const entry = r.recordset[0];
  const hold_id = genId('HOLD');
  const expiresAt = Date.now() + HOLD_TTL_MS;
  await createHold(pool, hold_id, entry.user_id, event_id, section_id, null, expiresAt);

  await pool.request()
    .input('id', sql.VarChar(20), entry.waiting_id)
    .query('DELETE FROM Waiting WHERE waiting_id = @id');
}

// ─────────────────────────────────────────────
// 13. FEEDBACK
// ─────────────────────────────────────────────

/**
 * POST /api/feedback
 * User must have purchased a ticket to the event (enforced).
 */
router.post('/feedback', authenticate, wrap(async (req, res) => {
  let { feedback_id, user_id, event_id, rating, comment } = req.body;
  if (req.user.type !== 'admin') user_id = req.user.user_id;
  if (!feedback_id) feedback_id = genId('F');

  if (!rating || rating < 1 || rating > 5)
    return res.status(400).json({ error: 'rating must be between 1 and 5' });

  const pool = await poolPromise;

  // Verify user purchased a ticket to this event
  if (req.user.type !== 'admin') {
    const bought = await pool.request()
      .input('event_id', sql.VarChar(20), event_id)
      .input('user_id',  sql.VarChar(20), user_id)
      .query(`SELECT TOP 1 ticket_id FROM Tickets
              WHERE event_id=@event_id AND purchased_by=@user_id`);
    if (!bought.recordset.length)
      return res.status(403).json({ error: 'You must have purchased a ticket to leave feedback' });
  }

  // Prevent duplicate feedback
  const dup = await pool.request()
    .input('event_id', sql.VarChar(20), event_id)
    .input('user_id',  sql.VarChar(20), user_id)
    .query('SELECT feedback_id FROM Feedback WHERE event_id=@event_id AND user_id=@user_id');
  if (dup.recordset.length)
    return res.status(409).json({ error: 'You have already submitted feedback for this event' });

  await pool.request()
    .input('feedback_id', sql.VarChar(20),   feedback_id)
    .input('user_id',     sql.VarChar(20),   user_id)
    .input('event_id',    sql.VarChar(20),   event_id)
    .input('rating',      sql.Int,           rating)
    .input('comment',     sql.VarChar(2000), comment || null)
    .query('INSERT INTO Feedback (feedback_id,user_id,event_id,rating,comment) VALUES (@feedback_id,@user_id,@event_id,@rating,@comment)');

  res.status(201).json({ message: 'Feedback submitted', feedback_id });
}));

router.delete('/feedback/:id', authenticate, requireRole('admin'), wrap(async (req, res) => {
  const pool = await poolPromise;
  await pool.request()
    .input('id', sql.VarChar(20), req.params.id)
    .query('DELETE FROM Feedback WHERE feedback_id = @id');
  res.json({ message: 'Feedback deleted' });
}));

// ─────────────────────────────────────────────
// 14. ADMIN / ORGANIZER TOOLS
// ─────────────────────────────────────────────

/** GET /api/admin/events  – all events with full detail + ticket counts (admin) */
router.get('/admin/events', authenticate, requireRole('admin'), wrap(async (req, res) => {
  const pool = await poolPromise;
  const r = await pool.request().query(`
    SELECT e.event_id, e.event_name, e.event_date, e.ticket_price, e.type,
           v.venue_name, u.username AS organizer_name,
           ISNULL(SUM(CASE WHEN t.purchased_by IS NOT NULL THEN 1 ELSE 0 END),0) AS tickets_sold,
           ISNULL(SUM(CASE WHEN t.purchased_by IS NOT NULL THEN t2.amount ELSE 0 END),0) AS revenue
    FROM Events e
    LEFT JOIN Venues  v  ON e.venue_id     = v.venue_id
    LEFT JOIN Users   u  ON e.organizer_id = u.user_id
    LEFT JOIN Tickets t  ON e.event_id     = t.event_id
    LEFT JOIN Payments t2 ON t.ticket_id   = t2.ticket_id
    GROUP BY e.event_id, e.event_name, e.event_date, e.ticket_price, e.type,
             v.venue_name, u.username
    ORDER BY e.event_date DESC
  `);
  res.json(r.recordset);
}));

/** POST /api/admin/seats/:id/block  – block a seat (admin) */
router.post('/admin/seats/:id/block', authenticate, requireRole('admin'), wrap(async (req, res) => {
  const pool = await poolPromise;
  await pool.request()
    .input('id', sql.VarChar(20), req.params.id)
    .query('UPDATE Seats SET blocked=1 WHERE seat_id=@id');
  try { if (io) io.emit('seat-updated', { seat_id: req.params.id, status: 'blocked' }); } catch (e) {}
  res.json({ message: 'Seat blocked' });
}));

/** POST /api/admin/seats/:id/unblock  – unblock a seat (admin) */
router.post('/admin/seats/:id/unblock', authenticate, requireRole('admin'), wrap(async (req, res) => {
  const pool = await poolPromise;
  await pool.request()
    .input('id', sql.VarChar(20), req.params.id)
    .query('UPDATE Seats SET blocked=0 WHERE seat_id=@id');
  try { if (io) io.emit('seat-updated', { seat_id: req.params.id, status: 'unblocked' }); } catch (e) {}
  res.json({ message: 'Seat unblocked' });
}));

/**
 * POST /api/admin/tickets/:id/override-booking  (admin)
 * Forcefully assign a ticket to a user (override any existing assignment).
 */
router.post('/admin/tickets/:id/override-booking', authenticate, requireRole('admin'), wrap(async (req, res) => {
  const { user_id, payment_id, method, amount } = req.body;
  if (!user_id) return res.status(400).json({ error: 'user_id is required' });

  const pool = await poolPromise;
  const transaction = new sql.Transaction(pool);

  try {
    await transaction.begin();

    // Remove any existing payment for this ticket
    await transaction.request()
      .input('ticket_id', sql.VarChar(20), req.params.id)
      .query('DELETE FROM Payments WHERE ticket_id = @ticket_id');

    // Assign ticket
    await transaction.request()
      .input('id',          sql.VarChar(20), req.params.id)
      .input('purchased_by',sql.VarChar(20), user_id)
      .query("UPDATE Tickets SET reserved='N', purchased_by=@purchased_by WHERE ticket_id=@id");

    // If payment info provided, create new payment record
    if (payment_id && method && amount !== undefined) {
      await transaction.request()
        .input('payment_id', sql.VarChar(20), payment_id || genId('P'))
        .input('user_id',    sql.VarChar(20), user_id)
        .input('ticket_id',  sql.VarChar(20), req.params.id)
        .input('method',     sql.VarChar(50), method)
        .input('amount',     sql.Float,       Number(amount))
        .query('INSERT INTO Payments (payment_id,user_id,ticket_id,method,amount) VALUES (@payment_id,@user_id,@ticket_id,@method,@amount)');
    }

    await transaction.commit();
    try { if (io) io.emit('seat-updated', { ticket_id: req.params.id, status: 'purchased', purchased_by: user_id }); } catch (e) {}
    res.json({ message: 'Ticket booking overridden', ticket_id: req.params.id, assigned_to: user_id });
  } catch (err) {
    try { await transaction.rollback(); } catch {}
    res.status(500).json({ error: err.message });
  }
}));

/**
 * POST /api/admin/tickets/:id/release  (admin)
 * Forcefully release a ticket (cancel without user action).
 */
router.post('/admin/tickets/:id/release', authenticate, requireRole('admin'), wrap(async (req, res) => {
  const pool = await poolPromise;
  const transaction = new sql.Transaction(pool);
  try {
    await transaction.begin();
    await transaction.request()
      .input('id', sql.VarChar(20), req.params.id)
      .query('DELETE FROM Payments WHERE ticket_id=@id');
    await transaction.request()
      .input('id', sql.VarChar(20), req.params.id)
      .query("UPDATE Tickets SET reserved='N', purchased_by=NULL WHERE ticket_id=@id");
    await transaction.commit();

    // Get ticket info for waitlist promotion
    const tR = await pool.request()
      .input('id', sql.VarChar(20), req.params.id)
      .query('SELECT event_id, seat_id FROM Tickets WHERE ticket_id=@id');
    if (tR.recordset.length) {
      const { event_id, seat_id } = tR.recordset[0];
      _promoteFromWaitlist(event_id, seat_id, pool).catch(() => {});
    }
    try { if (io) io.emit('seat-updated', { ticket_id: req.params.id, status: 'released' }); } catch (e) {}
    res.json({ message: 'Ticket forcefully released' });
  } catch (err) {
    try { await transaction.rollback(); } catch {}
    res.status(500).json({ error: err.message });
  }
}));

/** GET /api/organizers/:id/events  – events for an organizer */
router.get('/organizers/:id/events', authenticate, wrap(async (req, res) => {
  const isSelf  = req.user.user_id === req.params.id;
  const isAdmin = req.user.type === 'admin';
  if (!isSelf && !isAdmin) return res.status(403).json({ error: 'Access denied' });

  const pool = await poolPromise;
  const r = await pool.request()
    .input('organizer_id', sql.VarChar(20), req.params.id)
    .query(`SELECT e.event_id, e.event_name, e.event_date, v.venue_name,
                   ISNULL(COUNT(t.ticket_id),0) AS tickets_sold
            FROM Events e
            LEFT JOIN Venues  v ON e.venue_id  = v.venue_id
            LEFT JOIN Tickets t ON e.event_id  = t.event_id AND t.purchased_by IS NOT NULL
            WHERE e.organizer_id = @organizer_id
            GROUP BY e.event_id, e.event_name, e.event_date, v.venue_name
            ORDER BY e.event_date DESC`);
  res.json(r.recordset);
}));

// ─────────────────────────────────────────────
// 15. REPORTS / ANALYTICS
// ─────────────────────────────────────────────

/** GET /api/reports/top-events  – top 5 by tickets sold */
router.get('/reports/top-events', wrap(async (req, res) => {
  const pool = await poolPromise;
  const r = await pool.request().query(`
    SELECT TOP 5 e.event_id, e.event_name, COUNT(t.ticket_id) AS tickets_sold
    FROM Events e
    LEFT JOIN Tickets t ON e.event_id = t.event_id AND t.purchased_by IS NOT NULL
    GROUP BY e.event_id, e.event_name
    ORDER BY tickets_sold DESC
  `);
  res.json(r.recordset);
}));

/** GET /api/reports/top-revenue  – top 5 by revenue */
router.get('/reports/top-revenue', wrap(async (req, res) => {
  const pool = await poolPromise;
  const r = await pool.request().query(`
    SELECT TOP 5 e.event_id, e.event_name, ISNULL(SUM(p.amount),0) AS revenue
    FROM Events e
    LEFT JOIN Tickets  t ON e.event_id  = t.event_id
    LEFT JOIN Payments p ON t.ticket_id = p.ticket_id
    GROUP BY e.event_id, e.event_name
    ORDER BY revenue DESC
  `);
  res.json(r.recordset);
}));

/** GET /api/reports/upcoming-events */
router.get('/reports/upcoming-events', wrap(async (req, res) => {
  const pool = await poolPromise;
  const r = await pool.request().query(`
    SELECT e.event_id, e.event_name, e.event_date, v.venue_name
    FROM Events e
    JOIN Venues v ON e.venue_id = v.venue_id
    WHERE e.event_date >= CAST(GETDATE() AS date)
    ORDER BY e.event_date ASC
  `);
  res.json(r.recordset);
}));

/** GET /api/reports/popular-venues  – top 5 venues by tickets sold */
router.get('/reports/popular-venues', wrap(async (req, res) => {
  const pool = await poolPromise;
  const r = await pool.request().query(`
    SELECT TOP 5 v.venue_id, v.venue_name, COUNT(t.ticket_id) AS tickets_sold
    FROM Venues v
    JOIN Events  e ON e.venue_id  = v.venue_id
    LEFT JOIN Tickets t ON t.event_id = e.event_id AND t.purchased_by IS NOT NULL
    GROUP BY v.venue_id, v.venue_name
    ORDER BY tickets_sold DESC
  `);
  res.json(r.recordset);
}));

/** GET /api/reports/event-ratings  – avg rating for all events */
router.get('/reports/event-ratings', wrap(async (req, res) => {
  const pool = await poolPromise;
  const r = await pool.request().query(`
    SELECT e.event_id, e.event_name,
           ISNULL(AVG(CAST(f.rating AS FLOAT)),0) AS avg_rating,
           COUNT(f.feedback_id) AS reviews
    FROM Events e
    LEFT JOIN Feedback f ON e.event_id = f.event_id
    GROUP BY e.event_id, e.event_name
  `);
  res.json(r.recordset);
}));

/** GET /api/reports/event-details  – all events summary */
router.get('/reports/event-details', wrap(async (req, res) => {
  const pool = await poolPromise;
  const r = await pool.request().query(`
    SELECT e.event_id, e.event_name, e.event_date, e.ticket_price, e.type, v.venue_name,
           ISNULL(SUM(CASE WHEN t.purchased_by IS NOT NULL THEN 1 ELSE 0 END),0) AS tickets_sold
    FROM Events e
    LEFT JOIN Venues  v ON e.venue_id = v.venue_id
    LEFT JOIN Tickets t ON e.event_id = t.event_id
    GROUP BY e.event_id, e.event_name, e.event_date, e.ticket_price, e.type, v.venue_name
  `);
  res.json(r.recordset);
}));

/** GET /api/reports/section-summary  – seats per section per event */
router.get('/reports/section-summary', wrap(async (req, res) => {
  const pool = await poolPromise;
  const r = await pool.request().query(`
    SELECT sec.section_id, sec.section_name, e.event_id,
           sec.capacity,
           ISNULL(SUM(CASE WHEN t.purchased_by IS NOT NULL THEN 1 ELSE 0 END),0) AS purchased_count,
           (sec.capacity - ISNULL(SUM(CASE WHEN t.purchased_by IS NOT NULL THEN 1 ELSE 0 END),0)) AS remaining
    FROM Sections sec
    JOIN Events e ON e.venue_id = sec.venue_id
    LEFT JOIN Seats   s ON s.section_id = sec.section_id
    LEFT JOIN Tickets t ON t.seat_id    = s.seat_id AND t.event_id = e.event_id
    GROUP BY sec.section_id, sec.section_name, sec.capacity, e.event_id
  `);
  res.json(r.recordset);
}));

// ─────────────────────────────────────────────
// 16. DEBUG / UTILITY  (development only)
// ─────────────────────────────────────────────

router.get('/_routes', (req, res) => {
  const routes = [];
  router.stack.forEach(layer => {
    if (layer.route?.path)
      routes.push({ path: layer.route.path, methods: Object.keys(layer.route.methods) });
  });
  res.json(routes);
});

router.get('/users/by-email-debug', authenticate, requireRole('admin'), wrap(async (req, res) => {
  const email = req.query.email;
  if (!email) return res.status(400).json({ error: 'email required' });
  const pool = await poolPromise;
  const exact = await pool.request()
    .input('email', sql.VarChar(100), email)
    .query("SELECT user_id, username, email, type FROM Users WHERE LOWER(LTRIM(RTRIM(email))) = LOWER(LTRIM(RTRIM(@email)))");
  res.json({ received: email, matches: exact.recordset });
}));

// POST /api/users/by-email
// Accepts JSON body: { "email": "user@example.com" }
router.post('/users/by-email', authenticate, requireRole('admin'), wrap(async (req, res) => {
  const email = req.body && req.body.email;
  if (!email) return res.status(400).json({ error: 'email required in JSON body' });
  const pool = await poolPromise;
  const r = await pool.request()
    .input('email', sql.VarChar(100), email)
    .query('SELECT user_id, username, email, type FROM Users WHERE LOWER(LTRIM(RTRIM(email))) = LOWER(LTRIM(RTRIM(@email)))');
  res.json(r.recordset[0] || null);
}));

if (!holdWorkerStarted) {
  holdWorkerStarted = true;
  setInterval(async () => {
    try {
      const pool = await poolPromise;
      const expired = await pool.request()
        .query('SELECT hold_id, user_id, event_id, section_id, seat_id FROM WaitlistHolds WHERE expires_at <= GETDATE()');
      for (const e of expired.recordset) {
        try {
          await pool.request().input('hid', sql.VarChar(20), e.hold_id).query('DELETE FROM WaitlistHolds WHERE hold_id=@hid');
          if (e.seat_id) {
            await _promoteFromWaitlist(e.event_id, e.seat_id, pool);
          } else if (e.section_id) {
            await _promoteFromWaitlistSection(e.event_id, e.section_id, pool);
          }
          try {
            await sendMail({
              to: (await pool.request().input('uid', sql.VarChar(20), e.user_id).query('SELECT email FROM Users WHERE user_id=@uid')).recordset[0]?.email,
              subject: 'Your hold expired',
              text: 'Your hold has expired.'
            });
          } catch (er) {}
        } catch (er) { console.warn('hold-expire error', er.message || er); }
      }
    } catch (err) { /* no-op */ }
  }, 30 * 1000);
}

  return router;
};