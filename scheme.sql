create database project;
GO
use project;
GO
create table Users
(
    user_id varchar(20) primary key,
    username varchar(50) not null,
    email varchar(100) not null unique,
    password varchar(255) not null,
    type varchar(10) check (type in ('admin', 'user', 'organizer')) not null
);

create table Venues
(
    venue_id varchar(20) primary key,
    venue_name varchar(100) not null,
    venue_description varchar(1000) null
);

create table Sections
(
    section_id varchar(20) primary key,
    section_name varchar(100) not null,
    section_description varchar(1000) null,
    venue_id varchar(20) not null foreign key references Venues(venue_id),
    capacity int not null,
    factor float not null
);

create table Seats
(
    seat_id varchar(20) primary key,
    x_coord int not null,
    y_coord int not null,
    section_id varchar(20) not null foreign key references Sections(section_id),
    seat_num int not null,
    accessible bit default 0,
    obstructed bit default 0,
    blocked bit default 0
);

create table Events
(
    event_id varchar(20) primary key,
    event_name varchar(200) not null,
    event_description varchar(2000) null,
    event_date date not null,
    venue_id varchar(20) not null foreign key references Venues(venue_id),
    organizer_id varchar(20) not null foreign key references Users(user_id),
    ticket_price float not null,
    type varchar(50) check(type in ('Concert','Seminar','Movie Screening','Party'))
);

create table Tickets
(
    ticket_id varchar(20) primary key,
    event_id varchar(20) not null foreign key references Events(event_id),
    seat_id varchar(20) not null foreign key references Seats(seat_id),
    reserved char(1) check(reserved in ('Y','N')) not null,
    purchased_by varchar(20) null foreign key references Users(user_id)
);
create index IX_Tickets_EventSeat on Tickets(event_id, seat_id);

create table Payments
(
    payment_id varchar(20) primary key,
    user_id varchar(20) not null foreign key references Users(user_id),
    ticket_id varchar(20) not null foreign key references Tickets(ticket_id),
    method varchar(50) not null check(method in ('Bank Payment','Online Wallet Payment','Cash','COD')),
    amount float not null,
    paid_at datetime default GETDATE()
);

create table Waiting
(
    waiting_id varchar(20) primary key,
    section_id varchar(20) not null foreign key references Sections(section_id),
    event_id varchar(20) not null foreign key references Events(event_id),
    user_id varchar(20) not null foreign key references Users(user_id),
    created_at datetime default GETDATE()
);
create unique index UX_Waiting_EventSectionUser on Waiting(event_id, section_id, user_id);
create index IX_Waiting_EventSectionCreated on Waiting(event_id, section_id, created_at);

-- Persistent storage for password reset tokens (replace in-memory store)
create table PasswordResetTokens
(
    token varchar(128) primary key,
    user_id varchar(20) not null foreign key references Users(user_id),
    expires_at datetime not null,
    created_at datetime default GETDATE()
);

-- Persistent holds for waitlist promotions (15-minute holds)
create table WaitlistHolds
(
    hold_id varchar(20) primary key,
    user_id varchar(20) not null foreign key references Users(user_id),
    event_id varchar(20) not null foreign key references Events(event_id),
    section_id varchar(20) not null foreign key references Sections(section_id),
    seat_id varchar(20) null foreign key references Seats(seat_id),
    expires_at datetime not null,
    created_at datetime default GETDATE()
);
create index IX_WaitlistHolds_EventSeatSectionExpiry on WaitlistHolds(event_id, seat_id, section_id, expires_at);

create table SavedPayments
(
    sp_id varchar(20) primary key,
    user_id varchar(20) not null foreign key references Users(user_id),
    acc_no varchar(100) not null,
    bank varchar(100) not null
);

create table Feedback
(
    feedback_id varchar(20) primary key,
    user_id varchar(20) not null foreign key references Users(user_id),
    event_id varchar(20) not null foreign key references Events(event_id),
    rating int check (rating >= 1 and rating <= 5) not null,
    comment varchar(2000) null,
    created_at datetime default GETDATE()
);
create unique index UX_Feedback_EventUser on Feedback(event_id, user_id);

-- Use the DB
USE project;
GO

-- 1) Users
INSERT INTO Users (user_id, username, email, password, type) VALUES
('U001','admin_jane','jane.admin@example.com','$2b$dummyhash1','admin'),
('U002','fawad','fawad.idrees@example.com','$2b$dummyhash2','user'),
('U003','oliver_org','oliver.organizer@example.com','$2b$dummyhash3','organizer'),
('U004','amina','amina.user@example.com','$2b$dummyhash4','user'),
('U005','sara_events','sara.organizer@example.com','$2b$dummyhash5','organizer');
GO

-- 2) Venues
INSERT INTO Venues (venue_id, venue_name, venue_description) VALUES
('V001','Grand Arena','Large multipurpose arena with tiered seating.'),
('V002','Riverside Theater','Cozy riverside theater for film screenings and small shows.');
GO

-- 3) Sections
INSERT INTO Sections (section_id, section_name, section_description, venue_id, capacity, factor) VALUES
('S001','Main Floor','Front and centre seating on ground level', 'V001', 6, 1.00),
('S002','Balcony','Upper-level balcony seating', 'V001', 4, 0.80),
('S003','Screen 1','Main screening hall seats', 'V002', 6, 1.00);
GO

