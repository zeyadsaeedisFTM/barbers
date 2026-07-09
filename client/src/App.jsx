import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { SocketProvider } from './context/SocketContext';
import { ToastProvider } from './context/ToastContext';
import Layout from './components/Layout';
import CustomerJoin from './components/CustomerJoin';
import CustomerStatus from './components/CustomerStatus';
import AdminLogin from './components/AdminLogin';
import BarberDashboard from './components/BarberDashboard';
import AdminLog from './components/AdminLog';

function App() {
  return (
    <AuthProvider>
      <SocketProvider>
        <ToastProvider>
          <BrowserRouter>
            <Layout>
              <Routes>
                <Route path="/" element={<CustomerJoin />} />
                <Route path="/status/:id" element={<CustomerStatus />} />
                <Route path="/admin/login" element={<AdminLogin />} />
                <Route path="/admin/dashboard" element={<BarberDashboard />} />
                <Route path="/admin/log" element={<AdminLog />} />
                <Route path="*" element={<Navigate to="/" />} />
              </Routes>
            </Layout>
          </BrowserRouter>
        </ToastProvider>
      </SocketProvider>
    </AuthProvider>
  );
}

export default App;
