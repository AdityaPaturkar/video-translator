// Global state
let currentUser = null;
let currentVideoId = 'video1';
let watchTimeLimit = 300; // 5 minutes default
let watchTimeUsed = 0;
let watchTimeInterval = null;
let userLocation = null;
let userCity = null;
let comments = [];
let socket = null;
let localStream = null;
let remoteStream = null;
let peerConnection = null;
let mediaRecorder = null;
let recordedChunks = [];

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    initializeApp();
    setupEventListeners();
    detectLocation();
    applyTheme();
    setupVideoPlayer();
});

// Initialize app
function initializeApp() {
    // Check if user is logged in (from localStorage)
    const savedUser = localStorage.getItem('currentUser');
    if (savedUser) {
        currentUser = JSON.parse(savedUser);
        updateUI();
        loadUserPlan();
    }
    
    // Initialize Socket.IO
    socket = io();
    setupSocketListeners();
}

// Setup event listeners
function setupEventListeners() {
    // Login
    document.getElementById('loginBtn').addEventListener('click', () => {
        document.getElementById('loginModal').style.display = 'block';
    });
    
    document.getElementById('logoutBtn').addEventListener('click', () => {
        logout();
    });
    
    document.getElementById('loginForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        await handleLogin();
    });
    
    document.getElementById('registerForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        await handleRegister();
    });
    
    document.getElementById('showLogin').addEventListener('click', () => {
        document.getElementById('loginForm').style.display = 'block';
        document.getElementById('registerForm').style.display = 'none';
        document.getElementById('showLogin').classList.add('active-tab');
        document.getElementById('showLogin').classList.remove('inactive-tab');
        document.getElementById('showRegister').classList.add('inactive-tab');
        document.getElementById('showRegister').classList.remove('active-tab');
    });
    
    document.getElementById('showRegister').addEventListener('click', () => {
        document.getElementById('loginForm').style.display = 'none';
        document.getElementById('registerForm').style.display = 'block';
        document.getElementById('showRegister').classList.add('active-tab');
        document.getElementById('showRegister').classList.remove('inactive-tab');
        document.getElementById('showLogin').classList.add('inactive-tab');
        document.getElementById('showLogin').classList.remove('active-tab');
    });
    
    document.getElementById('verifyOtpBtn').addEventListener('click', async () => {
        await verifyOTP();
    });
    
    // Close modals
    document.querySelectorAll('.close').forEach(closeBtn => {
        closeBtn.addEventListener('click', (e) => {
            e.target.closest('.modal').style.display = 'none';
        });
    });
    
    // Comments
    document.getElementById('submitComment').addEventListener('click', () => {
        submitComment();
    });
    
    // Download
    document.getElementById('downloadBtn').addEventListener('click', () => {
        downloadVideo();
    });
    
    // Upgrade
    document.getElementById('upgradeBtn').addEventListener('click', () => {
        document.getElementById('subscriptionModal').style.display = 'block';
    });
    
    // Subscription plans
    document.querySelectorAll('.upgrade-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const planCard = e.target.closest('.plan-card');
            const plan = planCard.dataset.plan;
            const amount = parseInt(planCard.dataset.amount);
            initiatePayment(plan, amount);
        });
    });
    
    // VoIP
    document.getElementById('voipBtn').addEventListener('click', () => {
        document.getElementById('voipModal').style.display = 'block';
    });
    
    document.getElementById('joinRoomBtn').addEventListener('click', () => {
        joinRoom();
    });
    
    document.getElementById('shareScreenBtn').addEventListener('click', () => {
        shareScreen();
    });
    
    document.getElementById('recordBtn').addEventListener('click', () => {
        startRecording();
    });
    
    document.getElementById('stopRecordBtn').addEventListener('click', () => {
        stopRecording();
    });
    
    // Close modals on outside click
    window.addEventListener('click', (e) => {
        if (e.target.classList.contains('modal')) {
            e.target.style.display = 'none';
        }
    });
}