-- 4) Seats (coords are illustrative)
-- Section S001 (6 seats)
INSERT INTO Seats (seat_id, x_coord, y_coord, section_id, seat_num) VALUES
('SEAT-S001-01', 1, 1, 'S001', 1),
('SEAT-S001-02', 2, 1, 'S001', 2),
('SEAT-S001-03', 3, 1, 'S001', 3),
('SEAT-S001-04', 1, 2, 'S001', 4),
('SEAT-S001-05', 2, 2, 'S001', 5),
('SEAT-S001-06', 3, 2, 'S001', 6);

-- Section S002 (4 seats)
INSERT INTO Seats (seat_id, x_coord, y_coord, section_id, seat_num) VALUES
('SEAT-S002-01', 1, 1, 'S002', 1),
('SEAT-S002-02', 2, 1, 'S002', 2),
('SEAT-S002-03', 1, 2, 'S002', 3),
('SEAT-S002-04', 2, 2, 'S002', 4);

-- Section S003 (6 seats)
INSERT INTO Seats (seat_id, x_coord, y_coord, section_id, seat_num) VALUES
('SEAT-S003-01', 1, 1, 'S003', 1),
('SEAT-S003-02', 2, 1, 'S003', 2),
('SEAT-S003-03', 3, 1, 'S003', 3),
('SEAT-S003-04', 1, 2, 'S003', 4),
('SEAT-S003-05', 2, 2, 'S003', 5),
('SEAT-S003-06', 3, 2, 'S003', 6);
GO

-- 5) Events
INSERT INTO Events (event_id, event_name, event_description, event_date, venue_id, organizer_id, ticket_price, type) VALUES
('E001','Rock Night','An evening of live rock bands.', '2026-04-20', 'V001', 'U003', 50.00, 'Concert'),
('E002','Tech Talk 2026','A seminar on emerging web technologies.', '2026-03-25', 'V001', 'U005', 0.00, 'Seminar'),
('E003','Indie Film Fest: Session A','Independent film screening.', '2026-04-01', 'V002', 'U003', 12.50, 'Movie Screening');
GO

-- 6) Tickets
-- Tickets for E001 (Main Floor S001)
INSERT INTO Tickets (ticket_id, event_id, seat_id, reserved, purchased_by) VALUES
('T101','E001','SEAT-S001-01','Y','U002'),  -- purchased by U002
('T102','E001','SEAT-S001-02','Y','U004'),  -- purchased by U004
('T103','E001','SEAT-S001-03','Y',NULL),   -- VIP-only seat (not yet purchased)
('T104','E001','SEAT-S001-04','N',NULL),   -- available
('T105','E001','SEAT-S001-05','N',NULL),
('T106','E001','SEAT-S001-06','Y',NULL);   -- VIP-only seat (not yet purchased)

-- Tickets for E002 (Balcony S002)
INSERT INTO Tickets (ticket_id, event_id, seat_id, reserved, purchased_by) VALUES
('T201','E002','SEAT-S002-01','Y',NULL), -- VIP-only seat (not yet purchased)
('T202','E002','SEAT-S002-02','N',NULL),
('T203','E002','SEAT-S002-03','N',NULL),
('T204','E002','SEAT-S002-04','Y','U002');  -- VIP-only seat purchased by U002 (seminar tracked)

-- Tickets for E003 (Screen 1 S003)
INSERT INTO Tickets (ticket_id, event_id, seat_id, reserved, purchased_by) VALUES
('T301','E003','SEAT-S003-01','Y','U004'), -- VIP-only seat purchased by U004
('T302','E003','SEAT-S003-02','N',NULL),
('T303','E003','SEAT-S003-03','N',NULL);
GO

-- 7) Payments (for purchased tickets)
INSERT INTO Payments (payment_id, user_id, ticket_id, method, amount, paid_at) VALUES
('P001','U002','T101','Online Wallet Payment',50.00,'2026-02-25 10:15:00'),
('P002','U004','T102','Bank Payment',50.00,'2026-02-26 14:30:00'),
('P003','U002','T204','COD',0.00,'2026-02-28 09:00:00'),  -- seminar with 0 price but payment record for tracking (COD/0)
('P004','U004','T301','Cash',12.50,'2026-03-01 19:45:00');
GO

-- 8) Waiting (users in waiting list for specific section/event)
INSERT INTO Waiting (waiting_id, section_id, event_id, user_id, created_at) VALUES
('W001','S001','E001','U002','2026-02-20 08:00:00'),
('W002','S001','E001','U005','2026-02-22 09:30:00'),
('W003','S003','E003','U002','2026-02-27 12:00:00');
GO

-- 9) SavedPayments (user saved accounts)
INSERT INTO SavedPayments (sp_id, user_id, acc_no, bank) VALUES
('SP001','U002','PK12-3456-7890-001','National Bank'),
('SP002','U004','PK98-7654-3210-002','City Bank');
GO

-- 10) Feedback (ratings/comments for events)
INSERT INTO Feedback (feedback_id, user_id, event_id, rating, comment, created_at) VALUES
('F001','U002','E001',5,'Amazing performance, great sound and energy!','2026-02-26 21:00:00'),
('F002','U004','E003',4,'Good selection of films, seating was comfortable.','2026-03-02 18:30:00');
GO

select * from Events;