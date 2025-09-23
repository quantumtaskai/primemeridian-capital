require('dotenv').config();
const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const session = require('express-session');
const rateLimit = require('express-rate-limit');
const bcrypt = require('bcrypt');
const helmet = require('helmet');
const createDOMPurify = require('dompurify');
const { JSDOM } = require('jsdom');

const window = new JSDOM('').window;
const DOMPurify = createDOMPurify(window);

const app = express();
const PORT = process.env.PORT || 3000;

// Trust proxy if configured (for HTTPS headers from reverse proxy)
if (process.env.TRUST_PROXY === 'true') {
  app.set('trust proxy', 1);
}

// Basic logging function
function log(level, message, meta = {}) {
  const logLevel = process.env.LOG_LEVEL || 'info';
  const logFormat = process.env.LOG_FORMAT || 'simple';

  const levels = { error: 0, warn: 1, info: 2, verbose: 3, debug: 4 };
  if (levels[level] > levels[logLevel]) return;

  const timestamp = new Date().toISOString();
  const appInfo = {
    app: process.env.APP_NAME || 'primemeridian-capital',
    version: process.env.APP_VERSION || '1.0.0',
    env: process.env.DEPLOYMENT_ENV || process.env.NODE_ENV || 'development'
  };

  if (logFormat === 'json') {
    console.log(JSON.stringify({ timestamp, level, message, ...appInfo, ...meta }));
  } else {
    console.log(`[${timestamp}] ${level.toUpperCase()}: ${message}`);
  }
}

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
}));

// CORS configuration
const allowedOrigins = process.env.ALLOWED_ORIGINS ?
  process.env.ALLOWED_ORIGINS.split(',') :
  ['http://localhost:3000', 'http://localhost'];

app.use(cors({
  origin: allowedOrigins,
  credentials: true
}));

// Configure request size limits
const requestSizeLimit = process.env.MAX_REQUEST_SIZE || '10mb';
app.use(express.json({ limit: requestSizeLimit }));
app.use(express.urlencoded({ extended: true, limit: requestSizeLimit }));

// Add access logging middleware if enabled
if (process.env.ENABLE_ACCESS_LOGS === 'true') {
  app.use((req, res, next) => {
    const start = Date.now();
    res.on('finish', () => {
      const duration = Date.now() - start;
      log('info', 'HTTP Request', {
        method: req.method,
        url: req.url,
        status: res.statusCode,
        duration,
        ip: req.ip,
        userAgent: req.get('user-agent')
      });
    });
    next();
  });
}

app.use(session({
  secret: process.env.SESSION_SECRET || 'fallback-insecure-secret-change-me',
  resave: false,
  saveUninitialized: false,
  name: 'sessionId',
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
    sameSite: 'strict'
  }
}));

// Rate limiters (configurable via environment)
const loginLimiter = rateLimit({
  windowMs: parseInt(process.env.LOGIN_RATE_LIMIT_WINDOW) || 15 * 60 * 1000, // 15 minutes
  max: parseInt(process.env.LOGIN_RATE_LIMIT_MAX) || 5, // 5 attempts per window
  message: { error: 'Too many login attempts, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

const contactLimiter = rateLimit({
  windowMs: parseInt(process.env.CONTACT_RATE_LIMIT_WINDOW) || 60 * 1000, // 1 minute
  max: parseInt(process.env.CONTACT_RATE_LIMIT_MAX) || 3, // 3 submissions per minute per IP
  message: { error: 'Too many submissions, please wait before trying again.' },
  standardHeaders: true,
  legacyHeaders: false,
});

const submissionsFile = path.join(__dirname, 'submissions.json');

function sanitizeInput(input) {
  if (typeof input !== 'string') return input;
  return DOMPurify.sanitize(input, { ALLOWED_TAGS: [] });
}

function saveSubmission(data) {
  try {
    let submissions = [];
    if (fs.existsSync(submissionsFile)) {
      const fileContent = fs.readFileSync(submissionsFile, 'utf8');
      submissions = JSON.parse(fileContent);
    }

    const sanitizedData = {};
    for (const [key, value] of Object.entries(data)) {
      sanitizedData[key] = sanitizeInput(value);
    }

    const submission = {
      id: Date.now(),
      timestamp: new Date().toISOString(),
      ...sanitizedData
    };

    submissions.push(submission);
    fs.writeFileSync(submissionsFile, JSON.stringify(submissions, null, 2));
    return true;
  } catch (error) {
    console.error('Error saving submission:', error);
    return false;
  }
}

function requireAuth(req, res, next) {
  if (req.session && req.session.authenticated) {
    next();
  } else {
    if (req.path === '/api/admin') {
      res.redirect('/api/login');
    } else {
      res.status(401).json({ error: 'Authentication required' });
    }
  }
}


app.get('/health', (req, res) => {
  res.status(200).json({ status: 'OK', timestamp: new Date().toISOString() });
});

app.post('/api/contact', contactLimiter, async (req, res) => {
  try {
    const { firstName, lastName, email, phone, company, inquiry, message } = req.body;

    if (!firstName || !lastName || !email || !message) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: firstName, lastName, email, and message are required.'
      });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid email address format.'
      });
    }

    saveSubmission({
      firstName,
      lastName,
      email,
      phone,
      company,
      inquiry,
      message
    });

    res.status(200).json({
      success: true,
      message: 'Contact form submitted successfully'
    });

  } catch (error) {
    console.error('Form submission error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to submit form. Please try again later.'
    });
  }
});

