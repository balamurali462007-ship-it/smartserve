document.addEventListener('DOMContentLoaded', () => {
  const api = window.smartServeApi;

  // --- Auth Logic (Login/Register) ---
  const loginForm = document.getElementById('login-form');
  const registerForm = document.getElementById('register-form');
  const showRegister = document.getElementById('show-register');
  const showLogin = document.getElementById('show-login');
  const regRole = document.getElementById('reg-role');
  const regSkill = document.getElementById('reg-skill');

  if (showRegister) {
    showRegister.addEventListener('click', (e) => {
      e.preventDefault();
      loginForm.style.display = 'none';
      registerForm.style.display = 'block';
    });
  }

  if (showLogin) {
    showLogin.addEventListener('click', (e) => {
      e.preventDefault();
      registerForm.style.display = 'none';
      loginForm.style.display = 'block';
    });
  }

  if (regRole) {
    regRole.addEventListener('change', () => {
      regSkill.style.display = regRole.value === 'WORKER' ? 'block' : 'none';
    });
  }

  const loginBtn = document.getElementById('login-btn');
  if (loginBtn) {
    loginBtn.addEventListener('click', async () => {
      const email = document.getElementById('login-email').value;
      const password = document.getElementById('login-password').value;
      
      if (!email || !password) return alert('Please fill in all fields');
      
      try {
        loginBtn.disabled = true;
        loginBtn.innerText = 'Logging in...';
        const data = await api.login(email, password);
        window.location.href = data.user.role === 'WORKER' ? '/worker.html' : '/customer.html';
      } catch (error) {
        alert(error.message);
        loginBtn.disabled = false;
        loginBtn.innerText = 'Login';
      }
    });
  }

  const registerBtn = document.getElementById('register-btn');
  if (registerBtn) {
    registerBtn.addEventListener('click', async () => {
      const name = document.getElementById('reg-name').value;
      const email = document.getElementById('reg-email').value;
      const password = document.getElementById('reg-password').value;
      const role = document.getElementById('reg-role').value;
      const skill = document.getElementById('reg-skill').value;
      
      if (!name || !email || !password) return alert('Please fill in all fields');
      
      try {
        registerBtn.disabled = true;
        registerBtn.innerText = 'Registering...';
        const data = await api.register(name, email, password, role, skill);
        window.location.href = data.user.role === 'WORKER' ? '/worker.html' : '/customer.html';
      } catch (error) {
        alert(error.message);
        registerBtn.disabled = false;
        registerBtn.innerText = 'Register';
      }
    });
  }

  // --- Protected Route Check ---
  const currentUser = api.getUser();
  const JobStatus = {
    IDLE: 'IDLE',
    SEARCHING: 'SEARCHING',
    ASSIGNED: 'ASSIGNED',
    ON_THE_WAY: 'ON_THE_WAY',
    ARRIVED: 'ARRIVED',
    IN_PROGRESS: 'IN_PROGRESS',
    COMPLETED: 'COMPLETED',
    CANCELLED: 'CANCELLED'
  };

  const currentPath = window.location.pathname;

  if (currentPath === '/customer.html' || currentPath === '/worker.html') {
    if (!currentUser) {
      window.location.href = '/index.html';
      return;
    }
    
    // Role check
    if (currentPath === '/customer.html' && currentUser.role !== 'USER') {
      window.location.href = '/worker.html';
      return;
    }
    if (currentPath === '/worker.html' && currentUser.role !== 'WORKER') {
      window.location.href = '/customer.html';
      return;
    }
  }

  const logoutBtn = document.getElementById('logout-btn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', () => {
      api.logout();
      window.location.href = '/index.html';
    });
  }

  // Fetch real job history for customer
  const fetchCustomerJobHistory = async () => {
    const jobHistoryList = document.getElementById('job-history-list');
    if (!jobHistoryList || currentUser.role !== 'USER') return;

    try {
      const jobs = await api.getJobs();
      const completedJobs = jobs.filter(j => j.status === 'COMPLETED');
      
      if (completedJobs.length > 0) {
        jobHistoryList.innerHTML = '';
        completedJobs.forEach(job => {
          const item = document.createElement('div');
          item.className = 'job-item';
          item.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <div>
                <p style="font-weight: 600; margin-bottom: 0.25rem;">${job.title}</p>
                <p style="font-size: 0.75rem; color: #94a3b8;">${new Date(job.createdAt).toLocaleDateString()}</p>
              </div>
              <div style="text-align: right;">
                <p style="font-weight: 600; color: var(--accent-color);">₹${job.estimatedAmount}</p>
                <p style="font-size: 0.75rem; color: #10b981;">Completed</p>
              </div>
            </div>
          `;
          jobHistoryList.appendChild(item);
        });
      }
    } catch (error) {
      console.error('Failed to fetch job history:', error);
    }
  };

  if (currentPath === '/customer.html') {
    fetchCustomerJobHistory();
  }

  // --- Worker Dashboard Logic ---
  const initWorkerDashboard = async () => {
    const jobList = document.querySelector('.job-list');
    const earningsToday = document.getElementById('earnings-today');
    const jobsCompleted = document.getElementById('jobs-completed');
    const avgRating = document.getElementById('avg-rating');
    const workerNameEl = document.querySelector('.worker-profile h1 + p span');
    const workerImgEl = document.querySelector('.worker-img');

    if (currentUser) {
      if (workerNameEl) workerNameEl.innerText = currentUser.name;
      if (workerImgEl) workerImgEl.innerText = currentUser.name.charAt(0);
      if (avgRating) avgRating.innerText = `⭐ ${currentUser.rating || 4.8}`;
    }

    const fetchWorkerData = async () => {
      try {
        const jobs = await api.getJobs();
        
        // Update Stats
        const completedJobs = jobs.filter(j => j.status === 'COMPLETED');
        const todayCompleted = completedJobs.filter(j => new Date(j.updatedAt).toDateString() === new Date().toDateString());
        const totalEarnings = todayCompleted.reduce((sum, j) => sum + (j.estimatedAmount || 0), 0);
        
        if (earningsToday) earningsToday.innerText = `₹${totalEarnings}`;
        if (jobsCompleted) jobsCompleted.innerText = todayCompleted.length;

        // Update Current Job Section
        const currentJobSection = document.getElementById('current-job-section');
        const currentJobCard = document.getElementById('current-job-card');
        const activeJob = jobs.find(j => j.workerId === currentUser.id && j.status !== 'COMPLETED' && j.status !== 'CANCELLED');

        if (activeJob) {
          if (currentJobSection) currentJobSection.style.display = 'block';
          if (currentJobCard) {
            let actionBtn = '';
            switch (activeJob.status) {
              case 'ASSIGNED':
                actionBtn = `<button class="btn btn-primary status-update-btn" data-status="ON_THE_WAY">On the Way</button>`;
                break;
              case 'ON_THE_WAY':
                actionBtn = `<button class="btn btn-primary status-update-btn" data-status="ARRIVED">Arrived</button>`;
                break;
              case 'ARRIVED':
                actionBtn = `<button class="btn btn-primary status-update-btn" data-status="IN_PROGRESS">Start Work</button>`;
                break;
              case 'IN_PROGRESS':
                actionBtn = `<button class="btn btn-primary status-update-btn" data-status="COMPLETED">Complete Job</button>`;
                break;
            }

            currentJobCard.innerHTML = `
              <div class="job-info">
                <h4>${activeJob.title}</h4>
                <p>${activeJob.location} • ₹${activeJob.estimatedAmount}</p>
                <p style="font-size: 0.875rem; color: #94a3b8;">${activeJob.description}</p>
                <span class="status-badge status-${activeJob.status.toLowerCase()}" style="margin-top: 0.5rem;">${activeJob.status}</span>
              </div>
              <div class="job-actions" style="margin-top: 1rem;">
                ${actionBtn}
              </div>
            `;

            // Add listener for status update
            const updateBtn = currentJobCard.querySelector('.status-update-btn');
            if (updateBtn) {
              updateBtn.addEventListener('click', async () => {
                const newStatus = updateBtn.dataset.status;
                try {
                  updateBtn.disabled = true;
                  updateBtn.innerText = 'Updating...';
                  await api.updateJobStatus(activeJob.id, newStatus);
                  showToast('Status Updated', `Job status is now ${newStatus}`, '✅');
                  
                  // Start location simulation if worker is on the way
                  if (newStatus === 'ON_THE_WAY') {
                    startWorkerLocationSimulation(activeJob.id);
                  }
                  
                  fetchWorkerData();
                } catch (error) {
                  alert('Failed to update status: ' + error.message);
                  updateBtn.disabled = false;
                  updateBtn.innerText = newStatus;
                }
              });
            }
          }
        } else {
          if (currentJobSection) currentJobSection.style.display = 'none';
        }

        // Update Job List (Available Jobs)
        if (jobList) {
          jobList.innerHTML = '';
          const availableJobs = jobs.filter(j => j.status === 'PENDING');
          
          if (availableJobs.length === 0) {
            jobList.innerHTML = '<div class="empty-msg" style="width: 100%; grid-column: 1 / -1;">No new jobs available right now.</div>';
          } else {
            availableJobs.forEach(job => {
              const card = document.createElement('div');
              card.className = 'job-card';
              card.innerHTML = `
                <div class="job-info">
                  <h4>${job.title}</h4>
                  <p>${job.location} • ₹${job.estimatedAmount}</p>
                  <p style="font-size: 0.75rem; color: #94a3b8;">${job.description}</p>
                </div>
                <div class="job-actions">
                  <button class="btn btn-primary accept-job-btn" data-id="${job.id}" style="padding: 0.5rem 1rem; font-size: 0.875rem;">Accept</button>
                </div>
              `;
              jobList.appendChild(card);
            });

            // Add event listeners for accept buttons
            document.querySelectorAll('.accept-job-btn').forEach(btn => {
              btn.addEventListener('click', async () => {
                const jobId = btn.dataset.id;
                try {
                  btn.disabled = true;
                  btn.innerText = 'Accepting...';
                  await api.acceptJob(jobId);
                  showToast('Job Accepted', 'You have been assigned to this job.', '✅');
                  fetchWorkerData();
                } catch (error) {
                  alert('Failed to accept job: ' + error.message);
                  btn.disabled = false;
                  btn.innerText = 'Accept';
                }
              });
            });
          }
        }
      } catch (error) {
        console.error('Failed to fetch worker data:', error);
      }
    };

    const startWorkerLocationSimulation = (jobId) => {
      let progress = 0;
      const duration = 10000; // 10 seconds simulation
      const interval = 1000; // Update every second
      const stepsCount = duration / interval;
      
      const startCoords = currentUser.location ? [currentUser.location.lat, currentUser.location.lng] : [12.9800, 77.5800];
      const endCoords = [12.9716, 77.5946]; // Customer location
      
      const moveInterval = setInterval(() => {
        progress++;
        const ratio = progress / stepsCount;
        
        const currentLat = startCoords[0] + (endCoords[0] - startCoords[0]) * ratio;
        const currentLng = startCoords[1] + (endCoords[1] - startCoords[1]) * ratio;
        
        api.sendLocation(jobId, { lat: currentLat, lng: currentLng });
        
        if (progress >= stepsCount) {
          clearInterval(moveInterval);
        }
      }, interval);
    };

    // WebSocket Listeners for Worker
    api.on('NEW_JOB', (data) => {
      showToast('New Job Available', data.job.title, '🔔');
      addNotification('New Job', `A new ${data.job.title} request is available.`, '🔔');
      fetchWorkerData();
    });

    api.on('PAYMENT_RECEIVED', (data) => {
      showToast('Payment Received', `Received ₹${data.payment.amount} for ${data.job.title}`, '💰');
      addNotification('Payment Received', `₹${data.payment.amount} added to your earnings.`, '💰');
      fetchWorkerData();
    });

    api.on('JOB_STATUS_UPDATE', (data) => {
      if (data.job.workerId === currentUser.id) {
        fetchWorkerData();
      }
    });

    fetchWorkerData();
    setInterval(fetchWorkerData, 10000);
  };

  if (currentPath === '/worker.html') {
    initWorkerDashboard();
  }

  // Data Persistence Utility
  const Storage = {
    save: (key, data) => {
      localStorage.setItem(`smartserve_${key}`, JSON.stringify(data));
    },
    load: (key, defaultValue) => {
      const data = localStorage.getItem(`smartserve_${key}`);
      return data ? JSON.parse(data) : defaultValue;
    }
  };

  // Add smooth page transitions
  const buttons = document.querySelectorAll('.btn');
  
  buttons.forEach(button => {
    button.addEventListener('click', (e) => {
      const href = button.getAttribute('href');
      if (href && href !== '#') {
        e.preventDefault();
        
        // Add a simple exit animation effect
        document.body.style.transition = 'opacity 0.5s ease-out, transform 0.5s ease-out';
        document.body.style.opacity = '0';
        document.body.style.transform = 'translateY(-10px)';
        
        setTimeout(() => {
          window.location.href = href;
        }, 500);
      }
    });
  });

  // Subtle mouse move parallax effect for the glass card
  const card = document.querySelector('.glass-card');
  if (card) {
    document.addEventListener('mousemove', (e) => {
      const { clientX, clientY } = e;
      const { innerWidth, innerHeight } = window;
      
      const moveX = (clientX - innerWidth / 2) / 50;
      const moveY = (clientY - innerHeight / 2) / 50;
      
      card.style.transform = `translate(${moveX}px, ${moveY}px)`;
    });
  }

  // AI Analysis (Real Gemini API)
  const analyzeBtn = document.getElementById('analyze-btn');
  const analysisSection = document.getElementById('analysis-section');
  const loadingState = document.getElementById('loading-state');
  const resultState = document.getElementById('result-state');
  const problemDesc = document.getElementById('problem-desc');

  if (analyzeBtn) {
    analyzeBtn.addEventListener('click', async () => {
      const description = problemDesc.value.trim();
      if (!description) {
        showToast('Please describe your problem first.', 'error');
        return;
      }

      // Show analysis section and loading state
      analysisSection.classList.add('active');
      loadingState.style.display = 'block';
      resultState.style.display = 'none';
      
      // Disable button during analysis
      analyzeBtn.disabled = true;
      analyzeBtn.style.opacity = '0.5';
      analyzeBtn.innerText = 'Analyzing...';

      try {
        // Real AI Analysis
        const analysis = await api.analyzeProblem(description);
        
        // Create a job request on the backend
        const jobData = {
          title: analysis.workerType + ' Service',
          description: description,
          location: '123 Main St, City', // In a real app, this would come from geolocation
          skillRequired: analysis.workerType,
          estimatedAmount: analysis.estimatedAmount
        };
        
        const job = await api.requestJob(jobData);
        window.currentJobId = job.id;

        // Update UI with analysis results
        const workerSkillDisplay = document.getElementById('worker-skill');
        if (workerSkillDisplay) workerSkillDisplay.innerText = analysis.workerType;
        
        const analysisSummary = document.getElementById('analysis-summary');
        if (analysisSummary) analysisSummary.innerText = analysis.summary;

        // Show results
        loadingState.style.display = 'none';
        resultState.style.display = 'block';
        
        // Scroll to result
        resultState.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        
        // Start finding worker
        startFindingWorker(analysis.workerType);
      } catch (error) {
        console.error('Analysis failed:', error);
        showToast('AI Analysis failed. Please try again.', 'error');
      } finally {
        analyzeBtn.disabled = false;
        analyzeBtn.style.opacity = '1';
        analyzeBtn.innerText = 'Analyze Problem';
      }
    });
  }

  const findBestWorker = async (skill) => {
    try {
      const workers = await api.getNearbyWorkers(skill);
      if (workers.length === 0) return null;

      // Scoring system: (Rating * 0.7) + ((5 - Distance) * 0.3)
      return workers.sort((a, b) => {
        const scoreA = (a.rating * 0.7) + ((5 - (a.distance || 1)) * 0.3);
        const scoreB = (b.rating * 0.7) + ((5 - (b.distance || 1)) * 0.3);
        return scoreB - scoreA;
      })[0];
    } catch (error) {
      console.error('Failed to fetch workers:', error);
      return null;
    }
  };

  // Booking Flow Simulation with Map Tracking
  const bookBtn = document.getElementById('book-btn');
  const bookingStatus = document.getElementById('booking-status');
  const liveTracking = document.getElementById('live-tracking');
  const arrivalActions = document.getElementById('arrival-actions');
  const confirmArrivalBtn = document.getElementById('confirm-arrival-btn');
  const jobTimerContainer = document.getElementById('job-timer-container');
  const jobTimerDisplay = document.getElementById('job-timer');
  const workStartedMsg = document.getElementById('work-started-msg');
  const etaLabel = document.getElementById('eta-label');
  
  // Cancel & Reschedule Elements
  const bookingActions = document.getElementById('booking-actions');
  const cancelBookingBtn = document.getElementById('cancel-booking-btn');
  const rescheduleBtn = document.getElementById('reschedule-btn');
  const cancelModal = document.getElementById('cancel-modal');
  const confirmCancelBtn = document.getElementById('confirm-cancel-btn');
  const closeCancelModal = document.getElementById('close-cancel-modal');
  const rescheduleModal = document.getElementById('reschedule-modal');
  const submitRescheduleBtn = document.getElementById('submit-reschedule-btn');
  const closeRescheduleModal = document.getElementById('close-reschedule-modal');
  const rescheduleRequests = document.getElementById('reschedule-requests');
  
  // Invoice Elements
  const invoiceModal = document.getElementById('invoice-modal');
  const viewInvoiceBtn = document.getElementById('view-invoice-btn');
  const closeInvoiceBtn = document.getElementById('close-invoice-btn');
  const downloadInvoiceBtn = document.getElementById('download-invoice-btn');
  const shareInvoiceBtn = document.getElementById('share-invoice-btn');
  let finalTimeTaken = '00:00:00';

  // Load Razorpay Script
  const loadRazorpay = () => {
    return new Promise((resolve) => {
      const script = document.createElement('script');
      script.src = 'https://checkout.razorpay.com/v1/checkout.js';
      script.onload = () => resolve(true);
      script.onerror = () => resolve(false);
      document.body.appendChild(script);
    });
  };
  loadRazorpay();
  
  // Remove JobStatus from here as it's now global
  
  let currentJobStatus = JobStatus.IDLE;
  let timerInterval;
  let currentWorker = null;

  const validateTransition = (from, to) => {
    if (from === JobStatus.CANCELLED || from === JobStatus.COMPLETED) return false;
    if (to === JobStatus.CANCELLED) {
      // Cannot cancel after In Progress
      return from !== JobStatus.IN_PROGRESS && from !== JobStatus.COMPLETED;
    }
    
    const flow = [JobStatus.IDLE, JobStatus.SEARCHING, JobStatus.ASSIGNED, JobStatus.ON_THE_WAY, JobStatus.ARRIVED, JobStatus.IN_PROGRESS, JobStatus.COMPLETED];
    const fromIdx = flow.indexOf(from);
    const toIdx = flow.indexOf(to);
    
    return toIdx === fromIdx + 1;
  };

  const updateTimelineUI = (newStatus) => {
    const statusToStepId = {
      [JobStatus.SEARCHING]: 'step-1',
      [JobStatus.ASSIGNED]: 'step-2',
      [JobStatus.ON_THE_WAY]: 'step-3',
      [JobStatus.ARRIVED]: 'step-4',
      [JobStatus.IN_PROGRESS]: 'step-5',
      [JobStatus.COMPLETED]: 'step-6',
      [JobStatus.CANCELLED]: 'step-7'
    };

    const flow = [JobStatus.SEARCHING, JobStatus.ASSIGNED, JobStatus.ON_THE_WAY, JobStatus.ARRIVED, JobStatus.IN_PROGRESS, JobStatus.COMPLETED];
    const currentIdx = flow.indexOf(newStatus);

    Object.keys(statusToStepId).forEach(status => {
      const stepId = statusToStepId[status];
      const stepEl = document.getElementById(stepId);
      if (!stepEl) return;

      if (newStatus === JobStatus.CANCELLED) {
        if (status === JobStatus.CANCELLED) {
          stepEl.style.display = 'flex';
          stepEl.classList.add('active');
        } else {
          stepEl.classList.remove('active');
          // Keep completed steps as completed
        }
      } else {
        const statusIdx = flow.indexOf(status);
        if (status === newStatus) {
          stepEl.classList.add('active');
          stepEl.classList.remove('completed');
        } else if (statusIdx !== -1 && statusIdx < currentIdx) {
          stepEl.classList.remove('active');
          stepEl.classList.add('completed');
        } else {
          stepEl.classList.remove('active');
          stepEl.classList.remove('completed');
        }
        
        // Hide cancelled step if not cancelled
        if (status === JobStatus.CANCELLED) {
          stepEl.style.display = 'none';
        }
      }
    });
  };

  const updateButtonsState = (status) => {
    if (bookBtn) {
      const canBook = status === JobStatus.IDLE || status === JobStatus.CANCELLED || status === JobStatus.COMPLETED;
      bookBtn.disabled = !canBook;
      bookBtn.style.opacity = canBook ? '1' : '0.5';
      if (status === JobStatus.SEARCHING) {
        bookBtn.innerText = 'Booking...';
      } else {
        bookBtn.innerText = 'Book Now';
      }
    }

    if (cancelBookingBtn) {
      const canCancel = [JobStatus.SEARCHING, JobStatus.ASSIGNED, JobStatus.ON_THE_WAY, JobStatus.ARRIVED].includes(status);
      cancelBookingBtn.disabled = !canCancel;
      cancelBookingBtn.style.opacity = canCancel ? '1' : '0.5';
    }

    if (rescheduleBtn) {
      const canReschedule = [JobStatus.SEARCHING, JobStatus.ASSIGNED, JobStatus.ON_THE_WAY, JobStatus.ARRIVED].includes(status);
      rescheduleBtn.disabled = !canReschedule;
      rescheduleBtn.style.opacity = canReschedule ? '1' : '0.5';
    }

    if (confirmArrivalBtn) {
      const canConfirm = status === JobStatus.ARRIVED;
      confirmArrivalBtn.disabled = !canConfirm;
      confirmArrivalBtn.style.opacity = canConfirm ? '1' : '0.5';
      confirmArrivalBtn.innerText = status === JobStatus.IN_PROGRESS || status === JobStatus.COMPLETED ? 'Confirmed' : 'Confirm Worker Arrival';
    }
  };

  const updateJobStatus = async (newStatus) => {
    if (!validateTransition(currentJobStatus, newStatus)) {
      console.warn(`Invalid transition from ${currentJobStatus} to ${newStatus}`);
      return;
    }

    // Update on backend if we have a job ID
    if (window.currentJobId) {
      try {
        await api.updateJobStatus(window.currentJobId, newStatus);
      } catch (error) {
        console.error('Failed to update job status on backend:', error);
        // We continue with UI update for demo purposes, but in real app we might want to stop
      }
    }

    currentJobStatus = newStatus;
    updateTimelineUI(newStatus);
    updateButtonsState(newStatus);
    handleStatusSideEffects(newStatus);
  };

  const handleStatusSideEffects = (status) => {
    const workerName = currentWorker ? currentWorker.name : 'Raj Kumar';

    switch (status) {
      case JobStatus.SEARCHING:
        bookingStatus.style.display = 'block';
        if (bookingActions) bookingActions.style.display = 'grid';
        break;
      case JobStatus.ASSIGNED:
        showToast('Worker Assigned', `${workerName} has been assigned to your request.`, '👷');
        addNotification('Worker Assigned', `${workerName} (Plumber) is coming to help you.`, '👷');
        liveTracking.style.display = 'block';
        initMap();
        setTimeout(() => liveTracking.scrollIntoView({ behavior: 'smooth', block: 'center' }), 500);
        // Removed auto-transition to ON_THE_WAY
        break;
      case JobStatus.ON_THE_WAY:
        showToast('On the way', 'Worker is moving towards your location.', '🚗');
        addNotification('On the way', `${workerName} is 1.2km away from your home.`, '🚗');
        animateWorkerMovement();
        // Removed auto-transition to ARRIVED
        break;
      case JobStatus.ARRIVED:
        showToast('Worker Arrived', `${workerName} has reached your location.`, '📍');
        addNotification('Worker Arrived', 'Your service provider is at your doorstep.', '📍');
        arrivalActions.style.display = 'block';
        arrivalActions.scrollIntoView({ behavior: 'smooth', block: 'center' });
        break;
      case JobStatus.IN_PROGRESS:
        arrivalActions.style.display = 'none';
        if (bookingActions) bookingActions.style.display = 'none';
        jobTimerContainer.style.display = 'block';
        workStartedMsg.style.display = 'block';
        startJobTimer();
        // Removed auto-transition to COMPLETED
        break;
      case JobStatus.COMPLETED:
        completeWork();
        break;
      case JobStatus.CANCELLED:
        bookingStatus.style.display = 'block';
        bookingActions.style.display = 'none';
        liveTracking.style.display = 'none';
        arrivalActions.style.display = 'none';
        jobTimerContainer.style.display = 'none';
        showToast('Booking Cancelled', 'Your service request has been cancelled.', '❌');
        addNotification('Cancelled', 'You cancelled your booking.', '❌');
        break;
    }
  };
  
  // Billing Constants
  const BASE_PRICE = 300;
  const RATE_PER_MINUTE = 5;
  const PLATFORM_FEE = 20;
  let currentServiceCost = BASE_PRICE;
  let totalBillAmount = BASE_PRICE + PLATFORM_FEE;

  // Map Variables
  let map, userMarker, workerMarker, routeLine;
  const userCoords = [12.9716, 77.5946]; // Bangalore center
  const workerStartCoords = [12.9800, 77.5800];

  const initMap = () => {
    if (map) return;
    
    map = L.map('map', {
      zoomControl: true,
      attributionControl: false
    }).setView(userCoords, 14);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);

    // Custom Icons
    const userIcon = L.divIcon({
      className: 'custom-marker user-marker-icon',
      html: '🏠',
      iconSize: [40, 40],
      iconAnchor: [20, 20]
    });

    const workerIcon = L.divIcon({
      className: 'custom-marker worker-marker-icon',
      html: '👷',
      iconSize: [40, 40],
      iconAnchor: [20, 20]
    });

    userMarker = L.marker(userCoords, { icon: userIcon }).addTo(map);
    workerMarker = L.marker(workerStartCoords, { icon: workerIcon }).addTo(map);
    
    routeLine = L.polyline([workerStartCoords, userCoords], {
      color: '#3b82f6',
      weight: 4,
      opacity: 0.6,
      dashArray: '10, 10'
    }).addTo(map);

    map.fitBounds(routeLine.getBounds(), { padding: [50, 50] });
  };

  if (bookBtn) {
    bookBtn.addEventListener('click', async () => {
      const searchingOverlay = document.getElementById('searching-overlay');
      const matchStatus = document.getElementById('match-status');
      const bestMatchBadge = document.getElementById('best-match-badge');
      
      // Show searching overlay
      if (searchingOverlay) searchingOverlay.style.display = 'flex';
      
      // Simulate matching process
      const statuses = [
        "Analyzing rating and distance...",
        "Checking worker availability...",
        "Optimizing for best experience...",
        "Matching with top-rated professional..."
      ];
      
      let statusIdx = 0;
      const statusInterval = setInterval(() => {
        if (matchStatus) matchStatus.innerText = statuses[statusIdx % statuses.length];
        statusIdx++;
      }, 800);

      try {
        // Find best worker (Plumber)
        const bestWorker = await findBestWorker('Plumber');
        currentWorker = bestWorker;
        
        setTimeout(() => {
          clearInterval(statusInterval);
          
          if (bestWorker) {
            // Update UI with matched worker
            document.getElementById('worker-name').innerText = bestWorker.name;
            document.getElementById('worker-avatar').innerText = bestWorker.avatar || bestWorker.name.charAt(0);
            document.getElementById('worker-skill').innerText = bestWorker.skill;
            document.getElementById('worker-rating-display').innerText = `⭐ ${bestWorker.rating}`;
            document.getElementById('worker-distance-display').innerText = `📍 ${bestWorker.distance || 1} km`;
            
            if (bestMatchBadge) bestMatchBadge.style.display = 'block';
          }

          if (searchingOverlay) searchingOverlay.style.display = 'none';

          // Reset state if re-booking
          clearInterval(timerInterval);
          jobTimerDisplay.innerText = '00:00:00';
          jobTimerContainer.style.display = 'none';
          arrivalActions.style.display = 'none';
          workStartedMsg.style.display = 'none';
          
          updateJobStatus(JobStatus.SEARCHING);
          
          // Automatically move to ASSIGNED after a short delay
          setTimeout(() => updateJobStatus(JobStatus.ASSIGNED), 2000);
        }, 3500);
      } catch (error) {
        clearInterval(statusInterval);
        if (searchingOverlay) searchingOverlay.style.display = 'none';
        alert('Failed to find worker: ' + error.message);
      }
    });
  }

  const animateWorkerMovement = () => {
    let progress = 0;
    const duration = 8000; // 8 seconds for real movement
    const interval = 50;
    const stepsCount = duration / interval;
    
    const moveTimer = setInterval(() => {
      progress++;
      const ratio = progress / stepsCount;
      
      const currentLat = workerStartCoords[0] + (userCoords[0] - workerStartCoords[0]) * ratio;
      const currentLng = workerStartCoords[1] + (userCoords[1] - workerStartCoords[1]) * ratio;
      
      const currentPos = [currentLat, currentLng];
      workerMarker.setLatLng(currentPos);
      routeLine.setLatLngs([currentPos, userCoords]);

      // Update ETA
      const remainingRatio = 1 - ratio;
      const etaMinutes = Math.ceil(remainingRatio * 15); // Max 15 mins
      if (etaLabel) {
        etaLabel.innerText = etaMinutes > 0 ? `Arriving in ${etaMinutes} mins` : "Arrived";
      }
      
      if (progress >= stepsCount) {
        clearInterval(moveTimer);
        updateJobStatus(JobStatus.ARRIVED);
      }
    }, interval);
  };

  if (confirmArrivalBtn) {
    confirmArrivalBtn.addEventListener('click', () => {
      updateJobStatus(JobStatus.IN_PROGRESS);
    });
  }

  const startJobTimer = () => {
    let seconds = 0;
    const liveCostDisplay = document.getElementById('live-cost');
    
    timerInterval = setInterval(() => {
      seconds++;
      const hrs = Math.floor(seconds / 3600).toString().padStart(2, '0');
      const mins = Math.floor((seconds % 3600) / 60).toString().padStart(2, '0');
      const secs = (seconds % 60).toString().padStart(2, '0');
      jobTimerDisplay.innerText = `${hrs}:${mins}:${secs}`;
      
      // Calculate live cost
      const elapsedMinutes = seconds / 60;
      currentServiceCost = BASE_PRICE + (elapsedMinutes * RATE_PER_MINUTE);
      if (liveCostDisplay) {
        liveCostDisplay.innerText = `₹${currentServiceCost.toFixed(2)}`;
      }
    }, 1000);
  };

  const completeWork = async () => {
    clearInterval(timerInterval);
    finalTimeTaken = jobTimerDisplay.innerText;
    
    // Finalize billing
    totalBillAmount = currentServiceCost + PLATFORM_FEE;
    
    // Update job on backend
    if (window.currentJobId) {
      try {
        await api.updateJobStatus(window.currentJobId, 'COMPLETED', {
          amount: totalBillAmount,
          timeTaken: finalTimeTaken
        });
      } catch (error) {
        console.error('Failed to update job status on backend:', error);
      }
    }
    
    updateWorkerDashboard();

    // Update Payment Modal with final bill
    const billServiceCost = document.getElementById('bill-service-cost');
    const billTotalAmount = document.getElementById('bill-total-amount');
    const successFinalAmount = document.getElementById('success-final-amount');
    const successWorkerName = document.getElementById('success-worker-name');
    const payNowBtn = document.getElementById('pay-now-btn');
    
    if (billServiceCost) billServiceCost.innerText = `₹${currentServiceCost.toFixed(2)}`;
    if (billTotalAmount) billTotalAmount.innerText = `₹${totalBillAmount.toFixed(2)}`;
    if (successFinalAmount) successFinalAmount.innerText = `₹${totalBillAmount.toFixed(2)}`;
    if (successWorkerName && currentWorker) successWorkerName.innerText = currentWorker.name;
    if (payNowBtn) payNowBtn.innerText = `Pay ₹${totalBillAmount.toFixed(2)}`;

    bookBtn.innerText = 'Work Completed Successfully';
    bookBtn.style.background = '#10b981';
    bookBtn.style.opacity = '1';
    
    workStartedMsg.innerText = 'Work Completed';

    showToast('Job Completed', 'Work has been finished successfully.', '✅');
    addNotification('Job Completed', 'Thank you for using SmartServe. Please complete the payment.', '✅');
    
    // Populate Invoice Data
    const invoiceWorkerName = document.getElementById('invoice-worker-name');
    const invoiceJobType = document.getElementById('invoice-job-type');
    const invoiceTimeTaken = document.getElementById('invoice-time-taken');
    const invoiceServiceFee = document.getElementById('invoice-service-fee');
    const invoiceTotalAmount = document.getElementById('invoice-total-amount');
    const invoicePaymentMethod = document.getElementById('invoice-payment-method');
    const invoiceDate = document.getElementById('invoice-date');

    if (invoiceWorkerName && currentWorker) invoiceWorkerName.innerText = currentWorker.name;
    if (invoiceJobType && currentWorker) invoiceJobType.innerText = currentWorker.skill;
    if (invoiceTimeTaken) invoiceTimeTaken.innerText = finalTimeTaken;
    if (invoiceServiceFee) invoiceServiceFee.innerText = `₹${(currentServiceCost - BASE_PRICE).toFixed(2)}`;
    if (invoiceTotalAmount) invoiceTotalAmount.innerText = `₹${totalBillAmount.toFixed(2)}`;
    if (invoiceDate) invoiceDate.innerText = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
    
    // Trigger Payment Modal
    setTimeout(() => {
      showPaymentModal();
    }, 1500);
  };

  // Payment System Logic
  const paymentModal = document.getElementById('payment-modal');
  const paymentSuccessModal = document.getElementById('payment-success-modal');
  const payNowBtn = document.getElementById('pay-now-btn');
  const continueToRatingBtn = document.getElementById('continue-to-rating-btn');
  const paymentOptions = document.querySelectorAll('.payment-option');
  const finalMethodDisplay = document.getElementById('final-method');
  
  const upiDetails = document.getElementById('upi-details');
  const cardDetails = document.getElementById('card-details');
  const netbankingDetails = document.getElementById('netbanking-details');

  let selectedMethod = 'cash';

  const showPaymentModal = () => {
    if (paymentModal) {
      paymentModal.style.display = 'flex';
    }
  };

  paymentOptions.forEach(option => {
    option.addEventListener('click', () => {
      // Update active state
      paymentOptions.forEach(opt => opt.classList.remove('active'));
      option.classList.add('active');
      
      selectedMethod = option.dataset.method;
      
      // Update dynamic details
      upiDetails.style.display = selectedMethod === 'upi' ? 'block' : 'none';
      cardDetails.style.display = selectedMethod === 'card' ? 'block' : 'none';
      netbankingDetails.style.display = selectedMethod === 'netbanking' ? 'block' : 'none';
      
      // Update button text
      if (selectedMethod === 'cash') {
        payNowBtn.innerText = 'Mark as Paid (Cash)';
      } else {
        payNowBtn.innerText = `Pay ₹${totalBillAmount.toFixed(2)}`;
      }
    });
  });

  if (payNowBtn) {
    payNowBtn.addEventListener('click', async () => {
      payNowBtn.disabled = true;
      payNowBtn.innerText = 'Processing...';
      
      try {
        if (selectedMethod === 'cash') {
          // Cash payment simulation
          if (window.currentJobId) {
            await api.pay(window.currentJobId, totalBillAmount, 'cash');
          }
          handlePaymentSuccess();
        } else {
          // Razorpay Payment
          const order = await api.createRazorpayOrder(window.currentJobId, totalBillAmount);
          
          if (order.simulated) {
            // If keys are missing, simulate success
            showToast('Simulated Payment', 'Razorpay keys missing. Simulating success.', 'ℹ️');
            await api.pay(window.currentJobId, totalBillAmount, selectedMethod);
            handlePaymentSuccess();
            return;
          }

          const options = {
            key: order.key_id || 'rzp_test_dummy',
            amount: order.amount,
            currency: order.currency,
            name: 'SmartServe',
            description: 'Service Payment',
            order_id: order.id,
            handler: async function (response) {
              try {
                // Verify payment on server
                await api.verifyRazorpayPayment({
                  razorpay_order_id: response.razorpay_order_id,
                  razorpay_payment_id: response.razorpay_payment_id,
                  razorpay_signature: response.razorpay_signature
                });

                // Finalize payment in our system
                await api.pay(window.currentJobId, totalBillAmount, selectedMethod, response.razorpay_payment_id);
                handlePaymentSuccess();
              } catch (err) {
                alert('Payment verification failed: ' + err.message);
                payNowBtn.disabled = false;
                payNowBtn.innerText = `Pay ₹${totalBillAmount.toFixed(2)}`;
              }
            },
            prefill: {
              name: currentUser.name,
              email: currentUser.email
            },
            theme: {
              color: '#6366f1'
            },
            modal: {
              ondismiss: function() {
                payNowBtn.disabled = false;
                payNowBtn.innerText = `Pay ₹${totalBillAmount.toFixed(2)}`;
              }
            }
          };

          const rzp = new window.Razorpay(options);
          rzp.open();
        }
      } catch (error) {
        alert('Payment failed: ' + error.message);
        payNowBtn.disabled = false;
        payNowBtn.innerText = selectedMethod === 'cash' ? 'Mark as Paid (Cash)' : `Pay ₹${totalBillAmount.toFixed(2)}`;
      }
    });
  }

  const handlePaymentSuccess = () => {
    // Simulate payment processing delay for UI
    setTimeout(() => {
      paymentModal.style.display = 'none';
      paymentSuccessModal.style.display = 'flex';
      
      if (finalMethodDisplay) {
        finalMethodDisplay.innerText = selectedMethod.toUpperCase();
      }

      const invoicePaymentMethod = document.getElementById('invoice-payment-method');
      if (invoicePaymentMethod) invoicePaymentMethod.innerText = selectedMethod.toUpperCase();

      // Final check for amount
      const successFinalAmount = document.getElementById('success-final-amount');
      if (successFinalAmount) {
        successFinalAmount.innerText = `₹${totalBillAmount.toFixed(2)}`;
      }

      showToast('Payment Successful', `₹${totalBillAmount.toFixed(2)} paid via ${selectedMethod.toUpperCase()}`, '💰');
      addNotification('Payment Success', `Transaction of ₹${totalBillAmount.toFixed(2)} completed.`, '💰');
    }, 1000);
  };

  if (viewInvoiceBtn) {
    viewInvoiceBtn.addEventListener('click', () => {
      paymentSuccessModal.style.display = 'none';
      if (invoiceModal) invoiceModal.style.display = 'flex';
    });
  }

  if (closeInvoiceBtn) {
    closeInvoiceBtn.addEventListener('click', () => {
      if (invoiceModal) invoiceModal.style.display = 'none';
      // Go back to success screen
      paymentSuccessModal.style.display = 'flex';
    });
  }

  if (downloadInvoiceBtn) {
    downloadInvoiceBtn.addEventListener('click', () => {
      showToast('Downloading...', 'Your invoice is being downloaded.', '📥');
      // Simulated download
      setTimeout(() => {
        showToast('Success', 'Invoice downloaded successfully.', '✅');
      }, 2000);
    });
  }

  if (shareInvoiceBtn) {
    shareInvoiceBtn.addEventListener('click', () => {
      if (navigator.share) {
        navigator.share({
          title: 'SmartServe Invoice',
          text: `Invoice for my ${currentWorker ? currentWorker.skill : 'service'} job by ${currentWorker ? currentWorker.name : 'SmartServe'}. Total: ₹${totalBillAmount.toFixed(2)}`,
          url: window.location.href
        }).catch(err => console.log('Error sharing', err));
      } else {
        showToast('Link Copied', 'Invoice link copied to clipboard.', '🔗');
      }
    });
  }

  if (continueToRatingBtn) {
    continueToRatingBtn.addEventListener('click', () => {
      paymentSuccessModal.style.display = 'none';
      showRatingModal();
    });
  }

  // Rating System Logic
  const ratingModal = document.getElementById('rating-modal');
  const submitRatingBtn = document.getElementById('submit-rating-btn');
  const thankYouMsg = document.getElementById('thank-you-msg');
  const workerRatingDisplay = document.getElementById('worker-rating-display');
  const stars = document.querySelectorAll('.star');
  
  let ratings = {
    quality: 0,
    punctuality: 0,
    behavior: 0
  };

  const showRatingModal = () => {
    const workerName = currentWorker ? currentWorker.name : 'Raj Kumar';
    const ratingWorkerName = document.getElementById('rating-worker-name');
    if (ratingWorkerName) {
      ratingWorkerName.innerText = `Please rate your experience with ${workerName}`;
    }
    if (ratingModal) {
      ratingModal.style.display = 'flex';
    }
  };

  stars.forEach(star => {
    star.addEventListener('click', () => {
      const category = star.parentElement.dataset.category;
      const value = parseInt(star.dataset.value);
      
      ratings[category] = value;
      
      // Update UI for this category
      const categoryStars = star.parentElement.querySelectorAll('.star');
      categoryStars.forEach(s => {
        const sValue = parseInt(s.dataset.value);
        if (sValue <= value) {
          s.classList.add('active');
        } else {
          s.classList.remove('active');
        }
      });
    });

    // Hover effect
    star.addEventListener('mouseover', () => {
      const categoryStars = star.parentElement.querySelectorAll('.star');
      const value = parseInt(star.dataset.value);
      categoryStars.forEach(s => {
        if (parseInt(s.dataset.value) <= value) {
          s.style.color = '#f59e0b';
        }
      });
    });

    star.addEventListener('mouseout', () => {
      const categoryStars = star.parentElement.querySelectorAll('.star');
      const category = star.parentElement.dataset.category;
      const currentValue = ratings[category];
      categoryStars.forEach(s => {
        if (parseInt(s.dataset.value) > currentValue) {
          s.style.color = '';
        }
      });
    });
  });

  if (submitRatingBtn) {
    submitRatingBtn.addEventListener('click', async () => {
      // Calculate average of selected ratings
      const values = Object.values(ratings);
      const filledRatings = values.filter(v => v > 0);
      
      if (filledRatings.length === 0) {
        alert('Please provide at least one rating category.');
        return;
      }

      const avg = filledRatings.reduce((a, b) => a + b, 0) / filledRatings.length;
      
      submitRatingBtn.disabled = true;
      submitRatingBtn.innerText = 'Submitting...';

      try {
        if (window.currentJobId && currentWorker) {
          await api.rateWorker(window.currentJobId, currentWorker.id, avg, document.getElementById('rating-comment')?.value || '');
        }
        
        // Update local UI for immediate feedback
        if (currentWorker) {
          if (workerRatingDisplay) {
            workerRatingDisplay.innerText = `⭐ ${avg.toFixed(1)}`;
            workerRatingDisplay.style.color = '#f59e0b';
            workerRatingDisplay.style.fontWeight = 'bold';
          }
        }

        setTimeout(() => {
          if (thankYouMsg) thankYouMsg.style.display = 'block';
          if (ratingModal) ratingModal.style.display = 'none';
          
          showToast('Thank You!', 'Your feedback helps us improve.', '✨');
          
          // Reset for next job
          setTimeout(() => {
            if (thankYouMsg) thankYouMsg.style.display = 'none';
            updateJobStatus(JobStatus.IDLE);
          }, 3000);
        }, 1000);
      } catch (error) {
        alert('Failed to submit rating: ' + error.message);
        submitRatingBtn.disabled = false;
        submitRatingBtn.innerText = 'Submit Feedback';
      }
    });
  }

  // Worker Online/Offline Toggle
  const onlineStatus = document.getElementById('online-status');
  const statusText = document.getElementById('status-text');

  // Notification System Logic
  const toastContainer = document.getElementById('toast-container');
  const notifModal = document.getElementById('notif-modal');
  const viewNotifBtn = document.getElementById('view-notifications-btn');
  const closeNotifBtn = document.getElementById('close-notif-btn');
  const notifList = document.getElementById('notif-list');
  const notifCount = document.getElementById('notif-count');
  
  let notifications = Storage.load('notifications', []);

  const showToast = (title, message, icon) => {
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.innerHTML = `
      <div class="toast-icon">${icon}</div>
      <div class="toast-content">
        <h4>${title}</h4>
        <p>${message}</p>
      </div>
    `;
    
    toastContainer.appendChild(toast);
    
    // Auto remove after 4s
    setTimeout(() => {
      toast.classList.add('fade-out');
      setTimeout(() => toast.remove(), 400);
    }, 4000);
  };

  const addNotification = (title, message, icon) => {
    const now = new Date();
    const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    
    const notif = { title, message, icon, time: timeStr };
    notifications.unshift(notif); // Add to start
    Storage.save('notifications', notifications);
    
    updateNotifUI();
  };

  const updateNotifUI = () => {
    if (notifCount) {
      notifCount.innerText = notifications.length;
      notifCount.style.display = notifications.length > 0 ? 'block' : 'none';
    }
    
    if (notifList) {
      if (notifications.length === 0) {
        notifList.innerHTML = '<p class="empty-msg">No new notifications</p>';
      } else {
        notifList.innerHTML = notifications.map(n => `
          <div class="notif-item">
            <div class="notif-item-icon">${n.icon}</div>
            <div class="notif-item-content">
              <h5>${n.title}</h5>
              <p>${n.message}</p>
              <span class="notif-item-time">${n.time}</span>
            </div>
          </div>
        `).join('');
      }
    }
  };

  if (viewNotifBtn) {
    viewNotifBtn.addEventListener('click', () => {
      notifModal.style.display = 'flex';
    });
  }

  if (closeNotifBtn) {
    closeNotifBtn.addEventListener('click', () => {
      notifModal.style.display = 'none';
    });
  }

  // Initial UI update for notifications
  updateNotifUI();

  // Cancel & Reschedule Logic
  if (cancelBookingBtn) {
    cancelBookingBtn.addEventListener('click', () => {
      cancelModal.style.display = 'flex';
    });
  }

  if (closeCancelModal) {
    closeCancelModal.addEventListener('click', () => {
      cancelModal.style.display = 'none';
    });
  }

  if (confirmCancelBtn) {
    confirmCancelBtn.addEventListener('click', () => {
      cancelModal.style.display = 'none';
      updateJobStatus(JobStatus.CANCELLED);
    });
  }

  if (rescheduleBtn) {
    rescheduleBtn.addEventListener('click', () => {
      rescheduleModal.style.display = 'flex';
    });
  }

  if (closeRescheduleModal) {
    closeRescheduleModal.addEventListener('click', () => {
      rescheduleModal.style.display = 'none';
    });
  }

  if (submitRescheduleBtn) {
    submitRescheduleBtn.addEventListener('click', () => {
      const selectedTime = document.getElementById('reschedule-time').options[document.getElementById('reschedule-time').selectedIndex].text;
      rescheduleModal.style.display = 'none';
      
      showToast('Request Sent', `Reschedule request for ${selectedTime} sent to worker.`, '⏳');
      addNotification('Reschedule Requested', `Waiting for worker to accept new time: ${selectedTime}`, '⏳');
      
      // Simulate worker receiving request (if on worker page)
      if (rescheduleRequests) {
        rescheduleRequests.innerHTML = `
          <div class="job-card" id="active-reschedule-request">
            <div class="job-info">
              <h4>Reschedule Request</h4>
              <p>New Time: ${selectedTime}</p>
              <p style="font-size: 0.75rem; color: #94a3b8;">From: Customer (Kitchen Sink Leak)</p>
            </div>
            <div style="display: flex; gap: 0.5rem;">
              <button class="btn btn-primary" style="padding: 0.5rem 1rem; font-size: 0.75rem; background: #10b981;" onclick="this.closest('.job-card').remove(); alert('Reschedule Accepted')">Accept</button>
              <button class="btn" style="padding: 0.5rem 1rem; font-size: 0.75rem; background: #ef4444; color: #fff;" onclick="this.closest('.job-card').remove(); alert('Reschedule Rejected')">Reject</button>
            </div>
          </div>
        `;
      }
    });
  }

  // Load online status
  if (onlineStatus) {
    const isOffline = Storage.load('worker_offline', false);
    if (isOffline) {
      onlineStatus.classList.add('offline');
      if (statusText) statusText.innerText = 'Offline';
    } else {
      onlineStatus.classList.remove('offline');
      if (statusText) statusText.innerText = 'Online';
    }
  }

  if (onlineStatus) {
    onlineStatus.addEventListener('click', () => {
      const isOnline = !onlineStatus.classList.contains('offline');
      
      if (isOnline) {
        onlineStatus.classList.add('offline');
        if (statusText) statusText.innerText = 'Offline';
        Storage.save('worker_offline', true);
      } else {
        onlineStatus.classList.remove('offline');
        if (statusText) statusText.innerText = 'Online';
        Storage.save('worker_offline', false);
      }
    });
  }

  // Full Demo Logic
  const fullDemoBtn = document.getElementById('full-demo-btn');
  const demoProblemDesc = document.getElementById('problem-desc');

  if (fullDemoBtn) {
    fullDemoBtn.addEventListener('click', async () => {
      // 1. Auto-fill problem
      if (demoProblemDesc) demoProblemDesc.value = "There is a major water leak in my kitchen sink. The pipe seems to have burst. Need urgent help!";
      
      // 2. Trigger analysis
      if (analyzeBtn) analyzeBtn.click();
      
      // Wait for analysis to complete (simulated 2s + some buffer)
      await new Promise(resolve => setTimeout(resolve, 2500));
      
      // 3. Trigger booking
      bookBtn.click();

      // Wait for matching (3.5s) + some buffer
      await new Promise(resolve => setTimeout(resolve, 4000));

      // 4. Wait for worker to arrive (simulated movement takes 8s + buffer)
      await new Promise(resolve => setTimeout(resolve, 10000));

      // 5. Confirm arrival
      if (confirmArrivalBtn && arrivalActions.style.display !== 'none') {
        confirmArrivalBtn.click();
      }

      // 6. Wait for work completion (simulated 10s)
      await new Promise(resolve => setTimeout(resolve, 11000));

      // 7. Auto-pay for demo
      if (paymentModal && paymentModal.style.display !== 'none') {
        // Select UPI for demo
        const upiOption = document.querySelector('.payment-option[data-method="upi"]');
        if (upiOption) upiOption.click();
        
        setTimeout(() => {
          if (payNowBtn) payNowBtn.click();
        }, 1000);
      }

      // 8. Wait for payment success screen
      await new Promise(resolve => setTimeout(resolve, 4000));
      
      // View Invoice in demo
      if (viewInvoiceBtn) viewInvoiceBtn.click();
      await new Promise(resolve => setTimeout(resolve, 2000));
      if (closeInvoiceBtn) closeInvoiceBtn.click();
      await new Promise(resolve => setTimeout(resolve, 1000));

      if (continueToRatingBtn) continueToRatingBtn.click();

      // 9. Auto-fill rating for demo
      await new Promise(resolve => setTimeout(resolve, 1000));
      const demoStars = document.querySelectorAll('.star[data-value="5"]');
      demoStars.forEach(s => s.click());
      document.getElementById('review-text').value = "Excellent service! Raj was very professional and fixed the leak quickly. Highly recommended.";
      
      // 10. Submit rating
      setTimeout(() => {
        if (submitRatingBtn) submitRatingBtn.click();
      }, 1500);
    });
  }

  // --- Real-time Updates (WebSockets) ---
  if (currentUser) {
    api.connectWS();

    // Customer Listeners
    if (currentUser.role === 'USER') {
      api.on('JOB_ACCEPTED', (data) => {
        showToast('Worker Assigned', `${data.worker.name} has accepted your request.`, '👷');
        addNotification('Worker Assigned', `${data.worker.name} is on the way.`, '👷');
        
        if (window.currentJobId === data.job.id) {
          window.currentWorker = data.worker;
          
          // Update Worker Display UI
          const workerNameDisplay = document.getElementById('worker-name');
          const workerSkillDisplay = document.getElementById('worker-skill');
          const workerRatingDisplay = document.getElementById('worker-rating');
          
          if (workerNameDisplay) workerNameDisplay.innerText = data.worker.name;
          if (workerSkillDisplay) workerSkillDisplay.innerText = data.worker.skill;
          if (workerRatingDisplay) workerRatingDisplay.innerText = `⭐ ${data.worker.rating}`;
          
          // Set worker start location for map if available
          if (data.worker.location) {
            workerStartCoords[0] = data.worker.location.lat;
            workerStartCoords[1] = data.worker.location.lng;
          }
          
          updateJobStatus(JobStatus.ASSIGNED);
        }
      });

      api.on('JOB_STATUS_UPDATE', (data) => {
        if (window.currentJobId === data.job.id) {
          // Only update if status is different to avoid redundant updates
          if (currentJobStatus !== data.job.status) {
            updateJobStatus(data.job.status);
          }
        }
      });

      api.on('LOCATION_UPDATE', (data) => {
        if (window.currentJobId === data.jobId && workerMarker) {
          const newPos = [data.location.lat, data.location.lng];
          workerMarker.setLatLng(newPos);
          if (routeLine) routeLine.setLatLngs([newPos, userCoords]);
          
          // Calculate dynamic ETA based on distance
          const distance = Math.sqrt(
            Math.pow(data.location.lat - userCoords[0], 2) + 
            Math.pow(data.location.lng - userCoords[1], 2)
          );
          const etaMinutes = Math.ceil(distance * 1000); // Rough estimation
          if (etaLabel) {
            etaLabel.innerText = etaMinutes > 0 ? `Arriving in ${etaMinutes} mins` : "Arrived";
          }
        }
      });
    }
  }
});
