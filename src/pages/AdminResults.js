import React, { useEffect, useMemo, useState } from 'react';
import Header from '../components/Header';
import { listQuestionnaires } from '../utils/firestore';
import { listResults, deleteResult } from '../utils/firestore';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';

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

  const summary = useMemo(() => {
    if (!results.length) return { avg: 0, max: 0, min: 0 };
    const scores = results.map(r => Number(r.score || 0));
    const max = Math.max(...scores);
    const min = Math.min(...scores);
    const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
    return { avg, max, min };
  }, [results]);

  const exportExcel = () => {
    const rows = results.map((r) => ({
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
    const fname = `results_${filterQuizId || 'all'}_${new Date().toISOString().slice(0, 10)}.xlsx`;
    saveAs(blob, fname);
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
          <p className="muted">Filter by questionnaire, export to Excel, and manage submissions.</p>

          {err ? <div className="alert" style={{ marginBottom: 12 }}>{err}</div> : null}

          <div className="row" style={{ alignItems: 'flex-end' }}>
            <div className="col">
              <label className="label">Filter by Questionnaire</label>
              <select value={filterQuizId} onChange={(e) => setFilterQuizId(e.target.value)}>
                <option value="">All</option>
                {quizzes.map((q) => <option key={q.id} value={q.id}>{q.title}</option>)}
              </select>
            </div>
            <div className="col" style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button className="btn secondary" onClick={refresh}>Refresh</button>
              <button className="btn" onClick={exportExcel} disabled={!results.length}>Export Excel</button>
            </div>
          </div>

          <hr style={{ border: 0, borderTop: '1px solid var(--border)', margin: '16px 0' }} />

          {loading ? (
            <p className="muted">Loading...</p>
          ) : results.length === 0 ? (
            <div className="alert">No results found.</div>
          ) : (
            <>
              <div className="muted" style={{ marginBottom: 10 }}>
                Total submissions: <b>{results.length}</b> | Avg score: <b>{summary.avg.toFixed(2)}</b> | Max: <b>{summary.max}</b> | Min: <b>{summary.min}</b>
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
                    {results.map((r) => (
                      <tr key={r.id}>
                        <td>{r.name}</td>
                        <td>{r.department || '-'}</td>
                        <td>{r.quizTitle || r.quizId}</td>
                        <td><b>{r.score}</b> / {r.total}</td>
                        <td className="muted">{toISO(r.createdAt).replace('T',' ').slice(0, 19)}</td>
                        <td><button className="btn" style={{ padding: '8px 10px', borderColor: 'rgba(255,77,77,0.5)' }} onClick={() => remove(r.id)}>Delete</button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}

          <div className="footer">Note: this MVP stores results in Firestore collection <b>quizResults</b>.</div>
        </div>
      </div>
    </>
  );
}
