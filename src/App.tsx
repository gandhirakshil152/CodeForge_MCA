import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './contexts/AuthContext';

import SplashPage from './pages/SplashPage';
import AuthPage from './pages/AuthPage';
import ProblemsPage from './pages/ProblemsPage';
import ProblemPage from './pages/ProblemPage';
import LeaderboardPage from './pages/LeaderboardPage';
import DashboardPage from './pages/DashboardPage';
import ProfilePage from './pages/ProfilePage';
import AdminPage from './pages/AdminPage';
import DBMSPage from './pages/DBMSPage';
import PPTQuizPage from './pages/PPTQuizPage';
import TestsPage from './pages/TestsPage';
import TestPage from './pages/TestPage';

// Route guard for authenticated pages
const PrivateRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, loading } = useAuth();
  if (loading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-deep)' }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ width: 48, height: 48, border: '3px solid rgba(139,92,246,0.3)', borderTop: '3px solid var(--purple)', borderRadius: '50%', animation: 'spin-slow 0.8s linear infinite', margin: '0 auto 16px' }} />
        <p style={{ color: 'var(--text-3)', fontFamily: 'Space Grotesk, sans-serif' }}>Loading...</p>
      </div>
    </div>
  );
  return user ? <>{children}</> : <Navigate to="/login" replace />;
};

// Route guard for admin-only pages
const AdminRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, isAdmin, loading } = useAuth();
  if (loading) return null;
  if (!user) return <Navigate to="/login" replace />;
  if (!isAdmin) return <Navigate to="/" replace />;
  return <>{children}</>;
};

// Redirect logged-in users away from login/register
const PublicRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, loading } = useAuth();
  if (loading) return null;
  return user ? <Navigate to="/dashboard" replace /> : <>{children}</>;
};

const AppRoutes: React.FC = () => (
  <Routes>
    <Route path="/" element={<SplashPage />} />
    <Route path="/login" element={<PublicRoute><AuthPage mode="login" /></PublicRoute>} />
    <Route path="/register" element={<PublicRoute><AuthPage mode="register" /></PublicRoute>} />
    <Route path="/problems" element={<ProblemsPage />} />
    <Route path="/problems/:id" element={<ProblemPage />} />
    <Route path="/leaderboard" element={<LeaderboardPage />} />
    <Route path="/dashboard" element={<PrivateRoute><DashboardPage /></PrivateRoute>} />
    <Route path="/profile" element={<PrivateRoute><ProfilePage /></PrivateRoute>} />
    <Route path="/dbms" element={<DBMSPage />} />
    <Route path="/ppt-quiz" element={<PPTQuizPage />} />
    <Route path="/tests" element={<PrivateRoute><TestsPage /></PrivateRoute>} />
    <Route path="/tests/:testId" element={<PrivateRoute><TestPage /></PrivateRoute>} />
    <Route path="/test/:testId" element={<PrivateRoute><TestPage /></PrivateRoute>} />
    {/* Admin panel */}
    <Route path="/admin" element={<AdminRoute><AdminPage /></AdminRoute>} />
    <Route path="/admin-panel" element={<AdminRoute><AdminPage /></AdminRoute>} />
    <Route path="*" element={<Navigate to="/" replace />} />
  </Routes>
);

const App: React.FC = () => (
  <AuthProvider>
    <BrowserRouter>
      <AppRoutes />
      <Toaster
        position="top-right"
        toastOptions={{
          className: 'toast',
          duration: 3000,
          style: {
            background: '#0d0d22',
            border: '1px solid rgba(139,92,246,0.3)',
            color: '#f1f5f9',
            fontFamily: 'Space Grotesk, sans-serif',
            borderRadius: '12px',
          },
          success: {
            iconTheme: { primary: '#10b981', secondary: '#0d0d22' },
          },
          error: {
            iconTheme: { primary: '#ef4444', secondary: '#0d0d22' },
          },
        }}
      />
    </BrowserRouter>
  </AuthProvider>
);

export default App;
