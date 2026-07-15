import { Navigate } from 'react-router-dom';
import { hasValidSession } from '../../services/auth';

function PrivateRoute({ children }) {
  if (!hasValidSession()) {
    return <Navigate to="/login" replace />;
  }
  return children;
}

export default PrivateRoute;
