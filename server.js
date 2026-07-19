/************************************************************
 * SMS Adda v4.0 — server.js
 * Firebase: nepchat-aac9d | Cloudinary: uxj2a5iv
 * Messages: Firebase RTDB | Files: Cloudinary CDN
 * Voice Calls: Socket.IO + WebRTC | Push: Firebase FCM
 ************************************************************/

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const helmet = require('helmet');
const compression = require('compression');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

const admin = require('firebase-admin');
const cloudinary = require('cloudinary').v2;

/************************************************************
 CONFIGURATION
************************************************************/
const PORT = process.env.PORT || 3000;

// Firebase Admin - Load service account
const serviceAccount = require('./firebase-service-account.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: 'https://nepchat-aac9d-default-rtdb.firebaseio.com',
});

const db = admin.database();
console.log('[FIREBASE] Initialized:', serviceAccount.client_email);

// Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME || 'uxj2a5iv',
  api_key: process.env.CLOUDINARY_API_KEY || '916475527515219',
  api_secret: process.env.CLOUDINARY_API_SECRET,
});
console.log('[CLOUDINARY] Configured: uxj2a5iv');

// VAPID Keys for FCM Web Push
const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY || 'BFkam7-GFehRcCNIC5Q0dPk6Alfo671_IsGu1z0M-O__goOMYUSCr6ftAuhkl9E_A2Dvuzj9rjaKO_8ACEX2kQk';
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY || 'wYMHWFUNcPRGSEEue9vnAGbS5qXweddLq8qgw7iM78Q';

/************************************************************
 EXPRESS SETUP
************************************************************/
const app = express();
const server = http.createServer(app);

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: [
        "'self'",
        "'unsafe-inline'",
        "'unsafe-eval'",
        "'unsafe-hashes'",
        "https://www.gstatic.com",
        "https://cdn.socket.io",
        "https://unpkg.com",
        "https://apis.google.com",
        "https://*.firebaseio.com"
      ],
      scriptSrcAttr: ["'unsafe-inline'", "'unsafe-hashes'"],
      styleSrc: [
        "'self'",
        "'unsafe-inline'",
        "https://fonts.googleapis.com"
      ],
      fontSrc: [
        "'self'",
        "https://fonts.gstatic.com",
        "data:"
      ],
      imgSrc: [
        "'self'",
        "data:",
        "blob:",
        "https://res.cloudinary.com",
        "https://*.googleusercontent.com",
        "*"
      ],
      mediaSrc: [
        "'self'",
        "blob:",
        "https://res.cloudinary.com",
        "*"
      ],
      connectSrc: [
        "'self'",
        "ws:",
        "wss:",
        "https://nepchat-aac9d-default-rtdb.firebaseio.com",
        "https://*.firebaseio.com",
        "https://*.cloudinary.com",
        "https://*.googleapis.com",
        "https://apis.google.com",
        "https://identitytoolkit.googleapis.com",
        "https://securetoken.googleapis.com",
        "https://firebaseinstallations.googleapis.com"
      ],
      frameSrc: [
        "'self'",
        "https://nepchat-aac9d.firebaseapp.com",
        "https://*.firebaseapp.com",
        "https://apis.google.com",
        "https://*.google.com"
      ],
      workerSrc: ["'self'", "blob:"],
      manifestSrc: ["'self'"],
    },
  },
  crossOriginEmbedderPolicy: false,
  crossOriginResourcePolicy: { policy: "cross-origin" },
  crossOriginOpenerPolicy: { policy: "same-origin-allow-popups" },
}));

app.use(compression());
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
}));

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Serve static files
app.use(express.static(__dirname, {
  index: false,
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('.html')) {
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    }
    if (filePath.endsWith('.js')) {
      res.setHeader('Service-Worker-Allowed', '/');
    }
  },
}));

/************************************************************
 ROUTES
************************************************************/

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    version: '4.0.0',
    project: 'nepchat-aac9d',
    cloudinary: 'uxj2a5iv',
    timestamp: Date.now()
  });
});

// Firebase config for client
app.get('/firebase-config', (req, res) => {
  res.json({
    apiKey: "AIzaSyCoKAoarWlu8B6cnIw549hfg_UPe8YRSko",
    authDomain: "nepchat-aac9d.firebaseapp.com",
    databaseURL: "https://nepchat-aac9d-default-rtdb.firebaseio.com",
    projectId: "nepchat-aac9d",
    storageBucket: "nepchat-aac9d.firebasestorage.app",
    messagingSenderId: "179485804786",
    appId: "1:179485804786:web:3ec8a2fc563b08c682286b"
  });
});

