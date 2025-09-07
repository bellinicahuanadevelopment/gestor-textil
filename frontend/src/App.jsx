import React from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './contexts/AuthContext'
import AppShell from './components/AppShell'

// Pages
import Login from './pages/Login'
import Home from './pages/Home'
import Inventario from './pages/Inventario'
import Pedidos from './pages/Pedidos'
import NuevoPedido from './pages/NuevoPedido'
import PedidoDetalle from './pages/PedidoDetalle'
import Configuracion from './pages/Configuracion'

function PrivateRoute({ children }) {
  const { token } = useAuth()
  if (!token) return <Navigate to="/login" replace />
  return <AppShell>{children}</AppShell>
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />

        <Route
          path="/"
          element={
            <PrivateRoute>
              <Home />
            </PrivateRoute>
          }
        />

        <Route
          path="/inventario"
          element={
            <PrivateRoute>
              <Inventario />
            </PrivateRoute>
          }
        />

        <Route
          path="/pedidos"
          element={
            <PrivateRoute>
              <Pedidos />
            </PrivateRoute>
          }
        />

        <Route
          path="/pedidos/nuevo"
          element={
            <PrivateRoute>
              <NuevoPedido />
            </PrivateRoute>
          }
        />

        <Route
          path="/pedidos/:id"
          element={
            <PrivateRoute>
              <PedidoDetalle />
            </PrivateRoute>
          }
        />

        {/* Wrap Configuración so it shows Sidebar/Topbar */}
        <Route
          path="/configuracion"
          element={
            <PrivateRoute>
              <Configuracion />
            </PrivateRoute>
          }
        />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
