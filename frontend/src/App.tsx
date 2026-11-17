import { Route, Routes, Navigate } from "react-router-dom";
import { useState } from "react";
import Login from "./pages/Login";
import RegisterPro from "./pages/RegisterPro";
import RegisterPersonal from "./pages/RegisterPersonal";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import Catalog from "./pages/Catalog";
import ProductDetail from "./pages/ProductDetail";
import Orders from "./pages/Orders";
import OurStory from "./pages/OurStory";
import Profile from "./pages/Profile";
import Layout from "./components/Layout";
import AdminLayout from "./components/AdminLayout";
import { ProtectedRoute } from "./components/ProtectedRoute";
import CartDrawer from "./components/CartDrawer";
import AdminDashboard from "./pages/admin/Dashboard";
import AdminOrders from "./pages/admin/Orders";
import AdminOrderDetail from "./pages/admin/OrderDetail";
import AdminProducts from "./pages/admin/Products";
import AdminProductEdit from "./pages/admin/ProductEdit";
import AdminClients from "./pages/admin/Clients";
import AdminPending from "./pages/admin/Pending";
import AdminSettings from "./pages/admin/Settings";

export default function App() {
  const [cartOpen, setCartOpen] = useState(false);
  return (
    <>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/register/pro" element={<RegisterPro />} />
        <Route path="/register/particulier" element={<RegisterPersonal />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />

        <Route
          element={
            <ProtectedRoute>
              <Layout openCart={() => setCartOpen(true)} />
            </ProtectedRoute>
          }
        >
          <Route index element={<Catalog />} />
          <Route path="/products/:id" element={<ProductDetail />} />
          <Route path="/orders" element={<Orders />} />
          <Route path="/our-story" element={<OurStory />} />
          <Route path="/profile" element={<Profile />} />
        </Route>

        <Route
          path="/admin"
          element={
            <ProtectedRoute adminOnly>
              <AdminLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<AdminDashboard />} />
          <Route path="orders" element={<AdminOrders />} />
          <Route path="orders/:id" element={<AdminOrderDetail />} />
          <Route path="products" element={<AdminProducts />} />
          <Route path="products/new" element={<AdminProductEdit />} />
          <Route path="products/:id/edit" element={<AdminProductEdit />} />
          <Route path="clients" element={<AdminClients />} />
          <Route path="pending" element={<AdminPending />} />
          <Route path="settings" element={<AdminSettings />} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>

      <CartDrawer open={cartOpen} onClose={() => setCartOpen(false)} />
    </>
  );
}
