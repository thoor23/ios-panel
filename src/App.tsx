import { lazy, Suspense } from "react";
import { TopNotificationProvider } from "@/components/TopNotification";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { ThemeProvider } from "next-themes";
import { ThemeStatusBar } from "@/components/ThemeStatusBar";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import Login from "@/pages/Login";
import NotFound from "./pages/NotFound";

const AdminOverview = lazy(() => import("@/pages/admin/AdminOverview"));
const AdminKeys = lazy(() => import("@/pages/admin/AdminKeys"));
const AdminUsers = lazy(() => import("@/pages/admin/AdminUsers"));
const AdminCredits = lazy(() => import("@/pages/admin/AdminCredits"));
const AdminAuditLog = lazy(() => import("@/pages/admin/AdminAuditLog"));
const AdminManagement = lazy(() => import("@/pages/admin/AdminManagement"));

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem={true} storageKey="nextios_theme">
    <ThemeStatusBar />
    <TooltipProvider>
      <Toaster />
      <TopNotificationProvider>
      <AuthProvider>
        <BrowserRouter>
          <Suspense fallback={<div className="min-h-screen flex items-center justify-center bg-background"><div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>}>
            <Routes>
              <Route path="/" element={<Navigate to="/login" replace />} />
              <Route path="/login" element={<Login />} />

              {/* Admin routes */}
              <Route path="/dashboard" element={<ProtectedRoute allowedRoles={['admin']}><AdminOverview /></ProtectedRoute>} />
              <Route path="/dashboard/keys" element={<ProtectedRoute allowedRoles={['admin']}><AdminKeys /></ProtectedRoute>} />
              <Route path="/dashboard/users" element={<ProtectedRoute allowedRoles={['admin']}><AdminUsers /></ProtectedRoute>} />
              <Route path="/dashboard/credits" element={<ProtectedRoute allowedRoles={['admin']}><AdminCredits /></ProtectedRoute>} />
              <Route path="/dashboard/audit-log" element={<ProtectedRoute allowedRoles={['admin']}><AdminAuditLog /></ProtectedRoute>} />
              <Route path="/dashboard/manage" element={<ProtectedRoute allowedRoles={['admin']}><AdminManagement /></ProtectedRoute>} />

              {/* Reseller routes */}
              <Route path="/reseller" element={<ProtectedRoute allowedRoles={['reseller']}><AdminOverview /></ProtectedRoute>} />
              <Route path="/reseller/keys" element={<ProtectedRoute allowedRoles={['reseller']}><AdminKeys /></ProtectedRoute>} />
              <Route path="/reseller/credits" element={<ProtectedRoute allowedRoles={['reseller']}><AdminCredits /></ProtectedRoute>} />

              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
        </BrowserRouter>
      </AuthProvider>
      </TopNotificationProvider>
    </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
