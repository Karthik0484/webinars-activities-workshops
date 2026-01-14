import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@clerk/clerk-react';
import { Toaster } from 'react-hot-toast';
import { useState, useEffect } from 'react';
import axios from 'axios';
import SignIn from './pages/SignIn';
import SignUp from './pages/SignUp';
import Profile from './pages/Profile';
import Home from './pages/Home';
import Webinars from './pages/Webinars';
import Workshops from './pages/Workshops';
import Internships from './pages/Internships';
import AdminLogin from './pages/AdminLogin';
import AdminDashboard from './pages/AdminDashboard';
import AdminEventDetail from './pages/AdminEventDetail';
import AdminUsers from './pages/AdminUsers';
import AdminUserProfiles from './pages/AdminUserProfiles';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

function ProtectedRoute({ children }) {
  const { isLoaded, isSignedIn, getToken } = useAuth();
  const location = useLocation();
  const [isBlocked, setIsBlocked] = useState(false);
  const [checkingStatus, setCheckingStatus] = useState(true);

  useEffect(() => {
    const checkUserStatus = async () => {
      if (isSignedIn && isLoaded) {
        try {
          const token = await getToken();
          const response = await axios.get(`${API_URL}/users/profile`, {
            headers: {
              Authorization: `Bearer ${token}`
            }
          });

          if (response.data.success) {
            const blocked = response.data.user.isBlocked || false;
            setIsBlocked(blocked);
            
            // Redirect blocked users to profile if they're not already there
            if (blocked && location.pathname !== '/profile') {
              // Don't redirect here, let the component handle it
            }
          }
        } catch (error) {
          // If profile fetch fails, assume not blocked
          setIsBlocked(false);
        } finally {
          setCheckingStatus(false);
        }
      } else {
        setCheckingStatus(false);
      }
    };

    checkUserStatus();
  }, [isSignedIn, isLoaded, getToken, location.pathname]);

  if (!isLoaded || checkingStatus) {
    return <div>Loading...</div>;
  }

  if (!isSignedIn) {
    return <Navigate to="/sign-in" replace />;
  }

  // Redirect blocked users to profile if they try to access other routes
  if (isBlocked && location.pathname !== '/profile') {
    return <Navigate to="/profile" replace />;
  }

  return children;
}

function App() {
  return (
    <BrowserRouter>
      <Toaster position="top-right" />
      <Routes>
        {/* Clerk's multi-step flows need wildcard routes */}
        <Route path="/sign-in/*" element={<SignIn />} />
        <Route path="/sign-up/*" element={<SignUp />} />

        {/* Admin login route */}
        <Route path="/admin/login" element={<AdminLogin />} />

        {/* Admin dashboard routes */}
        <Route path="/admin/dashboard" element={<AdminDashboard />} />
        <Route path="/admin/users" element={<AdminUsers />} />
        <Route path="/admin/user-profiles" element={<AdminUserProfiles />} />
        <Route path="/admin/events/:id" element={<AdminEventDetail />} />
        <Route
          path="/profile"
          element={
            <ProtectedRoute>
              <Profile />
            </ProtectedRoute>
          }
        />
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <Home />
            </ProtectedRoute>
          }
        />
        <Route
          path="/webinars"
          element={
            <ProtectedRoute>
              <Webinars />
            </ProtectedRoute>
          }
        />
        <Route
          path="/workshops"
          element={
            <ProtectedRoute>
              <Workshops />
            </ProtectedRoute>
          }
        />
        <Route
          path="/internships"
          element={
            <ProtectedRoute>
              <Internships />
            </ProtectedRoute>
          }
        />
      </Routes>
    </BrowserRouter>
  );
}

export default App;



