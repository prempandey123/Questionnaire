import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Header from '../components/Header';
import { listQuestionnaires } from '../utils/firestore';
import { DEPARTMENTS } from '../config';

export default function EmployeeHome() {
  const nav = useNavigate();
  // Requirement: employee must select department first
  const [department, setDepartment] = useState(localStorage.getItem('emp_dept') || '');
  const [name, setName] = useState(localStorage.getItem('emp_name') || '');
  const [employeeId, setEmployeeId] = useState(localStorage.getItem('emp_id') || '');
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

  const canStart = useMemo(
    () => {
      const deptOk = department.trim().length > 0;
      const nameOk = name.trim().length >= 2;
      const idOk = /^HSL\d{4}$/.test(employeeId.trim().toUpperCase());
      return deptOk && nameOk && idOk;
    },
    [department, name, employeeId]
  );

  const start = (quizId) => {
    if (!canStart) {
      setErr('Please select your department, enter your name, and a valid Employee ID (HSL0000 format).');
      return;
    }
    localStorage.setItem('emp_name', name.trim());
    localStorage.setItem('emp_dept', department.trim());
    localStorage.setItem('emp_id', employeeId.trim().toUpperCase());
    nav(`/quiz/${quizId}`);
  };

  const visibleQuizzes = useMemo(() => {
    const dept = department.trim();
    if (!dept) return [];
    // If questionnaire.departments is empty/undefined => visible to all departments
    return quizzes.filter((q) => {
      const depts = Array.isArray(q.departments) ? q.departments : [];
      return depts.length === 0 || depts.includes(dept);
    });
  }, [quizzes, department]);

  return (
    <>
      <Header />
      <div className="container">
        <div className="row">
          <div className="col">
            <div className="card">
              <h2>Employee Details</h2>
              <p className="muted">Select your department, then enter your name and Employee ID.</p>
              <div className="stack">
                <div>
                  <label className="label">Department *</label>
                  <select value={department} onChange={(e) => setDepartment(e.target.value)}>
                    <option value="">-- Select Department --</option>
                    {DEPARTMENTS.map((d) => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="label">Name *</label>
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Your full name"
                    disabled={!department}
                  />
                </div>
                <div>
                  <label className="label">Employee ID *</label>
                  <input
                    value={employeeId}
                    onChange={(e) => setEmployeeId(e.target.value.toUpperCase())}
                    placeholder="HSL0000"
                    disabled={!department}
                  />
                  <div className="muted" style={{ marginTop: 6, fontSize: 12 }}>Format: HSL0000 (e.g., HSL0001)</div>
                </div>
              </div>
              {err ? <div className="alert" style={{ marginTop: 12 }}>{err}</div> : null}
            </div>
          </div>

          <div className="col">
            <div className="card">
              <h2>Available Questionnaires</h2>
              <p className="muted">Choose one to start (each has 15 questions (3 min timer)).</p>

              {loading ? (
                <p className="muted">Loading...</p>
              ) : !department ? (
                <div className="alert">Please select a department to view questionnaires.</div>
              ) : visibleQuizzes.length === 0 ? (
                <div className="alert">No published questionnaires yet. Please contact Admin.</div>
              ) : (
                <div className="grid">
                  {visibleQuizzes.map((q) => (
                    <div key={q.id} className="card card-hover">
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center' }}>
                        <div>
                          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                            <div className="badge">Questions: {q.questionsCount || 0}/15</div>
                            {q.designation ? <div className="badge">Designation: {q.designation}</div> : null}
                          </div>
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
