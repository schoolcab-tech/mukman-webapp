import "@/App.css";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import { Toaster } from "@/components/ui/sonner";
import Layout from "@/components/Layout";
import Login from "@/pages/Login";
import Dashboard from "@/pages/Dashboard";
import ContentPage from "@/pages/ContentPage";
import Timesheet from "@/pages/Timesheet";
import Reviews from "@/pages/Reviews";
import Feedback from "@/pages/Feedback";
import OrgChart from "@/pages/OrgChart";
import Notifications from "@/pages/Notifications";
import ChangePassword from "@/pages/ChangePassword";
import Admin from "@/pages/Admin";

const Loader = () => (
  <div className="min-h-screen flex items-center justify-center bg-slate-50">
    <div data-testid="app-loading-spinner" className="h-10 w-10 rounded-full border-2 border-slate-300 border-t-cyan-500 animate-spin" />
  </div>
);

function Protected({ children, admin, allowChange }) {
  const { user } = useAuth();
  if (user === null) return <Loader />;
  if (!user) return <Navigate to="/login" replace />;
  if (user.must_change_password && !allowChange) return <Navigate to="/change-password" replace />;
  if (!user.must_change_password && allowChange) return <Navigate to="/" replace />;
  if (admin && user.role !== "admin") return <Navigate to="/" replace />;
  return children;
}

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Toaster richColors position="top-right" />
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/change-password" element={<Protected allowChange><ChangePassword /></Protected>} />
          <Route element={<Protected><Layout /></Protected>}>
            <Route path="/" element={<Dashboard />} />
            <Route path="/valuation" element={<ContentPage pageKey="valuation" eyebrow="Valuation & Market Cap" badgeClass="bg-teal-100 text-teal-900 border border-teal-300/40" testid="valuation-page" />} />
            <Route path="/achievements" element={<ContentPage pageKey="achievements" eyebrow="Milestones & Achievements" badgeClass="bg-amber-100 text-amber-900 border border-amber-300/40" testid="achievements-page" />} />
            <Route path="/benefits" element={<ContentPage pageKey="benefits" eyebrow="Employee Benefits & Perks" badgeClass="bg-sky-100 text-sky-900 border border-sky-300/40" testid="benefits-page" />} />
            <Route path="/timesheet" element={<Timesheet />} />
            <Route path="/reviews" element={<Reviews />} />
            <Route path="/feedback" element={<Feedback />} />
            <Route path="/org-chart" element={<OrgChart />} />
            <Route path="/notifications" element={<Notifications />} />
            <Route path="/admin" element={<Protected admin><Admin /></Protected>} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
