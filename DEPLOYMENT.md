# Deployment Guide for SmartServe

This guide provides instructions for deploying the SmartServe application to production platforms like **Render** or **Railway**.

## Prerequisites

1.  **Firebase Project:** Ensure you have a Firebase project set up and Firestore enabled.
2.  **Razorpay Account:** Obtain your `RAZORPAY_KEY_ID` and `RAZORPAY_KEY_SECRET` from the Razorpay dashboard.
3.  **GitHub Repository:** Push your code to a GitHub repository.

## Environment Variables

You must configure the following environment variables on your deployment platform:

| Variable | Description | Example |
| :--- | :--- | :--- |
| `NODE_ENV` | Set to `production` | `production` |
| `PORT` | The port the server will listen on (usually set by the platform) | `3000` |
| `ALLOWED_ORIGINS` | Comma-separated list of allowed origins for CORS | `https://your-app.onrender.com` |
| `JWT_SECRET` | A long, random string for signing JWT tokens | `your_super_secret_jwt_key` |
| `RAZORPAY_KEY_ID` | Your Razorpay API Key ID | `rzp_live_...` |
| `RAZORPAY_KEY_SECRET` | Your Razorpay API Key Secret | `...` |

## Deployment on Render

1.  **Create a New Web Service:**
    *   Connect your GitHub repository.
    *   **Runtime:** `Node`
    *   **Build Command:** `npm install && npm run build`
    *   **Start Command:** `npm start`
2.  **Configure Environment Variables:**
    *   Go to the "Environment" tab and add the variables listed above.
3.  **Firebase Configuration:**
    *   Since Render doesn't support easy file uploads for secrets, you should ensure your `firebase-applet-config.json` is either included in your repo (if safe/private) or you can modify `server.ts` to read Firebase config from environment variables.
    *   *Recommendation:* Add `FIREBASE_CONFIG` as an environment variable (JSON string) and parse it in `server.ts`.

## Deployment on Railway

1.  **New Project:**
    *   Deploy from GitHub repo.
2.  **Variables:**
    *   Add the environment variables in the "Variables" tab.
3.  **Build & Start:**
    *   Railway should automatically detect the `build` and `start` scripts in `package.json`.

## Firebase Admin SDK Note

The current setup uses `firebase-admin` which typically requires a service account key. In this environment, it's pre-configured. For production, you should:

1.  Download your Firebase Service Account JSON from the Firebase Console (Project Settings > Service Accounts).
2.  Set the `GOOGLE_APPLICATION_CREDENTIALS` environment variable to the path of this file, or initialize the SDK using the JSON object directly from an environment variable.

---

### Important: CORS Configuration

Make sure `ALLOWED_ORIGINS` matches your production URL exactly (e.g., `https://smartserve.up.railway.app`).
