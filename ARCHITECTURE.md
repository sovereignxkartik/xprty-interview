# XPRTY Interview — System Architecture & Engineering Blueprint

## 1. Executive Summary & Product Independence

**XPRTY Interview** is a completely independent, enterprise-grade, standalone online interview platform. It operates with zero dependencies on any legacy assessment platforms, possessing:
- **Independent Frontend**: React 18, TypeScript, Tailwind CSS, Vite, Zustand, Jitsi Meet React SDK.
- **Independent Backend**: Node.js, Express, TypeScript, Socket.io (real-time proctoring sync), Jitsi room management.
- **Independent Database**: PostgreSQL with Supabase Auth, Row Level Security (RLS), full audit trails.
- **Independent Proctoring Engine**: In-browser dual-layer monitoring (Page Visibility, Blur/Focus, Fullscreen, Screen Sharing Track, Media stream permissions) combined with a Chrome Extension for advanced tab/domain allowlist monitoring.

---

## 2. System Architecture

```
                       +----------------------------------+
                       |          Web Browser             |
                       +----------------------------------+
                               /                      \
                              /                        \
               (Interviewer Portal)               (Candidate Portal)
              - Live Video Conference           - Technical Readiness Test
              - Screen Sharing Viewer           - Embedded Video Conference
              - Real-time Proctoring Monitor    - In-app Approved Resource Panel
              - Website Allowlist Controller    - Screen Sharing & Camera
              - Structured Evaluation & Notes   - Browser Proctoring Agent
                              \                        /
                               \                      /
                                v                    v
                        +-------------------------------+
                        |       XPRTY Interview UI      |
                        | (React + Vite + Tailwind CSS) |
                        +-------------------------------+
                                |               ^
                     HTTPS REST |               | WebSockets (Socket.io)
                                v               |
                        +-------------------------------+
                        |   XPRTY Interview Backend     |
                        |   (Node.js + Express + WS)    |
                        +-------------------------------+
                           /            |             \
                          /             |              \
                         v              v               v
                +-------------+  +-------------+  +-------------------+
                | Supabase    |  | Jitsi Meet  |  | Chrome Extension  |
                | PostgreSQL  |  | REST API    |  | Native Messaging  |
                | & Auth      |  | & Webhooks  |  | / Tab Monitor     |
                +-------------+  +-------------+  +-------------------+
```

---

## 3. Database Schema (PostgreSQL / Supabase)

### 3.1 Tables
1. **`users`**: Platform user accounts with role assignment (`super_admin`, `interviewer`, `candidate`).
2. **`interviewer_profiles`**: Organization, title, technical focus areas, verification status.
3. **`candidate_profiles`**: Resume link, portfolio, contact information, technical tags.
4. **`interview_sessions`**: Session code, Jitsi room name, status (`scheduled`, `in_progress`, `completed`, `cancelled`), scheduled start/end, actual timestamps.
5. **`interview_participants`**: Role in session, join token, join/leave timestamps, device specs.
6. **`interview_permissions`**: Allowed resource configurations, code editor enabled, proctoring strictness level.
7. **`interview_resource_access`**: Domain/URL allowlist per session with subdomain flags and active toggles.
8. **`proctoring_events`**: Timestamped security events (tab blur, exit fullscreen, display media stop, permission revocation, unauthorized tab attempt) with severity levels (`low`, `medium`, `high`, `critical`).
9. **`interview_recordings`**: Provider recording IDs, streaming URLs, duration, storage status.
10. **`interview_feedback`**: Structured scorecard evaluations (technical competency, problem-solving, communication, overall rating, recommendation).
11. **`interview_notes`**: Private interviewer timestamps and scratchpad notes.
12. **`subscriptions` & `audit_logs`**: SaaS subscription tier management and security audit trail.

---

## 4. Jitsi Meet Video Integration Architecture

1. **Backend room management**: The backend generates and persists a cryptographically random room name, returning it only after application participant authorization.
2. **Embedded meeting**: The React application embeds the official Jitsi React SDK with Jitsi's pre-join device check and call controls.
3. **Production access control**: Public `meet.jit.si` is development-only. Production must use JaaS JWTs or a self-hosted Jitsi deployment configured for authenticated room access.
4. **Recording lifecycle**: Recording is intentionally not enabled until the selected Jitsi provider is configured to support it.

---

## 5. Dual-Layer Browser Proctoring & Security Realities

### Browser Sandbox vs Chrome Extension
- **Webpage Sandbox Reality**: An ordinary webpage/iframe **cannot** inspect other browser tabs, block outside URLs, or prevent desktop switching due to browser security boundaries (Same-Origin Policy).
- **In-App Layer (Browser APIs)**:
  - Page Visibility API (`document.visibilityState` / `visibilitychange`).
  - Window Focus / Blur API (`window.onblur`, `window.onfocus`).
  - Fullscreen API (`document.fullscreenElement`, `fullscreenchange`).
  - MediaStream Track monitoring (`stream.getVideoTracks()[0].onended` for detecting when candidate stops screen sharing).
  - WebRTC connection health monitoring.
- **Advanced Layer (Chrome Extension)**:
  - `chrome.tabs.onActivated` and `chrome.webNavigation.onBeforeNavigate`: Real-time intercept of all candidate tabs.
  - Domain Allowlist Enforcement: If candidate visits a domain not in `interview_resource_access`, extension flags or blocks access and notifies the backend via WebSocket.