// VAPID public key for FCM
app.get('/vapid-public-key', (req, res) => {
  res.json({ publicKey: VAPID_PUBLIC_KEY });
});

// ============ CLOUDINARY UPLOAD ============
app.post('/upload', async (req, res) => {
  try {
    const { file, type, filename } = req.body;

    if (!file) {
      return res.status(400).json({ error: 'No file provided' });
    }

    const publicId = `sms-adda/${uuidv4()}`;

    const uploadOptions = {
      folder: 'sms-adda',
      public_id: publicId,
      resource_type: 'auto',
      transformation: [
        { quality: 'auto:good', fetch_format: 'auto' },
        { flags: 'strip_profile' }
      ],
    };

    const result = await cloudinary.uploader.upload(file, uploadOptions);

    console.log(`[CLOUDINARY] Uploaded: ${publicId} (${(result.bytes / 1024).toFixed(1)} KB)`);

    // Auto-delete non-image files after 48 hours
    if (type && !type.startsWith('image/')) {
      setTimeout(async () => {
        try {
          await cloudinary.uploader.destroy(publicId);
          console.log(`[CLOUDINARY] Auto-deleted (48h): ${publicId}`);
        } catch (e) {
          console.error('[CLOUDINARY DELETE ERROR]', e);
        }
      }, 48 * 60 * 60 * 1000);
    }

    res.json({
      success: true,
      url: result.secure_url,
      publicId: result.public_id,
      name: filename || result.original_filename || 'file',
      type: result.resource_type === 'image' ? type || 'image/jpeg' : type || 'application/octet-stream',
      size: result.bytes,
      format: result.format,
      width: result.width,
      height: result.height,
    });
  } catch (error) {
    console.error('[UPLOAD ERROR]', error);
    res.status(500).json({ error: 'Upload failed: ' + error.message });
  }
});

