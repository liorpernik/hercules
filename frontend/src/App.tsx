import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { GoogleOAuthProvider } from '@react-oauth/google';
import DashboardPage from './pages/DashboardPage';
import Login from './pages/Login';
import HerculesPage from './pages/HerculesPage';
import AutoLogout from './components/AutoLogout';
import GoogleCallback from './components/GoogleCallback';
import SettingsPage from './pages/SettingsPage';
import { ThemeProvider } from './context/ThemeContext';

import EntrancePage from './pages/EntrancePage';
import MonetaPage from './pages/MonetaPage';
import PersonalTasksPage from './pages/PersonalTasksPage';

// IMPORTANT: Replace with your actual Google Client ID from environment variable or constant
const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || "YOUR_GOOGLE_CLIENT_ID_HERE";

const ProtectedRoute = ({ children }: { children: React.ReactElement }) => {
  const token = localStorage.getItem("token");
  if (!token) {
    return <Navigate to="/login" replace />;
  }
  return children;
};

function App() {
  return (
    <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
      <ThemeProvider defaultTheme="dark" storageKey="vite-ui-theme">
        <BrowserRouter>
          <AutoLogout>
            <Routes>
              <Route
                path="/"
                element={
                  <ProtectedRoute>
                    <EntrancePage />
                  </ProtectedRoute>
                }
              />
              <Route path="/login" element={<Login />} />

              {/* Hercules Route */}
              <Route
                path="/hercules"
                element={
                  <ProtectedRoute>
                    <HerculesPage />
                  </ProtectedRoute>
                }
              />

              {/* Moneta Route */}
              <Route
                path="/moneta"
                element={
                  <ProtectedRoute>
                    <MonetaPage />
                  </ProtectedRoute>
                }
              />

              <Route
                path="/dashboard"
                element={
                  <ProtectedRoute>
                    <DashboardPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/settings"
                element={
                  <ProtectedRoute>
                    <SettingsPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/tasks"
                element={
                  <ProtectedRoute>
                    <PersonalTasksPage />
                  </ProtectedRoute>
                }
              />
              {/* Legacy Redirect */}
              <Route path="/assistant" element={<Navigate to="/hercules" replace />} />

              <Route path="/auth/google/callback" element={<GoogleCallback />} />
            </Routes>
          </AutoLogout>
        </BrowserRouter>
      </ThemeProvider>
    </GoogleOAuthProvider>
  );
}

export default App;
