import React from "react";
import { Link, Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import type { UserRole } from "../types";
import { ArrowLeft, ShieldAlert } from "lucide-react";

interface ProtectedRouteProps {
  allowedRoles?: UserRole[];
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ allowedRoles }) => {
  const { user, loading, hasRole } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-[300px] w-full items-center justify-center py-20">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-accent border-t-transparent" />
          <p className="text-sm font-medium text-ink-3">Authenticating session...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles && !hasRole(allowedRoles)) {
    return (
      <div className="flex min-h-[450px] w-full flex-col items-center justify-center p-6 text-ink">
        <div className="max-w-md rounded-2xl border border-rose-200 bg-rose-50/70 p-8 text-center shadow-card">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-rose-100 text-rose-600">
            <ShieldAlert className="h-7 w-7" />
          </div>
          <h2 className="text-lg font-bold text-slate-900">Access Restricted</h2>
          <p className="mt-2 text-sm text-slate-600 leading-relaxed">
            Your current account role (<strong>{user.role.replace("_", " ")}</strong>) does not have authorization
            to access this enterprise module or URL.
          </p>
          <div className="mt-6 flex justify-center">
            <Link
              to="/"
              className="inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-accent-hover"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Return to Dashboard
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return <Outlet />;
};
