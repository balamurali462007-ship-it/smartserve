import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import path from 'path';
import jwt from 'jsonwebtoken';
import { createServer as createViteServer } from 'vite';
import { WebSocketServer, WebSocket } from 'ws';
import { createServer } from 'http';
import Razorpay from 'razorpay';
import crypto from 'crypto';
import dotenv from 'dotenv';
import admin from 'firebase-admin';

dotenv.config();

// Initialize Firebase Admin
if (!admin.apps.length) {
  const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (serviceAccount) {
    try {
      const parsedAccount = JSON.parse(serviceAccount);
      admin.initializeApp({
        credential: admin.credential.cert(parsedAccount)
      });
    } catch (e) {
      console.error('Failed to parse FIREBASE_SERVICE_ACCOUNT:', e);
      admin.initializeApp();
    }
  } else {
    admin.initializeApp();
  }
}
const db = admin.firestore();

const JWT_SECRET = process.env.JWT_SECRET || 'your_super_secret_key_123';

// --- Firestore Error Handling ---
enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: any;
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      // In the backend, we don't have a current user in the same way as the frontend SDK
      // but we can log that it's a backend operation
      source: 'backend'
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// --- Razorpay Setup ---
let razorpay: Razorpay | null = null;
const getRazorpay = () => {
  if (!razorpay) {
    const keyId = process.env.RAZORPAY_KEY_ID;
    const keySecret = process.env.RAZORPAY_KEY_SECRET;
    if (!keyId || !keySecret) {
      console.warn('Razorpay keys missing. Payments will be simulated.');
      return null;
    }
    razorpay = new Razorpay({ key_id: keyId, key_secret: keySecret });
  }
  return razorpay;
};

interface AuthRequest extends Request {
  user?: {
    id: string;
    email: string;
    role: 'USER' | 'WORKER';
  };
}