// Location detection
async function detectLocation() {
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
            async (position) => {
                const { latitude, longitude } = position.coords;
                try {
                    // Using a free geocoding service
                    const response = await fetch(
                        `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${latitude}&longitude=${longitude}&localityLanguage=en`
                    );
                    const data = await response.json();
                    userLocation = data.principalSubdivision || 'Unknown';
                    userCity = data.city || data.locality || 'Unknown';
                    applyTheme();
                } catch (error) {
                    console.error('Location error:', error);
                    userLocation = 'Unknown';
                    userCity = 'Unknown';
                }
            },
            (error) => {
                console.error('Geolocation error:', error);
                userLocation = 'Unknown';
                userCity = 'Unknown';
            }
        );
    } else {
        userLocation = 'Unknown';
        userCity = 'Unknown';
    }
}

// Apply theme based on time and location
function applyTheme() {
    const now = new Date();
    const hour = now.getHours();
    const southStates = ['Tamil Nadu', 'Kerala', 'Karnataka', 'Andhra Pradesh', 'Telangana'];
    const isSouthIndia = userLocation && southStates.some(state => 
        userLocation.toLowerCase().includes(state.toLowerCase())
    );
    
    const isWhiteThemeTime = hour >= 10 && hour < 12;
    const shouldUseWhiteTheme = isWhiteThemeTime && isSouthIndia;
    
    if (shouldUseWhiteTheme) {
        document.body.classList.remove('dark-theme');
    } else {
        document.body.classList.add('dark-theme');
    }
}

// Setup video player with gesture controls
function setupVideoPlayer() {
    const video = document.getElementById('videoPlayer');
    const overlay = document.getElementById('videoOverlay');
    
    let tapTimeout = null;
    let tapCount = 0;
    let lastTapTime = 0;
    const TAP_DELAY = 300;
    
    overlay.addEventListener('click', (e) => {
        const rect = overlay.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const width = rect.width;
        const tapPosition = x / width;
        
        const currentTime = Date.now();
        
        if (currentTime - lastTapTime > TAP_DELAY) {
            tapCount = 0;
        }
        
        tapCount++;
        lastTapTime = currentTime;
        
        clearTimeout(tapTimeout);
        tapTimeout = setTimeout(() => {
            handleTap(tapCount, tapPosition);
            tapCount = 0;
        }, TAP_DELAY);
    });
    
    // Track watch time
    video.addEventListener('play', () => {
        startWatchTimeTracking();
    });
    
    video.addEventListener('pause', () => {
        stopWatchTimeTracking();
    });
    
    video.addEventListener('timeupdate', () => {
        checkWatchTimeLimit();
    });
}

function handleTap(count, position) {
    const video = document.getElementById('videoPlayer');
    
    if (count === 1) {
        // Single tap - middle area: pause/play
        if (position > 0.3 && position < 0.7) {
            if (video.paused) {
                video.play();
            } else {
                video.pause();
            }
        }
    } else if (count === 2) {
        // Double tap - right side: forward 10s
        if (position > 0.6) {
            video.currentTime = Math.min(video.currentTime + 10, video.duration);
        }
        // Double tap - left side: backward 10s
        else if (position < 0.4) {
            video.currentTime = Math.max(video.currentTime - 10, 0);
        }
    } else if (count === 3) {
        // Triple tap - middle: next video
        if (position > 0.3 && position < 0.7) {
            loadNextVideo();
        }
        // Triple tap - right: close website
        else if (position > 0.6) {
            if (confirm('Are you sure you want to close the website?')) {
                window.close();
            }
        }
        // Triple tap - left: show comments
        else if (position < 0.4) {
            toggleComments();
        }
    }
}

function toggleComments() {
    const commentsSection = document.getElementById('commentsSection');
    commentsSection.style.display = commentsSection.style.display === 'none' ? 'block' : 'none';
    if (commentsSection.style.display === 'block') {
        loadComments();
    }
}

function loadNextVideo() {
    // In a real app, this would load the next video from a playlist
    alert('Next video feature - would load next video in playlist');
}

