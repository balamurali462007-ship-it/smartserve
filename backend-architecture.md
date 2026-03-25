# SmartServe Backend Architecture

This document outlines the modular backend architecture for the SmartServe gig service application.

## 1. Core Services

### User Service
- **Responsibility:** User authentication, profiles, and saved addresses.
- **Key Endpoints:**
  - `POST /api/auth/register` - Register a new user
  - `POST /api/auth/login` - Login and get a token

### Worker Service
- **Responsibility:** Worker profiles, skills, availability, and real-time location.
- **Key Endpoints:**
  - `GET /api/workers/nearby-workers` - Find workers based on skill and location
  - `POST /api/workers/accept-job` - Worker accepts a pending job

### Job Service
- **Responsibility:** Managing the lifecycle of a service request.
- **Key Endpoints:**
  - `POST /api/jobs/request-job` - Create a new job request
  - `GET /api/jobs` - List all jobs (optionally filter by `userId`)
  - `PATCH /api/jobs/:id/status` - Update job status

### Payment Service
- **Responsibility:** Billing, transaction processing, and invoice generation.
- **Key Endpoints:**
  - `POST /api/payments/pay` - Process a payment for a job

### Rating Service
- **Responsibility:** Collecting and aggregating worker feedback.
- **Key Endpoints:**
  - `POST /api/ratings/rate-worker` - Submit a rating for a worker after a job

## 2. The Job Lifecycle Flow

1. **User Request:** User submits a problem. Job Service creates a `PENDING` job.
2. **Worker Match:** Worker Service finds the best available worker based on skill and distance.
3. **Job Lifecycle:**
   - Worker Accepts -> `ASSIGNED`
   - Worker Arrives -> `ARRIVED`
   - Work Starts -> `IN_PROGRESS`
   - Work Ends -> `COMPLETED`
4. **Payment:** Payment Service generates a bill. User pays. Status -> `PAID`.
5. **Rating:** User submits feedback. Rating Service updates the worker's aggregate score.

## 3. Authentication & Security

### JWT Authentication
The API uses JSON Web Tokens (JWT) for secure communication.
- **Login/Register:** Returns a `token` upon success.
- **Protected Routes:** Require the `Authorization: Bearer <token>` header.

### User Roles
- **USER:** Can request jobs, pay for services, and rate workers.
- **WORKER:** Can accept jobs and update job status.

### Secured Endpoints
| Endpoint | Method | Role Required | Description |
|----------|--------|---------------|-------------|
| `/api/auth/register` | POST | Public | Register as USER or WORKER |
| `/api/auth/login` | POST | Public | Login to get JWT |
| `/api/jobs/request-job` | POST | USER | Create a service request |
| `/api/jobs` | GET | USER/WORKER | View relevant jobs |
| `/api/jobs/:id/status` | PATCH | USER/WORKER | Update job progress |
| `/api/workers/nearby-workers` | GET | USER/WORKER | Find workers |
| `/api/workers/accept-job` | POST | WORKER | Claim a pending job |
| `/api/payments/pay` | POST | USER | Pay for a completed job |
| `/api/ratings/rate-worker` | POST | USER | Rate a worker |

## 4. Tech Stack
- **Runtime:** Node.js
- **Framework:** Express.js
- **Language:** TypeScript
- **API Style:** RESTful
- **Database:** Firestore (NoSQL) for real-time updates.
