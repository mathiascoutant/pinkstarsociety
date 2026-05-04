import { Navigate, Route, Routes } from "react-router-dom";
import Landing from "./Landing";
import { useAuth } from "./context/AuthContext";
import AccountBookingDetailPage from "./pages/AccountBookingDetailPage";
import AccountLoyaltyPage from "./pages/AccountLoyaltyPage";
import AccountPage from "./pages/AccountPage";
import AdminPage from "./pages/AdminPage";
import LoginPage from "./pages/LoginPage";
import PaymentSuccessPage from "./pages/PaymentSuccessPage";
import RegisterPage from "./pages/RegisterPage";
import ReservationPage from "./pages/ReservationPage";

function AdminRoute({ children }: { children: React.ReactElement }) {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#050507] text-white">
        Chargement…
      </div>
    );
  }
  if (!user) return <Navigate to="/connexion" replace />;
  if (user.role !== "admin")
    return (
      <div className="min-h-screen bg-[#050507] px-5 py-20 text-white">
        <p>Accès réservé aux administrateurs.</p>
      </div>
    );
  return children;
}

/** Espace personnel : client ou admin (réservations / QR / points). */
function AccountRoute({ children }: { children: React.ReactElement }) {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#050507] text-white">
        Chargement…
      </div>
    );
  }
  if (!user) return <Navigate to="/connexion" replace />;
  if (user.role !== "client" && user.role !== "admin")
    return <Navigate to="/" replace />;
  return children;
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/connexion" element={<LoginPage />} />
      <Route path="/inscription" element={<RegisterPage />} />
      <Route
        path="/admin"
        element={
          <AdminRoute>
            <AdminPage />
          </AdminRoute>
        }
      />
      <Route
        path="/compte"
        element={
          <AccountRoute>
            <AccountPage />
          </AccountRoute>
        }
      />
      <Route
        path="/compte/fidelite"
        element={
          <AccountRoute>
            <AccountLoyaltyPage />
          </AccountRoute>
        }
      />
      <Route
        path="/compte/prestation/:id"
        element={
          <AccountRoute>
            <AccountBookingDetailPage />
          </AccountRoute>
        }
      />
      <Route path="/reservation/:token/merci" element={<PaymentSuccessPage />} />
      <Route path="/reservation/:token" element={<ReservationPage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