// Watch time tracking
function startWatchTimeTracking() {
    if (watchTimeInterval) return;
    
    watchTimeInterval = setInterval(() => {
        watchTimeUsed++;
        updateWatchTimeDisplay();
        
        if (watchTimeUsed >= watchTimeLimit) {
            stopWatchTimeTracking();
            document.getElementById('videoPlayer').pause();
            alert('Watch time limit reached! Upgrade your plan for more time.');
        }
    }, 1000);
}

function stopWatchTimeTracking() {
    if (watchTimeInterval) {
        clearInterval(watchTimeInterval);
        watchTimeInterval = null;
    }
}

function checkWatchTimeLimit() {
    const video = document.getElementById('videoPlayer');
    if (watchTimeUsed >= watchTimeLimit) {
        video.pause();
        alert('Watch time limit reached! Upgrade your plan for more time.');
    }
}

function updateWatchTimeDisplay() {
    const remaining = Math.max(0, watchTimeLimit - watchTimeUsed);
    const minutes = Math.floor(remaining / 60);
    const seconds = remaining % 60;
    document.getElementById('remainingTime').textContent = 
        `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

// Register
async function handleRegister() {
    const name = document.getElementById('registerName').value;
    const email = document.getElementById('registerEmail').value;
    const phone = document.getElementById('registerPhone').value;
    const password = document.getElementById('registerPassword').value;
    
    try {
        const response = await fetch('/api/auth/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, email, phone, password })
        });
        
        const data = await response.json();
        
        if (data.success) {
            alert('Registration successful! Please login.');
            // Switch to login form
            document.getElementById('showLogin').click();
            document.getElementById('loginEmail').value = email;
        } else {
            alert('Registration failed: ' + (data.error || 'Unknown error'));
        }
    } catch (error) {
        console.error('Registration error:', error);
        alert('Registration failed. Please try again.');
    }
}

// Login
async function handleLogin() {
    const email = document.getElementById('loginEmail').value;
    const password = document.getElementById('loginPassword').value;
    
    try {
        const response = await fetch('/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password, location: userLocation })
        });
        
        const data = await response.json();
        
        if (data.success) {
            if (data.requiresOTP) {
                document.getElementById('otpSection').style.display = 'block';
                currentUser = { id: data.userId };
            } else {
                currentUser = data.user;
                localStorage.setItem('currentUser', JSON.stringify(currentUser));
                updateUI();
                loadUserPlan();
                document.getElementById('loginModal').style.display = 'none';
            }
        } else {
            alert('Login failed: ' + data.error);
        }
    } catch (error) {
        console.error('Login error:', error);
        alert('Login failed. Please try again.');
    }
}

async function verifyOTP() {
    const otp = document.getElementById('otpInput').value;
    
    if (!currentUser || !currentUser.id) {
        alert('Please login first');
        return;
    }
    
    try {
        const response = await fetch('/api/auth/verify-otp', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId: currentUser.id, otp })
        });
        
        const data = await response.json();
        
        if (data.success) {
            currentUser = data.user;
            localStorage.setItem('currentUser', JSON.stringify(currentUser));
            updateUI();
            loadUserPlan();
            document.getElementById('loginModal').style.display = 'none';
            document.getElementById('otpSection').style.display = 'none';
        } else {
            alert('OTP verification failed: ' + data.error);
        }
    } catch (error) {
        console.error('OTP verification error:', error);
        alert('OTP verification failed. Please try again.');
    }
}

function logout() {
    currentUser = null;
    localStorage.removeItem('currentUser');
    stopWatchTimeTracking();
    watchTimeUsed = 0;
    updateUI();
}

function updateUI() {
    if (currentUser) {
        document.getElementById('userName').textContent = currentUser.name || 'User';
        document.getElementById('userPlan').textContent = currentUser.plan || 'Free';
        document.getElementById('loginBtn').style.display = 'none';
        document.getElementById('logoutBtn').style.display = 'inline-block';
    } else {
        document.getElementById('userName').textContent = 'Guest';
        document.getElementById('userPlan').textContent = 'Free';
        document.getElementById('loginBtn').style.display = 'inline-block';
        document.getElementById('logoutBtn').style.display = 'none';
    }
}

async function loadUserPlan() {
    if (!currentUser) {
        watchTimeLimit = 300; // 5 minutes for guests
        return;
    }
    
    try {
        const response = await fetch(`/api/users/${currentUser.id}/plan`);
        const data = await response.json();
        watchTimeLimit = data.watchTimeLimit === Infinity ? 999999 : data.watchTimeLimit;
        updateWatchTimeDisplay();
    } catch (error) {
        console.error('Error loading plan:', error);
    }
}

// Comments
async function loadComments() {
    try {
        const response = await fetch(`/api/comments/${currentVideoId}`);
        const data = await response.json();
        comments = data;
        renderComments();
    } catch (error) {
        console.error('Error loading comments:', error);
    }
}

async function submitComment() {
    if (!currentUser) {
        alert('Please login to comment');
        return;
    }
    
    const text = document.getElementById('commentInput').value.trim();
    if (!text) return;
    
    try {
        const response = await fetch('/api/comments', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                videoId: currentVideoId,
                userId: currentUser.id,
                text: text,
                city: userCity || 'Unknown'
            })
        });
        
        const data = await response.json();
        
        if (data.success) {
            document.getElementById('commentInput').value = '';
            loadComments();
        } else {
            alert('Error: ' + data.error);
        }
    } catch (error) {
        console.error('Error submitting comment:', error);
        alert('Failed to submit comment');
    }
}

function renderComments() {
    const container = document.getElementById('commentsList');
    container.innerHTML = '';
    
    comments.forEach(comment => {
        const commentEl = document.createElement('div');
        commentEl.className = 'comment-item';
        commentEl.innerHTML = `
            <div class="comment-header">
                <div>
                    <span class="comment-author">User ${comment.userId}</span>
                    <span class="comment-city">, ${comment.city}</span>
                </div>
            </div>
            <div class="comment-text" data-original="${comment.text}">${comment.text}</div>
            <div class="comment-actions">
                <button onclick="likeComment('${comment.id}')">
                    👍 <span>${comment.likes || 0}</span>
                </button>
                <button onclick="dislikeComment('${comment.id}')">
                    👎 <span>${comment.dislikes || 0}</span>
                </button>
                <button class="translate-btn" onclick="translateComment('${comment.id}')">
                    Translate
                </button>
            </div>
        `;
        container.appendChild(commentEl);
    });
}

async function likeComment(commentId) {
    if (!currentUser) {
        alert('Please login to like comments');
        return;
    }
    
    try {
        const response = await fetch(`/api/comments/${commentId}/like`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId: currentUser.id })
        });
        
        const data = await response.json();
        if (data.success) {
            if (data.removed) {
                loadComments();
            } else {
                loadComments();
            }
        }
    } catch (error) {
        console.error('Error liking comment:', error);
    }
}

async function dislikeComment(commentId) {
    if (!currentUser) {
        alert('Please login to dislike comments');
        return;
    }
    
    try {
        const response = await fetch(`/api/comments/${commentId}/dislike`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId: currentUser.id })
        });
        
        const data = await response.json();
        if (data.success) {
            if (data.removed) {
                loadComments();
            } else {
                loadComments();
            }
        }
    } catch (error) {
        console.error('Error disliking comment:', error);
    }
}

async function translateComment(commentId) {
    const comment = comments.find(c => c.id === commentId);
    if (!comment) return;
    
    const targetLang = prompt('Enter target language code (e.g., en, es, fr, hi):', 'en');
    if (!targetLang) return;
    
    try {
        // Using a free translation API (you can replace with Google Translate API or similar)
        const response = await fetch(`https://api.mymemory.translated.net/get?q=${encodeURIComponent(comment.text)}&langpair=auto|${targetLang}`);
        const data = await response.json();
        
        if (data.responseData && data.responseData.translatedText) {
            const commentEl = document.querySelector(`[data-original="${comment.text}"]`);
            if (commentEl) {
                commentEl.textContent = data.responseData.translatedText;
                commentEl.style.fontStyle = 'italic';
                commentEl.style.color = 'var(--accent-color)';
                
                // Add button to show original
                const showOriginalBtn = document.createElement('button');
                showOriginalBtn.textContent = 'Show Original';
                showOriginalBtn.style.marginLeft = '0.5rem';
                showOriginalBtn.onclick = () => {
                    commentEl.textContent = comment.text;
                    commentEl.style.fontStyle = 'normal';
                    commentEl.style.color = '';
                    showOriginalBtn.remove();
                };
                commentEl.parentElement.appendChild(showOriginalBtn);
            }
        }
    } catch (error) {
        console.error('Translation error:', error);
        alert('Translation failed. Please try again.');
    }
}

