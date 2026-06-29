# coding-mastery-backend

REST API for the Coding Mastery learning platform. Built with **Express 5**, **MySQL 8**, **JWT**, and **bcryptjs**.

## Stack

- Node.js + Express 5
- MySQL 8 via `mysql2/promise` (connection pool)
- JWT auth (`jsonwebtoken`) with role-based access (`user`, `teacher`, `admin`)
- Password hashing with `bcryptjs`
- Request validation with `zod`
- CORS enabled for the Next.js frontend

## Setup

1. Make sure MySQL is running locally (any user with `CREATE DATABASE` privileges).
2. Copy env file and fill in your MySQL credentials:

   ```bash
   cp .env.example .env
   ```

3. Install deps:

   ```bash
   npm install
   ```

4. Run dev server (auto-creates the `coding-mastery` database and `users` table on first start):

   ```bash
   npm run dev
   ```

The API will be available at `http://localhost:5000`.

## API endpoints

Base URL: `http://localhost:5000/api`

| Method | Path                    | Auth          | Description                                    |
| ------ | ----------------------- | ------------- | ---------------------------------------------- |
| GET    | `/health`               | public        | Health check                                   |
| POST   | `/auth/register`        | public        | Create a new user                              |
| POST   | `/auth/login`           | public        | Authenticate and receive JWT                   |
| POST   | `/auth/forgot-password` | public        | Issue a password reset token (logged in dev)   |
| POST   | `/auth/reset-password`  | public        | Set a new password using a valid reset token   |
| GET    | `/auth/me`              | Bearer JWT    | Current user profile                           |
| GET    | `/user/ping`            | Bearer JWT    | Any authenticated user                         |
| GET    | `/teacher/ping`         | teacher/admin | Role-restricted example                        |
| GET    | `/admin/ping`           | admin         | Role-restricted example                        |

### Register

```http
POST /api/auth/register
Content-Type: application/json

{
  "name": "Ada Lovelace",
  "email": "ada@example.com",
  "password": "secret123",
  "contact": "9999999999",
  "role": "user"
}
```

Response `201`:

```json
{
  "token": "eyJhbGciOi...",
  "user": {
    "id": 1,
    "name": "Ada Lovelace",
    "email": "ada@example.com",
    "contact": "9999999999",
    "role": "user"
  }
}
```

### Login

```http
POST /api/auth/login
Content-Type: application/json

{
  "email": "ada@example.com",
  "password": "secret123",
  "role": "user"
}
```

If `role` is provided and doesn't match the account's role, returns `403`.

### Forgot password

```http
POST /api/auth/forgot-password
Content-Type: application/json

{
  "email": "ada@example.com"
}
```

Always responds `200` with the same message regardless of whether the email exists (prevents email enumeration). In **non-production** environments, the response also includes a `devResetUrl` so you can test the flow without an SMTP setup:

```json
{
  "message": "If an account exists for this email, a password reset link has been sent.",
  "devResetUrl": "http://localhost:3000/reset-password?token=<hex-token>"
}
```

#### Email delivery

When the email matches a user, the server emails the reset link via SMTP using **Nodemailer**. The body looks like:

```
Hi <name>,

Click below link to reset your password.

<reset url>

This link expires in 30 minutes.
```

Both `text/plain` and a styled HTML version are sent. Configure SMTP in `.env`:

```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=you@gmail.com
SMTP_PASSWORD=your-app-password
EMAIL_FROM=Coding Mastery <no-reply@codingmastery.com>
```

If `SMTP_HOST` is left blank, the email body is logged to the server console instead of sent (so dev still works without SMTP setup).

#### Token security

Tokens are random 32-byte values (64 hex chars), **stored as a SHA-256 hash**, single-use, and expire after **30 minutes**. Issuing a new token invalidates any active token for that user. No JWTs are involved in the password reset flow.

### Reset password

```http
POST /api/auth/reset-password
Content-Type: application/json

{
  "token": "<hex-token from email link>",
  "password": "newSecret123"
}
```

Validates the token (existence, not used, not expired), updates the user's password (`bcrypt` re-hash), and marks the token as used.

### Authenticated requests

Send the JWT in the `Authorization` header:

```
Authorization: Bearer <token>
```

## Project structure

```
src/
  app.js                  Express app factory
  server.js               Entry point: init DB, start HTTP
  config/
    env.js                Loads + validates .env
    db.js                 MySQL pool, ensures DB + schema
  middleware/
    auth.js               requireAuth, requireRole
    errorHandler.js       404 + central error responder
  models/
    user.model.js         users table queries
  controllers/
    auth.controller.js    register/login/me + zod schemas
  routes/
    index.js              /api router
    auth.routes.js        /api/auth/*
  utils/
    httpError.js
    jwt.js
    validate.js           zod -> express middleware
```