app.get('/api/login', (req, res) => {
  if (req.session && req.session.authenticated) {
    return res.redirect('/api/admin');
  }

  const error = req.query.error;
  const html = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Admin Login - Prime Meridian Capital</title>
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            background: linear-gradient(135deg, #000000, #333333);
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            color: #333;
        }
        .login-container {
            background: white;
            padding: 40px;
            border-radius: 12px;
            box-shadow: 0 20px 40px rgba(0,0,0,0.3);
            width: 100%;
            max-width: 400px;
            text-align: center;
        }
        .logo {
            margin-bottom: 30px;
        }
        .logo h1 {
            color: #000;
            font-size: 24px;
            font-weight: 600;
            margin-bottom: 5px;
        }
        .logo .gold { color: #D4AF37; }
        .subtitle { color: #666; font-size: 14px; margin-bottom: 30px; }
        .form-group {
            margin-bottom: 20px;
            text-align: left;
        }
        label {
            display: block;
            margin-bottom: 5px;
            color: #333;
            font-weight: 500;
        }
        input[type="email"], input[type="password"] {
            width: 100%;
            padding: 12px 16px;
            border: 2px solid #e1e5e9;
            border-radius: 6px;
            font-size: 16px;
            transition: border-color 0.3s;
        }
        input[type="email"]:focus, input[type="password"]:focus {
            outline: none;
            border-color: #D4AF37;
        }
        .login-btn {
            width: 100%;
            background: linear-gradient(135deg, #000000, #333333);
            color: white;
            border: none;
            padding: 14px;
            border-radius: 6px;
            font-size: 16px;
            font-weight: 600;
            cursor: pointer;
            transition: transform 0.2s, box-shadow 0.2s;
        }
        .login-btn:hover {
            transform: translateY(-1px);
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        }
        .login-btn:active {
            transform: translateY(0);
        }
        .error {
            background: #fee;
            color: #c33;
            padding: 12px;
            border-radius: 6px;
            margin-bottom: 20px;
            border-left: 4px solid #c33;
            text-align: left;
        }
        .footer {
            margin-top: 30px;
            color: #999;
            font-size: 12px;
        }
    </style>
</head>
<body>
    <div class="login-container">
        <div class="logo">
            <h1>Prime Meridian <span class="gold">Capital</span></h1>
        </div>
        <div class="subtitle">Admin Dashboard Access</div>

        ${error ? `<div class="error">${error}</div>` : ''}

        <form method="POST" action="/api/login">
            <div class="form-group">
                <label for="email">Email Address</label>
                <input type="email" id="email" name="email" required autocomplete="email">
            </div>

            <div class="form-group">
                <label for="password">Password</label>
                <input type="password" id="password" name="password" required autocomplete="current-password">
            </div>

            <button type="submit" class="login-btn">Sign In</button>
        </form>

        <div class="footer">
            Prime Meridian Capital &copy; 2025
        </div>
    </div>
</body>
</html>`;

  res.send(html);
});

app.post('/api/login', loginLimiter, async (req, res) => {
  const { email, password } = req.body;

  try {
    const adminEmail = process.env.ADMIN_EMAIL;
    const adminPasswordHash = process.env.ADMIN_PASSWORD_HASH;

    if (!adminEmail || !adminPasswordHash) {
      console.error('Admin credentials not configured');
      return res.redirect('/api/login?error=System configuration error');
    }

    if (email === adminEmail && await bcrypt.compare(password, adminPasswordHash)) {
      // Regenerate session ID for security
      req.session.regenerate((err) => {
        if (err) {
          console.error('Session regeneration error:', err);
          return res.redirect('/api/login?error=Login failed');
        }

        req.session.authenticated = true;
        req.session.user = { email };
        res.redirect('/api/admin');
      });
    } else {
      res.redirect('/api/login?error=Invalid email or password');
    }
  } catch (error) {
    console.error('Login error:', error);
    res.redirect('/api/login?error=Login failed');
  }
});

app.get('/api/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      console.error('Session destroy error:', err);
    }
    res.redirect('/api/login');
  });
});

app.get('/api/admin', requireAuth, (req, res) => {
  try {
    let submissions = [];
    if (fs.existsSync(submissionsFile)) {
      const fileContent = fs.readFileSync(submissionsFile, 'utf8');
      submissions = JSON.parse(fileContent);
    }

    const html = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Contact Form Submissions - Prime Meridian Capital</title>
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; background: #f5f5f5; }
        .container { max-width: 1200px; margin: 0 auto; background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        h1 { color: #333; text-align: center; margin-bottom: 30px; }
        .stats { display: flex; gap: 20px; margin-bottom: 20px; flex-wrap: wrap; }
        .stat { background: #f8f9fa; padding: 15px; border-radius: 6px; flex: 1; min-width: 150px; }
        .stat-number { font-size: 24px; font-weight: bold; color: #007bff; }
        .stat-label { color: #666; font-size: 14px; }
        .export-btn { background: #28a745; color: white; padding: 10px 20px; border: none; border-radius: 4px; cursor: pointer; margin-bottom: 20px; }
        .export-btn:hover { background: #218838; }
        table { width: 100%; border-collapse: collapse; margin-top: 20px; }
        th, td { padding: 12px; text-align: left; border-bottom: 1px solid #ddd; }
        th { background: #f8f9fa; font-weight: 600; }
        tr:hover { background: #f5f5f5; }
        .inquiry-badge { padding: 4px 8px; border-radius: 4px; font-size: 12px; font-weight: bold; }
        .ma-advisory { background: #e3f2fd; color: #1976d2; }
        .capital-advisory { background: #f3e5f5; color: #7b1fa2; }
        .strategic-consulting { background: #e8f5e8; color: #388e3c; }
        .other { background: #fff3e0; color: #f57c00; }
        .message-cell { max-width: 300px; word-wrap: break-word; }
        @media (max-width: 768px) {
            .container { margin: 10px; padding: 15px; }
            table { font-size: 14px; }
            th, td { padding: 8px; }
            .stats { flex-direction: column; }
        }
    </style>
</head>
<body>
    <div class="container">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 30px;">
            <h1 style="margin: 0;">Contact Form Submissions</h1>
            <a href="/api/logout" style="background: #dc3545; color: white; padding: 8px 16px; text-decoration: none; border-radius: 4px; font-size: 14px;">Logout</a>
        </div>

        <div class="stats">
            <div class="stat">
                <div class="stat-number">${submissions.length}</div>
                <div class="stat-label">Total Submissions</div>
            </div>
            <div class="stat">
                <div class="stat-number">${submissions.filter(s => s.inquiry === 'ma-advisory').length}</div>
                <div class="stat-label">M&A Advisory</div>
            </div>
            <div class="stat">
                <div class="stat-number">${submissions.filter(s => s.inquiry === 'capital-advisory').length}</div>
                <div class="stat-label">Capital Advisory</div>
            </div>
            <div class="stat">
                <div class="stat-number">${submissions.filter(s => s.inquiry === 'strategic-consulting').length}</div>
                <div class="stat-label">Strategic Intelligence</div>
            </div>
        </div>

        <button class="export-btn" onclick="exportCSV()">Export to CSV</button>

        <table>
            <thead>
                <tr>
                    <th>Date</th>
                    <th>Name</th>
                    <th>Email</th>
                    <th>Company</th>
                    <th>Service</th>
                    <th>Message</th>
                </tr>
            </thead>
            <tbody>
                ${submissions.reverse().map(sub => `
                    <tr>
                        <td>${new Date(sub.timestamp).toLocaleDateString()}</td>
                        <td>${sub.firstName} ${sub.lastName}</td>
                        <td>${sub.email}</td>
                        <td>${sub.company || '-'}</td>
                        <td><span class="inquiry-badge ${sub.inquiry || 'other'}">${
                            sub.inquiry === 'ma-advisory' ? 'M&A Advisory' :
                            sub.inquiry === 'capital-advisory' ? 'Capital Advisory' :
                            sub.inquiry === 'strategic-consulting' ? 'Strategic Intelligence' :
                            'Other'
                        }</span></td>
                        <td class="message-cell">${sub.message}</td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    </div>

    <script>
        function exportCSV() {
            const data = ${JSON.stringify(submissions)};
            const csv = [
                ['Date', 'First Name', 'Last Name', 'Email', 'Phone', 'Company', 'Service Interest', 'Message'],
                ...data.map(row => [
                    new Date(row.timestamp).toLocaleDateString(),
                    row.firstName,
                    row.lastName,
                    row.email,
                    row.phone || '',
                    row.company || '',
                    row.inquiry || '',
                    row.message
                ])
            ].map(row => row.map(field => '"' + (field || '').replace(/"/g, '""') + '"').join(',')).join('\\n');

            const blob = new Blob([csv], { type: 'text/csv' });
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'contact-submissions-' + new Date().toISOString().split('T')[0] + '.csv';
            a.click();
            window.URL.revokeObjectURL(url);
        }
    </script>
</body>
</html>`;

    res.send(html);
  } catch (error) {
    console.error('Error loading admin page:', error);
    res.status(500).json({ error: 'Failed to load submissions' });
  }
});

app.use('*', (req, res) => {
  res.status(404).json({ success: false, error: 'Endpoint not found' });
});

app.listen(PORT, () => {
  log('info', `Prime Meridian Capital API server started`, {
    port: PORT,
    environment: process.env.NODE_ENV || 'development',
    timestamp: new Date().toISOString()
  });
});