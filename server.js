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

// Firebase Admin
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

/************************************************************
 EXPRESS SETUP
************************************************************/
const app = express();
const server = http.createServer(app);

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'", "'unsafe-hashes'",
        "https://www.gstatic.com", "https://cdn.socket.io", "https://unpkg.com",
        "https://apis.google.com", "https://*.firebaseio.com"],
      scriptSrcAttr: ["'unsafe-inline'", "'unsafe-hashes'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com", "data:"],
      imgSrc: ["'self'", "data:", "blob:", "https://res.cloudinary.com", "https://*.googleusercontent.com", "*"],
      mediaSrc: ["'self'", "blob:", "https://res.cloudinary.com", "*"],
      connectSrc: ["'self'", "ws:", "wss:",
        "https://nepchat-aac9d-default-rtdb.firebaseio.com", "https://*.firebaseio.com",
        "https://*.cloudinary.com", "https://*.googleapis.com", "https://apis.google.com",
        "https://identitytoolkit.googleapis.com", "https://securetoken.googleapis.com",
        "https://firebaseinstallations.googleapis.com"],
      frameSrc: ["'self'", "https://nepchat-aac9d.firebaseapp.com", "https://*.firebaseapp.com",
        "https://apis.google.com", "https://*.google.com"],
      workerSrc: ["'self'", "blob:"],
      manifestSrc: ["'self'"],
    },
  },
  crossOriginEmbedderPolicy: false,
  crossOriginResourcePolicy: { policy: "cross-origin" },
  crossOriginOpenerPolicy: { policy: "same-origin-allow-popups" },
}));

