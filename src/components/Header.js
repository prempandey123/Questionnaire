import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';

export default function Header({ mode }) {
  const loc = useLocation();
  const nav = useNavigate();

  const isAdmin = mode === 'admin';

  const logout = () => {
    if (isAdmin) {
      localStorage.removeItem('admin_authed');
      nav('/admin');
    } else {
      nav('/');
    }
  };

  return (
    <div className="container" style={{ paddingTop: 18, paddingBottom: 0 }}>
      <div className="card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div className="badge">{isAdmin ? 'ADMIN' : 'EMPLOYEE'}</div>
          <h2 style={{ marginTop: 10 }}>Hero Steels – Employee Questionnaire</h2>
          <div className="muted" style={{ fontSize: 13 }}>
            React + Firebase (Auth optional) + Firestore
          </div>
        </div>

        <div className="row" style={{ gap: 10, alignItems: 'center', justifyContent: 'flex-end' }}>
          {isAdmin ? (
            <>
              <Link className="btn secondary" to="/admin/dashboard" aria-current={loc.pathname === '/admin/dashboard' ? 'page' : undefined}>Dashboard</Link>
              <Link className="btn secondary" to="/admin/results" aria-current={loc.pathname === '/admin/results' ? 'page' : undefined}>Results</Link>
              <button className="btn" onClick={logout}>Logout</button>
            </>
          ) : (
            <>
              <Link className="btn secondary" to="/">Home</Link>
              <Link className="btn" to="/admin">Admin</Link>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