// Download video
async function downloadVideo() {
    if (!currentUser) {
        alert('Please login to download videos');
        return;
    }
    
    try {
        const response = await fetch(`/api/videos/${currentVideoId}/download`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId: currentUser.id })
        });
        
        const data = await response.json();
        
        if (data.success) {
            // Trigger actual download
            const video = document.getElementById('videoPlayer');
            const a = document.createElement('a');
            a.href = video.src;
            a.download = `video_${currentVideoId}.mp4`;
            a.click();
            
            alert('Video downloaded successfully!');
        } else {
            if (data.error && data.error.includes('premium')) {
                if (confirm('Upgrade to premium for unlimited downloads?')) {
                    document.getElementById('subscriptionModal').style.display = 'block';
                }
            } else {
                alert('Error: ' + data.error);
            }
        }
    } catch (error) {
        console.error('Download error:', error);
        alert('Download failed. Please try again.');
    }
}

// Payment
async function initiatePayment(plan, amount) {
    if (!currentUser) {
        alert('Please login to upgrade');
        return;
    }
    
    try {
        const response = await fetch('/api/payments/create-order', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId: currentUser.id, plan, amount })
        });
        
        const data = await response.json();
        
        if (data.success) {
            const options = {
                key: 'rzp_test_YOUR_KEY', // Replace with your Razorpay key
                amount: data.amount,
                currency: 'INR',
                name: 'Video Platform',
                description: `${plan.toUpperCase()} Plan`,
                order_id: data.orderId,
                handler: async function(response) {
                    await verifyPayment(response, plan, amount);
                },
                prefill: {
                    email: currentUser.email
                },
                theme: {
                    color: '#007bff'
                }
            };
            
            const rzp = new Razorpay(options);
            rzp.open();
        }
    } catch (error) {
        console.error('Payment error:', error);
        alert('Payment initiation failed. Please try again.');
    }
}