app.use(compression());
app.use(cors({ origin: '*', methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'], allowedHeaders: ['Content-Type', 'Authorization'], credentials: true }));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(express.static(__dirname, { index: false, setHeaders: (res, filePath) => { if (filePath.endsWith('.html')) res.setHeader('Cache-Control', 'no-cache'); if (filePath.endsWith('.js')) res.setHeader('Service-Worker-Allowed', '/'); } }));

/************************************************************
 ROUTES
************************************************************/
app.get('/health', (req, res) => res.json({ status: 'OK', version: '4.0.0', project: 'nepchat-aac9d', cloudinary: 'uxj2a5iv', timestamp: Date.now() }));
app.get('/firebase-config', (req, res) => res.json({ apiKey: "AIzaSyCoKAoarWlu8B6cnIw549hfg_UPe8YRSko", authDomain: "nepchat-aac9d.firebaseapp.com", databaseURL: "https://nepchat-aac9d-default-rtdb.firebaseio.com", projectId: "nepchat-aac9d", storageBucket: "nepchat-aac9d.firebasestorage.app", messagingSenderId: "179485804786", appId: "1:179485804786:web:3ec8a2fc563b08c682286b" }));

// Cloudinary Upload
app.post('/upload', async (req, res) => {
  try {
    const { file, type, filename } = req.body;
    if (!file) return res.status(400).json({ error: 'No file provided' });
    const publicId = `sms-adda/${uuidv4()}`;
    const result = await cloudinary.uploader.upload(file, { folder: 'sms-adda', public_id: publicId, resource_type: 'auto', transformation: [{ quality: 'auto:good', fetch_format: 'auto' }, { flags: 'strip_profile' }] });
    if (type && !type.startsWith('image/')) { setTimeout(async () => { try { await cloudinary.uploader.destroy(publicId); } catch (e) {} }, 48 * 60 * 60 * 1000); }
    res.json({ success: true, url: result.secure_url, publicId: result.public_id, name: filename || result.original_filename || 'file', type: result.resource_type === 'image' ? type || 'image/jpeg' : type || 'application/octet-stream', size: result.bytes, format: result.format, width: result.width, height: result.height });
  } catch (error) { res.status(500).json({ error: 'Upload failed' }); }
});

// FCM Token
function sanitizeName(name) { return (name || '').toLowerCase().replace(/[.#$\/\[\]()]/g, '_').replace(/\s+/g, '_').substring(0, 50); }

app.post('/fcm-token', (req, res) => {
  const { username, token } = req.body;
  if (!username || !token) return res.status(400).json({ error: 'Username and token required' });
  const cleanUsername = sanitizeName(username);
  const cleanToken = token.replace(/[.#$\/\[\]]/g, '_');
  db.ref(`fcmTokens/${cleanUsername}/${cleanToken}`).set({ token, createdAt: admin.database.ServerValue.TIMESTAMP, originalUsername: username });
  console.log(`[FCM] Token saved: ${username} → ${cleanUsername}`);
  res.json({ success: true });
});

// Pages
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));
app.get('/welcome.html', (req, res) => res.sendFile(path.join(__dirname, 'welcome.html')));
app.get('/chat.html', (req, res) => res.sendFile(path.join(__dirname, 'chat.html')));
app.get('/download.html', (req, res) => res.sendFile(path.join(__dirname, 'download.html')));
app.get('/sw.js', (req, res) => { res.setHeader('Content-Type', 'application/javascript'); res.setHeader('Service-Worker-Allowed', '/'); res.setHeader('Cache-Control', 'no-cache'); res.sendFile(path.join(__dirname, 'sw.js')); });
app.get('/firebase-messaging-sw.js', (req, res) => { res.setHeader('Content-Type', 'application/javascript'); res.setHeader('Service-Worker-Allowed', '/'); res.setHeader('Cache-Control', 'no-cache'); res.sendFile(path.join(__dirname, 'firebase-messaging-sw.js')); });
app.use((req, res) => res.status(404).json({ error: 'Not found' }));
app.use((err, req, res, next) => { console.error('[SERVER ERROR]', err.message); res.status(500).json({ error: 'Internal server error' }); });

/************************************************************
 SOCKET.IO — Voice Call Signaling
************************************************************/
const io = new Server(server, { cors: { origin: '*', methods: ['GET', 'POST'] }, transports: ['websocket', 'polling'], pingInterval: 25000, pingTimeout: 20000, connectTimeout: 30000 });

const activeCalls = new Map();
const userCalls = new Map();
const iceBuffers = new Map();
const CALL_TIMEOUT = 45000;

io.on('connection', (socket) => {
  console.log(`[SOCKET] Connected: ${socket.id}`);

  socket.on('register-call', (data) => {
    if (data?.username) {
      socket.username = data.username;
      socket.join(`user:${sanitizeName(data.username)}`);
      console.log(`[CALL] Registered: ${data.username}`);
    }
  });

  socket.on('call-user', (data, callback) => {
    const { callerUsername, receiverUsername } = data || {};
    if (!callerUsername || !receiverUsername) return callback?.({ error: 'Invalid data' });

    const cleanReceiver = sanitizeName(receiverUsername);
    const cleanCaller = sanitizeName(callerUsername);

    if (cleanCaller === cleanReceiver) return callback?.({ error: 'Cannot call yourself' });
    if (userCalls.has(cleanCaller)) return callback?.({ error: 'You are already on a call' });
    if (userCalls.has(cleanReceiver)) return callback?.({ error: 'User is busy on another call' });

    const callId = uuidv4();
    const call = { id: callId, callerUsername, receiverUsername, cleanCaller, cleanReceiver, status: 'ringing', startedAt: Date.now() };
    activeCalls.set(callId, call);
    userCalls.set(cleanCaller, callId);
    userCalls.set(cleanReceiver, callId);
    iceBuffers.set(callId, []);

    io.to(`user:${cleanReceiver}`).emit('incoming-call', { callId, from: callerUsername });
    callback?.({ success: true, callId });
    console.log(`[CALL] ${callerUsername} → ${receiverUsername} (${callId})`);

    // Send push for incoming call
    sendPushNotification(receiverUsername, { title: `Incoming call from ${callerUsername}`, body: 'Tap to answer', type: 'incoming_call', tag: `call-${callId}`, requireInteraction: true, data: { callId, caller: callerUsername } });

    // Auto-timeout
    call.timeoutId = setTimeout(() => {
      const c = activeCalls.get(callId);
      if (c && c.status === 'ringing') {
        endCall(callId, 'no-answer');
        io.to(`user:${cleanCaller}`).emit('call-ended', { callId, reason: 'no-answer' });
        sendPushNotification(receiverUsername, { title: 'Missed Call', body: `Missed call from ${callerUsername}`, type: 'missed_call', tag: `missed-${callId}` });
      }
    }, CALL_TIMEOUT);
  });

  socket.on('call-accepted', (data) => {
    const call = activeCalls.get(data?.callId);
    if (!call) return;
    if (call.timeoutId) clearTimeout(call.timeoutId);
    call.status = 'active';
    call.acceptedAt = Date.now();
    io.to(`user:${call.cleanCaller}`).emit('call-accepted', { callId: data.callId });
    // Flush buffered ICE
    const buf = iceBuffers.get(data.callId) || [];
    buf.forEach(c => { const t = c.from === call.cleanCaller ? `user:${call.cleanReceiver}` : `user:${call.cleanCaller}`; io.to(t).emit('ice-candidate', c); });
    iceBuffers.delete(data.callId);
    console.log(`[CALL] Accepted: ${data.callId}`);
  });

  socket.on('call-rejected', (data) => {
    const call = activeCalls.get(data?.callId);
    if (!call) return;
    if (call.timeoutId) clearTimeout(call.timeoutId);
    io.to(`user:${call.cleanCaller}`).emit('call-ended', { callId: data.callId, reason: 'declined' });
    endCall(data.callId, 'declined');
  });

  socket.on('call-ended', (data) => {
    const call = activeCalls.get(data?.callId);
    if (!call) return;
    if (call.timeoutId) clearTimeout(call.timeoutId);
    const other = sanitizeName(socket.username || '') === call.cleanCaller ? call.cleanReceiver : call.cleanCaller;
    io.to(`user:${other}`).emit('call-ended', { callId: data.callId, reason: 'ended' });
    endCall(data.callId, 'ended');
  });

  // WebRTC Signaling
  socket.on('offer', (data) => {
    const call = activeCalls.get(data?.callId);
    if (!call || call.status !== 'active') return;
    const target = sanitizeName(socket.username || '') === call.cleanCaller ? call.cleanReceiver : call.cleanCaller;
    io.to(`user:${target}`).emit('offer', { callId: data.callId, offer: data.offer });
  });

  socket.on('answer', (data) => {
    const call = activeCalls.get(data?.callId);
    if (!call || call.status !== 'active') return;
    const target = sanitizeName(socket.username || '') === call.cleanCaller ? call.cleanReceiver : call.cleanCaller;
    io.to(`user:${target}`).emit('answer', { callId: data.callId, answer: data.answer });
  });

  socket.on('ice-candidate', (data) => {
    const call = activeCalls.get(data?.callId);
    if (!call) return;
    const candidate = { callId: data.callId, candidate: data.candidate, from: sanitizeName(socket.username || '') };
    const target = sanitizeName(socket.username || '') === call.cleanCaller ? call.cleanReceiver : call.cleanCaller;
    if (call.status === 'active') {
      io.to(`user:${target}`).emit('ice-candidate', candidate);
    } else {
      const buf = iceBuffers.get(data.callId) || [];
      if (buf.length < 200) buf.push(candidate);
      iceBuffers.set(data.callId, buf);
    }
  });

  socket.on('disconnect', () => {
    const cleanName = sanitizeName(socket.username || '');
    if (cleanName) {
      const callId = userCalls.get(cleanName);
      if (callId) {
        const call = activeCalls.get(callId);
        if (call) {
          if (call.timeoutId) clearTimeout(call.timeoutId);
          const other = cleanName === call.cleanCaller ? call.cleanReceiver : call.cleanCaller;
          io.to(`user:${other}`).emit('call-ended', { callId, reason: 'peer-disconnected' });
        }
        endCall(callId, 'peer-disconnected');
      }
    }
    console.log(`[SOCKET] Disconnected: ${socket.id}`);
  });
});

function endCall(callId, reason) {
  const call = activeCalls.get(callId);
  if (call) {
    if (call.timeoutId) clearTimeout(call.timeoutId);
    userCalls.delete(call.cleanCaller);
    userCalls.delete(call.cleanReceiver);
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
    const cleanUsername = sanitizeName(username);
    const tokensRef = db.ref(`fcmTokens/${cleanUsername}`);
    const snapshot = await tokensRef.once('value');
    const tokens = snapshot.val();
    if (!tokens) { console.log(`[FCM] No tokens for: ${cleanUsername}`); return; }

    const tokenValues = Object.values(tokens).map(t => t.token).filter(Boolean);
    if (tokenValues.length === 0) { console.log(`[FCM] No valid tokens for: ${cleanUsername}`); return; }

    console.log(`[FCM] Sending to ${cleanUsername}: ${tokenValues.length} tokens`);

    const message = {
      notification: { title: payload.title || 'SMS Adda', body: payload.body || '' },
      data: { click_action: payload.url || '/chat.html', type: payload.type || 'message', ...payload.data },
      webpush: { notification: { icon: '/favicon/favicon-192x192.png', badge: '/favicon/favicon-96x96.png', vibrate: [200, 100, 200], requireInteraction: payload.requireInteraction || false, tag: payload.tag || 'sms-adda', renotify: true }, fcmOptions: { link: payload.url || '/chat.html' } },
      tokens: tokenValues,
    };

    const response = await admin.messaging().sendEachForMulticast(message);
    console.log(`[FCM] Sent: ${response.successCount}/${tokenValues.length} delivered`);

    if (response.failureCount > 0) {
      response.responses.forEach((resp, idx) => {
        if (!resp.success) { const tk = tokenValues[idx].replace(/[.#$\/\[\]]/g, '_'); db.ref(`fcmTokens/${cleanUsername}/${tk}`).remove(); }
      });
    }
  } catch (error) { console.error('[FCM ERROR]', error.message); }
}

/************************************************************
 START SERVER
************************************************************/
server.listen(PORT, () => {
  console.log('');
  console.log('╔══════════════════════════════════════════╗');
  console.log('║     SMS Adda v4.0 — Production Ready     ║');
  console.log('║   Firebase:   nepchat-aac9d              ║');
  console.log('║   Cloudinary: uxj2a5iv                  ║');
  console.log('║   Calls:      Socket.IO + WebRTC        ║');
  console.log('║   Push:       Firebase FCM              ║');
  console.log(`║   Port:       ${String(PORT).padEnd(26)}║`);
  console.log(`║   URL:        http://localhost:${PORT}      ║`);
  console.log('╚══════════════════════════════════════════╝');
  console.log('');
});
