import React, { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';

import { auth, db } from '../firebase';

async function isAdminUid(uid) {
  // Admins are stored as: /admins/{uid}
  const snap = await getDoc(doc(db, 'admins', uid));
  return snap.exists();
}

export default function ProtectedAdmin({ children }) {
  const [state, setState] = useState({ loading: true, authed: false, admin: false });

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      try {
        if (!user) {
          setState({ loading: false, authed: false, admin: false });
          return;
        }
        const ok = await isAdminUid(user.uid);
        if (!ok) {
          // Signed in, but not authorized as admin
          await signOut(auth);
          setState({ loading: false, authed: false, admin: false });
          return;
        }
        setState({ loading: false, authed: true, admin: true });
      } catch (e) {
        // Fail closed
        await signOut(auth);
        setState({ loading: false, authed: false, admin: false });
      }
    });
    return () => unsub();
  }, []);

  if (state.loading) {
    return (
      <div className="container" style={{ paddingTop: 18 }}>
        <div className="card" style={{ maxWidth: 680, margin: '0 auto' }}>
          <h3 style={{ marginTop: 0 }}>Checking admin access…</h3>
          <p className="muted">Please wait.</p>
        </div>
      </div>
    );
  }

  if (!state.authed || !state.admin) return <Navigate to="/admin" replace />;
  return children;
}
