import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "./auth/AuthContext";
import { BrandingProvider } from "./branding/BrandingContext";
import { LoginPage } from "./auth/LoginPage";
import { ProtectedRoute } from "./auth/ProtectedRoute";
import { AppShell } from "./layout/AppShell";
import { ClaimList } from "./employee/ClaimList";
import { ClaimForm } from "./employee/ClaimForm";
import { ClaimDetail } from "./employee/ClaimDetail";
import { ApprovalQueue } from "./manager/ApprovalQueue";
import { AllClaimsTable } from "./admin/AllClaimsTable";
import { AuditLogViewer } from "./admin/AuditLogViewer";
import { UserManagement } from "./admin/UserManagement";
import { BrandingSettings } from "./admin/BrandingSettings";
import { EmailSettings } from "./admin/EmailSettings";
import { ProfilePage } from "./profile/ProfilePage";

export function App() {
  return (
    <AuthProvider>
      <BrandingProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route
              path="/"
              element={
                <ProtectedRoute>
                  <AppShell />
                </ProtectedRoute>
              }
            >
              <Route index element={<ClaimList />} />
              <Route path="claims/new" element={<ClaimForm />} />
              <Route path="claims/:id" element={<ClaimDetail />} />
              <Route path="profile" element={<ProfilePage />} />
              <Route
                path="approvals"
                element={
                  <ProtectedRoute roles={["MANAGER", "FINANCE", "HR", "ADMIN"]}>
                    <ApprovalQueue />
                  </ProtectedRoute>
                }
              />
              <Route
                path="admin/claims"
                element={
                  <ProtectedRoute roles={["FINANCE", "HR", "ADMIN"]}>
                    <AllClaimsTable />
                  </ProtectedRoute>
                }
              />
              <Route
                path="admin/audit-log"
                element={
                  <ProtectedRoute roles={["FINANCE", "HR", "ADMIN"]}>
                    <AuditLogViewer />
                  </ProtectedRoute>
                }
              />
              <Route
                path="admin/users"
                element={
                  <ProtectedRoute roles={["HR", "ADMIN"]}>
                    <UserManagement />
                  </ProtectedRoute>
                }
              />
              <Route
                path="admin/branding"
                element={
                  <ProtectedRoute roles={["ADMIN"]}>
                    <BrandingSettings />
                  </ProtectedRoute>
                }
              />
              <Route
                path="admin/email"
                element={
                  <ProtectedRoute roles={["ADMIN"]}>
                    <EmailSettings />
                  </ProtectedRoute>
                }
              />
            </Route>
          </Routes>
        </BrowserRouter>
      </BrandingProvider>
    </AuthProvider>
  );
}
