import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "../contexts/AuthContext";
import { ProtectedRoute } from "./ProtectedRoute";
import { Layout } from "../layouts/Layout";
import { LoginPage } from "../pages/LoginPage";
import { DashboardPage } from "../pages/DashboardPage";
import { EmployeesPage } from "../pages/EmployeesPage";
import { EmployeeDetailsPage } from "../pages/EmployeeDetailsPage";
import { DepartmentsPage } from "../pages/DepartmentsPage";
import { SkillsPage } from "../pages/SkillsPage";
import { PredictionsPage } from "../pages/PredictionsPage";
import { RecommendationsPage } from "../pages/RecommendationsPage";
import { TrainingPage } from "../pages/TrainingPage";
import { NotificationsPage } from "../pages/NotificationsPage";
import { AuditLogsPage } from "../pages/AuditLogsPage";

export default function AppRoutes() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          {/* Public Routes */}
          <Route path="/login" element={<LoginPage />} />

          {/* Private Routes Guarded by AuthProvider */}
          <Route element={<ProtectedRoute />}>
            <Route element={<Layout />}>
              {/* Common Access Pages */}
              <Route path="/" element={<DashboardPage />} />
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
      </AuthProvider>
    </BrowserRouter>
  );
}