async function verifyPayment(paymentResponse, plan, amount) {
    try {
        const response = await fetch('/api/payments/verify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                orderId: paymentResponse.razorpay_order_id,
                paymentId: paymentResponse.razorpay_payment_id,
                signature: paymentResponse.razorpay_signature,
                userId: currentUser.id,
                plan: plan,
                amount: amount * 100
            })
        });
        
        const data = await response.json();
        
        if (data.success) {
            alert('Payment successful! Your plan has been upgraded.');
            document.getElementById('subscriptionModal').style.display = 'none';
            loadUserPlan();
            updateUI();
        } else {
            alert('Payment verification failed: ' + data.error);
        }
    } catch (error) {
        console.error('Payment verification error:', error);
        alert('Payment verification failed. Please contact support.');
    }
}

// VoIP
function setupSocketListeners() {
    socket.on('user-joined', (userId) => {
        console.log('User joined:', userId);
    });
    
    socket.on('offer', async (data) => {
        await handleOffer(data.offer, data.from);
    });
    
    socket.on('answer', async (data) => {
        await handleAnswer(data.answer, data.from);
    });
    
    socket.on('ice-candidate', async (data) => {
        await handleIceCandidate(data.candidate, data.from);
    });
}

async function joinRoom() {
    const roomId = document.getElementById('roomIdInput').value || `room_${Date.now()}`;
    
    try {
        // Get user media
        localStream = await navigator.mediaDevices.getUserMedia({ 
            video: true, 
            audio: true 
        });
        
        document.getElementById('localVideo').srcObject = localStream;
        document.getElementById('shareScreenBtn').style.display = 'block';
        document.getElementById('recordBtn').style.display = 'block';
        
        // Create peer connection
        const configuration = {
            iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
        };
        
        peerConnection = new RTCPeerConnection(configuration);
        
        // Add local stream tracks
        localStream.getTracks().forEach(track => {
            peerConnection.addTrack(track, localStream);
        });
        
        // Handle remote stream
        peerConnection.ontrack = (event) => {
            remoteStream = event.streams[0];
            document.getElementById('remoteVideo').srcObject = remoteStream;
        };
        
        // Handle ICE candidates
        peerConnection.onicecandidate = (event) => {
            if (event.candidate) {
                socket.emit('ice-candidate', {
                    roomId: roomId,
                    candidate: event.candidate
                });
            }
        };
        
        // Create and send offer
        const offer = await peerConnection.createOffer();
        await peerConnection.setLocalDescription(offer);
        
        socket.emit('join-room', roomId);
        socket.emit('offer', {
            roomId: roomId,
            offer: offer
        });
        
    } catch (error) {
        console.error('Error joining room:', error);
        alert('Failed to join room. Please check permissions.');
    }
}

