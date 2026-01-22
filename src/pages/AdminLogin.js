import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Header from '../components/Header';
import { ADMIN_LOGIN } from '../config';

export default function AdminLogin() {
  const nav = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState('');

  const login = (e) => {
    e.preventDefault();
    setErr('');
    if (username === ADMIN_LOGIN.username && password === ADMIN_LOGIN.password) {
      localStorage.setItem('admin_authed', 'true');
      nav('/admin/dashboard');
    } else {
      setErr('Invalid username or password');
    }
  };

  return (
    <>
      <Header mode="admin" />
      <div className="container">
        <div className="card" style={{ maxWidth: 520, margin: '0 auto' }}>
          <h2>Admin Login</h2>
          <p className="muted">Hardcoded login only (as requested). Change credentials in <b>src/config.js</b>.</p>

          <form onSubmit={login} style={{ display: 'grid', gap: 10 }}>
            <div>
              <label className="label">Username</label>
              <input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="admin" />
            </div>
            <div>
              <label className="label">Password</label>
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="admin@123" />
            </div>
            {err ? <div className="alert">{err}</div> : null}
            <button className="btn" type="submit">Login</button>
          </form>
        </div>
      </div>
    </>
  );
}
