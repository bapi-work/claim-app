import { Navigate } from "react-router-dom";
import { useAuth, CurrentUser } from "./AuthContext";

export function ProtectedRoute({
  children,
  roles,
}: {
  children: React.ReactNode;
  roles?: CurrentUser["role"][];
}) {
  const { user, loading } = useAuth();

  if (loading) return <p>Loading...</p>;
  if (!user) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(user.role)) return <Navigate to="/" replace />;

  return <>{children}</>;
}
