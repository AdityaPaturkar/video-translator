const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');
const fs = require('fs');
const http = require('http');
const crypto = require('crypto');
const socketIo = require('socket.io');
const Razorpay = require('razorpay');
const nodemailer = require('nodemailer');
const twilio = require('twilio');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Request logging middleware
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
  next();
});

// Serve static files
app.use(express.static('public'));

// Data storage (in production, use a real database)
const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir);
}

// Initialize Razorpay (use your actual keys)
const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID || 'rzp_test_YOUR_KEY',
  key_secret: process.env.RAZORPAY_KEY_SECRET || 'YOUR_SECRET'
});

// Email transporter (configure with your email service)
// Only initialize if valid credentials are provided
let transporter = null;
if (process.env.EMAIL_USER && process.env.EMAIL_USER !== 'your-email@gmail.com' && 
    process.env.EMAIL_PASS && process.env.EMAIL_PASS !== 'your-app-password') {
  transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS
    }
  });
}

// Twilio client (configure with your credentials)
// Only initialize if valid credentials are provided
let twilioClient = null;
if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_ACCOUNT_SID.startsWith('AC') && 
    process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_AUTH_TOKEN !== 'your-auth-token') {
  twilioClient = twilio(
    process.env.TWILIO_ACCOUNT_SID,
    process.env.TWILIO_AUTH_TOKEN
  );
}

// Helper functions
function loadData(file) {
  const filePath = path.join(dataDir, file);
  try {
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, 'utf8');
      if (content.trim() === '') {
        return {};
      }
      return JSON.parse(content);
    }
  } catch (error) {
    console.error(`Error loading ${file}:`, error);
    return {};
  }
  return {};
}

function saveData(file, data) {
  const filePath = path.join(dataDir, file);
  try {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
  } catch (error) {
    console.error(`Error saving ${file}:`, error);
  }
}

// Initialize data files
const users = loadData('users.json');
const comments = loadData('comments.json');
const videos = loadData('videos.json');
const downloads = loadData('downloads.json');
const subscriptions = loadData('subscriptions.json');

// Routes

// User registration/login
app.post('/api/auth/register', (req, res) => {
  const { email, phone, password, name } = req.body;
  const userId = Date.now().toString();
  
  users[userId] = {
    id: userId,
    email,
    phone,
    password, // In production, hash this
    name,
    plan: 'free',
    createdAt: new Date().toISOString()
  };
  
  saveData('users.json', users);
  res.json({ success: true, userId });
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password, location } = req.body;
    
    const user = Object.values(users).find(u => u.email === email && u.password === password);
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    // Check location and send OTP
    const southStates = ['Tamil Nadu', 'Kerala', 'Karnataka', 'Andhra Pradesh', 'Telangana'];
    const isSouthIndia = location && southStates.some(state => location.includes(state));
    
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    user.otp = otp;
    user.otpExpiry = Date.now() + 600000; // 10 minutes
    
    if (isSouthIndia) {
      // Send email OTP
      if (transporter) {
        try {
          await transporter.sendMail({
            from: process.env.EMAIL_USER,
            to: user.email,
            subject: 'OTP Verification',
            text: `Your OTP is: ${otp}`
          });
        } catch (err) {
          console.error('Email error:', err);
          console.log('OTP for testing:', otp); // Log OTP if email fails
        }
      } else {
        console.log('Email not configured. OTP for testing:', otp);
      }
    } else {
      // Send SMS OTP
      if (twilioClient) {
        try {
          await twilioClient.messages.create({
            body: `Your OTP is: ${otp}`,
            from: process.env.TWILIO_PHONE || '+1234567890',
            to: user.phone
          });
        } catch (err) {
          console.error('SMS error:', err);
          console.log('OTP for testing:', otp); // Log OTP if SMS fails
        }
      } else {
        console.log('Twilio not configured. OTP for testing:', otp);
      }
    }
    
    saveData('users.json', users);
    res.json({ success: true, requiresOTP: true, userId: user.id });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/auth/verify-otp', (req, res) => {
  const { userId, otp } = req.body;
  const user = users[userId];
  
  if (!user || user.otp !== otp || Date.now() > user.otpExpiry) {
    return res.status(401).json({ error: 'Invalid or expired OTP' });
  }
  
  delete user.otp;
  delete user.otpExpiry;
  saveData('users.json', users);
  
  res.json({ success: true, user: { id: user.id, name: user.name, email: user.email, plan: user.plan } });
});

// Comments API
app.get('/api/comments/:videoId', (req, res) => {
  const videoComments = Object.values(comments).filter(c => c.videoId === req.params.videoId);
  res.json(videoComments);
});

