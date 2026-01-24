import React, { useEffect, useMemo, useState } from 'react';
import Header from '../components/Header';
import { listQuestionnaires, listQuestions } from '../utils/firestore';
import { listResults, deleteResult } from '../utils/firestore';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import { DEPARTMENTS } from '../config';

function toISO(ts) {
  try {
    // Firestore Timestamp
    if (ts && typeof ts.toDate === 'function') return ts.toDate().toISOString();
  } catch {}
  return '';
}

export default function AdminResults() {
  const [quizzes, setQuizzes] = useState([]);
  const [results, setResults] = useState([]);
  const [filterQuizId, setFilterQuizId] = useState('');
  const [filterDept, setFilterDept] = useState('');
  const [searchName, setSearchName] = useState('');
  const [selectedResult, setSelectedResult] = useState(null);
  const [questionsCache, setQuestionsCache] = useState({}); // quizId -> questions[]
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');

  const refresh = async () => {
    try {
      setLoading(true);
      const [qz, res] = await Promise.all([
        listQuestionnaires({}),
        listResults({ quizId: filterQuizId || undefined })
      ]);
      setQuizzes(qz);
      setResults(res);
    } catch (e) {
      setErr(e?.message || 'Failed to load results');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterQuizId]);

  const ensureQuestions = async (quizId) => {
    if (!quizId || questionsCache[quizId]) return;
    try {
      const qs = await listQuestions(quizId);
      setQuestionsCache((prev) => ({ ...prev, [quizId]: qs }));
    } catch {
      setQuestionsCache((prev) => ({ ...prev, [quizId]: [] }));
    }
  };

  const filteredResults = useMemo(() => {
    let r = results;
    if (filterDept) {
      r = r.filter((x) => String(x.department || '').trim() === filterDept);
    }
    if (searchName.trim()) {
      const q = searchName.trim().toLowerCase();
      r = r.filter((x) => String(x.name || '').toLowerCase().includes(q));
    }
    return r;
  }, [results, filterDept, searchName]);

  const summary = useMemo(() => {
    if (!filteredResults.length) return { avg: 0, max: 0, min: 0 };
    const scores = filteredResults.map(r => Number(r.score || 0));
    const max = Math.max(...scores);
    const min = Math.min(...scores);
    const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
    return { avg, max, min };
  }, [filteredResults]);

  const exportExcel = () => {
    const rows = filteredResults.map((r) => ({
      Name: r.name,
      Department: r.department,
      QuestionnaireTitle: r.quizTitle,
      QuestionnaireId: r.quizId,
      Score: r.score,
      Total: r.total,
      SubmittedAt: toISO(r.createdAt)
    }));

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Results');
    const buf = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const fname = `results_${filterQuizId || 'all'}_${filterDept || 'allDepts'}_${new Date().toISOString().slice(0, 10)}.xlsx`;
    saveAs(blob, fname);
  };

  const openDetails = async (r) => {
    setSelectedResult(r);
    const quizId = r?.quizId;
    if (!quizId) return;
    if (questionsCache[quizId]) return;
    try {
      const qs = await listQuestions(quizId);
      setQuestionsCache((prev) => ({ ...prev, [quizId]: qs }));
    } catch {
      // ignore
    }
  };

  const remove = async (id) => {
    const ok = window.confirm('Delete this result?');
    if (!ok) return;
    try {
      await deleteResult(id);
      await refresh();
    } catch (e) {
      setErr(e?.message || 'Delete failed');
    }
  };

  return (
    <>
      <Header mode="admin" />
      <div className="container">
        <div className="card">
          <h2>Results</h2>
          <p className="muted">Filter by questionnaire/department, search employee names, export to Excel, and view answers.</p>

          {err ? <div className="alert" style={{ marginBottom: 12 }}>{err}</div> : null}

          <div className="row" style={{ alignItems: 'flex-end' }}>
            <div className="col">
              <label className="label">Filter by Questionnaire</label>
              <select value={filterQuizId} onChange={(e) => setFilterQuizId(e.target.value)}>
                <option value="">All</option>
                {quizzes.map((q) => <option key={q.id} value={q.id}>{q.title}</option>)}
              </select>
            </div>
            <div className="col">
              <label className="label">Filter by Department</label>
              <select value={filterDept} onChange={(e) => setFilterDept(e.target.value)}>
                <option value="">All</option>
                {DEPARTMENTS.map((d) => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
            <div className="col">
              <label className="label">Search Employee</label>
              <input value={searchName} onChange={(e) => setSearchName(e.target.value)} placeholder="Type employee name..." />
            </div>
            <div className="col" style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button className="btn secondary" onClick={refresh}>Refresh</button>
              <button className="btn" onClick={exportExcel} disabled={!filteredResults.length}>Export Excel</button>
            </div>
          </div>

          <hr style={{ border: 0, borderTop: '1px solid var(--border)', margin: '16px 0' }} />

          {loading ? (
            <p className="muted">Loading...</p>
          ) : filteredResults.length === 0 ? (
            <div className="alert">No results found for current filters.</div>
          ) : (
            <>
              <div className="muted" style={{ marginBottom: 10 }}>
                Total submissions: <b>{filteredResults.length}</b> | Avg score: <b>{summary.avg.toFixed(2)}</b> | Max: <b>{summary.max}</b> | Min: <b>{summary.min}</b>
              </div>
              <div style={{ overflow: 'auto' }}>
                <table className="table">
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Department</th>
                      <th>Questionnaire</th>
                      <th>Score</th>
                      <th>Submitted</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredResults.map((r) => (
                      <tr key={r.id}>
                        <td>{r.name}</td>
                        <td>{r.department || '-'}</td>
                        <td>{r.quizTitle || r.quizId}</td>
                        <td><b>{r.score}</b> / {r.total}</td>
                        <td className="muted">{toISO(r.createdAt).replace('T',' ').slice(0, 19)}</td>
                        <td style={{ whiteSpace: 'nowrap' }}>
                          <button
                            className="btn secondary"
                            style={{ padding: '8px 10px', marginRight: 8 }}
                            onClick={() => openDetails(r)}
                          >
                            View Answers
                          </button>
                          <button
                            className="btn"
                            style={{ padding: '8px 10px', borderColor: 'rgba(255,77,77,0.5)' }}
                            onClick={() => remove(r.id)}
                          >
                            Delete
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {selectedResult ? (
                <div className="card" style={{ marginTop: 16, padding: 14, borderRadius: 16 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center' }}>
                    <div>
                      <div className="badge">Employee Answers</div>
                      <h3 style={{ marginTop: 10 }}>{selectedResult.name} {selectedResult.department ? `(${selectedResult.department})` : ''}</h3>
                      <div className="muted">Questionnaire: <b>{selectedResult.quizTitle || selectedResult.quizId}</b></div>
                      <div className="muted">Score: <b>{selectedResult.score}</b> / {selectedResult.total}</div>
                    </div>
                    <button className="btn secondary" onClick={() => setSelectedResult(null)}>Close</button>
                  </div>

                  <hr style={{ border: 0, borderTop: '1px solid var(--border)', margin: '16px 0' }} />

                  {(() => {
                    const quizId = selectedResult.quizId;
                    const qs = questionsCache[quizId];
                    if (!qs) return <p className="muted">Loading questions...</p>;
                    if (!Array.isArray(selectedResult.answers) || selectedResult.answers.length === 0) {
                      return <div className="alert">No answers saved for this submission.</div>;
                    }

                    const ansMap = Object.fromEntries(
                      selectedResult.answers.map((a) => [a.questionId, String(a.selectedOptionIndex)])
                    );

                    return (
                      <ol style={{ margin: 0, paddingLeft: 18, display: 'grid', gap: 10 }}>
                        {qs.map((q, idx) => {
                          const selectedIdx = ansMap[q.id];
                          const opts = Array.isArray(q.options) ? q.options : [];
                          const chosen = opts[Number(selectedIdx)];
                          const correct = opts.find((o) => o.isCorrect);
                          const isCorrect = chosen && chosen.isCorrect;
                          return (
                            <li key={q.id}>
                              <div style={{ fontWeight: 800 }}>Q{idx + 1}. {q.text}</div>
                              <div className="muted" style={{ marginTop: 6 }}>
                                Selected: <b>{chosen ? chosen.text : '-'}</b>
                                {isCorrect ? (
                                  <span className="badge" style={{ marginLeft: 10 }}>Correct</span>
                                ) : (
                                  <span className="badge" style={{ marginLeft: 10, borderColor: 'rgba(255,77,77,0.5)' }}>Wrong</span>
                                )}
                              </div>
                              {!isCorrect ? (
                                <div className="muted" style={{ marginTop: 4 }}>
                                  Correct Answer: <b>{correct ? correct.text : '-'}</b>
                                </div>
                              ) : null}
                            </li>
                          );
                        })}
                      </ol>
                    );
                  })()}
                </div>
              ) : null}
            </>
          )}

          <div className="footer">Note: this MVP stores results in Firestore collection <b>quizResults</b>.</div>
        </div>
      </div>
    </>
  );
}