async function handleOffer(offer, from) {
    try {
        await peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
        const answer = await peerConnection.createAnswer();
        await peerConnection.setLocalDescription(answer);
        
        socket.emit('answer', {
            roomId: document.getElementById('roomIdInput').value,
            answer: answer
        });
    } catch (error) {
        console.error('Error handling offer:', error);
    }
}

async function handleAnswer(answer, from) {
    try {
        await peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
    } catch (error) {
        console.error('Error handling answer:', error);
    }
}

async function handleIceCandidate(candidate, from) {
    try {
        await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
    } catch (error) {
        console.error('Error handling ICE candidate:', error);
    }
}

async function shareScreen() {
    try {
        const screenStream = await navigator.mediaDevices.getDisplayMedia({ 
            video: true,
            audio: true 
        });
        
        // Replace video track
        const videoTrack = screenStream.getVideoTracks()[0];
        const sender = peerConnection.getSenders().find(s => 
            s.track && s.track.kind === 'video'
        );
        
        if (sender) {
            await sender.replaceTrack(videoTrack);
        }
        
        document.getElementById('localVideo').srcObject = screenStream;
        
        screenStream.getVideoTracks()[0].onended = () => {
            shareScreen(); // Re-share if user stops sharing
        };
    } catch (error) {
        console.error('Error sharing screen:', error);
        alert('Failed to share screen. Please check permissions.');
    }
}

function startRecording() {
    if (!remoteStream) {
        alert('No remote stream to record');
        return;
    }
    
    recordedChunks = [];
    mediaRecorder = new MediaRecorder(remoteStream);
    
    mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
            recordedChunks.push(event.data);
        }
    };
    
    mediaRecorder.onstop = () => {
        const blob = new Blob(recordedChunks, { type: 'video/webm' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `video_call_${Date.now()}.webm`;
        a.click();
        URL.revokeObjectURL(url);
    };
    
    mediaRecorder.start();
    document.getElementById('recordBtn').style.display = 'none';
    document.getElementById('stopRecordBtn').style.display = 'block';
}

function stopRecording() {
    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
        mediaRecorder.stop();
        document.getElementById('recordBtn').style.display = 'block';
        document.getElementById('stopRecordBtn').style.display = 'none';
    }
}

// Update theme every minute to handle time changes
setInterval(() => {
    applyTheme();
}, 60000);

