const fs = require('fs');

async function runMigrations(pool) {
  // Create PasswordResetTokens if missing
  await pool.request().query(`
    IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'PasswordResetTokens')
    BEGIN
      CREATE TABLE PasswordResetTokens (
        token varchar(128) PRIMARY KEY,
        user_id varchar(20) NOT NULL REFERENCES Users(user_id),
        expires_at datetime NOT NULL,
        created_at datetime DEFAULT GETDATE()
      );
    END
  `);

  // Create WaitlistHolds if missing
  await pool.request().query(`
    IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'WaitlistHolds')
    BEGIN
      CREATE TABLE WaitlistHolds (
        hold_id varchar(20) PRIMARY KEY,
        user_id varchar(20) NOT NULL REFERENCES Users(user_id),
        event_id varchar(20) NOT NULL REFERENCES Events(event_id),
        section_id varchar(20) NOT NULL REFERENCES Sections(section_id),
        seat_id varchar(20) NULL REFERENCES Seats(seat_id),
        expires_at datetime NOT NULL,
        created_at datetime DEFAULT GETDATE()
      );
    END
  `);

  // Helpful indexes / constraints for booking and waitlist integrity
  await pool.request().query(`
    IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_Tickets_EventSeat' AND object_id = OBJECT_ID('Tickets'))
    BEGIN
      CREATE INDEX IX_Tickets_EventSeat ON Tickets(event_id, seat_id);
    END

    IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_Waiting_EventSectionCreated' AND object_id = OBJECT_ID('Waiting'))
    BEGIN
      CREATE INDEX IX_Waiting_EventSectionCreated ON Waiting(event_id, section_id, created_at);
    END

    IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_WaitlistHolds_EventSeatSectionExpiry' AND object_id = OBJECT_ID('WaitlistHolds'))
    BEGIN
      CREATE INDEX IX_WaitlistHolds_EventSeatSectionExpiry ON WaitlistHolds(event_id, seat_id, section_id, expires_at);
    END
  `);

  // Ensure Waiting table exists (should already) and other sanity checks could go here
  return true;
}

module.exports = { runMigrations };
