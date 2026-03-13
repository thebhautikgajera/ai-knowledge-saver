import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import CinematicLoader from './ui/CinematicLoader';

const ProtectedRoute = ({ children }) => {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return <CinematicLoader label="Checking your session…" sublabel="Just a moment." />;
  }

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  // If in the future the user object includes `isEmailVerified === false`,
  // this will redirect unverified users to the verification flow.
  if (user && user.isEmailVerified === false) {
    return <Navigate to="/verify-email" replace state={{ from: location }} />;
  }

  return children;
};

export default ProtectedRoute;

