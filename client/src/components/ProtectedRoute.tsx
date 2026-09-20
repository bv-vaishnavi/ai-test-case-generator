import { useEffect, useState } from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { clearSession, tokenExpiresAt } from "../lib/session";

const ProtectedRoute = () => {
  const location = useLocation();
  const [expired, setExpired] = useState(() => {
    const expiresAt = tokenExpiresAt();
    return expiresAt === null || expiresAt <= Date.now();
  });

  useEffect(() => {
    const expiresAt = tokenExpiresAt();
    if (expiresAt === null || expiresAt <= Date.now()) {
      clearSession();
      return;
    }
    const timeout = window.setTimeout(() => {
      clearSession();
      setExpired(true);
    }, expiresAt - Date.now());
    return () => window.clearTimeout(timeout);
  }, []);

  if (expired)
    return (
      <Navigate
        to="/login"
        replace
        state={{ from: location.pathname, reason: "expired" }}
      />
    );

  return <Outlet />;
};

export default ProtectedRoute;
