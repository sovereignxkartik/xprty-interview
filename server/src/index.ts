import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import dotenv from 'dotenv';
import authRoutes from './routes/auth.routes';
import adminRoutes from './routes/admin.routes';
import interviewRoutes from './routes/interview.routes';
import userRoutes from './routes/user.routes';
import { setupSocketHandlers } from './sockets/interview.socket';
import { jitsiService } from './services/jitsi.service';

dotenv.config();

const app = express();
const server = http.createServer(app);

const PORT = process.env.PORT || 5000;
if (process.env.NODE_ENV === 'production' && !process.env.JWT_SECRET) {
  throw new Error('JWT_SECRET must be configured when NODE_ENV=production.');
}
jitsiService.validateConfiguration();

const allowedOrigins = (process.env.CORS_ORIGIN || process.env.CLIENT_URL || 'http://localhost:5173')
  .split(',')
  // Browsers send origins without a trailing slash. Normalize deployment
  // settings such as https://app.example.com/ before CORS compares them.
  .map((origin) => origin.trim().replace(/\/+$/, ''))
  .filter(Boolean);

const corsOptions = {
  origin: allowedOrigins,
  methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE'],
  credentials: true
};

// Middleware
app.use(cors(corsOptions));
app.use(express.json());

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/interviews', interviewRoutes);
app.use('/api', userRoutes);

app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'XPRTY Interview Enterprise Independent Backend',
    timestamp: new Date().toISOString()
  });
});

// Socket.io Real-time Setup
const io = new Server(server, {
  cors: {
    origin: allowedOrigins,
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE'],
    credentials: true
  }
});

setupSocketHandlers(io);

server.listen(PORT, () => {
  console.log(`=======================================================`);
  console.log(`🚀 XPRTY Interview Backend running on http://localhost:${PORT}`);
  console.log(`🔐 Real Authentication & RBAC Active (Admin, Interviewer, Candidate)`);
  console.log(`⏳ Single-Candidate Concurrency & Live Queueing Active`);
  console.log(`Jitsi Meet Video Integration Ready`);
  console.log(`=======================================================`);
});
