import React, { useEffect, useMemo, useState } from 'react';
import Header from '../components/Header';
import { listQuestionnaires, listQuestions, listResults, deleteResult } from '../utils/firestore';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import { DEPARTMENTS } from '../config';
import './AdminResults.css';

function toDate(ts) {
  try {
    if (ts && typeof ts.toDate === 'function') return ts.toDate();
  } catch {}
  return null;
}

function fmt(dt) {
  try {
    return dt ? dt.toLocaleString() : '';
  } catch {
    return '';
  }
}

function pct(score, total) {
  const t = Math.max(1, Number(total || 0));
  const s = Number(score || 0);
  return Math.max(0, Math.min(1, s / t)) * 100;
}

export default function AdminResults() {
  const [quizzes, setQuizzes] = useState([]);
  const [results, setResults] = useState([]);
  const [filterQuizId, setFilterQuizId] = useState('');
  const [filterDept, setFilterDept] = useState('');
  const [searchName, setSearchName] = useState('');
  const [fromDate, setFromDate] = useState(''); // yyyy-mm-dd
  const [toDateStr, setToDateStr] = useState(''); // yyyy-mm-dd

  const [selectedResult, setSelectedResult] = useState(null);
  const [questionsCache, setQuestionsCache] = useState({}); // quizId -> questions[]
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');

  const refresh = async () => {
    setErr('');
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

    const from = fromDate ? new Date(fromDate + 'T00:00:00') : null;
    const to = toDateStr ? new Date(toDateStr + 'T23:59:59') : null;

    if (from || to) {
      r = r.filter((x) => {
        const dt = toDate(x.createdAt);
        if (!dt) return true;
        if (from && dt < from) return false;
        if (to && dt > to) return false;
        return true;
      });
    }

    return r;
  }, [results, filterDept, searchName, fromDate, toDateStr]);

  const summary = useMemo(() => {
    if (!filteredResults.length) return { avg: 0, max: 0, min: 0 };
    const pcts = filteredResults.map(r => pct(r.score, r.total));
    const max = Math.max(...pcts);
    const min = Math.min(...pcts);
    const avg = pcts.reduce((a, b) => a + b, 0) / pcts.length;
    return { avg, max, min };
  }, [filteredResults]);

  const exportXlsx = () => {
    const rows = filteredResults.map((r) => ({
      Name: r.name || '',
      Department: r.department || '',
      Quiz: r.quizTitle || '',
      Score: r.score ?? '',
      Total: r.total ?? '',
      Percent: pct(r.score, r.total).toFixed(1) + '%',
      TimeTakenSec: r.timeTakenSec ?? '',
      SubmittedAt: fmt(toDate(r.createdAt))
    }));

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Results');
    const out = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
    saveAs(new Blob([out], { type: 'application/octet-stream' }), `quiz_results_${Date.now()}.xlsx`);
  };

  const exportCsv = () => {
    const rows = filteredResults.map((r) => ({
      name: (r.name || '').replaceAll(',', ' '),
      department: (r.department || '').replaceAll(',', ' '),
      quiz: (r.quizTitle || '').replaceAll(',', ' '),
      score: r.score ?? '',
      total: r.total ?? '',
      percent: pct(r.score, r.total).toFixed(1),
      timeTakenSec: r.timeTakenSec ?? '',
      submittedAt: fmt(toDate(r.createdAt)).replaceAll(',', ' ')
    }));

    const header = Object.keys(rows[0] || { name: '', department: '', quiz: '', score: '', total: '', percent: '', timeTakenSec: '', submittedAt: '' }).join(',');
    const body = rows.map(o => Object.values(o).join(',')).join('\n');
    const csv = header + '\n' + body;
    saveAs(new Blob([csv], { type: 'text/csv;charset=utf-8' }), `quiz_results_${Date.now()}.csv`);
  };

  const clearFilters = () => {
    setFilterDept('');
    setSearchName('');
    setFromDate('');
    setToDateStr('');
  };

  const openResult = async (r) => {
    setSelectedResult(r);
    await ensureQuestions(r.quizId);
  };

  const remove = async (r) => {
    const ok = window.confirm(`Delete result for "${r.name}" (${r.quizTitle})?`);
    if (!ok) return;
    try {
      await deleteResult(r.id);
      await refresh();
      setSelectedResult(null);
    } catch (e) {
      setErr(e?.message || 'Delete failed');
    }
  };

  const details = useMemo(() => {
    if (!selectedResult) return null;

    // If answers were saved as snapshot array, prefer it
    const snapshot = Array.isArray(selectedResult.answers) ? selectedResult.answers : null;
    if (snapshot && snapshot.length && snapshot[0]?.questionText) {
      return snapshot.map((a, idx) => ({
        idx,
        q: a.questionText || `Q${idx + 1}`,
        selected: a.selectedOptionText ?? a.selectedOption ?? '',
        correct: a.correctOptionText ?? a.correctOption ?? '',
        isCorrect: Boolean(a.isCorrect)
      }));
    }

    // Back-compat: map saved option indices to questions cache
    const qs = questionsCache[selectedResult.quizId] || [];
    const ans = selectedResult.answers || {};
    return qs.map((q, idx) => {
      const selectedIdx = ans[q.id];
      const selectedText =
        typeof selectedIdx === 'number' ? (q.options?.[selectedIdx]?.text || '') : (ans[q.id] || '');
      const correct = (q.options || []).find((o) => o.isCorrect)?.text || '';
      const isCorrect = selectedText && correct && selectedText === correct;
      return { idx, q: q.text, selected: selectedText, correct, isCorrect };
    });
  }, [selectedResult, questionsCache]);

  return (
    <>
      <Header />
      <div className="container">
        <div className="results-hero">
          <div>
            <h1 className="dash-title">Results</h1>
            <p className="dash-sub">Filters + exports + answer review</p>
          </div>
          <div className="results-actions">
            <button className="btn primary" onClick={exportXlsx} disabled={!filteredResults.length}>Export XLSX</button>
            <button className="btn" onClick={exportCsv} disabled={!filteredResults.length}>Export CSV</button>
            <button className="btn" onClick={clearFilters}>Clear</button>
          </div>
        </div>

        {err ? <div className="alert danger">{err}</div> : null}

        <div className="card results-filters">
          <div className="filters-grid">
            <label className="field">
              <span>Quiz</span>
              <select value={filterQuizId} onChange={(e) => setFilterQuizId(e.target.value)}>
                <option value="">All</option>
                {quizzes.map((q) => (
                  <option key={q.id} value={q.id}>{q.title}</option>
                ))}
              </select>
            </label>

            <label className="field">
              <span>Department</span>
              <select value={filterDept} onChange={(e) => setFilterDept(e.target.value)}>
                <option value="">All</option>
                {DEPARTMENTS.map((d) => <option key={d} value={d}>{d}</option>)}
              </select>
            </label>

            <label className="field">
              <span>Name contains</span>
              <input value={searchName} onChange={(e) => setSearchName(e.target.value)} placeholder="e.g. Rahul" />
            </label>

            <label className="field">
              <span>From</span>
              <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
            </label>

            <label className="field">
              <span>To</span>
              <input type="date" value={toDateStr} onChange={(e) => setToDateStr(e.target.value)} />
            </label>
          </div>
        </div>

        <div className="kpi-grid" style={{ marginTop: 16 }}>
          <div className="kpi card">
            <div className="kpi-label">Attempts</div>
            <div className="kpi-value">{filteredResults.length}</div>
            <div className="kpi-hint">Filtered</div>
          </div>
          <div className="kpi card">
            <div className="kpi-label">Avg</div>
            <div className="kpi-value">{summary.avg.toFixed(1)}%</div>
            <div className="kpi-hint">Percent score</div>
          </div>
          <div className="kpi card">
            <div className="kpi-label">Max</div>
            <div className="kpi-value">{summary.max.toFixed(1)}%</div>
            <div className="kpi-hint">Best attempt</div>
          </div>
          <div className="kpi card">
            <div className="kpi-label">Min</div>
            <div className="kpi-value">{summary.min.toFixed(1)}%</div>
            <div className="kpi-hint">Lowest attempt</div>
          </div>
        </div>

        <div className="grid grid-2 gap-16" style={{ marginTop: 16 }}>
          <div className="card">
            <div className="card-head">
              <h3>Submissions</h3>
              <div className="muted">
                Showing {filteredResults.length} / {results.length}
              </div>
            </div>

            {loading ? (
              <div className="muted">Loading…</div>
            ) : filteredResults.length ? (
              <div className="table-wrap">
                <table className="table results-table">
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Dept</th>
                      <th>Quiz</th>
                      <th>Score</th>
                      <th>%</th>
                      <th>Submitted</th>
                      <th className="right">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredResults.map((r) => {
                      const dt = toDate(r.createdAt);
                      return (
                        <tr key={r.id} className={selectedResult?.id === r.id ? 'active' : ''}>
                          <td>
                            <button className="linkbtn" onClick={() => openResult(r)}>{r.name || '—'}</button>
                          </td>
                          <td>{r.department || '—'}</td>
                          <td className="muted">{r.quizTitle || '—'}</td>
                          <td>{r.score}/{r.total}</td>
                          <td>{pct(r.score, r.total).toFixed(1)}%</td>
                          <td className="muted">{fmt(dt)}</td>
                          <td className="right">
                            <button className="btn" onClick={() => openResult(r)}>View</button>
                            <button className="btn danger" onClick={() => remove(r)}>Delete</button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="muted">No results match the filters.</div>
            )}
          </div>

          <div className="card">
            <div className="card-head">
              <h3>Answer Review</h3>
              <div className="muted">{selectedResult ? `${selectedResult.name} • ${selectedResult.quizTitle}` : 'Select a row'}</div>
            </div>

            {!selectedResult ? (
              <div className="muted">Click any submission to see answers.</div>
            ) : (
              <div className="review">
                <div className="review-top">
                  <div className="badge ok">{selectedResult.score}/{selectedResult.total}</div>
                  <div className="muted">
                    {selectedResult.department || '—'} • {fmt(toDate(selectedResult.createdAt))}
                  </div>
                </div>

                <div className="review-list">
                  {(details || []).map((d) => (
                    <div className={`review-item ${d.isCorrect ? 'ok' : 'bad'}`} key={d.idx}>
                      <div className="review-q">
                        <b>Q{d.idx + 1}.</b> {d.q}
                      </div>
                      <div className="review-a">
                        <span className="tag">Selected</span>
                        <span>{d.selected || '—'}</span>
                      </div>
                      <div className="review-a">
                        <span className="tag">Correct</span>
                        <span>{d.correct || '—'}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        <div style={{ height: 20 }} />
      </div>
    </>
  );
}
