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
    <div className="topbar">
      <div className="topbar-inner">
        <div className="brand" role="banner">
          <div className="logo">Q</div>
          <div>
            <h1>Hero Steels • Questionnaire</h1>
            <div className="sub">{isAdmin ? 'Admin Panel' : 'Employee Portal'} • Fast • Clean • Secure</div>
          </div>
        </div>

        <div className="nav" role="navigation" aria-label="Primary">
          {isAdmin ? (
            <>
              <Link className="btn secondary" to="/admin/dashboard" aria-current={loc.pathname === '/admin/dashboard' ? 'page' : undefined}>
                Dashboard
              </Link>
              <Link className="btn secondary" to="/admin/results" aria-current={loc.pathname === '/admin/results' ? 'page' : undefined}>
                Results
              </Link>
              <button className="btn btn-danger" onClick={logout}>Logout</button>
            </>
          ) : (
            <>
              <Link className="btn secondary" to="/" aria-current={loc.pathname === '/' ? 'page' : undefined}>Home</Link>
              <Link className="btn btn-primary" to="/admin" aria-current={loc.pathname === '/admin' ? 'page' : undefined}>Admin Login</Link>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
