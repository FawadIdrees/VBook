-- DQL queries and Views for project functionalities
-- 1) Top 5 Events by tickets sold
SELECT TOP 5 e.event_id, e.event_name, COUNT(t.ticket_id) AS tickets_sold
FROM Events e
LEFT JOIN Tickets t ON e.event_id = t.event_id AND t.purchased_by IS NOT NULL
GROUP BY e.event_id, e.event_name
ORDER BY tickets_sold DESC;

-- 2) Top 5 Events by revenue
SELECT TOP 5 e.event_id, e.event_name, ISNULL(SUM(p.amount),0) AS revenue
FROM Events e
LEFT JOIN Tickets t ON e.event_id = t.event_id
LEFT JOIN Payments p ON t.ticket_id = p.ticket_id
GROUP BY e.event_id, e.event_name
ORDER BY revenue DESC;

-- 3) Available seats for a given event (use @event_id parameter)
-- Replace @event_id with the event id when executing
SELECT s.seat_id, s.seat_num, s.section_id
FROM Seats s
JOIN Sections sec ON s.section_id = sec.section_id
WHERE s.seat_id NOT IN (
    SELECT t.seat_id FROM Tickets t WHERE t.event_id = @event_id AND t.purchased_by IS NOT NULL
);

-- 4) User purchase history (use @user_id)
SELECT p.payment_id, p.amount, p.paid_at, e.event_id, e.event_name, t.ticket_id, t.seat_id
FROM Payments p
JOIN Tickets t ON p.ticket_id = t.ticket_id
JOIN Events e ON t.event_id = e.event_id
WHERE p.user_id = @user_id
ORDER BY p.paid_at DESC;

-- 5) Upcoming events
SELECT e.event_id, e.event_name, e.event_date, v.venue_name
FROM Events e
JOIN Venues v ON e.venue_id = v.venue_id
WHERE e.event_date >= CAST(GETDATE() AS date)
ORDER BY e.event_date ASC;

-- 6) Average rating and review count per event (view)
CREATE VIEW vw_EventRatings AS
SELECT e.event_id, e.event_name, ISNULL(AVG(f.rating),0) AS avg_rating, COUNT(f.feedback_id) AS reviews
FROM Events e
LEFT JOIN Feedback f ON e.event_id = f.event_id
GROUP BY e.event_id, e.event_name;

-- 7) Event details view with sold seats count (tickets where purchased_by IS NOT NULL). `reserved` is VIP-only flag.
CREATE VIEW vw_EventDetails AS
SELECT e.event_id, e.event_name, e.event_date, e.ticket_price, e.type, v.venue_name,
       ISNULL(COUNT(t.ticket_id),0) AS tickets_sold,
       ISNULL(COUNT(t.ticket_id),0) AS tickets_reserved
FROM Events e
LEFT JOIN Venues v ON e.venue_id = v.venue_id
LEFT JOIN Tickets t ON e.event_id = t.event_id AND t.purchased_by IS NOT NULL
GROUP BY e.event_id, e.event_name, e.event_date, e.ticket_price, e.type, v.venue_name;

-- 8) Seats remaining per section for an event (use @event_id). Counts sold tickets (purchased_by IS NOT NULL).
SELECT sec.section_id, sec.section_name, sec.capacity,
       (sec.capacity - ISNULL(reserved_count,0)) AS seats_remaining
FROM Sections sec
LEFT JOIN (
    SELECT ss.section_id, COUNT(t.ticket_id) AS reserved_count
    FROM Seats ss
    JOIN Tickets t ON ss.seat_id = t.seat_id AND t.event_id = @event_id AND t.purchased_by IS NOT NULL
    GROUP BY ss.section_id
) r ON sec.section_id = r.section_id
WHERE sec.venue_id = (SELECT venue_id FROM Events WHERE event_id = @event_id);

-- 9) Feedback list for an event (use @event_id)
SELECT f.feedback_id, f.user_id, u.username, f.rating, f.comment, f.created_at
FROM Feedback f
JOIN Users u ON f.user_id = u.user_id
WHERE f.event_id = @event_id
ORDER BY f.created_at DESC;

-- 10) Popular venues by tickets sold
SELECT TOP 5 v.venue_id, v.venue_name, COUNT(t.ticket_id) AS tickets_sold
FROM Venues v
JOIN Events e ON e.venue_id = v.venue_id
LEFT JOIN Tickets t ON t.event_id = e.event_id AND t.purchased_by IS NOT NULL
GROUP BY v.venue_id, v.venue_name
ORDER BY tickets_sold DESC;