async function startServer() {
  const app = express();
  const server = createServer(app);
  const wss = new WebSocketServer({ server });
  const PORT = process.env.PORT || 3000;

  app.use(cors({
    origin: process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',') : '*',
    credentials: true
  }));
  app.use(express.json());

  // --- WebSocket Management ---
  const clients = new Map<string, WebSocket>();

  wss.on('connection', (ws, req) => {
    let userId: string | null = null;

    ws.on('message', async (message) => {
      try {
        const data = JSON.parse(message.toString());
        if (data.type === 'AUTH') {
          const token = data.token;
          jwt.verify(token, JWT_SECRET, (err: any, decoded: any) => {
            if (!err && decoded) {
              userId = decoded.id;
              clients.set(userId!, ws);
              console.log(`User ${userId} connected via WebSocket`);
            }
          });
        } else if (data.type === 'LOCATION_UPDATE') {
          if (userId && userId.startsWith('worker_')) {
            const { jobId, location } = data;
            const jobDoc = await db.collection('jobs').doc(jobId).get();
            const job = jobDoc.data();
            if (job && job.workerId === userId) {
              // Update worker's current location in Firestore
              await db.collection('users').doc(userId).update({ location });
              // Broadcast to the customer assigned to this job
              broadcastToUser(job.userId, { type: 'LOCATION_UPDATE', jobId, location });
            }
          }
        }
      } catch (e) {
        console.error('WS Message Error:', e);
      }
    });

    ws.on('close', () => {
      if (userId) {
        clients.delete(userId);
        console.log(`User ${userId} disconnected from WebSocket`);
      }
    });
  });

  const broadcastToUser = (userId: string, data: any) => {
    const client = clients.get(userId);
    if (client && client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify(data));
    }
  };

  const broadcastToAllWorkers = async (data: any) => {
    try {
      const workersSnapshot = await db.collection('users').where('role', '==', 'WORKER').get();
      workersSnapshot.forEach(doc => {
        const workerId = doc.id;
        const ws = clients.get(workerId);
        if (ws && ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify(data));
        }
      });
    } catch (error) {
      console.error('Broadcast to workers error:', error);
    }
  };

  // --- Middleware ---
  const authenticateToken = (req: AuthRequest, res: Response, next: NextFunction) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) return res.status(401).json({ error: 'Access denied. No token provided.' });

    jwt.verify(token, JWT_SECRET, (err: any, user: any) => {
      if (err) return res.status(403).json({ error: 'Invalid or expired token.' });
      req.user = user;
      next();
    });
  };

  const authorizeRole = (role: 'USER' | 'WORKER') => {
    return (req: AuthRequest, res: Response, next: NextFunction) => {
      if (req.user?.role !== role) {
        return res.status(403).json({ error: `Forbidden. Requires ${role} role.` });
      }
      next();
    };
  };

  // --- 1. Auth Service ---
  app.post('/api/auth/register', async (req, res) => {
    const { name, email, password, role } = req.body; // role: 'USER' or 'WORKER'
    const targetRole = role === 'WORKER' ? 'WORKER' : 'USER';
    
    try {
      const id = `${targetRole.toLowerCase()}_${Date.now()}`;
      const newUser: any = { 
        id, 
        name, 
        email, 
        password, // In real app, hash this!
        role: targetRole,
        createdAt: new Date().toISOString()
      };

      if (targetRole === 'WORKER') {
        newUser.skill = req.body.skill || 'General';
        newUser.rating = 5.0;
        newUser.available = true;
      }

      await db.collection('users').doc(id).set(newUser);

      const token = jwt.sign({ id, email, role: targetRole }, JWT_SECRET, { expiresIn: '24h' });
      res.status(201).json({ message: 'Registration successful', user: { id, name, email, role: targetRole }, token });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'users');
      res.status(500).json({ error: 'Registration failed' });
    }
  });

  app.post('/api/auth/login', async (req, res) => {
    const { email, password } = req.body;
    try {
      const usersSnapshot = await db.collection('users').where('email', '==', email).where('password', '==', password).limit(1).get();
      
      if (usersSnapshot.empty) return res.status(401).json({ error: 'Invalid email or password' });

      const account = usersSnapshot.docs[0].data();
      const token = jwt.sign({ id: account.id, email: account.email, role: account.role }, JWT_SECRET, { expiresIn: '24h' });
      res.json({ 
        message: 'Login successful', 
        user: { id: account.id, name: account.name, email: account.email, role: account.role }, 
        token 
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, 'users');
      res.status(500).json({ error: 'Login failed' });
    }
  });

  // --- 2. Job Service (Protected) ---
  app.post('/api/jobs/request-job', authenticateToken, authorizeRole('USER'), async (req: AuthRequest, res) => {
    const { title, description, location, estimatedAmount } = req.body;
    try {
      const id = `job_${Date.now()}`;
      const newJob = { 
        id, 
        userId: req.user?.id, 
        title, 
        description, 
        location, 
        estimatedAmount: estimatedAmount || 300,
        status: 'PENDING',
        createdAt: new Date().toISOString()
      };
      
      await db.collection('jobs').doc(id).set(newJob);

      // Notify all workers about new job
      broadcastToAllWorkers({ type: 'NEW_JOB', job: newJob });

      res.status(201).json(newJob);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'jobs');
      res.status(500).json({ error: 'Job request failed' });
    }
  });

  app.get('/api/jobs', authenticateToken, async (req: AuthRequest, res) => {
    try {
      if (req.user?.role === 'USER') {
        const snapshot = await db.collection('jobs').where('userId', '==', req.user?.id).get();
        const jobsList = snapshot.docs.map(doc => doc.data());
        return res.json(jobsList);
      } else {
        // Workers see pending jobs OR jobs assigned to them
        const [pending, assigned] = await Promise.all([
          db.collection('jobs').where('status', '==', 'PENDING').get(),
          db.collection('jobs').where('workerId', '==', req.user?.id).get()
        ]);
        const jobsList = [...pending.docs, ...assigned.docs].map(doc => doc.data());
        // Remove duplicates
        const uniqueJobs = Array.from(new Map(jobsList.map(item => [item.id, item])).values());
        return res.json(uniqueJobs);
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, 'jobs');
      res.status(500).json({ error: 'Failed to fetch jobs' });
    }
  });

  app.patch('/api/jobs/:id/status', authenticateToken, async (req: AuthRequest, res) => {
    const { id } = req.params;
    const { status } = req.body;
    try {
      const jobDoc = await db.collection('jobs').doc(id).get();
      if (!jobDoc.exists) return res.status(404).json({ error: 'Job not found' });
      
      const job = jobDoc.data()!;
      
      // Basic security: only assigned worker or the user can update status
      if (job.userId !== req.user?.id && job.workerId !== req.user?.id) {
        return res.status(403).json({ error: 'Unauthorized to update this job' });
      }

      await db.collection('jobs').doc(id).update({ 
        status, 
        updatedAt: new Date().toISOString() 
      });

      const updatedJob = { ...job, status, updatedAt: new Date().toISOString() };

      // Notify both parties about status change
      broadcastToUser(job.userId, { type: 'JOB_STATUS_UPDATE', job: updatedJob });
      if (job.workerId) {
        broadcastToUser(job.workerId, { type: 'JOB_STATUS_UPDATE', job: updatedJob });
      }

      res.json(updatedJob);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `jobs/${id}`);
      res.status(500).json({ error: 'Failed to update job status' });
    }
  });

  // --- 3. Worker Service (Protected) ---
  app.get('/api/workers/nearby-workers', authenticateToken, async (req, res) => {
    const { skill } = req.query;
    try {
      let query = db.collection('users').where('role', '==', 'WORKER').where('available', '==', true);
      if (skill) {
        query = query.where('skill', '==', skill);
      }
      
      const snapshot = await query.get();
      const nearby = snapshot.docs.map(doc => {
        const data = doc.data();
        const { password, ...w } = data; // Don't return passwords
        return w;
      });
      res.json(nearby);
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, 'users');
      res.status(500).json({ error: 'Failed to fetch workers' });
    }
  });

  app.post('/api/workers/accept-job', authenticateToken, authorizeRole('WORKER'), async (req: AuthRequest, res) => {
    const { jobId } = req.body;
    try {
      const jobRef = db.collection('jobs').doc(jobId);
      const workerRef = db.collection('users').doc(req.user?.id!);
      
      const [jobDoc, workerDoc] = await Promise.all([jobRef.get(), workerRef.get()]);
      
      if (!jobDoc.exists || !workerDoc.exists) return res.status(404).json({ error: 'Job or Worker not found' });
      
      const job = jobDoc.data()!;
      const worker = workerDoc.data()!;
      
      if (job.status !== 'PENDING') return res.status(400).json({ error: 'Job is no longer available' });
      
      await Promise.all([
        jobRef.update({ status: 'ASSIGNED', workerId: worker.id }),
        workerRef.update({ available: false })
      ]);

      const updatedJob = { ...job, status: 'ASSIGNED', workerId: worker.id };

      // Notify customer that worker accepted
      broadcastToUser(job.userId, { 
        type: 'JOB_ACCEPTED', 
        job: updatedJob, 
        worker: { 
          id: worker.id, 
          name: worker.name, 
          skill: worker.skill, 
          rating: worker.rating,
          location: worker.location
        } 
      });
      
      res.json({ message: 'Job accepted successfully', job: updatedJob });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'jobs/accept');
      res.status(500).json({ error: 'Failed to accept job' });
    }
  });

  // --- 4. Payment Service (Protected) ---
  app.post('/api/payments/create-order', authenticateToken, authorizeRole('USER'), async (req: AuthRequest, res) => {
    const { amount, jobId } = req.body;
    const rzp = getRazorpay();
    
    if (!rzp) {
      // Fallback for simulation
      return res.json({ id: `order_sim_${Date.now()}`, amount: amount * 100, currency: 'INR', simulated: true });
    }

    try {
      const order = await rzp.orders.create({
        amount: Math.round(amount * 100), // Razorpay expects amount in paise
        currency: 'INR',
        receipt: `receipt_${jobId}`,
        notes: { jobId, userId: req.user?.id }
      });
      res.json(order);
    } catch (error: any) {
      console.error('Razorpay Order Error:', error);
      res.status(500).json({ error: 'Failed to create payment order' });
    }
  });

  app.post('/api/payments/verify', authenticateToken, authorizeRole('USER'), (req: AuthRequest, res) => {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;
    const keySecret = process.env.RAZORPAY_KEY_SECRET;

    if (!keySecret) {
      return res.json({ status: 'ok', simulated: true });
    }

    const hmac = crypto.createHmac('sha256', keySecret);
    hmac.update(razorpay_order_id + "|" + razorpay_payment_id);
    const generated_signature = hmac.digest('hex');

    if (generated_signature === razorpay_signature) {
      res.json({ status: 'ok' });
    } else {
      res.status(400).json({ error: 'Invalid signature' });
    }
  });

  app.post('/api/payments/pay', authenticateToken, authorizeRole('USER'), async (req: AuthRequest, res) => {
    const { jobId, amount, method, razorpay_payment_id } = req.body;
    try {
      const jobRef = db.collection('jobs').doc(jobId);
      const jobDoc = await jobRef.get();
      
      if (!jobDoc.exists || jobDoc.data()?.userId !== req.user?.id) {
        return res.status(404).json({ error: 'Job not found or unauthorized' });
      }

      const id = razorpay_payment_id || `pay_${Date.now()}`;
      const payment = {
        id,
        jobId,
        userId: req.user?.id,
        amount,
        method,
        status: 'PAID',
        createdAt: new Date().toISOString()
      };
      
      await db.collection('payments').doc(id).set(payment);
      await jobRef.update({ status: 'COMPLETED' });

      const job: any = { ...jobDoc.data(), status: 'COMPLETED' };

      // Notify worker about payment
      if (job.workerId) {
        broadcastToUser(job.workerId, { type: 'PAYMENT_RECEIVED', job, payment });
      }
      
      res.json({ message: 'Payment processed successfully', payment });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'payments');
      res.status(500).json({ error: 'Payment failed' });
    }
  });

  // --- 5. Rating Service (Protected) ---
  app.post('/api/ratings/rate-worker', authenticateToken, authorizeRole('USER'), async (req: AuthRequest, res) => {
    const { jobId, workerId, score, comment } = req.body;
    try {
      const jobDoc = await db.collection('jobs').doc(jobId).get();
      if (!jobDoc.exists || jobDoc.data()?.userId !== req.user?.id) {
        return res.status(404).json({ error: 'Job not found or unauthorized' });
      }

      const id = `rate_${Date.now()}`;
      const rating = {
        id,
        jobId,
        workerId,
        userId: req.user?.id,
        score,
        comment,
        createdAt: new Date().toISOString()
      };
      
      await db.collection('ratings').doc(id).set(rating);
      
      // Update worker rating
      const workerRef = db.collection('users').doc(workerId);
      const workerDoc = await workerRef.get();
      if (workerDoc.exists) {
        const worker = workerDoc.data()!;
        const newRating = Number(((worker.rating + score) / 2).toFixed(1));
        await workerRef.update({ rating: newRating });
      }
      
      res.json({ message: 'Feedback submitted', rating });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'ratings');
      res.status(500).json({ error: 'Rating failed' });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  server.listen(Number(PORT), '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
