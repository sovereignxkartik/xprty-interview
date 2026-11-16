import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { LandingPage } from './pages/LandingPage';
import { LoginPage } from './pages/LoginPage';
import { CandidateJoinPage } from './pages/CandidateJoinPage';
import { InterviewerDashboard } from './pages/InterviewerDashboard';
import { InterviewerRoom } from './pages/InterviewerRoom';
import { CandidateDashboard } from './pages/CandidateDashboard';
import { AdminDashboard } from './pages/AdminDashboard';

export const App: React.FC = () => {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/candidate-join" element={<CandidateJoinPage />} />
        <Route path="/admin" element={<AdminDashboard />} />
        <Route path="/interviewer" element={<InterviewerDashboard />} />
        <Route path="/interviewer-room/:id" element={<InterviewerRoom />} />
        <Route path="/candidate" element={<CandidateJoinPage />} />
        <Route path="/candidate/:id" element={<CandidateDashboard />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
};

export default App;
