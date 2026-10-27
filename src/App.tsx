import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './contexts/AuthContext';

const SplashPage = React.lazy(() => import('./pages/SplashPage'));
const AuthPage = React.lazy(() => import('./pages/AuthPage'));
const ProblemsPage = React.lazy(() => import('./pages/ProblemsPage'));
const ProblemPage = React.lazy(() => import('./pages/ProblemPage'));
const LeaderboardPage = React.lazy(() => import('./pages/LeaderboardPage'));
const DashboardPage = React.lazy(() => import('./pages/DashboardPage'));
const ProfilePage = React.lazy(() => import('./pages/ProfilePage'));
const AdminPage = React.lazy(() => import('./pages/AdminPage'));
const DBMSPage = React.lazy(() => import('./pages/DBMSPage'));
const PPTQuizPage = React.lazy(() => import('./pages/PPTQuizPage'));
const TestsPage = React.lazy(() => import('./pages/TestsPage'));
const TestPage = React.lazy(() => import('./pages/TestPage'));
const RulesPage = React.lazy(() => import('./pages/RulesPage'));
const HistoryPage = React.lazy(() => import('./pages/HistoryPage'));
import CodeRainBackground from './components/CodeRainBackground';

const PageLoader: React.FC = () => (
  <div style={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
    <div style={{ textAlign: 'center' }}>
      <div style={{
        width: 38,
        height: 38,
        border: '3px solid rgba(59,130,246,0.18)',
        borderTop: '3px solid var(--blue-light)',
        borderRadius: '50%',
        animation: 'spin-slow 0.7s linear infinite',
        margin: '0 auto 12px',
        boxShadow: '0 0 16px rgba(56,189,248,0.25)'
      }} />
      <p style={{ color: 'var(--text-3)', fontSize: 13, letterSpacing: '0.02em' }}>Loading...</p>
    </div>
  </div>
);

// Route guard for authenticated pages
const PrivateRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, loading } = useAuth();
  if (loading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-deep)' }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ width: 44, height: 44, border: '3px solid rgba(59,130,246,0.2)', borderTop: '3px solid var(--blue-light)', borderRadius: '50%', animation: 'spin-slow 0.8s linear infinite', margin: '0 auto 16px' }} />
        <p style={{ color: 'var(--text-3)', fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 14 }}>Loading CodeForge MCA...</p>
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
  <React.Suspense fallback={<PageLoader />}>
    <Routes>
      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route path="/splash" element={<SplashPage />} />
      <Route path="/login" element={<PublicRoute><AuthPage mode="login" /></PublicRoute>} />
      <Route path="/register" element={<PublicRoute><AuthPage mode="register" /></PublicRoute>} />
      <Route path="/problems" element={<ProblemsPage />} />
      <Route path="/problems/:id" element={<ProblemPage />} />
      <Route path="/leaderboard" element={<LeaderboardPage />} />
      <Route path="/rules" element={<RulesPage />} />
      <Route path="/dashboard" element={<PrivateRoute><DashboardPage /></PrivateRoute>} />
      <Route path="/profile" element={<PrivateRoute><ProfilePage /></PrivateRoute>} />
      <Route path="/dbms" element={<DBMSPage />} />
      <Route path="/ppt-quiz" element={<PPTQuizPage />} />
      <Route path="/tests" element={<PrivateRoute><TestsPage /></PrivateRoute>} />
      <Route path="/tests/:testId" element={<PrivateRoute><TestPage /></PrivateRoute>} />
      <Route path="/test/:testId" element={<PrivateRoute><TestPage /></PrivateRoute>} />
      <Route path="/history" element={<PrivateRoute><HistoryPage /></PrivateRoute>} />
      {/* Admin panel */}
      <Route path="/admin" element={<AdminRoute><AdminPage /></AdminRoute>} />
      <Route path="/admin-panel" element={<AdminRoute><AdminPage /></AdminRoute>} />
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  </React.Suspense>
);

const App: React.FC = () => (
  <AuthProvider>
    <BrowserRouter>
      <CodeRainBackground />
      <AppRoutes />
      <Toaster
        position="top-right"
        toastOptions={{
          className: 'toast',
          duration: 3000,
          style: {
            background: '#0a1628',
            border: '1px solid rgba(59,130,246,0.3)',
            color: '#f8fafc',
            fontFamily: 'Plus Jakarta Sans, sans-serif',
            borderRadius: '12px',
            fontSize: '13px',
          },
          success: {
            iconTheme: { primary: '#10b981', secondary: '#0a1628' },
          },
          error: {
            iconTheme: { primary: '#ef4444', secondary: '#0a1628' },
          },
        }}
      />
    </BrowserRouter>
  </AuthProvider>
);

export default App;
