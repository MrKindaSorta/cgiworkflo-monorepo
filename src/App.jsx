import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { AARProvider } from './contexts/AARContext';
import Login from './pages/Login';
import Layout from './components/layout/Layout';
import Dashboard from './pages/Dashboard';
import BrowseAARs from './pages/BrowseAARs';
import AARDetail from './pages/AARDetail';
import SubmitAAR from './pages/SubmitAAR';
import Chat from './pages/Chat';
import Profile from './pages/Profile';
import Analytics from './pages/Analytics';
import Branding from './pages/Branding';
import Customize from './pages/Customize';
import Users from './pages/Users';

const ProtectedRoute = ({ children }) => {
  const { isAuthenticated } = useAuth();
  return isAuthenticated ? children : <Navigate to="/login" replace />;
};

const AppRoutes = () => {
  const { isAuthenticated } = useAuth();

  return (
    <Routes>
      <Route
        path="/login"
        element={isAuthenticated ? <Navigate to="/" replace /> : <Login />}
      />
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Dashboard />} />
        <Route path="browse" element={<BrowseAARs />} />
        <Route path="aar/:id" element={<AARDetail />} />
        <Route path="submit" element={<SubmitAAR />} />
        <Route path="chat" element={<Chat />} />
        <Route path="profile" element={<Profile />} />
        <Route path="analytics" element={<Analytics />} />
        <Route path="branding" element={<Branding />} />
        <Route path="customize" element={<Customize />} />
        <Route path="users" element={<Users />} />
      </Route>
    </Routes>
  );
};

function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <AARProvider>
          <AppRoutes />
        </AARProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
