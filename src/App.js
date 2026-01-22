import { Routes, Route, Navigate } from 'react-router-dom';

import EmployeeHome from './pages/EmployeeHome';
import TakeQuiz from './pages/TakeQuiz';
import SubmitSuccess from './pages/SubmitSuccess';

import AdminLogin from './pages/AdminLogin';
import AdminDashboard from './pages/AdminDashboard';
import AdminResults from './pages/AdminResults';

import ProtectedAdmin from './components/ProtectedAdmin';
import NotFound from './pages/NotFound';

function App() {
  return (
    <Routes>
      {/* Employee */}
      <Route path="/" element={<EmployeeHome />} />
      <Route path="/quiz/:quizId" element={<TakeQuiz />} />
      <Route path="/submitted" element={<SubmitSuccess />} />

      {/* Admin */}
      <Route path="/admin" element={<AdminLogin />} />
      <Route
        path="/admin/dashboard"
        element={
          <ProtectedAdmin>
            <AdminDashboard />
          </ProtectedAdmin>
        }
      />
      <Route
        path="/admin/results"
        element={
          <ProtectedAdmin>
            <AdminResults />
          </ProtectedAdmin>
        }
      />

      <Route path="/404" element={<NotFound />} />
      <Route path="*" element={<Navigate to="/404" replace />} />
    </Routes>
  );
}

export default App;
