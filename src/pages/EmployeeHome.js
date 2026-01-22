import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Header from '../components/Header';
import { listQuestionnaires } from '../utils/firestore';

export default function EmployeeHome() {
  const nav = useNavigate();
  const [name, setName] = useState(localStorage.getItem('emp_name') || '');
  const [department, setDepartment] = useState(localStorage.getItem('emp_dept') || '');
  const [quizzes, setQuizzes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const list = await listQuestionnaires({ onlyPublished: true });
        setQuizzes(list);
      } catch (e) {
        setErr(e?.message || 'Failed to load questionnaires');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const canStart = useMemo(() => name.trim().length >= 2, [name]);

  const start = (quizId) => {
    if (!canStart) {
      setErr('Please enter your name to continue.');
      return;
    }
    localStorage.setItem('emp_name', name.trim());
    localStorage.setItem('emp_dept', department.trim());
    nav(`/quiz/${quizId}`);
  };

  return (
    <>
      <Header />
      <div className="container">
        <div className="row">
          <div className="col">
            <div className="card">
              <h2>Employee Details</h2>
              <p className="muted">Enter your details before starting.</p>
              <div style={{ display: 'grid', gap: 10 }}>
                <div>
                  <label className="label">Name *</label>
                  <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Your full name" />
                </div>
                <div>
                  <label className="label">Department (optional)</label>
                  <input value={department} onChange={(e) => setDepartment(e.target.value)} placeholder="e.g., HR / Sales" />
                </div>
              </div>
              {err ? <div className="alert" style={{ marginTop: 12 }}>{err}</div> : null}
            </div>
          </div>

          <div className="col">
            <div className="card">
              <h2>Available Questionnaires</h2>
              <p className="muted">Choose one to start (each can have up to 20 questions).</p>

              {loading ? (
                <p className="muted">Loading...</p>
              ) : quizzes.length === 0 ? (
                <div className="alert">No published questionnaires yet. Please contact Admin.</div>
              ) : (
                <div style={{ display: 'grid', gap: 12 }}>
                  {quizzes.map((q) => (
                    <div key={q.id} className="card" style={{ borderRadius: 14, padding: 14 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center' }}>
                        <div>
                          <div className="badge">Questions: {q.questionsCount || 0}/20</div>
                          <h3 style={{ marginTop: 10 }}>{q.title}</h3>
                          {q.description ? <div className="muted" style={{ marginTop: 4 }}>{q.description}</div> : null}
                        </div>
                        <button className="btn" onClick={() => start(q.id)}>Start</button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="footer">Powered by Vercel + Firebase</div>
      </div>
    </>
  );
}
