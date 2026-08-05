import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import type { ReactNode } from 'react';
import { Layout } from './components/Layout';
import { PageLoader } from './components/ui';
import { useAuth } from './lib/auth';
import { About } from './pages/About';
import { Admin } from './pages/Admin';
import { Browse } from './pages/Browse';
import { Dashboard } from './pages/Dashboard';
import { Interests } from './pages/Interests';
import { Landing } from './pages/Landing';
import { Login } from './pages/Login';
import { MemberProfile } from './pages/MemberProfile';
import { Messages } from './pages/Messages';
import { MyProfile } from './pages/MyProfile';
import { NotFound } from './pages/NotFound';
import { Notifications } from './pages/Notifications';
import { Photos } from './pages/Photos';
import { Preferences } from './pages/Preferences';
import { Register } from './pages/Register';
import { Safety } from './pages/Safety';
import { Settings } from './pages/Settings';
import { Shortlist } from './pages/Shortlist';

function RequireAuth({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) return <PageLoader />;
  if (!user) return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  return <>{children}</>;
}

function RequireStaff({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();

  if (loading) return <PageLoader />;
  if (!user) return <Navigate to="/login" replace />;
  if (user.role !== 'ADMIN' && user.role !== 'MODERATOR') return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
}

/** Signed-in members skip the marketing pages and land on their dashboard. */
function HomeRoute() {
  const { user, loading } = useAuth();
  if (loading) return <PageLoader />;
  return user ? <Navigate to="/dashboard" replace /> : <Landing />;
}

export function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<HomeRoute />} />
        <Route path="/about" element={<About />} />
        <Route path="/safety" element={<Safety />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />

        <Route
          path="/dashboard"
          element={
            <RequireAuth>
              <Dashboard />
            </RequireAuth>
          }
        />
        <Route
          path="/browse"
          element={
            <RequireAuth>
              <Browse />
            </RequireAuth>
          }
        />
        <Route
          path="/members/:userId"
          element={
            <RequireAuth>
              <MemberProfile />
            </RequireAuth>
          }
        />
        <Route
          path="/interests"
          element={
            <RequireAuth>
              <Interests />
            </RequireAuth>
          }
        />
        <Route
          path="/messages"
          element={
            <RequireAuth>
              <Messages />
            </RequireAuth>
          }
        />
        <Route
          path="/messages/:conversationId"
          element={
            <RequireAuth>
              <Messages />
            </RequireAuth>
          }
        />
        <Route
          path="/shortlist"
          element={
            <RequireAuth>
              <Shortlist />
            </RequireAuth>
          }
        />
        <Route
          path="/notifications"
          element={
            <RequireAuth>
              <Notifications />
            </RequireAuth>
          }
        />
        <Route
          path="/profile"
          element={
            <RequireAuth>
              <MyProfile />
            </RequireAuth>
          }
        />
        <Route
          path="/profile/photos"
          element={
            <RequireAuth>
              <Photos />
            </RequireAuth>
          }
        />
        <Route
          path="/preferences"
          element={
            <RequireAuth>
              <Preferences />
            </RequireAuth>
          }
        />
        <Route
          path="/settings"
          element={
            <RequireAuth>
              <Settings />
            </RequireAuth>
          }
        />
        <Route
          path="/admin"
          element={
            <RequireStaff>
              <Admin />
            </RequireStaff>
          }
        />

        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
}
