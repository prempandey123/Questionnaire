import React from 'react';
import { Navigate } from 'react-router-dom';

function isAuthed() {
  return localStorage.getItem('admin_authed') === 'true';
}

export default function ProtectedAdmin({ children }) {
  if (!isAuthed()) return <Navigate to="/admin" replace />;
  return children;
}