app.post('/api/comments', (req, res) => {
  const { videoId, userId, text, city } = req.body;
  
  // Check for special characters (allow only alphanumeric, spaces, and basic punctuation)
  if (!/^[a-zA-Z0-9\s.,!?\-]+$/.test(text)) {
    return res.status(400).json({ error: 'Comments with special characters are not allowed' });
  }
  
  const commentId = Date.now().toString();
  comments[commentId] = {
    id: commentId,
    videoId,
    userId,
    text,
    city,
    likes: 0,
    dislikes: 0,
    likedBy: [],
    dislikedBy: [],
    createdAt: new Date().toISOString()
  };
  
  saveData('comments.json', comments);
  res.json({ success: true, comment: comments[commentId] });
});

app.post('/api/comments/:commentId/like', (req, res) => {
  const { commentId } = req.params;
  const { userId } = req.body;
  const comment = comments[commentId];
  
  if (!comment) return res.status(404).json({ error: 'Comment not found' });
  
  if (comment.likedBy.includes(userId)) {
    comment.likes--;
    comment.likedBy = comment.likedBy.filter(id => id !== userId);
  } else {
    if (comment.dislikedBy.includes(userId)) {
      comment.dislikes--;
      comment.dislikedBy = comment.dislikedBy.filter(id => id !== userId);
    }
    comment.likes++;
    comment.likedBy.push(userId);
  }
  
  // Auto-remove if 2+ dislikes
  if (comment.dislikes >= 2) {
    delete comments[commentId];
    saveData('comments.json', comments);
    return res.json({ success: true, removed: true });
  }
  
  saveData('comments.json', comments);
  res.json({ success: true, comment });
});

app.post('/api/comments/:commentId/dislike', (req, res) => {
  const { commentId } = req.params;
  const { userId } = req.body;
  const comment = comments[commentId];
  
  if (!comment) return res.status(404).json({ error: 'Comment not found' });
  
  if (comment.dislikedBy.includes(userId)) {
    comment.dislikes--;
    comment.dislikedBy = comment.dislikedBy.filter(id => id !== userId);
  } else {
    if (comment.likedBy.includes(userId)) {
      comment.likes--;
      comment.likedBy = comment.likedBy.filter(id => id !== userId);
    }
    comment.dislikes++;
    comment.dislikedBy.push(userId);
  }
  
  // Auto-remove if 2+ dislikes
  if (comment.dislikes >= 2) {
    delete comments[commentId];
    saveData('comments.json', comments);
    return res.json({ success: true, removed: true });
  }
  
  saveData('comments.json', comments);
  res.json({ success: true, comment });
});

// Video download API
app.post('/api/videos/:videoId/download', (req, res) => {
  const { videoId } = req.params;
  const { userId } = req.body;
  const user = users[userId];
  
  if (!user) return res.status(401).json({ error: 'Unauthorized' });
  
  // Check daily download limit for free users
  if (user.plan === 'free') {
    const today = new Date().toDateString();
    const userDownloads = Object.values(downloads).filter(d => 
      d.userId === userId && new Date(d.downloadedAt).toDateString() === today
    );
    
    if (userDownloads.length >= 1) {
      return res.status(403).json({ error: 'Daily download limit reached. Upgrade to premium for unlimited downloads.' });
    }
  }
  
  const downloadId = Date.now().toString();
  downloads[downloadId] = {
    id: downloadId,
    videoId,
    userId,
    downloadedAt: new Date().toISOString()
  };
  
  saveData('downloads.json', downloads);
  res.json({ success: true, downloadId });
});

app.get('/api/users/:userId/downloads', (req, res) => {
  const { userId } = req.params;
  const userDownloads = Object.values(downloads).filter(d => d.userId === userId);
  res.json(userDownloads);
});

// Subscription and payment
app.post('/api/payments/create-order', async (req, res) => {
  try {
    const { userId, plan, amount } = req.body;
    
    if (!razorpay || !razorpay.key_id || razorpay.key_id === 'rzp_test_YOUR_KEY') {
      return res.status(500).json({ error: 'Payment gateway not configured' });
    }
    
    const options = {
      amount: amount * 100, // Razorpay expects amount in paise
      currency: 'INR',
      receipt: `receipt_${Date.now()}`,
      notes: {
        userId,
        plan
      }
    };
    
    const order = await razorpay.orders.create(options);
    res.json({ success: true, orderId: order.id, amount: order.amount });
  } catch (error) {
    console.error('Payment order creation error:', error);
    res.status(500).json({ error: error.message || 'Failed to create payment order' });
  }
});

