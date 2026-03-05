const express = require('express');
const router = express.Router();
const { poolPromise, sql } = require('./db');

// Debug: list registered routes (useful to confirm endpoints are mounted)
router.get('/_routes', (req, res) => {
  try {
    const routes = [];
    router.stack.forEach((layer) => {
      if (layer.route && layer.route.path) {
        routes.push({ path: layer.route.path, methods: Object.keys(layer.route.methods) });
      }
    });
    res.json(routes);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// --- Users CRUD ---
router.get('/users', async (req, res) => {
  try {
    const pool = await poolPromise;
    const result = await pool.request().query('SELECT user_id, username, email, type FROM Users');
    res.json(result.recordset);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// --- User search endpoints (validated columns only)
const USER_SEARCH_COLUMNS = ['user_id','username','email','type'];

// Generic search: /api/users/search?column=<col>&value=<val>
router.get('/users/search', async (req, res) => {
  try {
    const column = req.query.column;
    const value = req.query.value;
    if (!column || !value) return res.status(400).json({ error: 'column and value query parameters required' });
    if (!USER_SEARCH_COLUMNS.includes(column)) return res.status(400).json({ error: 'invalid column' });
    const pool = await poolPromise;
    const q = `SELECT user_id, username, email, type FROM Users WHERE ${column} = @value`;
    const r = await pool.request().input('value', sql.VarChar(200), value).query(q);
    res.json(r.recordset);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Convenience route: /api/users/by-<column>?<column>=<value>
router.get('/users/by-:column', async (req, res) => {
  try {
    const column = req.params.column;
    const value = req.query[column];
    if (!value) return res.status(400).json({ error: `${column} query parameter required` });
    if (!USER_SEARCH_COLUMNS.includes(column)) return res.status(400).json({ error: 'invalid column' });
    const pool = await poolPromise;
    const q = `SELECT user_id, username, email, type FROM Users WHERE ${column} = @value`;
    const r = await pool.request().input('value', sql.VarChar(200), value).query(q);
    res.json(r.recordset);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/users/:id', async (req, res) => {
  try {
    const pool = await poolPromise;
    const result = await pool.request().input('id', sql.VarChar(20), req.params.id)
      .query('SELECT user_id, username, email, type FROM Users WHERE user_id = @id');
    res.json(result.recordset[0] || null);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/users', async (req, res) => {
  const { user_id, username, email, password, type } = req.body;
  try {
    const pool = await poolPromise;
    await pool.request()
      .input('user_id', sql.VarChar(20), user_id)
      .input('username', sql.VarChar(50), username)
      .input('email', sql.VarChar(100), email)
      .input('password', sql.VarChar(255), password)
      .input('type', sql.VarChar(10), type)
      .query('INSERT INTO Users (user_id, username, email, password, type) VALUES (@user_id,@username,@email,@password,@type)');
    res.status(201).json({ message: 'User created' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/users/:id', async (req, res) => {
  const { username, email, password, type } = req.body;
  try {
    const pool = await poolPromise;
    await pool.request()
      .input('id', sql.VarChar(20), req.params.id)
      .input('username', sql.VarChar(50), username)
      .input('email', sql.VarChar(100), email)
      .input('password', sql.VarChar(255), password)
      .input('type', sql.VarChar(10), type)
      .query('UPDATE Users SET username=@username, email=@email, password=@password, type=@type WHERE user_id=@id');
    res.json({ message: 'User updated' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/users/:id', async (req, res) => {
  try {
    const pool = await poolPromise;
    await pool.request().input('id', sql.VarChar(20), req.params.id).query('DELETE FROM Users WHERE user_id = @id');
    res.json({ message: 'User deleted' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// --- Events CRUD (basic) ---
router.get('/events', async (req, res) => {
  try {
    const pool = await poolPromise;
    const result = await pool.request().query('SELECT * FROM Events');
    res.json(result.recordset);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/events/:id', async (req, res) => {
  try {
    const pool = await poolPromise;
    const r = await pool.request().input('id', sql.VarChar(20), req.params.id).query('SELECT * FROM Events WHERE event_id = @id');
    res.json(r.recordset[0] || null);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/events', async (req, res) => {
  const { event_id, event_name, event_description, event_date, venue_id, organizer_id, ticket_price, type } = req.body;
  try {
    const pool = await poolPromise;
    await pool.request()
      .input('event_id', sql.VarChar(20), event_id)
      .input('event_name', sql.VarChar(200), event_name)
      .input('event_description', sql.VarChar(2000), event_description)
      .input('event_date', sql.Date, event_date)
      .input('venue_id', sql.VarChar(20), venue_id)
      .input('organizer_id', sql.VarChar(20), organizer_id)
      .input('ticket_price', sql.Float, ticket_price)
      .input('type', sql.VarChar(50), type)
      .query('INSERT INTO Events (event_id,event_name,event_description,event_date,venue_id,organizer_id,ticket_price,type) VALUES (@event_id,@event_name,@event_description,@event_date,@venue_id,@organizer_id,@ticket_price,@type)');
    res.status(201).json({ message: 'Event created' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/events/:id', async (req, res) => {
  const { event_name, event_description, event_date, venue_id, ticket_price, type } = req.body;
  try {
    const pool = await poolPromise;
    await pool.request()
      .input('id', sql.VarChar(20), req.params.id)
      .input('event_name', sql.VarChar(200), event_name)
      .input('event_description', sql.VarChar(2000), event_description)
      .input('event_date', sql.Date, event_date)
      .input('venue_id', sql.VarChar(20), venue_id)
      .input('ticket_price', sql.Float, ticket_price)
      .input('type', sql.VarChar(50), type)
      .query('UPDATE Events SET event_name=@event_name, event_description=@event_description, event_date=@event_date, venue_id=@venue_id, ticket_price=@ticket_price, type=@type WHERE event_id=@id');
    res.json({ message: 'Event updated' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/events/:id', async (req, res) => {
  try {
    const pool = await poolPromise;
    await pool.request().input('id', sql.VarChar(20), req.params.id).query('DELETE FROM Events WHERE event_id=@id');
    res.json({ message: 'Event deleted' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// --- Venues CRUD ---
router.get('/venues', async (req, res) => {
  try {
    const pool = await poolPromise;
    const r = await pool.request().query('SELECT * FROM Venues');
    res.json(r.recordset);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/venues/:id', async (req, res) => {
  try {
    const pool = await poolPromise;
    const r = await pool.request().input('id', sql.VarChar(20), req.params.id).query('SELECT * FROM Venues WHERE venue_id = @id');
    res.json(r.recordset[0] || null);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/venues', async (req, res) => {
  const { venue_id, venue_name, venue_description } = req.body;
  try {
    const pool = await poolPromise;
    await pool.request()
      .input('venue_id', sql.VarChar(20), venue_id)
      .input('venue_name', sql.VarChar(100), venue_name)
      .input('venue_description', sql.VarChar(1000), venue_description)
      .query('INSERT INTO Venues (venue_id,venue_name,venue_description) VALUES (@venue_id,@venue_name,@venue_description)');
    res.status(201).json({ message: 'Venue created' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/venues/:id', async (req, res) => {
  const { venue_name, venue_description } = req.body;
  try {
    const pool = await poolPromise;
    await pool.request()
      .input('id', sql.VarChar(20), req.params.id)
      .input('venue_name', sql.VarChar(100), venue_name)
      .input('venue_description', sql.VarChar(1000), venue_description)
      .query('UPDATE Venues SET venue_name=@venue_name, venue_description=@venue_description WHERE venue_id=@id');
    res.json({ message: 'Venue updated' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/venues/:id', async (req, res) => {
  try {
    const pool = await poolPromise;
    await pool.request().input('id', sql.VarChar(20), req.params.id).query('DELETE FROM Venues WHERE venue_id = @id');
    res.json({ message: 'Venue deleted' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// --- Report endpoints (use internal queries) ---
router.get('/reports/top-events', async (req, res) => {
  try {
    const pool = await poolPromise;
    const q = `SELECT TOP 5 e.event_id, e.event_name, COUNT(t.ticket_id) AS tickets_sold
           FROM Events e
           LEFT JOIN Tickets t ON e.event_id = t.event_id AND t.purchased_by IS NOT NULL
           GROUP BY e.event_id, e.event_name
           ORDER BY tickets_sold DESC`;
    const r = await pool.request().query(q);
    res.json(r.recordset);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/reports/top-revenue', async (req, res) => {
  try {
    const pool = await poolPromise;
    const q = `SELECT TOP 5 e.event_id, e.event_name, ISNULL(SUM(p.amount),0) AS revenue
               FROM Events e
               LEFT JOIN Tickets t ON e.event_id = t.event_id
               LEFT JOIN Payments p ON t.ticket_id = p.ticket_id
               GROUP BY e.event_id, e.event_name
               ORDER BY revenue DESC`;
    const r = await pool.request().query(q);
    res.json(r.recordset);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/reports/upcoming-events', async (req, res) => {
  try {
    const pool = await poolPromise;
    const q = `SELECT e.event_id, e.event_name, e.event_date, v.venue_name
               FROM Events e
               JOIN Venues v ON e.venue_id = v.venue_id
               WHERE e.event_date >= CAST(GETDATE() AS date)
               ORDER BY e.event_date ASC`;
    const r = await pool.request().query(q);
    res.json(r.recordset);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/events/:id/available-seats', async (req, res) => {
  try {
    const pool = await poolPromise;
    const eventId = req.params.id;
    const q = `SELECT s.seat_id, s.seat_num, s.section_id FROM Seats s WHERE s.seat_id NOT IN (SELECT t.seat_id FROM Tickets t WHERE t.event_id = @event_id AND t.purchased_by IS NOT NULL)`;
    const r = await pool.request().input('event_id', sql.VarChar(20), eventId).query(q);
    res.json(r.recordset);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/events/:id/seats-remaining', async (req, res) => {
  try {
    const pool = await poolPromise;
    const eventId = req.params.id;
    const q = `SELECT sec.section_id, sec.section_name, sec.capacity,
                      (sec.capacity - ISNULL(reserved_count,0)) AS seats_remaining
               FROM Sections sec
               LEFT JOIN (
                 SELECT ss.section_id, COUNT(t.ticket_id) AS reserved_count
                 FROM Seats ss
                 JOIN Tickets t ON ss.seat_id = t.seat_id AND t.event_id = @event_id AND t.purchased_by IS NOT NULL
                 GROUP BY ss.section_id
               ) r ON sec.section_id = r.section_id
               WHERE sec.venue_id = (SELECT venue_id FROM Events WHERE event_id = @event_id)`;
    const r = await pool.request().input('event_id', sql.VarChar(20), eventId).query(q);
    res.json(r.recordset);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/events/:id/feedback', async (req, res) => {
  try {
    const pool = await poolPromise;
    const r = await pool.request().input('event_id', sql.VarChar(20), req.params.id)
      .query('SELECT f.feedback_id, f.user_id, u.username, f.rating, f.comment, f.created_at FROM Feedback f JOIN Users u ON f.user_id = u.user_id WHERE f.event_id = @event_id ORDER BY f.created_at DESC');
    res.json(r.recordset);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/reports/popular-venues', async (req, res) => {
  try {
    const pool = await poolPromise;
    const q = `SELECT TOP 5 v.venue_id, v.venue_name, COUNT(t.ticket_id) AS tickets_sold
           FROM Venues v
           JOIN Events e ON e.venue_id = v.venue_id
           LEFT JOIN Tickets t ON t.event_id = e.event_id AND t.purchased_by IS NOT NULL
           GROUP BY v.venue_id, v.venue_name
           ORDER BY tickets_sold DESC`;
    const r = await pool.request().query(q);
    res.json(r.recordset);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Organizer events (from vw_OrganizerEvents view)
router.get('/organizers/:id/events', async (req, res) => {
  try {
    const pool = await poolPromise;
    const r = await pool.request().input('organizer_id', sql.VarChar(20), req.params.id)
      .query('SELECT * FROM vw_OrganizerEvents WHERE organizer_id = @organizer_id');
    res.json(r.recordset);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Event ratings and details views
router.get('/reports/event-ratings', async (req, res) => {
  try {
    const pool = await poolPromise;
    const q = `SELECT e.event_id, e.event_name, ISNULL(AVG(f.rating),0) AS avg_rating, COUNT(f.feedback_id) AS reviews
               FROM Events e
               LEFT JOIN Feedback f ON e.event_id = f.event_id
               GROUP BY e.event_id, e.event_name`;
    const r = await pool.request().query(q);
    res.json(r.recordset);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/reports/event-details', async (req, res) => {
  try {
    const pool = await poolPromise;
    const q = `SELECT e.event_id, e.event_name, e.event_date, e.ticket_price, e.type, v.venue_name,
                      ISNULL(SUM(CASE WHEN t.purchased_by IS NOT NULL THEN 1 ELSE 0 END),0) AS tickets_sold
               FROM Events e
               LEFT JOIN Venues v ON e.venue_id = v.venue_id
               LEFT JOIN Tickets t ON e.event_id = t.event_id
               GROUP BY e.event_id, e.event_name, e.event_date, e.ticket_price, e.type, v.venue_name`;
    const r = await pool.request().query(q);
    res.json(r.recordset);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// --- Additional query endpoints mapped from queries.sql
// User purchase history (payments) - matches queries.sql #4
router.get('/users/:id/purchases', async (req, res) => {
  try {
    const pool = await poolPromise;
    const r = await pool.request().input('user_id', sql.VarChar(20), req.params.id)
      .query(`SELECT p.payment_id, p.amount, p.paid_at, e.event_id, e.event_name, t.ticket_id, t.seat_id
              FROM Payments p
              JOIN Tickets t ON p.ticket_id = t.ticket_id
              JOIN Events e ON t.event_id = e.event_id
              WHERE p.user_id = @user_id
              ORDER BY p.paid_at DESC`);
    res.json(r.recordset);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Event ratings for a single event (from vw_EventRatings)
router.get('/events/:id/ratings', async (req, res) => {
  try {
    const pool = await poolPromise;
    const q = `SELECT e.event_id, e.event_name, ISNULL(AVG(f.rating),0) AS avg_rating, COUNT(f.feedback_id) AS reviews
               FROM Events e
               LEFT JOIN Feedback f ON e.event_id = f.event_id
               WHERE e.event_id = @event_id
               GROUP BY e.event_id, e.event_name`;
    const r = await pool.request().input('event_id', sql.VarChar(20), req.params.id).query(q);
    res.json(r.recordset[0] || null);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Event details for a single event (from vw_EventDetails)
router.get('/events/:id/details', async (req, res) => {
  try {
    const pool = await poolPromise;
    const q = `SELECT e.event_id, e.event_name, e.event_date, e.ticket_price, e.type, v.venue_name,
                      ISNULL(SUM(CASE WHEN t.purchased_by IS NOT NULL THEN 1 ELSE 0 END),0) AS tickets_sold
               FROM Events e
               LEFT JOIN Venues v ON e.venue_id = v.venue_id
               LEFT JOIN Tickets t ON e.event_id = t.event_id
               WHERE e.event_id = @event_id
               GROUP BY e.event_id, e.event_name, e.event_date, e.ticket_price, e.type, v.venue_name`;
    const r = await pool.request().input('event_id', sql.VarChar(20), req.params.id).query(q);
    res.json(r.recordset[0] || null);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Get user by email (helper for login flows) - returns non-sensitive fields
router.get('/users/by-email', async (req, res) => {
  try {
    const email = req.query.email;
    if (!email) return res.status(400).json({ error: 'email query parameter required' });
    const pool = await poolPromise;
    const r = await pool.request().input('email', sql.VarChar(100), email)
      .query('SELECT user_id, username, email, type FROM Users WHERE email = @email');
    res.json(r.recordset[0] || null);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Debug endpoint: detailed email match info (no sensitive fields)
router.get('/users/by-email-debug', async (req, res) => {
  try {
    const email = req.query.email;
    if (!email) return res.status(400).json({ error: 'email query parameter required' });
    const pool = await poolPromise;
    const exact = await pool.request().input('email', sql.VarChar(100), email)
      .query("SELECT user_id, username, email, type FROM Users WHERE LOWER(LTRIM(RTRIM(email))) = LOWER(LTRIM(RTRIM(@email)))");
    const like = await pool.request().input('email', sql.VarChar(100), `%${email}%`)
      .query("SELECT user_id, username, email, type FROM Users WHERE email LIKE @email");
    res.json({ received: email, exactMatches: exact.recordset, likeMatches: like.recordset });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// User profile view
router.get('/profile/:id', async (req, res) => {
  try {
    const pool = await poolPromise;
    const r = await pool.request().input('id', sql.VarChar(20), req.params.id).query('SELECT * FROM vw_UserProfile WHERE user_id = @id');
    res.json(r.recordset[0] || null);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Section summary view
router.get('/reports/section-summary', async (req, res) => {
  try {
    const pool = await poolPromise;
    const r = await pool.request().query('SELECT * FROM vw_SectionSummary');
    res.json(r.recordset);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// --- Sections CRUD ---
router.get('/sections', async (req, res) => {
  try {
    const pool = await poolPromise;
    const r = await pool.request().query('SELECT * FROM Sections');
    res.json(r.recordset);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/sections/:id', async (req, res) => {
  try {
    const pool = await poolPromise;
    const r = await pool.request().input('id', sql.VarChar(20), req.params.id).query('SELECT * FROM Sections WHERE section_id = @id');
    res.json(r.recordset[0] || null);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/sections', async (req, res) => {
  const { section_id, section_name, section_description, venue_id, capacity, factor } = req.body;
  try {
    const pool = await poolPromise;
    await pool.request()
      .input('section_id', sql.VarChar(20), section_id)
      .input('section_name', sql.VarChar(100), section_name)
      .input('section_description', sql.VarChar(1000), section_description)
      .input('venue_id', sql.VarChar(20), venue_id)
      .input('capacity', sql.Int, capacity)
      .input('factor', sql.Float, factor)
      .query('INSERT INTO Sections (section_id,section_name,section_description,venue_id,capacity,factor) VALUES (@section_id,@section_name,@section_description,@venue_id,@capacity,@factor)');
    res.status(201).json({ message: 'Section created' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/sections/:id', async (req, res) => {
  const { section_name, section_description, venue_id, capacity, factor } = req.body;
  try {
    const pool = await poolPromise;
    await pool.request()
      .input('id', sql.VarChar(20), req.params.id)
      .input('section_name', sql.VarChar(100), section_name)
      .input('section_description', sql.VarChar(1000), section_description)
      .input('venue_id', sql.VarChar(20), venue_id)
      .input('capacity', sql.Int, capacity)
      .input('factor', sql.Float, factor)
      .query('UPDATE Sections SET section_name=@section_name, section_description=@section_description, venue_id=@venue_id, capacity=@capacity, factor=@factor WHERE section_id=@id');
    res.json({ message: 'Section updated' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/sections/:id', async (req, res) => {
  try {
    const pool = await poolPromise;
    await pool.request().input('id', sql.VarChar(20), req.params.id).query('DELETE FROM Sections WHERE section_id = @id');
    res.json({ message: 'Section deleted' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// --- Seats CRUD ---
router.get('/seats', async (req, res) => {
  try {
    const pool = await poolPromise;
    const r = await pool.request().query('SELECT * FROM Seats');
    res.json(r.recordset);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/seats/:id', async (req, res) => {
  try {
    const pool = await poolPromise;
    const r = await pool.request().input('id', sql.VarChar(20), req.params.id).query('SELECT * FROM Seats WHERE seat_id = @id');
    res.json(r.recordset[0] || null);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/seats', async (req, res) => {
  const { seat_id, x_coord, y_coord, section_id, seat_num } = req.body;
  try {
    const pool = await poolPromise;
    await pool.request()
      .input('seat_id', sql.VarChar(20), seat_id)
      .input('x_coord', sql.Int, x_coord)
      .input('y_coord', sql.Int, y_coord)
      .input('section_id', sql.VarChar(20), section_id)
      .input('seat_num', sql.Int, seat_num)
      .query('INSERT INTO Seats (seat_id,x_coord,y_coord,section_id,seat_num) VALUES (@seat_id,@x_coord,@y_coord,@section_id,@seat_num)');
    res.status(201).json({ message: 'Seat created' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/seats/:id', async (req, res) => {
  const { x_coord, y_coord, section_id, seat_num } = req.body;
  try {
    const pool = await poolPromise;
    await pool.request()
      .input('id', sql.VarChar(20), req.params.id)
      .input('x_coord', sql.Int, x_coord)
      .input('y_coord', sql.Int, y_coord)
      .input('section_id', sql.VarChar(20), section_id)
      .input('seat_num', sql.Int, seat_num)
      .query('UPDATE Seats SET x_coord=@x_coord, y_coord=@y_coord, section_id=@section_id, seat_num=@seat_num WHERE seat_id=@id');
    res.json({ message: 'Seat updated' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/seats/:id', async (req, res) => {
  try {
    const pool = await poolPromise;
    await pool.request().input('id', sql.VarChar(20), req.params.id).query('DELETE FROM Seats WHERE seat_id = @id');
    res.json({ message: 'Seat deleted' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// --- Tickets CRUD ---
router.get('/tickets', async (req, res) => {
  try {
    const pool = await poolPromise;
    const r = await pool.request().query('SELECT * FROM Tickets');
    res.json(r.recordset);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/tickets/:id', async (req, res) => {
  try {
    const pool = await poolPromise;
    const r = await pool.request().input('id', sql.VarChar(20), req.params.id).query('SELECT * FROM Tickets WHERE ticket_id = @id');
    res.json(r.recordset[0] || null);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Create/update a ticket: body should include ticket_id,event_id,seat_id,reserved,purchased_by
// Note: `reserved` is a VIP-only flag ('Y' = VIP-only seat). A ticket is considered sold when `purchased_by` is NOT NULL.
router.post('/tickets', async (req, res) => {
  const { ticket_id, event_id, seat_id, reserved, purchased_by } = req.body;
  // Validation: purchased tickets must not be marked reserved='Y' (VIP-only)
  if (purchased_by && reserved === 'Y') {
    return res.status(400).json({ error: "Cannot create a purchased ticket with reserved='Y' (VIP-only). Set reserved='N' for purchased tickets." });
  }
  try {
    const pool = await poolPromise;
    await pool.request()
      .input('ticket_id', sql.VarChar(20), ticket_id)
      .input('event_id', sql.VarChar(20), event_id)
      .input('seat_id', sql.VarChar(20), seat_id)
      .input('reserved', sql.Char(1), reserved)
      .input('purchased_by', sql.VarChar(20), purchased_by)
      .query('INSERT INTO Tickets (ticket_id,event_id,seat_id,reserved,purchased_by) VALUES (@ticket_id,@event_id,@seat_id,@reserved,@purchased_by)');
    res.status(201).json({ message: 'Ticket created' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/tickets/:id', async (req, res) => {
  const { reserved, purchased_by } = req.body;
  // Validation: purchased tickets must not be marked reserved='Y'
  if (purchased_by && reserved === 'Y') {
    return res.status(400).json({ error: "Cannot mark a purchased ticket as reserved='Y' (VIP-only). Use reserved='N'." });
  }
  try {
    const pool = await poolPromise;
    await pool.request()
      .input('id', sql.VarChar(20), req.params.id)
      .input('reserved', sql.Char(1), reserved)
      .input('purchased_by', sql.VarChar(20), purchased_by)
      .query('UPDATE Tickets SET reserved=@reserved, purchased_by=@purchased_by WHERE ticket_id=@id');
    res.json({ message: 'Ticket updated' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/tickets/:id', async (req, res) => {
  try {
    const pool = await poolPromise;
    await pool.request().input('id', sql.VarChar(20), req.params.id).query('DELETE FROM Tickets WHERE ticket_id = @id');
    res.json({ message: 'Ticket deleted' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// --- Transactional booking flow (reserve seat + record payment) ---
router.post('/book', async (req, res) => {
  const { ticket_id, event_id, seat_id, user_id, payment_id, method, amount } = req.body;
  const pool = await poolPromise;
  const transaction = new sql.Transaction(pool);
  try {
    await transaction.begin();

    // Check seat state for the event using a fresh request on the transaction
    // - If any ticket for this event/seat has purchased_by IS NOT NULL -> already purchased
    // - Else if any ticket row exists with reserved='Y' and purchased_by IS NULL -> VIP-only seat (not purchasable here)
    const seatCheckReq = transaction.request();
    const seatRows = await seatCheckReq.input('event_id', sql.VarChar(20), event_id)
      .input('seat_id', sql.VarChar(20), seat_id)
      .query("SELECT reserved, purchased_by FROM Tickets WHERE event_id = @event_id AND seat_id = @seat_id");
    if (seatRows.recordset.some(r => r.purchased_by !== null)) {
      await transaction.rollback();
      return res.status(409).json({ error: 'Seat already purchased for this event' });
    }
    if (seatRows.recordset.some(r => r.reserved === 'Y' && r.purchased_by == null)) {
      await transaction.rollback();
      return res.status(403).json({ error: 'Seat is VIP-only and cannot be purchased via this endpoint' });
    }

    // Insert ticket using a new request to avoid reusing parameter names
    const insertReq = transaction.request();
    await insertReq.input('ticket_id', sql.VarChar(20), ticket_id)
      .input('event_id', sql.VarChar(20), event_id)
      .input('seat_id', sql.VarChar(20), seat_id)
      .input('reserved', sql.Char(1), 'N')
      .input('purchased_by', sql.VarChar(20), user_id)
      .query('INSERT INTO Tickets (ticket_id,event_id,seat_id,reserved,purchased_by) VALUES (@ticket_id,@event_id,@seat_id,@reserved,@purchased_by)');

    // Insert payment using another fresh request
    const paymentReq = transaction.request();
    await paymentReq.input('payment_id', sql.VarChar(20), payment_id)
      .input('user_id', sql.VarChar(20), user_id)
      .input('ticket_id', sql.VarChar(20), ticket_id)
      .input('method', sql.VarChar(50), method)
      .input('amount', sql.Float, amount)
      .query('INSERT INTO Payments (payment_id,user_id,ticket_id,method,amount) VALUES (@payment_id,@user_id,@ticket_id,@method,@amount)');

    await transaction.commit();
    res.status(201).json({ message: 'Booking successful', ticket_id, payment_id });
  } catch (err) {
    try { await transaction.rollback(); } catch (e) {}
    res.status(500).json({ error: err.message });
  }
});

// --- Payments CRUD ---
router.get('/payments', async (req, res) => {
  try {
    const pool = await poolPromise;
    const r = await pool.request().query('SELECT * FROM Payments');
    res.json(r.recordset);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/payments/:id', async (req, res) => {
  try {
    const pool = await poolPromise;
    const r = await pool.request().input('id', sql.VarChar(20), req.params.id).query('SELECT * FROM Payments WHERE payment_id = @id');
    res.json(r.recordset[0] || null);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/payments', async (req, res) => {
  const { payment_id, user_id, ticket_id, method, amount } = req.body;
  try {
    const pool = await poolPromise;
    await pool.request()
      .input('payment_id', sql.VarChar(20), payment_id)
      .input('user_id', sql.VarChar(20), user_id)
      .input('ticket_id', sql.VarChar(20), ticket_id)
      .input('method', sql.VarChar(50), method)
      .input('amount', sql.Float, amount)
      .query('INSERT INTO Payments (payment_id,user_id,ticket_id,method,amount) VALUES (@payment_id,@user_id,@ticket_id,@method,@amount)');
    res.status(201).json({ message: 'Payment recorded' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/payments/:id', async (req, res) => {
  try {
    const pool = await poolPromise;
    await pool.request().input('id', sql.VarChar(20), req.params.id).query('DELETE FROM Payments WHERE payment_id = @id');
    res.json({ message: 'Payment deleted' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// --- SavedPayments CRUD ---
router.get('/saved-payments', async (req, res) => {
  try {
    const pool = await poolPromise;
    const r = await pool.request().query('SELECT * FROM SavedPayments');
    res.json(r.recordset);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/saved-payments', async (req, res) => {
  const { sp_id, user_id, acc_no, bank } = req.body;
  try {
    const pool = await poolPromise;
    await pool.request()
      .input('sp_id', sql.VarChar(20), sp_id)
      .input('user_id', sql.VarChar(20), user_id)
      .input('acc_no', sql.VarChar(100), acc_no)
      .input('bank', sql.VarChar(100), bank)
      .query('INSERT INTO SavedPayments (sp_id,user_id,acc_no,bank) VALUES (@sp_id,@user_id,@acc_no,@bank)');
    res.status(201).json({ message: 'Saved payment added' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/saved-payments/:id', async (req, res) => {
  try {
    const pool = await poolPromise;
    await pool.request().input('id', sql.VarChar(20), req.params.id).query('DELETE FROM SavedPayments WHERE sp_id = @id');
    res.json({ message: 'Saved payment deleted' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// --- Waiting list ---
router.get('/events/:id/waiting', async (req, res) => {
  try {
    const pool = await poolPromise;
    const r = await pool.request().input('event_id', sql.VarChar(20), req.params.id)
      .query('SELECT w.waiting_id, w.user_id, u.username, w.section_id, w.created_at FROM Waiting w JOIN Users u ON w.user_id = u.user_id WHERE w.event_id = @event_id ORDER BY w.created_at ASC');
    res.json(r.recordset);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/waiting', async (req, res) => {
  const { waiting_id, section_id, event_id, user_id } = req.body;
  try {
    const pool = await poolPromise;
    await pool.request()
      .input('waiting_id', sql.VarChar(20), waiting_id)
      .input('section_id', sql.VarChar(20), section_id)
      .input('event_id', sql.VarChar(20), event_id)
      .input('user_id', sql.VarChar(20), user_id)
      .query('INSERT INTO Waiting (waiting_id,section_id,event_id,user_id) VALUES (@waiting_id,@section_id,@event_id,@user_id)');
    res.status(201).json({ message: 'Added to waiting list' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/waiting/:id', async (req, res) => {
  try {
    const pool = await poolPromise;
    await pool.request().input('id', sql.VarChar(20), req.params.id).query('DELETE FROM Waiting WHERE waiting_id = @id');
    res.json({ message: 'Removed from waiting list' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// --- Feedback CRUD ---
router.post('/feedback', async (req, res) => {
  const { feedback_id, user_id, event_id, rating, comment } = req.body;
  try {
    const pool = await poolPromise;
    await pool.request()
      .input('feedback_id', sql.VarChar(20), feedback_id)
      .input('user_id', sql.VarChar(20), user_id)
      .input('event_id', sql.VarChar(20), event_id)
      .input('rating', sql.Int, rating)
      .input('comment', sql.VarChar(2000), comment)
      .query('INSERT INTO Feedback (feedback_id,user_id,event_id,rating,comment) VALUES (@feedback_id,@user_id,@event_id,@rating,@comment)');
    res.status(201).json({ message: 'Feedback submitted' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/feedback/:id', async (req, res) => {
  try {
    const pool = await poolPromise;
    await pool.request().input('id', sql.VarChar(20), req.params.id).query('DELETE FROM Feedback WHERE feedback_id = @id');
    res.json({ message: 'Feedback deleted' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
