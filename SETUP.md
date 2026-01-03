# Quick Setup Guide

## Step 1: Install Dependencies
```bash
npm install
```

## Step 2: Initialize Data Files
```bash
npm run init
```

## Step 3: Configure Environment Variables

Create a `.env` file in the root directory with:

```
RAZORPAY_KEY_ID=your_razorpay_key_id
RAZORPAY_KEY_SECRET=your_razorpay_key_secret
EMAIL_USER=your_email@gmail.com
EMAIL_PASS=your_gmail_app_password
TWILIO_ACCOUNT_SID=your_twilio_account_sid
TWILIO_AUTH_TOKEN=your_twilio_auth_token
TWILIO_PHONE=+1234567890
PORT=3000
```

**Note**: If you don't have these services set up yet, the app will still run but some features (payment, email, SMS) won't work.

## Step 4: Update Razorpay Key in Frontend

Edit `public/app.js` and replace:
```javascript
key: 'rzp_test_YOUR_KEY', // Replace with your Razorpay key
```
with your actual Razorpay key ID.

## Step 5: Start the Server
```bash
npm start
```

Or for development with auto-reload:
```bash
npm run dev
```

## Step 6: Access the Application
Open your browser and go to:
```
http://localhost:3000
```

## Testing Without External Services

If you want to test the app without setting up Razorpay, Email, or Twilio:

1. **Payment**: The payment UI will work, but you'll need to mock the verification in development
2. **Email OTP**: Comment out email sending code or use a test email service
3. **SMS OTP**: Comment out SMS sending code or use Twilio's test credentials

## Creating a Test User

You can create a test user by making a POST request to `/api/auth/register`:

```bash
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "test123",
    "name": "Test User",
    "phone": "+1234567890"
  }'
```

Or use the login form in the UI (you'll need to register first through the API or add registration UI).

## Features to Test

1. **Comments**: Triple-tap left side of video to open comments
2. **Video Gestures**: Try different tap combinations on the video
3. **Download**: Click download button (1 per day for free users)
4. **Theme**: The theme changes based on time and location
5. **VoIP**: Click "Start Video Call" to test video calling

## Troubleshooting

### Port Already in Use
Change the PORT in `.env` or kill the process using port 3000

### Module Not Found
Run `npm install` again

### Data Files Not Found
Run `npm run init` to create data files

### Geolocation Not Working
The app will default to "Unknown" location if geolocation is denied

### Video Player Not Working
Make sure you're using a modern browser with video support

