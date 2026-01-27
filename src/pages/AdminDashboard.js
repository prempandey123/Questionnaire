import React, { useEffect, useMemo, useState } from 'react';
import Header from '../components/Header';
import { LIMITS, DEPARTMENTS } from '../config';
import {
  createQuestionnaire,
  listQuestionnaires,
  updateQuestionnaire,
  deleteQuestionnaire,
  addQuestion,
  listQuestions,
  listResults
} from '../utils/firestore';

import './AdminDashboard.css';

function emptyQuestion() {
  return {
    text: '',
    points: 1,
    options: [
      { text: '', isCorrect: true },
      { text: '', isCorrect: false },
      { text: '', isCorrect: false },
      { text: '', isCorrect: false }
    ]
  };
}

function toNumber(n) {
  const x = Number(n);
  return Number.isFinite(x) ? x : 0;
}

function clamp01(n) {
  return Math.max(0, Math.min(1, n));
}

export default function AdminDashboard() {
  const [tab, setTab] = useState('overview'); // overview | manage | questions

  const [quizzes, setQuizzes] = useState([]);
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [msg, setMsg] = useState('');

  // create questionnaire
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [isPublished, setIsPublished] = useState(true);
  const [deptSelectionMode, setDeptSelectionMode] = useState('ALL'); // ALL | SOME
  const [selectedDepts, setSelectedDepts] = useState([]);

  // question add
  const [selectedQuizId, setSelectedQuizId] = useState('');
  const [questions, setQuestions] = useState([]);
  const [question, setQuestion] = useState(emptyQuestion());
  const [savingQ, setSavingQ] = useState(false);

  // analytics filters
  const [analyticsDept, setAnalyticsDept] = useState(''); // '' => all
  const [daysWindow, setDaysWindow] = useState(30);

  const refresh = async () => {
    setErr('');
    setMsg('');
    try {
      setLoading(true);
      const [qz, res] = await Promise.all([
        listQuestionnaires({}),
        listResults({})
      ]);
      setQuizzes(qz);
      setResults(res);
      if (!selectedQuizId && qz.length) setSelectedQuizId(qz[0].id);
    } catch (e) {
      setErr(e?.message || 'Failed to load');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    (async () => {
      if (!selectedQuizId) {
        setQuestions([]);
        return;
      }
      try {
        const qs = await listQuestions(selectedQuizId);
        setQuestions(qs);
      } catch {
        setQuestions([]);
      }
    })();
  }, [selectedQuizId]);

  const selectedQuiz = useMemo(
    () => quizzes.find((q) => q.id === selectedQuizId) || null,
    [quizzes, selectedQuizId]
  );

  const toggleDept = (dept) => {
    setSelectedDepts((prev) =>
      prev.includes(dept) ? prev.filter((d) => d !== dept) : [...prev, dept]
    );
  };

  const create = async (e) => {
    e.preventDefault();
    setErr('');
    setMsg('');
    try {
      const departments = deptSelectionMode === 'ALL' ? [] : selectedDepts;
      const id = await createQuestionnaire({ title, description, isPublished, departments });
      setTitle('');
      setDescription('');
      setIsPublished(true);
      setDeptSelectionMode('ALL');
      setSelectedDepts([]);
      setSelectedQuizId(id);
      await refresh();
      setMsg(`Questionnaire created. Add questions (max ${LIMITS.questionsPerQuestionnaire}).`);
      setTab('questions');
    } catch (e2) {
      setErr(e2?.message || 'Create failed');
    }
  };

  const togglePublish = async (quiz) => {
    setErr('');
    setMsg('');
    try {
      await updateQuestionnaire(quiz.id, { isPublished: !quiz.isPublished });
      await refresh();
      setMsg(`Updated: ${quiz.title}`);
    } catch (e) {
      setErr(e?.message || 'Update failed');
    }
  };

  const removeQuiz = async (quiz) => {
    const ok = window.confirm(
      `Delete questionnaire "${quiz.title}"?\n\nNote: Questions subcollection is not auto-deleted in this MVP.`
    );
    if (!ok) return;
    setErr('');
    setMsg('');
    try {
      await deleteQuestionnaire(quiz.id);
      if (selectedQuizId === quiz.id) setSelectedQuizId('');
      await refresh();
      setMsg('Deleted questionnaire doc.');
    } catch (e) {
      setErr(e?.message || 'Delete failed');
    }
  };

  const setCorrect = (idx) => {
    setQuestion((prev) => ({
      ...prev,
      options: prev.options.map((o, i) => ({ ...o, isCorrect: i === idx }))
    }));
  };

  const updateOptText = (idx, text) => {
    setQuestion((prev) => ({
      ...prev,
      options: prev.options.map((o, i) => (i === idx ? { ...o, text } : o))
    }));
  };

  const saveQuestion = async () => {
    setErr('');
    setMsg('');

    if (!selectedQuizId) {
      setErr('Select a questionnaire first.');
      return;
    }
    if (!question.text.trim()) {
      setErr('Question text is required');
      return;
    }
    const cleanOpts = question.options.map((o) => ({ ...o, text: (o.text || '').trim() }));
    if (cleanOpts.some((o) => !o.text)) {
      setErr('All 4 options are required');
      return;
    }
    if (!cleanOpts.some((o) => o.isCorrect)) {
      setErr('Mark at least one option correct');
      return;
    }

    try {
      setSavingQ(true);
      await addQuestion(selectedQuizId, { ...question, options: cleanOpts });
      setQuestion(emptyQuestion());
      const qs = await listQuestions(selectedQuizId);
      setQuestions(qs);
      setMsg('Question added.');
      await refresh();
    } catch (e) {
      setErr(e?.message || 'Failed to save question');
    } finally {
      setSavingQ(false);
    }
  };

  // -------------------------
  // KPIs + Analytics
  // -------------------------
  const publishedCount = useMemo(
    () => quizzes.filter((q) => q.isPublished).length,
    [quizzes]
  );

  const windowedResults = useMemo(() => {
    const now = Date.now();
    const ms = Math.max(1, Number(daysWindow) || 30) * 24 * 60 * 60 * 1000;
    let r = results;
    if (analyticsDept) {
      r = r.filter((x) => String(x.department || '').trim() === analyticsDept);
    }
    r = r.filter((x) => {
      const ts = x.createdAt?.toDate ? x.createdAt.toDate().getTime() : null;
      return ts ? (now - ts) <= ms : true; // include if missing timestamp
    });
    return r;
  }, [results, analyticsDept, daysWindow]);

  const avgScore = useMemo(() => {
    if (!windowedResults.length) return 0;
    const sumPct = windowedResults.reduce((acc, r) => {
      const total = Math.max(1, toNumber(r.total));
      const score = toNumber(r.score);
      return acc + clamp01(score / total);
    }, 0);
    return (sumPct / windowedResults.length) * 100;
  }, [windowedResults]);

  const deptCounts = useMemo(() => {
    const map = {};
    windowedResults.forEach((r) => {
      const d = String(r.department || '').trim() || 'Unknown';
      map[d] = (map[d] || 0) + 1;
    });
    // keep configured depts first, then unknowns
    const rows = [];
    DEPARTMENTS.forEach((d) => {
      if (map[d]) rows.push({ dept: d, count: map[d] });
    });
    Object.keys(map)
      .filter((k) => !DEPARTMENTS.includes(k))
      .sort()
      .forEach((k) => rows.push({ dept: k, count: map[k] }));
    return rows;
  }, [windowedResults]);

  const maxDept = useMemo(() => Math.max(1, ...deptCounts.map((x) => x.count)), [deptCounts]);

  return (
    <>
      <Header />
      <div className="container">
        <div className="dash-hero">
          <div>
            <h1 className="dash-title">Admin Dashboard</h1>
            <p className="dash-sub">
              Premium analytics + questionnaire management (mobile friendly).
            </p>
          </div>

          <div className="dash-tabs">
            <button className={`pill ${tab === 'overview' ? 'active' : ''}`} onClick={() => setTab('overview')}>Overview</button>
            <button className={`pill ${tab === 'manage' ? 'active' : ''}`} onClick={() => setTab('manage')}>Manage</button>
            <button className={`pill ${tab === 'questions' ? 'active' : ''}`} onClick={() => setTab('questions')}>Add Questions</button>
            <a className="pill link" href="/admin/results">Results</a>
          </div>
        </div>

        {err ? <div className="alert danger">{err}</div> : null}
        {msg ? <div className="alert ok">{msg}</div> : null}

        {loading ? (
          <div className="card">Loading…</div>
        ) : (
          <>
            {tab === 'overview' ? (
              <div className="grid gap-16">
                {/* KPI cards */}
                <div className="kpi-grid">
                  <div className="kpi card">
                    <div className="kpi-label">Total Quizzes</div>
                    <div className="kpi-value">{quizzes.length}</div>
                    <div className="kpi-hint">Limit: {LIMITS.maxQuestionnaires}</div>
                  </div>
                  <div className="kpi card">
                    <div className="kpi-label">Published</div>
                    <div className="kpi-value">{publishedCount}</div>
                    <div className="kpi-hint">Visible to employees</div>
                  </div>
                  <div className="kpi card">
                    <div className="kpi-label">Total Submissions</div>
                    <div className="kpi-value">{results.length}</div>
                    <div className="kpi-hint">Latest 500 loaded</div>
                  </div>
                  <div className="kpi card">
                    <div className="kpi-label">Avg Score</div>
                    <div className="kpi-value">{avgScore.toFixed(1)}%</div>
                    <div className="kpi-hint">Window: last {daysWindow} days</div>
                  </div>
                </div>

                {/* Analytics + Chart */}
                <div className="grid grid-2 gap-16">
                  <div className="card">
                    <div className="card-head">
                      <h3>Dept-wise Attempts</h3>
                      <div className="controls">
                        <label className="field">
                          <span>Department</span>
                          <select value={analyticsDept} onChange={(e) => setAnalyticsDept(e.target.value)}>
                            <option value="">All</option>
                            {DEPARTMENTS.map((d) => <option key={d} value={d}>{d}</option>)}
                          </select>
                        </label>
                        <label className="field">
                          <span>Window</span>
                          <select value={daysWindow} onChange={(e) => setDaysWindow(Number(e.target.value))}>
                            <option value={7}>Last 7 days</option>
                            <option value={30}>Last 30 days</option>
                            <option value={90}>Last 90 days</option>
                            <option value={365}>Last 365 days</option>
                          </select>
                        </label>
                      </div>
                    </div>

                    {deptCounts.length ? (
                      <div className="bar-chart">
                        {deptCounts.map((r) => (
                          <div className="bar-row" key={r.dept}>
                            <div className="bar-label" title={r.dept}>{r.dept}</div>
                            <div className="bar-track">
                              <div
                                className="bar-fill"
                                style={{ width: `${Math.round((r.count / maxDept) * 100)}%` }}
                                aria-label={`${r.dept} ${r.count}`}
                              />
                            </div>
                            <div className="bar-value">{r.count}</div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="muted">No attempts in this window.</div>
                    )}
                  </div>

                  <div className="card">
                    <h3>Quick Insights</h3>
                    <div className="insights">
                      <div className="insight">
                        <div className="muted">Most attempted quiz</div>
                        <div className="big">
                          {(() => {
                            const m = {};
                            results.forEach(r => {
                              const t = String(r.quizTitle || r.quizId || 'Unknown');
                              m[t] = (m[t] || 0) + 1;
                            });
                            const top = Object.entries(m).sort((a,b) => b[1]-a[1])[0];
                            return top ? `${top[0]} (${top[1]})` : '—';
                          })()}
                        </div>
                      </div>

                      <div className="insight">
                        <div className="muted">Latest submission</div>
                        <div className="big">
                          {(() => {
                            const latest = [...results].sort((a,b) => {
                              const ta = a.createdAt?.seconds || 0;
                              const tb = b.createdAt?.seconds || 0;
                              return tb - ta;
                            })[0];
                            if (!latest) return '—';
                            const dt = latest.createdAt?.toDate ? latest.createdAt.toDate() : null;
                            const when = dt ? dt.toLocaleString() : '';
                            return `${latest.employeeId ? latest.employeeId + ' • ' : ''}${latest.name || '—'} • ${latest.quizTitle || '—'}${when ? ` • ${when}` : ''}`;
                          })()}
                        </div>
                      </div>

                      <div className="insight hint">
                        Tip: Use <b>Results</b> page for filters + exports.
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ) : null}

            {tab === 'manage' ? (
              <div className="grid gap-16">
                <div className="grid grid-2 gap-16">
                  <div className="card">
                    <h3>Create Questionnaire</h3>
                    <form onSubmit={create} className="form">
                      <label className="field">
                        <span>Title</span>
                        <input value={title} onChange={(e) => setTitle(e.target.value)} required placeholder="e.g. Safety Training" />
                      </label>

                      <label className="field">
                        <span>Description</span>
                        <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} placeholder="Short description…" />
                      </label>

                      <div className="row between">
                        <label className="check">
                          <input type="checkbox" checked={isPublished} onChange={(e) => setIsPublished(e.target.checked)} />
                          Publish immediately
                        </label>

                        <div className="muted">
                          Questions limit: <b>{LIMITS.questionsPerQuestionnaire}</b>
                        </div>
                      </div>

                      <div className="dept-box">
                        <div className="row between">
                          <div>
                            <div className="muted">Availability</div>
                            <div className="big">Departments</div>
                          </div>
                          <div className="seg">
                            <button type="button" className={deptSelectionMode === 'ALL' ? 'active' : ''} onClick={() => setDeptSelectionMode('ALL')}>All</button>
                            <button type="button" className={deptSelectionMode === 'SOME' ? 'active' : ''} onClick={() => setDeptSelectionMode('SOME')}>Select</button>
                          </div>
                        </div>

                        {deptSelectionMode === 'SOME' ? (
                          <div className="chips">
                            {DEPARTMENTS.map((d) => (
                              <button
                                key={d}
                                type="button"
                                className={`chip ${selectedDepts.includes(d) ? 'on' : ''}`}
                                onClick={() => toggleDept(d)}
                              >
                                {d}
                              </button>
                            ))}
                          </div>
                        ) : (
                          <div className="muted">Available to all departments.</div>
                        )}
                      </div>

                      <button className="btn primary" type="submit">Create</button>
                    </form>
                  </div>

                  <div className="card">
                    <div className="card-head">
                      <h3>Questionnaires</h3>
                      <div className="muted">Tap one to manage questions</div>
                    </div>

                    {quizzes.length ? (
                      <div className="table-wrap">
                        <table className="table">
                          <thead>
                            <tr>
                              <th>Title</th>
                              <th>Published</th>
                              <th>Questions</th>
                              <th className="right">Actions</th>
                            </tr>
                          </thead>
                          <tbody>
                            {quizzes.map((q) => (
                              <tr key={q.id} className={q.id === selectedQuizId ? 'active' : ''}>
                                <td>
                                  <button className="linkbtn" onClick={() => { setSelectedQuizId(q.id); setTab('questions'); }}>
                                    {q.title}
                                  </button>
                                  <div className="tiny muted">{q.description}</div>
                                </td>
                                <td>
                                  <span className={`badge ${q.isPublished ? 'ok' : 'muted'}`}>
                                    {q.isPublished ? 'Yes' : 'No'}
                                  </span>
                                </td>
                                <td>{q.questionsCount || 0}</td>
                                <td className="right">
                                  <button className="btn" onClick={() => togglePublish(q)}>
                                    {q.isPublished ? 'Unpublish' : 'Publish'}
                                  </button>
                                  <button className="btn danger" onClick={() => removeQuiz(q)}>Delete</button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <div className="muted">No questionnaires yet.</div>
                    )}
                  </div>
                </div>
              </div>
            ) : null}

            {tab === 'questions' ? (
              <div className="grid gap-16">
                <div className="grid grid-2 gap-16">
                  <div className="card">
                    <div className="card-head">
                      <h3>Add Question</h3>
                      <div className="controls">
                        <label className="field">
                          <span>Questionnaire</span>
                          <select value={selectedQuizId} onChange={(e) => setSelectedQuizId(e.target.value)}>
                            <option value="">Select…</option>
                            {quizzes.map((q) => (
                              <option key={q.id} value={q.id}>
                                {q.title}
                              </option>
                            ))}
                          </select>
                        </label>
                      </div>
                    </div>

                    {selectedQuiz ? (
                      <div className="muted">
                        {selectedQuiz.title} • {questions.length}/{LIMITS.questionsPerQuestionnaire} questions
                      </div>
                    ) : null}

                    <div className="form">
                      <label className="field">
                        <span>Question</span>
                        <textarea
                          value={question.text}
                          onChange={(e) => setQuestion((p) => ({ ...p, text: e.target.value }))}
                          rows={3}
                          placeholder="Write a clear question…"
                        />
                      </label>

                      <div className="opt-grid">
                        {question.options.map((o, idx) => (
                          <div className={`opt ${o.isCorrect ? 'correct' : ''}`} key={idx}>
                            <div className="row between">
                              <div className="muted">Option {idx + 1}</div>
                              <label className="check">
                                <input
                                  type="radio"
                                  name="correct"
                                  checked={o.isCorrect}
                                  onChange={() => setCorrect(idx)}
                                />
                                Correct
                              </label>
                            </div>
                            <input
                              value={o.text}
                              onChange={(e) => updateOptText(idx, e.target.value)}
                              placeholder={`Option ${idx + 1} text…`}
                            />
                          </div>
                        ))}
                      </div>

                      <div className="row between">
                        <label className="field" style={{ maxWidth: 220 }}>
                          <span>Points</span>
                          <input
                            type="number"
                            min="1"
                            value={question.points}
                            onChange={(e) => setQuestion((p) => ({ ...p, points: e.target.value }))}
                          />
                        </label>

                        <button className="btn primary" onClick={saveQuestion} disabled={savingQ}>
                          {savingQ ? 'Saving…' : 'Add Question'}
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="card">
                    <div className="card-head">
                      <h3>Questions</h3>
                      <div className="muted">Preview (latest)</div>
                    </div>

                    {questions.length ? (
                      <div className="q-list">
                        {questions.map((q, i) => (
                          <div className="q-item" key={q.id}>
                            <div className="q-title">
                              {i + 1}. {q.text}
                            </div>
                            <div className="q-opts">
                              {(q.options || []).map((o, idx) => (
                                <div key={idx} className={`q-opt ${o.isCorrect ? 'ok' : ''}`}>
                                  {o.text}
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="muted">No questions yet.</div>
                    )}
                  </div>
                </div>
              </div>
            ) : null}
          </>
        )}
      </div>
    </>
  );
}
