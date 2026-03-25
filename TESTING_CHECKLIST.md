# SmartServe Testing Checklist

This document outlines the testing scenarios for the SmartServe application to ensure a smooth user experience and robust functionality.

## 1. Authentication (Login / Register)
- [ ] **Registration (Customer):** Create a new account with role "Customer". Verify redirect to `customer.html`.
- [ ] **Registration (Worker):** Create a new account with role "Worker" and select a skill (e.g., Plumber). Verify redirect to `worker.html`.
- [ ] **Login:** Log in with existing credentials. Verify correct role-based redirection.
- [ ] **Logout:** Click logout and verify redirection to `index.html` and clearing of session.
- [ ] **Validation:** Test empty fields, invalid email format, and incorrect passwords.

## 2. Job Request Flow (Customer)
- [ ] **AI Analysis:** Enter a problem description (e.g., "Leaking pipe") and click "Analyze with AI".
- [ ] **AI Result:** Verify that Gemini suggests the correct worker type and provides a summary.
- [ ] **Worker Search:** Verify the "Finding the best worker" overlay appears and correctly identifies a nearby worker.
- [ ] **Job Creation:** Verify a new job is created in the database (check console or network logs).

## 3. Worker Acceptance (Worker)
- [ ] **Incoming Request:** Log in as a worker with the matching skill. Verify the "New Job Request" modal appears.
- [ ] **Accept Job:** Click "Accept" and verify the status changes to "Assigned".
- [ ] **Reject Job:** Click "Reject" and verify the modal closes and the job becomes available for others (or shows "No workers found" to customer).

## 4. Service Execution (Worker & Customer)
- [ ] **On The Way:** Worker clicks "Start Journey". Customer sees "Worker is on the way" with live map tracking.
- [ ] **Arrival:** Worker clicks "I have Arrived". Customer UI updates to "Worker Arrived".
- [ ] **Start Work:** Worker clicks "Start Work". Verify the timer starts on both dashboards.

## 5. Timer and Billing
- [ ] **Live Timer:** Verify the timer increments every second.
- [ ] **Live Cost Calculation:** Verify the cost updates dynamically based on the elapsed time (Base Price + Rate per Minute).
- [ ] **Complete Work:** Worker clicks "Work Completed". Verify the timer stops and the final bill is calculated.

## 6. Payment System
- [ ] **Invoice Generation:** Verify the customer sees a detailed invoice with service fee, time taken, and total amount.
- [ ] **Payment Methods:** Test selecting different payment methods (UPI, Card, Cash).
- [ ] **Payment Success:** Complete a payment. Verify the "Payment Successful" modal appears and the job status updates to "Completed".
- [ ] **Payment Failure:** (Simulated) Verify error handling if a payment fails or is cancelled.

## 7. Rating System
- [ ] **Submit Rating:** After payment, rate the worker (1-5 stars) and add a comment.
- [ ] **Rating Update:** Verify the worker's average rating updates in the database/UI.

## 8. Edge Cases & Error Handling
- [ ] **Cancel Midway (Customer):** Customer cancels the job after it's assigned but before work starts. Verify worker is notified.
- [ ] **Cancel Midway (Worker):** Worker cancels after accepting. Verify customer is notified and search restarts.
- [ ] **Network Failure:** Simulate offline mode during a job. Verify the app handles reconnection or shows a "Connection Lost" message.
- [ ] **No Workers Available:** Request a service where no workers are online. Verify the "No workers found" message is displayed to the customer.
- [ ] **Refresh Persistence:** Refresh the page during an active job. Verify the state is recovered from the backend/local storage.

---
**Date Created:** March 25, 2026
**Version:** 1.0.0
