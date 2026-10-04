import { Suspense, lazy } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "../contexts/AuthContext";
import { useAuth } from "../hooks/useAuth";
import { ProtectedRoute } from "./ProtectedRoute";
import { Layout } from "../layouts/Layout";
import { LoginPage } from "../pages/LoginPage";

const DashboardPage = lazy(() => import("../pages/DashboardPage").then((m) => ({ default: m.DashboardPage })));
const MyDashboardPage = lazy(() => import("../pages/MyDashboardPage").then((m) => ({ default: m.MyDashboardPage })));
const EmployeesPage = lazy(() => import("../pages/EmployeesPage").then((m) => ({ default: m.EmployeesPage })));
const EmployeeDetailsPage = lazy(() =>
  import("../pages/EmployeeDetailsPage").then((m) => ({ default: m.EmployeeDetailsPage }))
);
const DepartmentsPage = lazy(() => import("../pages/DepartmentsPage").then((m) => ({ default: m.DepartmentsPage })));
const SkillsPage = lazy(() => import("../pages/SkillsPage").then((m) => ({ default: m.SkillsPage })));
const PredictionsPage = lazy(() => import("../pages/PredictionsPage").then((m) => ({ default: m.PredictionsPage })));
const RecommendationsPage = lazy(() =>
  import("../pages/RecommendationsPage").then((m) => ({ default: m.RecommendationsPage }))
);
const TrainingPage = lazy(() => import("../pages/TrainingPage").then((m) => ({ default: m.TrainingPage })));
const NotificationsPage = lazy(() =>
  import("../pages/NotificationsPage").then((m) => ({ default: m.NotificationsPage }))
);
const AuditLogsPage = lazy(() => import("../pages/AuditLogsPage").then((m) => ({ default: m.AuditLogsPage })));

const RouteFallback = () => (
  <div className="flex h-full w-full items-center justify-center py-24">
    <div className="h-8 w-8 animate-spin rounded-full border-2 border-indigo-200 border-t-indigo-600" />
  </div>
);

// Organization-wide analytics for HR; a personal self-service view for employees
const HomePage = () => {
  const { user } = useAuth();
  return user?.role === "EMPLOYEE" ? <MyDashboardPage /> : <DashboardPage />;
};

export default function AppRoutes() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Suspense fallback={<RouteFallback />}>
        <Routes>
          {/* Public Routes */}
          <Route path="/login" element={<LoginPage />} />

          {/* Private Routes Guarded by AuthProvider */}
          <Route element={<ProtectedRoute />}>
            <Route element={<Layout />}>
              {/* Common Access Pages */}
              <Route path="/" element={<HomePage />} />
              <Route path="/departments" element={<DepartmentsPage />} />
              <Route path="/skills" element={<SkillsPage />} />
              <Route path="/training" element={<TrainingPage />} />
              <Route path="/notifications" element={<NotificationsPage />} />

              {/* Manager & Admin Restricted Pages */}
              <Route element={<ProtectedRoute allowedRoles={["HR_ADMIN", "HR_MANAGER"]} />}>
                <Route path="/employees" element={<EmployeesPage />} />
                <Route path="/employees/:id" element={<EmployeeDetailsPage />} />
                <Route path="/predictions" element={<PredictionsPage />} />
                <Route path="/recommendations" element={<RecommendationsPage />} />
              </Route>

              {/* Admin Only Restricted Pages */}
              <Route element={<ProtectedRoute allowedRoles={["HR_ADMIN"]} />}>
                <Route path="/audit-logs" element={<AuditLogsPage />} />
              </Route>
            </Route>
          </Route>

          {/* Catch-all fallback */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        </Suspense>
      </AuthProvider>
    </BrowserRouter>
  );
}
