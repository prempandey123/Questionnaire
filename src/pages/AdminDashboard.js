import React, { useEffect, useMemo, useState } from 'react';
import Header from '../components/Header';
import { LIMITS, DEPARTMENTS } from '../config';
import {
  createQuestionnaire,
  listQuestionnaires,
  updateQuestionnaire,
  deleteQuestionnaire,
  addQuestion,
  updateQuestion,
  listQuestions,
  listResults
} from '../utils/firestore';

import './AdminDashboard.css';

function emptyQuestion() {
  return {
    text: '',
    textHi: '',
    points: 1,
    options: [
      { text: '', textHi: '', isCorrect: true },
      { text: '', textHi: '', isCorrect: false },
      { text: '', textHi: '', isCorrect: false },
      { text: '', textHi: '', isCorrect: false }
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
  const [designation, setDesignation] = useState('');
  const [description, setDescription] = useState('');
  const [isPublished, setIsPublished] = useState(true);
  const [deptSelectionMode, setDeptSelectionMode] = useState('ALL'); // ALL | SOME
  const [selectedDepts, setSelectedDepts] = useState([]);

  // question add
  const [selectedQuizId, setSelectedQuizId] = useState('');
  const [questions, setQuestions] = useState([]);
  const [question, setQuestion] = useState(emptyQuestion());
  const [editingQuestionId, setEditingQuestionId] = useState('');
  const [savingQ, setSavingQ] = useState(false);
  const [translatingHi, setTranslatingHi] = useState(false);

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

  // --- Hindi auto-translate helpers (client-side) ---
  // Uses Google's public translate endpoint (no key). Works for light usage.
  // Note: For heavy/production usage, consider a proper translation service & caching.
  const translateToHindi = async (text) => {
    const q = (text || '').trim();
    if (!q) return '';
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=hi&dt=t&q=${encodeURIComponent(q)}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error('Hindi translation failed');
    const data = await res.json();
    const parts = Array.isArray(data?.[0]) ? data[0] : [];
    return parts.map((p) => p?.[0]).filter(Boolean).join('');
  };

  const autoTranslateCurrentToHindi = async () => {
    // Translates current Question + all option texts into Hindi fields.
    try {
      setMsg('');
      setErr('');
      setTranslatingHi(true);

      const baseQ = question;
      const [qHi, ...optHis] = await Promise.all([
        translateToHindi(baseQ.text),
        ...baseQ.options.map((o) => translateToHindi(o.text))
      ]);

      setQuestion((p) => ({
        ...p,
        textHi: qHi || p.textHi,
        options: p.options.map((o, idx) => ({
          ...o,
          textHi: optHis[idx] || o.textHi
        }))
      }));
    } catch (e) {
      setErr(e?.message || 'Hindi translation failed');
    } finally {
      setTranslatingHi(false);
    }
  };

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    (async () => {
      setEditingQuestionId('');
      setQuestion(emptyQuestion());
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
      const id = await createQuestionnaire({ title, designation, description, isPublished, departments });
      setTitle('');
      setDesignation('');
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

  const updateOptTextHi = (idx, textHi) => {
    setQuestion((prev) => ({
      ...prev,
      options: prev.options.map((o, i) => (i === idx ? { ...o, textHi } : o))
    }));
  };

  const startEditQuestion = (q) => {
    setErr('');
    setMsg('');
    const currentOptions = q.options || [];
    const fallbackOptions = emptyQuestion().options;
    setEditingQuestionId(q.id);
    setQuestion({
      text: q.text || '',
      textHi: q.textHi || '',
      points: q.points || 1,
      options: fallbackOptions.map((fallback, idx) => {
        const opt = currentOptions[idx] || fallback;
        return {
          text: opt.text || '',
          textHi: opt.textHi || '',
          isCorrect: Boolean(opt.isCorrect)
        };
      })
    });
  };

  const cancelEditQuestion = () => {
    setEditingQuestionId('');
    setQuestion(emptyQuestion());
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
    const cleanOpts = question.options.map((o) => ({
      ...o,
      text: (o.text || '').trim(),
      textHi: (o.textHi || '').trim()
    }));
    if (cleanOpts.length !== 4 || cleanOpts.some((o) => !o.text)) {
      setErr('All 4 options are required');
      return;
    }
    if (!cleanOpts.some((o) => o.isCorrect)) {
      setErr('Mark at least one option correct');
      return;
    }

    try {
      setSavingQ(true);
      if (editingQuestionId) {
        await updateQuestion(selectedQuizId, editingQuestionId, { ...question, options: cleanOpts });
        setEditingQuestionId('');
        setMsg('Question updated.');
      } else {
        await addQuestion(selectedQuizId, { ...question, options: cleanOpts });
        setMsg('Question added.');
      }
      setQuestion(emptyQuestion());
      const qs = await listQuestions(selectedQuizId);
      setQuestions(qs);
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
                        <span>Questionnaire Designation</span>
                        <input
                          value={designation}
                          onChange={(e) => setDesignation(e.target.value)}
                          placeholder="e.g. Operator / Supervisor / Manager"
                        />
                        <div className="tiny muted">Optional: shows as a tag on the employee side.</div>
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
                              <th>Designation</th>
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
                                  {q.designation ? <span className="badge">{q.designation}</span> : <span className="muted">—</span>}
                                </td>
                                <td>
                                  <span className={`badge ${q.isPublished ? 'ok' : 'muted'}`}>
                                    {q.isPublished ? 'Yes' : 'No'}
                                  </span>
                                </td>
                                <td>{q.questionsCount || 0}</td>
                                <td className="right">
                                  <button className="btn" onClick={() => { setSelectedQuizId(q.id); setTab('questions'); }}>
                                    Edit Questions
                                  </button>
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
                      <h3>{editingQuestionId ? 'Edit Question' : 'Add Question'}</h3>
                      <div className="controls">
                        <label className="field">
                          <span>Questionnaire</span>
                          <select value={selectedQuizId} onChange={(e) => setSelectedQuizId(e.target.value)} disabled={Boolean(editingQuestionId)}>
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
                        {editingQuestionId ? ' • Editing selected question' : ''}
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

                      <label className="field">
                        <div className="row between" style={{ alignItems: 'center' }}>
                          <span>
                            Question (Hindi) <span className="muted" style={{ fontWeight: 500 }}>(optional)</span>
                          </span>
                          <button
                            type="button"
                            className="btn tiny"
                            onClick={autoTranslateCurrentToHindi}
                            disabled={translatingHi || !question.text.trim()}
                            title="Auto translate question + options to Hindi"
                            style={{ padding: '6px 10px', borderRadius: 999 }}
                          >
                            {translatingHi ? 'Translating…' : 'Hindi'}
                          </button>
                        </div>
                        <textarea
                          value={question.textHi}
                          onChange={(e) => setQuestion((p) => ({ ...p, textHi: e.target.value }))}
                          rows={3}
                          placeholder="प्रश्न हिंदी में (optional)…"
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

                            <input
                              value={o.textHi}
                              onChange={(e) => updateOptTextHi(idx, e.target.value)}
                              placeholder={`Option ${idx + 1} text (Hindi) — optional…`}
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

                        <div className="controls">
                          {editingQuestionId ? (
                            <button className="btn" onClick={cancelEditQuestion} disabled={savingQ}>
                              Cancel
                            </button>
                          ) : null}
                          <button className="btn primary" onClick={saveQuestion} disabled={savingQ}>
                            {savingQ ? 'Saving…' : editingQuestionId ? 'Update Question' : 'Add Question'}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="card">
                    <div className="card-head">
                      <h3>Questions</h3>
                      <div className="muted">Preview / Edit</div>
                    </div>

                    {questions.length ? (
                      <div className="q-list">
                        {questions.map((q, i) => (
                          <div className="q-item" key={q.id}>
                            <div className="q-title">
                              <div className="row between" style={{ alignItems: 'flex-start', gap: 10 }}>
                                <div>
                                  {i + 1}. {q.text}
                                  {q.textHi ? <div className="muted" style={{ marginTop: 4 }}>{q.textHi}</div> : null}
                                </div>
                                <button className="btn tiny" onClick={() => startEditQuestion(q)} style={{ padding: '6px 10px' }}>
                                  Edit
                                </button>
                              </div>
                            </div>
                            <div className="q-opts">
                              {(q.options || []).map((o, idx) => (
                                <div key={idx} className={`q-opt ${o.isCorrect ? 'ok' : ''}`}>
                                  {o.text}
                                  {o.textHi ? <div className="muted" style={{ marginTop: 4 }}>{o.textHi}</div> : null}
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
