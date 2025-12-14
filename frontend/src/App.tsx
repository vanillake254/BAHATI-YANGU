import type React from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'

import { AuthProvider, useAuth } from './auth/AuthContext'
import { AgeGate } from './components/AgeGate'
import { Layout } from './components/Layout'
import { AboutPage } from './pages/AboutPage'
import { AdminProfitPage } from './pages/AdminProfitPage'
import { CookiesPage } from './pages/CookiesPage'
import { DashboardPage } from './pages/DashboardPage'
import { LoginPage } from './pages/LoginPage'
import { PrivacyPage } from './pages/PrivacyPage'
import { PredictPage } from './pages/PredictPage'
import { PickBoxPage } from './pages/PickBoxPage'
import { RegisterPage } from './pages/RegisterPage'
import { SpinPage } from './pages/SpinPage'
import { TermsPage } from './pages/TermsPage'
import { ProfilePage } from './pages/ProfilePage'
import { ForgotPasswordPage } from './pages/ForgotPasswordPage'
import { ChangePasswordPage } from './pages/ChangePasswordPage'
import { PaymentStatusPage } from './pages/PaymentStatusPage'
import { SupportPage } from './pages/SupportPage'

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, loading, ageVerified } = useAuth()

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-accent border-t-transparent" />
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/login" replace />
  }

  // If backend has flagged that the user must change password, lock them into
  // the change-password flow until completed.
  if (user.force_password_change) {
    return <Navigate to="/change-password" replace />
  }

  if (!ageVerified) {
    return <AgeGate />
  }

  return children
}

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Layout>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route path="/forgot-password" element={<ForgotPasswordPage />} />
            <Route path="/change-password" element={<ChangePasswordPage />} />
            <Route path="/about" element={<AboutPage />} />
            <Route path="/privacy" element={<PrivacyPage />} />
            <Route path="/cookies" element={<CookiesPage />} />
            <Route path="/terms" element={<TermsPage />} />

            <Route
              path="/"
              element={
                <ProtectedRoute>
                  <DashboardPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/spin"
              element={
                <ProtectedRoute>
                  <SpinPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/predict"
              element={
                <ProtectedRoute>
                  <PredictPage />
                </ProtectedRoute>
              }
            />

            <Route
              path="/pick-box"
              element={
                <ProtectedRoute>
                  <PickBoxPage />
                </ProtectedRoute>
              }
            />

            <Route
              path="/profile"
              element={
                <ProtectedRoute>
                  <ProfilePage />
                </ProtectedRoute>
              }
            />

            <Route
              path="/admin/profit"
              element={
                <ProtectedRoute>
                  <AdminProfitPage />
                </ProtectedRoute>
              }
            />

            <Route
              path="/payment-status"
              element={
                <ProtectedRoute>
                  <PaymentStatusPage />
                </ProtectedRoute>
              }
            />

            <Route
              path="/support"
              element={
                <ProtectedRoute>
                  <SupportPage />
                </ProtectedRoute>
              }
            />

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Layout>
      </BrowserRouter>
    </AuthProvider>
  )
}

export default App
