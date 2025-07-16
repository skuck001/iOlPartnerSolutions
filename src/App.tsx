import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './hooks/useAuth';
import { Layout } from './components/Layout';
import { Login } from './pages/Login';
import { Dashboard } from './pages/Dashboard';
import { Accounts } from './pages/Accounts';
import { AccountDetails } from './pages/AccountDetails';
import { Products } from './pages/Products';
import { ProductDetails } from './pages/ProductDetails';
import { Contacts } from './pages/Contacts';
import { ContactDetails } from './pages/ContactDetails';
import { Opportunities } from './pages/Opportunities';
import { OpportunityDetails } from './pages/OpportunityDetails';
import { Tasks } from './pages/Tasks';
import { TaskDetails } from './pages/TaskDetails';
import { WeeklyReport } from './pages/WeeklyReport';

import { UserProfile } from './pages/UserProfile';

// Protected Route wrapper
const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { currentUser } = useAuth();
  return currentUser ? <Layout>{children}</Layout> : <Navigate to="/login" />;
};

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/" element={
        <ProtectedRoute>
          <Dashboard />
        </ProtectedRoute>
      } />
      <Route path="/profile" element={
        <ProtectedRoute>
          <UserProfile />
        </ProtectedRoute>
      } />
      <Route path="/weekly-report" element={
        <ProtectedRoute>
          <WeeklyReport />
        </ProtectedRoute>
      } />

      <Route path="/accounts" element={
        <ProtectedRoute>
          <Accounts />
        </ProtectedRoute>
      } />
      <Route path="/accounts/new" element={
        <ProtectedRoute>
          <AccountDetails />
        </ProtectedRoute>
      } />
      <Route path="/accounts/:id" element={
        <ProtectedRoute>
          <AccountDetails />
        </ProtectedRoute>
      } />
      <Route path="/products" element={
        <ProtectedRoute>
          <Products />
        </ProtectedRoute>
      } />
      <Route path="/products/new" element={
        <ProtectedRoute>
          <ProductDetails />
        </ProtectedRoute>
      } />
      <Route path="/products/:id" element={
        <ProtectedRoute>
          <ProductDetails />
        </ProtectedRoute>
      } />
      <Route path="/contacts" element={
        <ProtectedRoute>
          <Contacts />
        </ProtectedRoute>
      } />
      <Route path="/contacts/new" element={
        <ProtectedRoute>
          <ContactDetails />
        </ProtectedRoute>
      } />
      <Route path="/contacts/:id" element={
        <ProtectedRoute>
          <ContactDetails />
        </ProtectedRoute>
      } />
      <Route path="/opportunities" element={
        <ProtectedRoute>
          <Opportunities />
        </ProtectedRoute>
      } />
      <Route path="/opportunities/new" element={
        <ProtectedRoute>
          <OpportunityDetails />
        </ProtectedRoute>
      } />
      <Route path="/opportunities/:id" element={
        <ProtectedRoute>
          <OpportunityDetails />
        </ProtectedRoute>
      } />
      <Route path="/tasks" element={
        <ProtectedRoute>
          <Tasks />
        </ProtectedRoute>
      } />
      <Route path="/tasks/new" element={
        <ProtectedRoute>
          <TaskDetails />
        </ProtectedRoute>
      } />
      <Route path="/tasks/:id" element={
        <ProtectedRoute>
          <TaskDetails />
        </ProtectedRoute>
      } />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

function App() {
  return (
    <Router>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </Router>
  );
}

export default App;
