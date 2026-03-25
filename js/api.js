const getApiBaseUrl = () => {
  if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    return '/api';
  }
  // For production, if the frontend is served by the backend, /api is still correct.
  // If deployed separately, you might want to use a full URL from an env var.
  return '/api';
};

const API_BASE_URL = getApiBaseUrl();

const api = {
  // --- Auth ---
  register: async (name, email, password, role = 'USER', skill = '') => {
    const response = await fetch(`${API_BASE_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, password, role, skill })
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Registration failed');
    if (data.token) localStorage.setItem('smartserve_token', data.token);
    if (data.user) localStorage.setItem('smartserve_user', JSON.stringify(data.user));
    return data;
  },

  login: async (email, password) => {
    const response = await fetch(`${API_BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Login failed');
    if (data.token) localStorage.setItem('smartserve_token', data.token);
    if (data.user) localStorage.setItem('smartserve_user', JSON.stringify(data.user));
    return data;
  },

  logout: () => {
    localStorage.removeItem('smartserve_token');
    localStorage.removeItem('smartserve_user');
    window.location.href = '/index.html';
  },

  getToken: () => localStorage.getItem('smartserve_token'),
  getUser: () => JSON.parse(localStorage.getItem('smartserve_user') || 'null'),

  getHeaders: () => {
    const token = api.getToken();
    return {
      'Content-Type': 'application/json',
      'Authorization': token ? `Bearer ${token}` : ''
    };
  },

  // --- Jobs ---
  requestJob: async (title, description, location) => {
    const response = await fetch(`${API_BASE_URL}/jobs/request-job`, {
      method: 'POST',
      headers: api.getHeaders(),
      body: JSON.stringify({ title, description, location })
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Job request failed');
    return data;
  },

  getJobs: async (userId = null) => {
    let url = `${API_BASE_URL}/jobs`;
    if (userId) url += `?userId=${userId}`;
    
    const response = await fetch(url, {
      headers: api.getHeaders()
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Failed to fetch jobs');
    return data;
  },

  updateJobStatus: async (jobId, status) => {
    const response = await fetch(`${API_BASE_URL}/jobs/${jobId}/status`, {
      method: 'PATCH',
      headers: api.getHeaders(),
      body: JSON.stringify({ status })
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Failed to update status');
    return data;
  },

  // --- Workers ---
  getNearbyWorkers: async (skill = '') => {
    let url = `${API_BASE_URL}/workers/nearby-workers`;
    if (skill) url += `?skill=${skill}`;
    
    const response = await fetch(url, {
      headers: api.getHeaders()
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Failed to fetch workers');
    return data;
  },

  acceptJob: async (jobId) => {
    const response = await fetch(`${API_BASE_URL}/workers/accept-job`, {
      method: 'POST',
      headers: api.getHeaders(),
      body: JSON.stringify({ jobId })
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Failed to accept job');
    return data;
  },

  // --- Payments ---
  pay: async (jobId, amount, method, razorpay_payment_id = null) => {
    const response = await fetch(`${API_BASE_URL}/payments/pay`, {
      method: 'POST',
      headers: api.getHeaders(),
      body: JSON.stringify({ jobId, amount, method, razorpay_payment_id })
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Payment failed');
    return data;
  },

  createRazorpayOrder: async (jobId, amount) => {
    const response = await fetch(`${API_BASE_URL}/payments/create-order`, {
      method: 'POST',
      headers: api.getHeaders(),
      body: JSON.stringify({ jobId, amount })
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Order creation failed');
    return data;
  },

  verifyRazorpayPayment: async (paymentData) => {
    const response = await fetch(`${API_BASE_URL}/payments/verify`, {
      method: 'POST',
      headers: api.getHeaders(),
      body: JSON.stringify(paymentData)
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Verification failed');
    return data;
  },

  // --- Ratings ---
  rateWorker: async (jobId, workerId, score, comment) => {
    const response = await fetch(`${API_BASE_URL}/ratings/rate-worker`, {
      method: 'POST',
      headers: api.getHeaders(),
      body: JSON.stringify({ jobId, workerId, score, comment })
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Rating failed');
    return data;
  },

  // --- AI Analysis (Gemini) ---
  analyzeProblem: async (description, imageBase64 = null) => {
    try {
      const { GoogleGenAI } = await import('@google/genai');
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

      let prompt = `Analyze the following home service problem and suggest the best type of worker (e.g., Plumber, Electrician, Carpenter, etc.) and provide a short summary of the likely issue.
      Problem: ${description}
      
      Return the result as JSON in this format:
      {
        "workerType": "Plumber",
        "summary": "Detected a leak in the kitchen sink area.",
        "estimatedAmount": 450
      }`;

      const parts = [{ text: prompt }];
      if (imageBase64) {
        parts.push({
          inlineData: {
            data: imageBase64.split(',')[1],
            mimeType: 'image/jpeg'
          }
        });
      }

      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: [{ role: 'user', parts }],
        config: {
          responseMimeType: "application/json"
        }
      });
      
      const text = response.text;
      if (text) {
        return JSON.parse(text);
      }
      throw new Error('Failed to parse AI response');
    } catch (error) {
      console.error('AI Analysis Error:', error);
      // Fallback to mock data if AI fails
      return {
        workerType: 'Plumber',
        summary: 'Detected a potential issue based on your description.',
        estimatedAmount: 300
      };
    }
  },

  // --- Real-time (WebSockets) ---
  ws: null,
  listeners: [],
  
  connectWS: () => {
    if (api.ws && api.ws.readyState === WebSocket.OPEN) return;

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}`;
    
    try {
      api.ws = new WebSocket(wsUrl);

      api.ws.onopen = () => {
        console.log('Connected to WebSocket server');
        const token = api.getToken();
        if (token) {
          api.ws.send(JSON.stringify({ type: 'AUTH', token }));
        }
      };

      api.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          console.log('WS Message Received:', data);
          api.listeners.forEach(l => {
            if (l.type === data.type || l.type === '*') {
              l.callback(data);
            }
          });
        } catch (e) {
          console.error('WS Message Parse Error:', e);
        }
      };

      api.ws.onclose = () => {
        console.log('Disconnected from WebSocket server. Reconnecting in 5s...');
        setTimeout(api.connectWS, 5000);
      };

      api.ws.onerror = (err) => {
        console.error('WebSocket Error:', err);
      };
    } catch (e) {
      console.error('WebSocket Connection Error:', e);
    }
  },

  on: (type, callback) => {
    api.listeners.push({ type, callback });
  },

  sendLocation: (jobId, location) => {
    if (api.ws && api.ws.readyState === WebSocket.OPEN) {
      api.ws.send(JSON.stringify({ type: 'LOCATION_UPDATE', jobId, location }));
    }
  }
};

window.smartServeApi = api;
