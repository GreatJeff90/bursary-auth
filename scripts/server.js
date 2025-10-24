const express = require('express');
const bodyParser = require('body-parser');
const bcrypt = require('bcryptjs');
const nodemailer = require('nodemailer');
const sqlite3 = require('sqlite3').verbose();
const { v4: uuidv4 } = require('uuid');

const app = express();
const port = 3000;

const cors = require('cors');
app.use(cors());

// Middleware
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Serve static files from the frontend (if you want to serve the HTML from the same server)
app.use(express.static('../bursary-system')); // Adjust the path to your frontend folder

// Database setup
const db = new sqlite3.Database('./bursary.db', (err) => {
  if (err) {
    console.error('Error opening database:', err);
  } else {
    console.log('Connected to SQLite database.');
    // Create tables if they don't exist
    db.run(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id TEXT UNIQUE NOT NULL,
        username TEXT UNIQUE NOT NULL,
        email TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
    db.run(`
      CREATE TABLE IF NOT EXISTS otps (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id TEXT NOT NULL,
        otp_code TEXT NOT NULL,
        expires_at DATETIME NOT NULL,
        used INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
    db.run(`
      CREATE TABLE IF NOT EXISTS authentication_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id TEXT NOT NULL,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        status TEXT NOT NULL,
        ip_address TEXT
      )
    `);
  }
});

// Configure Nodemailer for sending OTP emails
// For testing, you can use Ethereal (https://ethereal.email/) to create a fake SMTP service
const transporter = nodemailer.createTransporter({
  host: 'smtp.ethereal.email',
  port: 587,
  auth: {
    user: 'your-ethereal-email@ethereal.email', // replace with your Ethereal email
    pass: 'your-ethereal-password' // replace with your Ethereal password
  }
});

// Helper function to send email
async function sendOtpEmail(email, otp) {
  const mailOptions = {
    from: '"University Bursary" <noreply@uniport.edu.ng>',
    to: email,
    subject: 'Your OTP for Bursary System',
    text: `Your OTP is: ${otp}. It will expire in 10 minutes.`,
    html: `<p>Your OTP is: <strong>${otp}</strong></p><p>It will expire in 10 minutes.</p>`
  };

  try {
    let info = await transporter.sendMail(mailOptions);
    console.log('OTP email sent: %s', info.messageId);
    return true;
  } catch (error) {
    console.error('Error sending OTP email:', error);
    return false;
  }
}

// Routes

// User registration (for testing, you can add a route to register users)
app.post('/register', async (req, res) => {
  const { username, email, password } = req.body;
  const userId = uuidv4();
  const hashedPassword = await bcrypt.hash(password, 10);

  db.run(
    'INSERT INTO users (user_id, username, email, password) VALUES (?, ?, ?, ?)',
    [userId, username, email, hashedPassword],
    function(err) {
      if (err) {
        return res.status(400).json({ success: false, message: 'User already exists' });
      }
      res.json({ success: true, message: 'User registered' });
    }
  );
});

// Login endpoint
app.post('/login', (req, res) => {
  const { username, password } = req.body;

  db.get(
    'SELECT * FROM users WHERE username = ?',
    [username],
    async (err, user) => {
      if (err) {
        return res.status(500).json({ success: false, message: 'Database error' });
      }
      if (!user) {
        return res.status(400).json({ success: false, message: 'Invalid username or password' });
      }

      const isMatch = await bcrypt.compare(password, user.password);
      if (!isMatch) {
        return res.status(400).json({ success: false, message: 'Invalid username or password' });
      }

      // Generate OTP
      const otp = Math.floor(100000 + Math.random() * 900000).toString();
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

      // Save OTP to database
      db.run(
        'INSERT INTO otps (user_id, otp_code, expires_at) VALUES (?, ?, ?)',
        [user.user_id, otp, expiresAt.toISOString()],
        async function(err) {
          if (err) {
            return res.status(500).json({ success: false, message: 'Error generating OTP' });
          }

          // Send OTP via email
          const emailSent = await sendOtpEmail(user.email, otp);
          if (!emailSent) {
            return res.status(500).json({ success: false, message: 'Error sending OTP email' });
          }

          // Log the authentication attempt
          db.run(
            'INSERT INTO authentication_logs (user_id, status, ip_address) VALUES (?, ?, ?)',
            [user.user_id, 'OTP_SENT', req.ip]
          );

          res.json({ success: true, message: 'OTP sent to your email' });
        }
      );
    }
  );
});

// OTP verification endpoint
app.post('/verify-otp', (req, res) => {
  const { username, otp } = req.body;

  // First, get the user
  db.get(
    'SELECT * FROM users WHERE username = ?',
    [username],
    (err, user) => {
      if (err || !user) {
        return res.status(400).json({ success: false, message: 'Invalid user' });
      }

      // Check the OTP
      db.get(
        `SELECT * FROM otps 
         WHERE user_id = ? AND otp_code = ? AND used = 0 AND expires_at > datetime('now')`,
        [user.user_id, otp],
        (err, otpRecord) => {
          if (err || !otpRecord) {
            // Log failed attempt
            db.run(
              'INSERT INTO authentication_logs (user_id, status, ip_address) VALUES (?, ?, ?)',
              [user.user_id, 'OTP_FAILED', req.ip]
            );
            return res.status(400).json({ success: false, message: 'Invalid or expired OTP' });
          }

          // Mark OTP as used
          db.run(
            'UPDATE otps SET used = 1 WHERE id = ?',
            [otpRecord.id],
            (err) => {
              if (err) {
                return res.status(500).json({ success: false, message: 'Error verifying OTP' });
              }

              // Log successful authentication
              db.run(
                'INSERT INTO authentication_logs (user_id, status, ip_address) VALUES (?, ?, ?)',
                [user.user_id, 'LOGIN_SUCCESS', req.ip]
              );

              // In a real application, you would create a session or JWT token here
              res.json({ success: true, message: 'OTP verified successfully' });
            }
          );
        }
      );
    }
  );
});

// Start the server
app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});