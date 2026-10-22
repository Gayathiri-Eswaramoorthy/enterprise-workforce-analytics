import { Suspense, lazy } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "../contexts/AuthContext";
import { useAuth } from "../hooks/useAuth";
import { ProtectedRoute } from "./ProtectedRoute";
import { Layout } from "../layouts/Layout";
import { LoginPage } from "../pages/LoginPage";

const SystemOverviewPage = lazy(() =>
  import("../pages/SystemOverviewPage").then((m) => ({ default: m.SystemOverviewPage }))
);
const DashboardPage = lazy(() =>
  import("../pages/DashboardPage").then((m) => ({ default: m.DashboardPage }))
);
const MyDashboardPage = lazy(() =>
  import("../pages/MyDashboardPage").then((m) => ({ default: m.MyDashboardPage }))
);
const EmployeesPage = lazy(() =>
  import("../pages/EmployeesPage").then((m) => ({ default: m.EmployeesPage }))
);
const EmployeeDetailsPage = lazy(() =>
  import("../pages/EmployeeDetailsPage").then((m) => ({ default: m.EmployeeDetailsPage }))
);
const DepartmentsPage = lazy(() =>
  import("../pages/DepartmentsPage").then((m) => ({ default: m.DepartmentsPage }))
);
const SkillsPage = lazy(() =>
  import("../pages/SkillsPage").then((m) => ({ default: m.SkillsPage }))
);
const PredictionsPage = lazy(() =>
  import("../pages/PredictionsPage").then((m) => ({ default: m.PredictionsPage }))
);
const RecommendationsPage = lazy(() =>
  import("../pages/RecommendationsPage").then((m) => ({ default: m.RecommendationsPage }))
);
const TrainingPage = lazy(() =>
  import("../pages/TrainingPage").then((m) => ({ default: m.TrainingPage }))
);
const MyLearningPage = lazy(() =>
  import("../pages/MyLearningPage").then((m) => ({ default: m.MyLearningPage }))
);
const MySkillsPage = lazy(() =>
  import("../pages/MySkillsPage").then((m) => ({ default: m.MySkillsPage }))
);
const MyTrainingProgressPage = lazy(() =>
  import("../pages/MyTrainingProgressPage").then((m) => ({ default: m.MyTrainingProgressPage }))
);
const MyRequestsPage = lazy(() =>
  import("../pages/MyRequestsPage").then((m) => ({ default: m.MyRequestsPage }))
);
const NotificationsPage = lazy(() =>
  import("../pages/NotificationsPage").then((m) => ({ default: m.NotificationsPage }))
);
const AuditLogsPage = lazy(() =>
  import("../pages/AuditLogsPage").then((m) => ({ default: m.AuditLogsPage }))
);
const UsersPage = lazy(() =>
  import("../pages/UsersPage").then((m) => ({ default: m.UsersPage }))
);

const RouteFallback = () => (
  <div className="flex h-full w-full items-center justify-center py-24">
    <div className="h-8 w-8 animate-spin rounded-full border-2 border-indigo-200 border-t-indigo-600" />
  </div>
);

// Role-aware landing page dispatcher
const HomePage = () => {
  const { user } = useAuth();
  if (user?.role === "HR_ADMIN") return <SystemOverviewPage />;
  if (user?.role === "HR_MANAGER") return <DashboardPage />;
  return <MyDashboardPage />;
};

export default function AppRoutes() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Suspense fallback={<RouteFallback />}>
          <Routes>
            {/* Public Routes */}
            <Route path="/login" element={<LoginPage />} />

            {/* Authenticated Layout Boundary */}
            <Route element={<ProtectedRoute />}>
              <Route element={<Layout />}>
                {/* Role-Aware Landing Page & Shared Notifications */}
                <Route path="/" element={<HomePage />} />
                <Route path="/notifications" element={<NotificationsPage />} />

                {/* HR Shared Management Pages (Admin & Manager) */}
                <Route element={<ProtectedRoute allowedRoles={["HR_ADMIN", "HR_MANAGER"]} />}>
                  <Route path="/employees" element={<EmployeesPage />} />
                  <Route path="/employees/:id" element={<EmployeeDetailsPage />} />
                  <Route path="/departments" element={<DepartmentsPage />} />
                </Route>

                {/* HR Admin Restricted Pages (System Governance) */}
                <Route element={<ProtectedRoute allowedRoles={["HR_ADMIN"]} />}>
                  <Route path="/users" element={<UsersPage />} />
                  <Route path="/audit-logs" element={<AuditLogsPage />} />
                </Route>

                {/* HR Manager Restricted Pages (Workforce Analytics & Decisions) */}
                <Route element={<ProtectedRoute allowedRoles={["HR_MANAGER"]} />}>
                  <Route path="/predictions" element={<PredictionsPage />} />
                  <Route path="/recommendations" element={<RecommendationsPage />} />
                  <Route path="/skills" element={<SkillsPage />} />
                  <Route path="/training" element={<TrainingPage />} />
                </Route>

                {/* Employee Self-Service Restricted Pages */}
                <Route element={<ProtectedRoute allowedRoles={["EMPLOYEE"]} />}>
                  <Route path="/my-learning" element={<MyLearningPage />} />
                  <Route path="/my-skills" element={<MySkillsPage />} />
                  <Route path="/my-progress" element={<MyTrainingProgressPage />} />
                  <Route path="/my-requests" element={<MyRequestsPage />} />
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
