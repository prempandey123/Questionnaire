import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Header from '../components/Header';
import { signInWithEmailAndPassword, onAuthStateChanged, signOut } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '../firebase';

export default function AdminLogin() {
  const nav = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // If already signed in as admin, send to dashboard.
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user) return;
      const adminSnap = await getDoc(doc(db, 'admins', user.uid));
      if (adminSnap.exists()) nav('/admin/dashboard');
    });
    return () => unsub();
  }, [nav]);

  const login = async (e) => {
    e.preventDefault();
    setErr('');
    setLoading(true);
    try {
      const cred = await signInWithEmailAndPassword(auth, email.trim(), password);
      const adminSnap = await getDoc(doc(db, 'admins', cred.user.uid));
      if (!adminSnap.exists()) {
        await signOut(auth);
        setErr('You are signed in, but not authorized as Admin.');
        return;
      }
      nav('/admin/dashboard');
    } catch (e2) {
      const msg = String(e2?.message || 'Login failed');
      // Friendly mapping for common auth errors
      if (msg.includes('auth/invalid-credential') || msg.includes('auth/wrong-password')) {
        setErr('Invalid email or password');
      } else if (msg.includes('auth/user-not-found')) {
        setErr('Admin account not found');
      } else if (msg.includes('auth/too-many-requests')) {
        setErr('Too many attempts. Try again later.');
      } else {
        setErr('Login failed. Please check your credentials.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Header mode="admin" />
      <div className="container">
        <div className="card" style={{ maxWidth: 520, margin: "22px auto 0" }}>
          <h2>Admin Login</h2>
          <p className="muted">Sign in using your Admin Email &amp; Password (Firebase Authentication).</p>

          <form onSubmit={login} style={{ display: 'grid', gap: 10 }}>
            <div>
              <label className="label">Email</label>
              <input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@company.com"
                autoComplete="email"
              />
            </div>
            <div>
              <label className="label">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Your password"
                autoComplete="current-password"
              />
            </div>
            {err ? <div className="alert">{err}</div> : null}
            <button className="btn btn-primary" type="submit" disabled={loading}>
              {loading ? 'Signing in…' : 'Login'}
            </button>
          </form>

          <div style={{ marginTop: 10 }} className="muted">
            <small>
              Tip: Add the admin user UID in Firestore under <b>admins/{'{uid}'}</b> to grant access.
            </small>
          </div>
        </div>
      </div>
    </>
  );
}