-- 11) Users on waitlist for an event (use @event_id)
SELECT w.waiting_id, w.user_id, u.username, w.section_id, w.created_at
FROM Waiting w
JOIN Users u ON w.user_id = u.user_id
WHERE w.event_id = @event_id
ORDER BY w.created_at ASC;

-- 12) View to show organizer's events
CREATE VIEW vw_OrganizerEvents AS
SELECT e.event_id, e.event_name, e.event_date, v.venue_name, ISNULL(COUNT(t.ticket_id),0) AS tickets_reserved
FROM Events e
LEFT JOIN Venues v ON e.venue_id = v.venue_id
LEFT JOIN Tickets t ON e.event_id = t.event_id AND t.purchased_by IS NOT NULL
GROUP BY e.event_id, e.event_name, e.event_date, v.venue_name, e.organizer_id;

-- End of queries

/*
    Advanced DQL for Venue Management & Event Ticketing Portal
    - Adds support for password reset tokens and holds (timed holds)
    - Seat attributes (accessible, obstructed, blocked)
    - Queries to join waitlist, promote users, and view seat map state
*/



-- 4) Get user by email (for login)
-- param: @email
SELECT user_id, username, email, password, type FROM Users WHERE email = @email;

-- 5) Insert new user (registration)
-- fields: @user_id,@username,@email,@password,@type
INSERT INTO Users (user_id,username,email,password,type) VALUES (@user_id,@username,@email,@password,@type);

-- 9) Create venue / update venue
-- Create
INSERT INTO Venues (venue_id,venue_name,venue_description) VALUES (@venue_id,@venue_name,@venue_description);
-- Update
UPDATE Venues SET venue_name=@venue_name, venue_description=@venue_description WHERE venue_id=@venue_id;

-- 10) Create section & set section pricing/attributes
INSERT INTO Sections (section_id,section_name,section_description,venue_id,capacity,factor) VALUES (@section_id,@section_name,@section_description,@venue_id,@capacity,@factor);
UPDATE Sections SET section_name=@section_name, section_description=@section_description, capacity=@capacity, factor=@factor WHERE section_id=@section_id;

-- 11) Create seats and set attributes
INSERT INTO Seats (seat_id,x_coord,y_coord,section_id,seat_num,accessible,obstructed,blocked) VALUES (@seat_id,@x_coord,@y_coord,@section_id,@seat_num,@accessible,@obstructed,@blocked);
UPDATE Seats SET x_coord=@x_coord,y_coord=@y_coord,section_id=@section_id,seat_num=@seat_num,accessible=@accessible,obstructed=@obstructed,blocked=@blocked WHERE seat_id=@seat_id

-- 16) Cancel ticket and refund (simplified)
-- fields: @ticket_id
-- delete payment and mark ticket as not reserved (or delete ticket)
DELETE FROM Payments WHERE ticket_id = @ticket_id;
UPDATE Tickets SET reserved = 'N', purchased_by = NULL WHERE ticket_id = @ticket_id;

-- 17) Join waitlist (queue) for a sold-out section/event
-- fields: @waiting_id,@section_id,@event_id,@user_id
INSERT INTO Waiting (waiting_id,section_id,event_id,user_id,created_at) VALUES (@waiting_id,@section_id,@event_id,@user_id,GETDATE());

-- 19) View: user profile (purchases, saved payments, tickets)
CREATE VIEW vw_UserProfile AS
SELECT u.user_id, u.username, u.email, u.type,
    (SELECT COUNT(p.payment_id) FROM Payments p WHERE p.user_id = u.user_id) AS payments_count,
    (SELECT COUNT(t.ticket_id) FROM Tickets t WHERE t.purchased_by = u.user_id) AS tickets_count
FROM Users u;

-- 20) View: event seat summary per section
CREATE VIEW vw_SectionSummary AS
SELECT sec.section_id, sec.section_name, e.event_id,
    sec.capacity,
    ISNULL(SUM(CASE WHEN t.purchased_by IS NOT NULL THEN 1 ELSE 0 END),0) AS purchased_count,
    ISNULL(SUM(CASE WHEN t.purchased_by IS NOT NULL THEN 1 ELSE 0 END),0) AS reserved_count,
    (sec.capacity - ISNULL(SUM(CASE WHEN t.purchased_by IS NOT NULL THEN 1 ELSE 0 END),0)) AS remaining
FROM Sections sec
JOIN Events e ON e.venue_id = sec.venue_id
LEFT JOIN Seats s ON s.section_id = sec.section_id
LEFT JOIN Tickets t ON t.seat_id = s.seat_id AND t.event_id = e.event_id
GROUP BY sec.section_id,sec.section_name,sec.capacity,e.event_id;

-- End of advanced DQL
