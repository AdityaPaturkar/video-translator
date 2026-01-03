# Video Platform

A comprehensive video platform with comments, downloads, subscriptions, VoIP, and advanced features.

## Features

### 1. Comment System
- Multi-language comment support
- Translation feature for comments
- Like/Dislike functionality
- City name display with comments
- Automatic removal of comments with special characters
- Auto-removal of comments with 2+ dislikes

### 2. Video Download
- Download videos directly from the website
- Free users: 1 video per day limit
- Premium plan for unlimited downloads
- Download history in user profile

### 3. Subscription Plans
- **Free Plan**: 5 minutes watch time
- **Bronze Plan**: 7 minutes watch time (₹10)
- **Silver Plan**: 10 minutes watch time (₹50)
- **Gold Plan**: Unlimited watch time (₹100)
- Razorpay payment gateway integration
- Email invoice after successful payment

### 4. Dynamic Theme
- White theme: 10 AM - 12 PM in South India states
- Dark theme: All other times and locations
- Automatic theme switching based on time and location

### 5. OTP Verification
- Email OTP for users in South India (Tamil Nadu, Kerala, Karnataka, Andhra Pradesh, Telangana)
- SMS OTP for users in other states

### 6. Custom Video Player
- **Double-tap right**: Forward 10 seconds
- **Double-tap left**: Backward 10 seconds
- **Single-tap middle**: Pause/Play
- **Triple-tap middle**: Next video
- **Triple-tap right**: Close website
- **Triple-tap left**: Show comment section

### 7. VoIP Features
- Video calls between users
- Screen sharing (YouTube website)
- Video call recording
- Local storage of recordings

## Installation

1. Install dependencies:
```bash
npm install
```

2. Create a `.env` file in the root directory with the following variables:
```
RAZORPAY_KEY_ID=your_razorpay_key_id
RAZORPAY_KEY_SECRET=your_razorpay_key_secret
EMAIL_USER=your_email@gmail.com
EMAIL_PASS=your_app_password
TWILIO_ACCOUNT_SID=your_twilio_account_sid
TWILIO_AUTH_TOKEN=your_twilio_auth_token
TWILIO_PHONE=your_twilio_phone_number
PORT=3000
```

3. Update Razorpay key in `public/app.js`:
   - Replace `'rzp_test_YOUR_KEY'` with your actual Razorpay key ID

4. Start the server:
```bash
npm start
```

For development with auto-reload:
```bash
npm run dev
```

5. Open your browser and navigate to:
```
http://localhost:3000
```

## Configuration

### Razorpay Setup
1. Sign up at [Razorpay](https://razorpay.com/)
2. Get your API keys from the dashboard
3. Add them to `.env` file

### Email Setup (Gmail)
1. Enable 2-factor authentication
2. Generate an app password
3. Use the app password in `.env` file

### Twilio Setup (SMS)
1. Sign up at [Twilio](https://www.twilio.com/)
2. Get your Account SID and Auth Token
3. Get a phone number
4. Add credentials to `.env` file

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login user
- `POST /api/auth/verify-otp` - Verify OTP

### Comments
- `GET /api/comments/:videoId` - Get comments for a video
- `POST /api/comments` - Create a comment
- `POST /api/comments/:commentId/like` - Like a comment
- `POST /api/comments/:commentId/dislike` - Dislike a comment

### Downloads
- `POST /api/videos/:videoId/download` - Download a video
- `GET /api/users/:userId/downloads` - Get user's downloads

### Subscriptions
- `POST /api/payments/create-order` - Create payment order
- `POST /api/payments/verify` - Verify payment
- `GET /api/users/:userId/plan` - Get user plan details

## Usage

### Register/Login
1. Click "Login" button
2. Enter email and password
3. Complete OTP verification (email or SMS based on location)

### Comment on Videos
1. Triple-tap left side of video to open comments
2. Write a comment (no special characters allowed)
3. Use translate button to translate comments
4. Like/Dislike comments

### Download Videos
1. Click "Download Video" button
2. Free users can download 1 video per day
3. Upgrade to premium for unlimited downloads

### Upgrade Plan
1. Click "Upgrade Plan" button
2. Select a plan (Bronze, Silver, or Gold)
3. Complete payment via Razorpay
4. Receive invoice via email

### Video Player Gestures
- Use tap gestures on video player for various controls
- Watch time is tracked and limited based on your plan

### Video Calls
1. Click "Start Video Call" button
2. Enter or create a room ID
3. Share screen to show YouTube website
4. Record the call session
5. Recording is saved locally

## Data Storage

The application uses JSON files for data storage (located in `data/` directory):
- `users.json` - User accounts
- `comments.json` - Comments
- `videos.json` - Video metadata
- `downloads.json` - Download history
- `subscriptions.json` - Subscription records

**Note**: For production, migrate to a proper database (MongoDB, PostgreSQL, etc.)

## Security Notes

- Passwords are stored in plain text (for demo). Use bcrypt in production.
- Add proper authentication middleware
- Implement rate limiting
- Add input validation and sanitization
- Use HTTPS in production
- Secure WebSocket connections

## Browser Compatibility

- Modern browsers with WebRTC support
- Chrome, Firefox, Edge (latest versions)
- Mobile browsers may have limited gesture support

## License

ISC

