import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import Header from '../components/Header';

export default function SubmitSuccess() {
  const loc = useLocation();
  const score = loc.state?.score;
  const total = loc.state?.total;
  const title = loc.state?.title;

  return (
    <>
      <Header />
      <div className="container">
        <div className="card" style={{ textAlign: 'center' }}>
          <div className="badge">SUBMITTED</div>
          <h1 style={{ marginTop: 12 }}>Thank you!</h1>
          {title ? <p className="muted">Questionnaire: <b>{title}</b></p> : null}
          {typeof score === 'number' ? (
            <p style={{ fontSize: 18 }}>
              Your Score: <b>{score}</b> / {total}
            </p>
          ) : (
            <p className="muted">Your response has been recorded.</p>
          )}
          <div style={{ marginTop: 18 }}>
            <Link className="btn" to="/">Back to Home</Link>
          </div>
        </div>
      </div>
    </>
  );
}
