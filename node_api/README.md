Event Ticketing API (Express + MSSQL)

Setup

1. Create a `.env` file from the example and fill database credentials.

```bash
# from the `node_api` folder run:
cp .env.example .env
# Edit `.env` and add your DB credentials (do NOT commit `.env` to Git)
```
2. Install dependencies (Ubuntu 24 example):

```bash
# install Node.js (Node 18 LTS) and npm
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs build-essential

cd University/node_api
npm install
```

3. Start server:

```bash
npm run start
# or for development
npm run dev
```

Frontend (React + Vite)

The frontend app is in `../frontend` and uses `../vbook.jsx` as the main UI module.

```bash
cd ../frontend
cp .env.example .env
npm install
npm run dev
```

Default frontend environment:

- `VITE_API_BASE=http://localhost:3000/api`
- `VITE_SOCKET_BASE=http://localhost:3000`

For production-like local serving:

```bash
cd ../frontend
npm run build
cd ../node_api
npm run start
```

When `frontend/dist` exists, the backend serves the built frontend automatically.

Database: executing `scheme.sql`

If you have Microsoft SQL Server and `sqlcmd` (mssql-tools) installed, run:

```bash
# example (requires mssql-tools/sqlcmd configured)
sqlcmd -S <server> -U <user> -P '<password>' -d master -i ../scheme.sql
```

To install `mssql-tools` on Ubuntu, follow Microsoft's guide. Example (may require adapting for Ubuntu 24):

```bash
curl -sSL https://packages.microsoft.com/keys/microsoft.asc | sudo apt-key add -
curl -sSL https://packages.microsoft.com/config/ubuntu/22.04/prod.list | sudo tee /etc/apt/sources.list.d/mssql-release.list
sudo apt-get update
sudo ACCEPT_EULA=Y apt-get install -y msodbcsql18 mssql-tools unixodbc-dev
```

Then run `sqlcmd` as above to execute `scheme.sql` into your `project` database.

Endpoints

- `GET /api/users` - list users
- `POST /api/users` - create user (JSON body)
- `GET /api/users/:id` - get user
- `PUT /api/users/:id` - update user
- `DELETE /api/users/:id` - delete user

- `GET /api/events` - list events
- `POST /api/events` - create event
- `GET /api/events/:id/available-seats` - available seats for event
- `GET /api/events/:id/feedback` - feedback for event

- `GET /api/reports/top-events` - top 5 events by tickets sold

Notes

- The API uses `mssql` to connect to a SQL Server instance. Ensure the `project` database is created and `scheme.sql` has been executed to create tables.
- Use Postman to test endpoints. Provide JSON bodies for `POST`/`PUT` requests.

Postman

- Import the collection file: `node_api/postman_collection.json` into Postman.
- Example booking request (POST `http://localhost:3000/api/book`) body:

```json
{
	"ticket_id": "T100",
	"event_id": "E1",
	"seat_id": "S100",
	"user_id": "U1",
	"payment_id": "P100",
	"method": "Online Wallet Payment",
	"amount": 50
}
```

Automated verification scripts

Run with the API server running at `http://localhost:3000`:

```bash
cd node_api
npm test                 # auth + access-control smoke checks
npm run concurrency      # concurrent booking race check
npm run test:admin-flow  # organizer/admin end-to-end management flow
```

Curl examples

- List events:

```bash
curl http://localhost:3000/api/events
```

- Create a user:

```bash
curl -X POST http://localhost:3000/api/users -H 'Content-Type: application/json' -d '{"user_id":"U1","username":"Alice","email":"alice@example.com","password":"secret","type":"user"}'
```

- Booking (transactional):

```bash
curl -X POST http://localhost:3000/api/book -H 'Content-Type: application/json' -d '{"ticket_id":"T100","event_id":"E1","seat_id":"S100","user_id":"U1","payment_id":"P100","method":"Online Wallet Payment","amount":50}'
```

Notes on booking endpoint

- The `/api/book` endpoint performs an atomic transaction: it checks seat availability (using `purchased_by IS NOT NULL`), inserts the ticket (sets `reserved = 'N'` for booked tickets because `reserved='Y'` is used to mark VIP-only seats) and records the payment. If the seat is already taken, it returns HTTP 409.
 - The `/api/book` endpoint performs an atomic transaction: it checks seat availability (using `purchased_by IS NOT NULL`), inserts the ticket (sets `reserved = 'N'` for booked tickets because `reserved='Y'` is used to mark VIP-only seats) and records the payment. If the seat is already taken, it returns HTTP 409.
 - VIP-only seats: a ticket row with `reserved='Y'` indicates the seat is VIP-only. Such seats cannot be purchased via the standard `/api/book` endpoint and will return HTTP 403 if attempted. Purchased tickets are identified by `purchased_by IS NOT NULL`.

Demo pages

- Admin demo: http://localhost:3000/admin.html — log in as an admin and block/unblock seats or promote waitlist entries (demo controls).
- Seatmap demo: http://localhost:3000/seatmap.html — user demo: login, view seatmap, simulate payment, and book.

Notes

- The admin demo calls admin endpoints and the waitlist promotion endpoint to illustrate organizer workflows; it uses the same auth flow as other API calls.
- If an endpoint path differs in your local `routes.js`, update `public/admin.html` accordingly.

If you'd like, I can now bundle the React `vbook.jsx` into a small SPA and add concurrency e2e tests — say "bundle UI and test" or I'll proceed automatically after your confirmation.

