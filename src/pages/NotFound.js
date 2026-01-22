import React from 'react';
import { Link } from 'react-router-dom';
import Header from '../components/Header';

export default function NotFound() {
  return (
    <>
      <Header />
      <div className="container">
        <div className="card" style={{ textAlign: 'center' }}>
          <h1>404</h1>
          <p className="muted">Page not found</p>
          <Link className="btn" to="/">Go Home</Link>
        </div>
      </div>
    </>
  );
}
