import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './hooks/useAuth';
import { DataProvider } from './context/DataContext';
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
import Assignments from './pages/Assignments';
import AssignmentDetails from './pages/AssignmentDetails';

import { UserProfile } from './pages/UserProfile';
import PartnerMap from './pages/PartnerMap';

// Protected Route wrapper
const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { currentUser, loading } = useAuth();
  
  // Show loading spinner while checking authentication
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    );
  }
  
  // Redirect to login if not authenticated
  if (!currentUser) {
    return <Navigate to="/login" replace />;
  }
  
  // Render protected content if authenticated
  return <Layout>{children}</Layout>;
};

function AppRoutes() {
  const { currentUser, loading } = useAuth();
  
  return (
    <Routes>
      <Route path="/login" element={
        // Redirect to dashboard if already logged in
        currentUser && !loading ? <Navigate to="/" replace /> : <Login />
      } />
      
      {/* Protected Routes */}
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
      <Route path="/partner-map" element={<PartnerMap />} />

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
      <Route path="/assignments" element={
        <ProtectedRoute>
          <Assignments />
        </ProtectedRoute>
      } />
      <Route path="/assignments/new" element={
        <ProtectedRoute>
          <AssignmentDetails />
        </ProtectedRoute>
      } />
      <Route path="/assignments/:taskId" element={
        <ProtectedRoute>
          <AssignmentDetails />
        </ProtectedRoute>
      } />
      
      {/* Catch-all route - redirect to login if not authenticated, otherwise to dashboard */}
      <Route path="*" element={
        currentUser && !loading ? <Navigate to="/" replace /> : <Navigate to="/login" replace />
      } />
    </Routes>
  );
}

function App() {
  return (
    <Router>
      <AuthProvider>
        <DataProvider>
          <AppRoutes />
        </DataProvider>
      </AuthProvider>
    </Router>
  );
}

export default App;
