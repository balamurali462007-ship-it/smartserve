# SmartServe Database Schema

This document defines the data models and relationships for the SmartServe gig application.

## 1. Collections (Firestore NoSQL)

### Users (`users`)
- `id`: **String** (UID) - Primary Key
- `name`: **String** - Full name of the user
- `email`: **String** - Email address
- `phone`: **String** - Contact number
- `address`: **Map**
  - `street`: **String**
  - `city`: **String**
  - `state`: **String**
  - `zip`: **String**
  - `lat`: **Number** - Latitude for service location
  - `lng`: **Number** - Longitude for service location
- `createdAt`: **Timestamp**
- `updatedAt`: **Timestamp**

### Workers (`workers`)
- `id`: **String** (UID) - Primary Key
- `name`: **String** - Full name of the worker
- `email`: **String**
- `phone`: **String**
- `skills`: **Array[String]** - List of services (e.g., ["Plumber", "Electrician"])
- `rating`: **Number** - Average rating score
- `ratingCount`: **Number** - Total number of ratings received
- `isOnline`: **Boolean** - Current availability status
- `location`: **Map**
  - `lat`: **Number** - Current latitude
  - `lng`: **Number** - Current longitude
- `createdAt`: **Timestamp**
- `updatedAt`: **Timestamp**

### Jobs (`jobs`)
- `id`: **String** - Primary Key
- `userId`: **String** - Foreign Key to `users.id`
- `workerId`: **String** (Nullable) - Foreign Key to `workers.id`
- `title`: **String** - Job title (e.g., "Kitchen Sink Leak")
- `description`: **String** - Detailed problem description
- `status`: **Enum** - `PENDING`, `ASSIGNED`, `ON_THE_WAY`, `ARRIVED`, `IN_PROGRESS`, `COMPLETED`, `CANCELLED`
- `location`: **Map**
  - `lat`: **Number**
  - `lng`: **Number**
  - `address`: **String**
- `scheduledAt`: **Timestamp**
- `startedAt`: **Timestamp**
- `completedAt`: **Timestamp**
- `createdAt`: **Timestamp**
- `updatedAt`: **Timestamp**

### Payments (`payments`)
- `id`: **String** - Primary Key
- `jobId`: **String** - Foreign Key to `jobs.id` (Unique)
- `userId`: **String** - Foreign Key to `users.id`
- `amount`: **Number** - Total bill amount
- `currency`: **String** - e.g., "INR"
- `status`: **Enum** - `PENDING`, `PAID`, `FAILED`, `REFUNDED`
- `method`: **String** - e.g., "UPI", "CARD"
- `transactionId`: **String** - Reference from payment gateway
- `createdAt`: **Timestamp**

### Ratings (`ratings`)
- `id`: **String** - Primary Key
- `jobId`: **String** - Foreign Key to `jobs.id` (Unique)
- `userId`: **String** - Foreign Key to `users.id`
- `workerId`: **String** - Foreign Key to `workers.id`
- `score`: **Number** - Rating score (1-5)
- `comment`: **String** - User feedback
- `createdAt`: **Timestamp**

---

## 2. Relationships

- **User → Jobs (1:N):** A user can request multiple jobs over time.
- **Worker → Jobs (1:N):** A worker can be assigned to multiple jobs (sequentially).
- **Job → Payment (1:1):** Each completed job has exactly one payment record.
- **Job → Rating (1:1):** Each completed job can receive exactly one rating from the user.
- **Worker → Ratings (1:N):** A worker accumulates many ratings, which are averaged to update their `rating` field.
