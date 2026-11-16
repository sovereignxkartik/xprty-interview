import { io, Socket } from 'socket.io-client';

/**
 * Browser-visible configuration. Never put server secrets (Jitsi/JaaS key,
 * Supabase service-role key, or JWT secret) in VITE_ variables.
 */
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
const SOCKET_URL = import.meta.env.VITE_WS_URL || 'http://localhost:5000';

class ApiService {
  private socket: Socket | null = null;

  private getHeaders(): HeadersInit {
    const token = localStorage.getItem('xprty_auth_token');
    return {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    };
  }

  getSocket(): Socket {
    if (!this.socket) {
      this.socket = io(SOCKET_URL, {
        transports: ['websocket', 'polling'],
        auth: { token: localStorage.getItem('xprty_auth_token') }
      });
    }
    return this.socket;
  }

  // --- Auth APIs ---
  async login(credentials: { email: string; password: string }) {
    const res = await fetch(`${API_BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(credentials)
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to authenticate');
    }
    return res.json();
  }

  async register(data: any) {
    const res = await fetch(`${API_BASE_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Registration failed');
    }
    return res.json();
  }

  async getMe() {
    const res = await fetch(`${API_BASE_URL}/auth/me`, {
      headers: this.getHeaders()
    });
    if (!res.ok) throw new Error('Failed to load profile');
    return res.json();
  }

  // --- Candidate Key Access & Queue APIs ---
  async accessInterviewByKey(interviewKey: string, email: string) {
    const res = await fetch(`${API_BASE_URL}/interviews/access-by-key`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ interviewKey, email })
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Invalid interview key');
    }
    return data;
  }

  async getQueueStatus(sessionId: string) {
    const res = await fetch(`${API_BASE_URL}/interviews/${sessionId}/queue-status`);
    return res.json();
  }

  async updateWaitingRoomPresence(sessionId: string, present = true) {
    const res = await fetch(`${API_BASE_URL}/interviews/${sessionId}/waiting-room`, { method: 'POST', headers: this.getHeaders(), body: JSON.stringify({ present }) });
    if (!res.ok) throw new Error('Could not update waiting-room status');
    return res.json();
  }

  async getWaitingRoomPresence(sessionId: string) {
    const res = await fetch(`${API_BASE_URL}/interviews/${sessionId}/waiting-room`, { headers: this.getHeaders() });
    if (!res.ok) throw new Error('Could not load waiting-room status');
    return res.json();
  }

  // --- Interview Sessions ---
  async getSessions() {
    const res = await fetch(`${API_BASE_URL}/interviews`, {
      headers: this.getHeaders()
    });
    if (!res.ok) throw new Error('Failed to fetch interviews');
    return res.json();
  }

  async getSession(id: string) {
    const res = await fetch(`${API_BASE_URL}/interviews/${id}`, {
      headers: this.getHeaders()
    });
    if (!res.ok) throw new Error('Failed to load session');
    return res.json();
  }

  async createSession(sessionData: any) {
    const res = await fetch(`${API_BASE_URL}/interviews`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(sessionData)
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to schedule interview');
    }
    return res.json();
  }

  async bulkSchedule(rows: Record<string, string>[]) {
    const res = await fetch(`${API_BASE_URL}/interviews/bulk`, { method: 'POST', headers: this.getHeaders(), body: JSON.stringify({ rows }) });
    const data = await res.json();
    if (!res.ok && !data.created) throw new Error(data.error || 'Failed to schedule CSV rows');
    return data;
  }

  async getMeetingDetails(sessionId: string) {
    const res = await fetch(`${API_BASE_URL}/interviews/${sessionId}/meeting`, {
      headers: this.getHeaders()
    });
    if (!res.ok) throw new Error('Failed to retrieve meeting token');
    return res.json();
  }

  async getRoomStatus(sessionId: string) {
    const res = await fetch(`${API_BASE_URL}/interviews/${sessionId}/room-status`, { headers: this.getHeaders() });
    if (!res.ok) throw new Error('Failed to retrieve room status');
    return res.json();
  }

  async initializeRoom(sessionId: string) {
    const res = await fetch(`${API_BASE_URL}/interviews/${sessionId}/room`, { method: 'POST', headers: this.getHeaders() });
    if (!res.ok) throw new Error('Failed to initialize interview room');
    return res.json();
  }

  async endInterview(sessionId: string) {
    const res = await fetch(`${API_BASE_URL}/interviews/${sessionId}/end`, { method: 'POST', headers: this.getHeaders() });
    if (!res.ok) { const err = await res.json(); throw new Error(err.error || 'Failed to end interview'); }
    return res.json();
  }

  async rescheduleInterview(sessionId: string, scheduled_start_time: string, scheduled_end_time: string) {
    const res = await fetch(`${API_BASE_URL}/interviews/${sessionId}/schedule`, { method: 'PATCH', headers: this.getHeaders(), body: JSON.stringify({ scheduled_start_time, scheduled_end_time }) });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to reschedule interview');
    return data.updated;
  }

  async cancelInterview(sessionId: string) {
    const res = await fetch(`${API_BASE_URL}/interviews/${sessionId}/cancel`, { method: 'POST', headers: this.getHeaders() });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to cancel interview');
    return data.updated;
  }

  async createReinterview(sessionId: string, scheduled_start_time: string, scheduled_end_time: string) {
    const res = await fetch(`${API_BASE_URL}/interviews/${sessionId}/reinterview`, { method: 'POST', headers: this.getHeaders(), body: JSON.stringify({ scheduled_start_time, scheduled_end_time }) });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to create re-interview');
    return data.session;
  }

  async updateSessionStatus(sessionId: string, status: string) {
    const res = await fetch(`${API_BASE_URL}/interviews/${sessionId}/status`, {
      method: 'PATCH',
      headers: this.getHeaders(),
      body: JSON.stringify({ status })
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to update interview status');
    }
    return res.json();
  }

  // --- Super Admin APIs ---
  async getAdminOverview() {
    const res = await fetch(`${API_BASE_URL}/admin/overview`, {
      headers: this.getHeaders()
    });
    if (!res.ok) throw new Error('Admin authorization required');
    return res.json();
  }

  async getAdminUsers() {
    const res = await fetch(`${API_BASE_URL}/admin/users`, {
      headers: this.getHeaders()
    });
    return res.json();
  }

  async getAdminSessions() {
    const res = await fetch(`${API_BASE_URL}/admin/interviews`, { headers: this.getHeaders() });
    if (!res.ok) throw new Error('Failed to load platform interviews');
    return res.json();
  }

  async toggleUserStatus(userId: string, isActive: boolean) {
    const res = await fetch(`${API_BASE_URL}/admin/users/${userId}/status`, {
      method: 'PATCH',
      headers: this.getHeaders(),
      body: JSON.stringify({ is_active: isActive })
    });
    return res.json();
  }

  async updatePlatformSettings(settings: any) {
    const res = await fetch(`${API_BASE_URL}/admin/settings`, {
      method: 'PATCH',
      headers: this.getHeaders(),
      body: JSON.stringify(settings)
    });
    return res.json();
  }

  async updateInterviewerVerification(userId: string, verification_status: string) {
    const res = await fetch(`${API_BASE_URL}/admin/interviewers/${userId}/verification`, {
      method: 'PATCH',
      headers: this.getHeaders(),
      body: JSON.stringify({ verification_status })
    });
    return res.json();
  }

  async createInterviewer(data: any) {
    const res = await fetch(`${API_BASE_URL}/admin/interviewers`, { method: 'POST', headers: this.getHeaders(), body: JSON.stringify(data) });
    const payload = await res.json();
    if (!res.ok) throw new Error(payload.error || 'Failed to create interviewer');
    return payload;
  }

  // --- Allowlist ---
  async getResources(sessionId: string) {
    const res = await fetch(`${API_BASE_URL}/interviews/${sessionId}/resources`);
    return res.json();
  }

  async addResource(sessionId: string, domain: string, title: string, includeSubdomains: boolean) {
    const res = await fetch(`${API_BASE_URL}/interviews/${sessionId}/resources`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({ domain, title, include_subdomains: includeSubdomains })
    });
    return res.json();
  }

  async toggleResource(sessionId: string, resourceId: string, isActive: boolean) {
    const res = await fetch(`${API_BASE_URL}/interviews/${sessionId}/resources/${resourceId}`, {
      method: 'PATCH',
      headers: this.getHeaders(),
      body: JSON.stringify({ is_active: isActive })
    });
    return res.json();
  }

  async deleteResource(sessionId: string, resourceId: string) {
    const res = await fetch(`${API_BASE_URL}/interviews/${sessionId}/resources/${resourceId}`, {
      method: 'DELETE',
      headers: this.getHeaders()
    });
    return res.json();
  }

  // --- Proctoring Events ---
  async getProctoringEvents(sessionId: string) {
    const res = await fetch(`${API_BASE_URL}/interviews/${sessionId}/proctoring`, { headers: this.getHeaders() });
    if (!res.ok) throw new Error('Failed to load proctoring events');
    return res.json();
  }

  async reportProctoringEvent(sessionId: string, userId: string, eventType: string, severity: string, metadata = {}) {
    const res = await fetch(`${API_BASE_URL}/interviews/${sessionId}/proctoring`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({ user_id: userId, event_type: eventType, severity, metadata })
    });
    return res.json();
  }

  // --- Feedback ---
  async submitFeedback(sessionId: string, feedback: any) {
    const res = await fetch(`${API_BASE_URL}/interviews/${sessionId}/feedback`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(feedback)
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to save scorecard');
    return data;
  }

  async getFeedback(sessionId: string) {
    const res = await fetch(`${API_BASE_URL}/interviews/${sessionId}/feedback`, { headers: this.getHeaders() });
    if (!res.ok) throw new Error('Failed to load scorecard');
    return res.json();
  }
}

export const api = new ApiService();
