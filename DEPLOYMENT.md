# XPRTY Interview Platform — Deployment & Operational Guide

## Independent SaaS Architecture
XPRTY Interview is an enterprise, proctored online interview application completely segregated from any existing assessment modules.

### Components
1. **Frontend (`/client`)**: React 18, TypeScript, Tailwind CSS, Jitsi Meet Video, Zustand.
2. **Backend (`/server`)**: Node.js, Express, Socket.io Realtime Server, Jitsi room management.
3. **Database (`/supabase`)**: PostgreSQL schema with RLS, audit logs, and session tables.
4. **Chrome Extension (`/extension`)**: Manifest V3 Guardian for tab monitoring and domain allowlist enforcement.

---

## 1. Local Development Setup

### Backend
```bash
cd server
npm install
npm run dev
# Server starts on http://localhost:5000 with WebSockets active
```

### Frontend
```bash
cd client
npm install
npm run dev
# Frontend starts on http://localhost:5173
```

### Chrome Extension (Optional Advanced Proctoring)
1. Open Google Chrome and navigate to `chrome://extensions/`.
2. Enable **Developer mode** in the upper right corner.
3. Click **Load unpacked** and select the `/extension` directory.

---

## 2. Production Deployment

### Backend (Railway / Render / AWS ECS)
1. Configure environment variables:
   - Copy `server/.env.example` to `server/.env` and replace every `replace-with-...` value.
   - `PORT=5000`
   - `CLIENT_URL=https://interview.xprty.io` and `CORS_ORIGIN=https://interview.xprty.io`
   - A unique, random `JWT_SECRET` (do not use the development fallback).
   - `JITSI_DOMAIN=meet.jit.si` for development, or your authenticated JaaS/self-hosted domain in production.
   - `SUPABASE_URL=<Your Supabase Project URL>`
   - `SUPABASE_SERVICE_ROLE_KEY=<Your Supabase Service Role Key>`
2. Build and start:
   ```bash
   npm run build
   npm start
   ```

### Frontend (Vercel / Cloudflare Pages)
1. Set root directory to `client`.
2. Build command: `npm run build`
3. Output directory: `dist`
4. Copy `client/.env.example` to `client/.env` and set `VITE_API_URL` to the
   public API endpoint (including `/api`) and `VITE_WS_URL` to the public API
   origin. These are public browser settings; do not put API keys or secrets in them.

### Important data-persistence note
The current route layer uses the in-memory `DatabaseService`. Jitsi meeting details
will enable genuine video rooms, but adding Supabase credentials alone does not yet
persist application users, interviews, or feedback across an API restart. Complete
the database-service integration before treating this as a durable production system.

---

## 3. Core Capabilities
- **Jitsi Meet Rooms**: Backend-generated, persistent room identifiers for authorized app participants.
- **Interviewer Website Allowlist**: Dynamic real-time domain toggle (candidates access approved docs directly in-app or controlled tabs).
- **Dual-Layer Proctoring**: Instant socket alerts for tab switching, window minimization, fullscreen exits, and unauthorized navigation attempts.
- **Structured Evaluations**: Scorecard evaluations with technical ratings, problem-solving rubrics, and hiring recommendations.