// ============ FCM TOKENS ============
app.post('/fcm-token', (req, res) => {
  const { username, token } = req.body;

  if (!username || !token) {
    return res.status(400).json({ error: 'Username and token required' });
  }

  const cleanUsername = username.toLowerCase().replace(/[.#$\/\[\]]/g, '_');
  const cleanToken = token.replace(/[.#$\/\[\]]/g, '_');

  const tokenRef = db.ref(`fcmTokens/${cleanUsername}/${cleanToken}`);
  tokenRef.set({
    token: token,
    createdAt: admin.database.ServerValue.TIMESTAMP,
    username: username
  });

  console.log(`[FCM] Token saved: ${username}`);
  res.json({ success: true });
});

app.post('/fcm-token-remove', (req, res) => {
  const { username, token } = req.body;

  if (!username || !token) {
    return res.status(400).json({ error: 'Username and token required' });
  }

  const cleanUsername = username.toLowerCase().replace(/[.#$\/\[\]]/g, '_');
  const cleanToken = token.replace(/[.#$\/\[\]]/g, '_');

  db.ref(`fcmTokens/${cleanUsername}/${cleanToken}`).remove();

  console.log(`[FCM] Token removed: ${username}`);
  res.json({ success: true });
});

// Test push endpoint
app.post('/test-push', async (req, res) => {
  const { username } = req.body;

  if (!username) {
    return res.status(400).json({ error: 'Username required' });
  }

  await sendPushNotification(username, {
    title: 'Test Notification',
    body: 'Push notifications are working! 🎉',
    type: 'test',
    tag: 'test-' + Date.now(),
  });

  res.json({ success: true, message: `Test push sent to ${username}` });
});

// ============ HTML PAGES ============
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));
app.get('/welcome.html', (req, res) => res.sendFile(path.join(__dirname, 'welcome.html')));
app.get('/chat.html', (req, res) => res.sendFile(path.join(__dirname, 'chat.html')));
app.get('/download.html', (req, res) => res.sendFile(path.join(__dirname, 'download.html')));

// Service Worker
app.get('/sw.js', (req, res) => {
  res.setHeader('Content-Type', 'application/javascript');
  res.setHeader('Service-Worker-Allowed', '/');
  res.setHeader('Cache-Control', 'no-cache');
  res.sendFile(path.join(__dirname, 'sw.js'));
});

app.get('/firebase-messaging-sw.js', (req, res) => {
  res.setHeader('Content-Type', 'application/javascript');
  res.setHeader('Service-Worker-Allowed', '/');
  res.setHeader('Cache-Control', 'no-cache');
  res.sendFile(path.join(__dirname, 'firebase-messaging-sw.js'));
});

// 404
app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('[SERVER ERROR]', err.message);
  res.status(500).json({ error: 'Internal server error' });
});

/************************************************************
 SOCKET.IO — Voice Call Signaling
************************************************************/
const io = new Server(server, {
  cors: { origin: '*', methods: ['GET', 'POST'] },
  transports: ['websocket', 'polling'],
  pingInterval: 25000,
  pingTimeout: 20000,
});

const activeCalls = new Map();
const userCalls = new Map();
const iceBuffers = new Map();

io.on('connection', (socket) => {
  console.log(`[SOCKET] Connected: ${socket.id}`);

  socket.on('register-call', (data) => {
    if (data?.username) {
      socket.username = data.username;
      socket.join(`user:${data.username.toLowerCase()}`);
    }
  });

  socket.on('call-user', (data, callback) => {
    const { callerUsername, receiverUsername } = data || {};
    if (!callerUsername || !receiverUsername) return callback?.({ error: 'Invalid data' });
    if (userCalls.has(callerUsername.toLowerCase())) return callback?.({ error: 'You are on a call' });
    if (userCalls.has(receiverUsername.toLowerCase())) return callback?.({ error: 'User is busy' });

    const callId = uuidv4();
    activeCalls.set(callId, {
      id: callId, callerUsername, receiverUsername,
      status: 'ringing', startedAt: Date.now(),
    });
    userCalls.set(callerUsername.toLowerCase(), callId);
    userCalls.set(receiverUsername.toLowerCase(), callId);
    iceBuffers.set(callId, []);

    io.to(`user:${receiverUsername.toLowerCase()}`).emit('incoming-call', {
      callId, from: callerUsername,
    });

    // Send push notification for incoming call
    sendPushNotification(receiverUsername, {
      title: `Incoming call from ${callerUsername}`,
      body: 'Tap to answer',
      type: 'incoming_call',
      tag: `call-${callId}`,
      requireInteraction: true,
      data: { callId, caller: callerUsername }
    });

    callback?.({ success: true, callId });
    console.log(`[CALL] ${callerUsername} → ${receiverUsername}`);

    setTimeout(() => {
      const call = activeCalls.get(callId);
      if (call?.status === 'ringing') {
        endCall(callId, 'no-answer');
        io.to(`user:${callerUsername.toLowerCase()}`).emit('call-ended', { callId, reason: 'no-answer' });
        // Missed call push
        sendPushNotification(receiverUsername, {
          title: 'Missed Call',
          body: `Missed call from ${callerUsername}`,
          type: 'missed_call',
          tag: `missed-${callId}`
        });
      }
    }, 30000);
  });

  socket.on('call-accepted', (data) => {
    const call = activeCalls.get(data?.callId);
    if (!call) return;
    call.status = 'active';
    call.acceptedAt = Date.now();
    io.to(`user:${call.callerUsername.toLowerCase()}`).emit('call-accepted', { callId: data.callId });

    const buffer = iceBuffers.get(data.callId) || [];
    buffer.forEach(c => {
      const target = c.from === call.callerUsername.toLowerCase()
        ? `user:${call.receiverUsername.toLowerCase()}`
        : `user:${call.callerUsername.toLowerCase()}`;
      io.to(target).emit('ice-candidate', c);
    });
    iceBuffers.delete(data.callId);
  });

  socket.on('call-rejected', (data) => {
    const call = activeCalls.get(data?.callId);
    if (!call) return;
    io.to(`user:${call.callerUsername.toLowerCase()}`).emit('call-ended', { callId: data.callId, reason: 'declined' });
    endCall(data.callId, 'declined');
  });

  socket.on('call-ended', (data) => {
    const call = activeCalls.get(data?.callId);
    if (!call) return;
    const other = socket.username === call.callerUsername ? call.receiverUsername : call.callerUsername;
    io.to(`user:${other.toLowerCase()}`).emit('call-ended', { callId: data.callId, reason: 'ended' });
    endCall(data.callId, 'ended');
  });

  socket.on('offer', (data) => {
    const call = activeCalls.get(data?.callId);
    if (!call || call.status !== 'active') return;
    const target = socket.username === call.callerUsername ? call.receiverUsername : call.callerUsername;
    io.to(`user:${target.toLowerCase()}`).emit('offer', { callId: data.callId, offer: data.offer });
  });

  socket.on('answer', (data) => {
    const call = activeCalls.get(data?.callId);
    if (!call || call.status !== 'active') return;
    const target = socket.username === call.callerUsername ? call.receiverUsername : call.callerUsername;
    io.to(`user:${target.toLowerCase()}`).emit('answer', { callId: data.callId, answer: data.answer });
  });

  socket.on('ice-candidate', (data) => {
    const call = activeCalls.get(data?.callId);
    if (!call) return;
    const candidate = { callId: data.callId, candidate: data.candidate, from: socket.username?.toLowerCase() };
    const target = socket.username === call.callerUsername ? call.receiverUsername : call.callerUsername;
    if (call.status === 'active') {
      io.to(`user:${target.toLowerCase()}`).emit('ice-candidate', candidate);
    } else {
      const buf = iceBuffers.get(data.callId) || [];
      if (buf.length < 100) buf.push(candidate);
      iceBuffers.set(data.callId, buf);
    }
  });

  socket.on('disconnect', () => {
    if (socket.username) {
      const callId = userCalls.get(socket.username.toLowerCase());
      if (callId) {
        const call = activeCalls.get(callId);
        if (call) {
          const other = socket.username === call.callerUsername ? call.receiverUsername : call.callerUsername;
          io.to(`user:${other.toLowerCase()}`).emit('call-ended', { callId, reason: 'disconnected' });
        }
        endCall(callId, 'disconnected');
      }
    }
  });
});

function endCall(callId, reason) {
  const call = activeCalls.get(callId);
  if (call) {
    userCalls.delete(call.callerUsername.toLowerCase());
    userCalls.delete(call.receiverUsername.toLowerCase());
    activeCalls.delete(callId);
    iceBuffers.delete(callId);
    console.log(`[CALL ENDED] ${callId} - ${reason}`);
  }
}

/************************************************************
 FCM PUSH NOTIFICATIONS
************************************************************/
async function sendPushNotification(username, payload) {
  try {
    const cleanUsername = username.toLowerCase().replace(/[.#$\/\[\]]/g, '_');
    const tokensRef = db.ref(`fcmTokens/${cleanUsername}`);
    const snapshot = await tokensRef.once('value');
    const tokens = snapshot.val();

    if (!tokens) {
      console.log(`[FCM] No tokens found for ${username}`);
      return;
    }

    const tokenValues = Object.values(tokens)
      .map(t => t.token)
      .filter(Boolean);

    if (tokenValues.length === 0) {
      console.log(`[FCM] No valid tokens for ${username}`);
      return;
    }

    console.log(`[FCM] Sending to ${username}: ${tokenValues.length} tokens`);

    const message = {
      notification: {
        title: payload.title || 'SMS Adda',
        body: payload.body || '',
      },
      data: {
        click_action: payload.url || '/chat.html',
        type: payload.type || 'message',
        ...payload.data,
      },
      webpush: {
        notification: {
          icon: '/favicon/favicon-192x192.png',
          badge: '/favicon/favicon-96x96.png',
          vibrate: [200, 100, 200],
          requireInteraction: payload.requireInteraction || false,
          tag: payload.tag || 'sms-adda',
          renotify: true,
        },
        fcmOptions: {
          link: payload.url || '/chat.html',
        },
      },
      tokens: tokenValues,
    };

    const response = await admin.messaging().sendEachForMulticast(message);
    console.log(`[FCM] Sent: ${response.successCount}/${tokenValues.length} delivered`);

    // Clean up invalid tokens
    if (response.failureCount > 0) {
      response.responses.forEach((resp, idx) => {
        if (!resp.success) {
          const tokenKey = tokenValues[idx].replace(/[.#$\/\[\]]/g, '_');
          db.ref(`fcmTokens/${cleanUsername}/${tokenKey}`).remove();
          console.log(`[FCM] Removed invalid token for ${username}`);
        }
      });
    }
  } catch (error) {
    console.error('[FCM ERROR]', error.message);
    if (error.code) console.error('[FCM ERROR CODE]', error.code);
  }
}

/************************************************************
 START SERVER
************************************************************/
server.listen(PORT, () => {
  console.log('');
  console.log('╔══════════════════════════════════════════╗');
  console.log('║     SMS Adda v4.0 — Production Ready     ║');
  console.log('║                                          ║');
  console.log('║   Firebase:   nepchat-aac9d              ║');
  console.log('║   Cloudinary: uxj2a5iv                  ║');
  console.log('║   Messages:   Firebase RTDB             ║');
  console.log('║   Files:      Cloudinary CDN            ║');
  console.log('║   Calls:      Socket.IO + WebRTC        ║');
  console.log('║   Push:       Firebase FCM              ║');
  console.log('║                                          ║');
  console.log(`║   Port:       ${String(PORT).padEnd(26)}║`);
  console.log(`║   URL:        http://localhost:${PORT}      ║`);
  console.log('╚══════════════════════════════════════════╝');
  console.log('');
});