app.post('/api/payments/verify', async (req, res) => {
  try {
    const { orderId, paymentId, signature, userId, plan } = req.body;
    
    if (!razorpay || !razorpay.key_secret || razorpay.key_secret === 'YOUR_SECRET') {
      return res.status(500).json({ error: 'Payment gateway not configured' });
    }
    
    const generatedSignature = crypto
      .createHmac('sha256', razorpay.key_secret)
      .update(`${orderId}|${paymentId}`)
      .digest('hex');
    
    if (generatedSignature !== signature) {
      return res.status(400).json({ error: 'Invalid payment signature' });
    }
    
    // Update user subscription
    const user = users[userId];
    if (user) {
      user.plan = plan;
      subscriptions[paymentId] = {
        userId,
        plan,
        amount: req.body.amount,
        paymentId,
        orderId,
        createdAt: new Date().toISOString()
      };
      
      saveData('users.json', users);
      saveData('subscriptions.json', subscriptions);
      
      // Send invoice email
      if (transporter) {
        try {
          await transporter.sendMail({
            from: process.env.EMAIL_USER,
            to: user.email,
            subject: 'Payment Successful - Invoice',
            html: `
              <h2>Payment Successful</h2>
              <p>Thank you for your subscription!</p>
              <p><strong>Plan:</strong> ${plan}</p>
              <p><strong>Amount:</strong> ₹${req.body.amount / 100}</p>
              <p><strong>Payment ID:</strong> ${paymentId}</p>
              <p><strong>Order ID:</strong> ${orderId}</p>
              <p><strong>Date:</strong> ${new Date().toLocaleString()}</p>
            `
          });
        } catch (err) {
          console.error('Invoice email error:', err);
        }
      } else {
        console.log('Email not configured. Invoice not sent.');
      }
      
      res.json({ success: true, message: 'Payment verified and subscription updated' });
    } else {
      res.status(404).json({ error: 'User not found' });
    }
  } catch (error) {
    console.error('Payment verification error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get user plan and watch time limit
app.get('/api/users/:userId/plan', (req, res) => {
  const user = users[req.params.userId];
  if (!user) return res.status(404).json({ error: 'User not found' });
  
  const watchTimeLimits = {
    free: 300, // 5 minutes in seconds
    bronze: 420, // 7 minutes
    silver: 600, // 10 minutes
    gold: Infinity
  };
  
  res.json({
    plan: user.plan,
    watchTimeLimit: watchTimeLimits[user.plan] || 300
  });
});

// Test endpoint
app.get('/api/test', (req, res) => {
  res.json({ status: 'ok', message: 'Server is working!' });
});

// Serve main page (must be before 404 handler)
app.get('/', (req, res) => {
  try {
    const indexPath = path.join(__dirname, 'public', 'index.html');
    if (!fs.existsSync(indexPath)) {
      return res.status(404).send('index.html not found. Please check the public directory.');
    }
    res.sendFile(indexPath);
  } catch (error) {
    console.error('Error serving index:', error);
    res.status(500).send('Error loading page');
  }
});

// 404 handler (must be after all routes)
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Error handling middleware (must be last)
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({ error: 'Internal server error', message: err.message });
});

// WebSocket for VoIP
io.on('connection', (socket) => {
  console.log('User connected:', socket.id);
  
  socket.on('join-room', (roomId) => {
    socket.join(roomId);
    socket.to(roomId).emit('user-joined', socket.id);
  });
  
  socket.on('offer', (data) => {
    socket.to(data.roomId).emit('offer', { offer: data.offer, from: socket.id });
  });
  
  socket.on('answer', (data) => {
    socket.to(data.roomId).emit('answer', { answer: data.answer, from: socket.id });
  });
  
  socket.on('ice-candidate', (data) => {
    socket.to(data.roomId).emit('ice-candidate', { candidate: data.candidate, from: socket.id });
  });
  
  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
  });
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  // Don't exit, just log
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  // Don't exit, just log
});

const PORT = process.env.PORT || 3001;

// Start server with error handling
try {
  server.listen(PORT, '0.0.0.0', () => {
    console.log('\n========================================');
    console.log('🚀 Server is running!');
    console.log('========================================');
    console.log(`📍 Local:   http://localhost:${PORT}`);
    console.log(`🌐 Network: http://0.0.0.0:${PORT}`);
    console.log('========================================\n');
    console.log('💡 Open your browser and visit: http://localhost:' + PORT);
    console.log('📝 Press Ctrl+C to stop the server\n');
  });
  
  server.on('error', (error) => {
    if (error.code === 'EADDRINUSE') {
      console.error(`Port ${PORT} is already in use. Please use a different port.`);
      process.exit(1);
    } else {
      console.error('Server error:', error);
    }
  });
} catch (error) {
  console.error('Failed to start server:', error);
  process.exit(1);
}

