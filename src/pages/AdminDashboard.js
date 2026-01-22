import React, { useEffect, useMemo, useState } from 'react';
import Header from '../components/Header';
import { LIMITS } from '../config';
import {
  createQuestionnaire,
  listQuestionnaires,
  updateQuestionnaire,
  deleteQuestionnaire,
  addQuestion,
  listQuestions
} from '../utils/firestore';

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

export default function AdminDashboard() {
  const [quizzes, setQuizzes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [msg, setMsg] = useState('');

  // create questionnaire
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [isPublished, setIsPublished] = useState(false);

  // question add
  const [selectedQuizId, setSelectedQuizId] = useState('');
  const [questions, setQuestions] = useState([]);
  const [question, setQuestion] = useState(emptyQuestion());
  const [savingQ, setSavingQ] = useState(false);

  const refresh = async () => {
    setErr('');
    setMsg('');
    try {
      setLoading(true);
      const list = await listQuestionnaires({});
      setQuizzes(list);
      if (!selectedQuizId && list.length) setSelectedQuizId(list[0].id);
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

  const create = async (e) => {
    e.preventDefault();
    setErr('');
    setMsg('');
    try {
      const id = await createQuestionnaire({ title, description, isPublished });
      setTitle('');
      setDescription('');
      setIsPublished(false);
      setSelectedQuizId(id);
      await refresh();
      setMsg('Questionnaire created. Now add questions (max 20).');
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
    const ok = window.confirm(`Delete questionnaire "${quiz.title}"? (Questions subcollection is not auto-deleted in this MVP)`);
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
    const filled = question.options.filter((o) => o.text.trim().length > 0);
    if (filled.length < 2) {
      setErr('At least 2 options are required');
      return;
    }

    try {
      setSavingQ(true);
      await addQuestion(selectedQuizId, question);
      setQuestion(emptyQuestion());
      const qs = await listQuestions(selectedQuizId);
      setQuestions(qs);
      await refresh();
      setMsg('Question added');
    } catch (e) {
      setErr(e?.message || 'Add question failed');
    } finally {
      setSavingQ(false);
    }
  };

  return (
    <>
      <Header mode="admin" />
      <div className="container">
        {err ? <div className="alert" style={{ marginBottom: 12 }}>{err}</div> : null}
        {msg ? <div className="alert" style={{ marginBottom: 12, borderColor: 'rgba(54,211,153,0.5)' }}>{msg}</div> : null}

        <div className="row">
          <div className="col">
            <div className="card">
              <h2>Create Questionnaire</h2>
              <p className="muted">You can create up to <b>{LIMITS.maxQuestionnaires}</b> questionnaires. Each questionnaire can have <b>{LIMITS.questionsPerQuestionnaire}</b> questions.</p>

              <form onSubmit={create} style={{ display: 'grid', gap: 10 }}>
                <div>
                  <label className="label">Title</label>
                  <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g., Safety Quiz" required />
                </div>
                <div>
                  <label className="label">Description</label>
                  <textarea rows={3} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Optional" />
                </div>
                <label style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <input type="checkbox" checked={isPublished} onChange={(e) => setIsPublished(e.target.checked)} />
                  <span>Publish immediately</span>
                </label>
                <button className="btn" type="submit">Create</button>
              </form>
            </div>

            <div className="card" style={{ marginTop: 16 }}>
              <h2>Manage Questionnaires</h2>
              {loading ? <p className="muted">Loading...</p> : null}
              <div style={{ display: 'grid', gap: 10 }}>
                {quizzes.map((q) => (
                  <div key={q.id} className="card" style={{ padding: 12, borderRadius: 14 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center' }}>
                      <div>
                        <div className="badge">{q.isPublished ? 'PUBLISHED' : 'DRAFT'} • Questions: {q.questionsCount || 0}/{LIMITS.questionsPerQuestionnaire}</div>
                        <div style={{ fontWeight: 800, marginTop: 8 }}>{q.title}</div>
                        {q.description ? <div className="muted" style={{ fontSize: 13, marginTop: 4 }}>{q.description}</div> : null}
                      </div>
                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                        <button className="btn secondary" onClick={() => setSelectedQuizId(q.id)}>Edit Questions</button>
                        <button className="btn secondary" onClick={() => togglePublish(q)}>{q.isPublished ? 'Unpublish' : 'Publish'}</button>
                        <button className="btn" style={{ borderColor: 'rgba(255,77,77,0.5)' }} onClick={() => removeQuiz(q)}>Delete</button>
                      </div>
                    </div>
                  </div>
                ))}

                {(!loading && quizzes.length === 0) ? <div className="alert">No questionnaires created yet.</div> : null}
              </div>
            </div>
          </div>

          <div className="col">
            <div className="card">
              <h2>Add Questions</h2>
              <p className="muted">Select questionnaire and add questions (max {LIMITS.questionsPerQuestionnaire}).</p>

              <div style={{ display: 'grid', gap: 10 }}>
                <div>
                  <label className="label">Select Questionnaire</label>
                  <select value={selectedQuizId} onChange={(e) => setSelectedQuizId(e.target.value)}>
                    <option value="">-- Select --</option>
                    {quizzes.map((q) => <option key={q.id} value={q.id}>{q.title}</option>)}
                  </select>
                </div>

                <div className="card" style={{ padding: 12, borderRadius: 14 }}>
                  <div className="badge">Selected: {selectedQuiz ? `${selectedQuiz.title} (${selectedQuiz.questionsCount || 0}/${LIMITS.questionsPerQuestionnaire})` : 'None'}</div>
                </div>

                <div>
                  <label className="label">Question Text</label>
                  <textarea rows={3} value={question.text} onChange={(e) => setQuestion((p) => ({ ...p, text: e.target.value }))} placeholder="Type question..." />
                </div>

                <div>
                  <label className="label">Points</label>
                  <input type="number" min="1" value={question.points} onChange={(e) => setQuestion((p) => ({ ...p, points: Number(e.target.value) }))} />
                </div>

                <div>
                  <label className="label">Options (choose correct one)</label>
                  <div style={{ display: 'grid', gap: 10 }}>
                    {question.options.map((opt, idx) => (
                      <div key={idx} className="card" style={{ padding: 12, borderRadius: 14 }}>
                        <label style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <input type="radio" name="correct" checked={opt.isCorrect} onChange={() => setCorrect(idx)} />
                          <span className="muted" style={{ fontSize: 13 }}>Correct</span>
                        </label>
                        <input
                          style={{ marginTop: 8 }}
                          value={opt.text}
                          onChange={(e) =>
                            setQuestion((prev) => ({
                              ...prev,
                              options: prev.options.map((o, i) => (i === idx ? { ...o, text: e.target.value } : o))
                            }))
                          }
                          placeholder={`Option ${idx + 1}`}
                        />
                      </div>
                    ))}
                  </div>
                </div>

                <button
                  className="btn"
                  onClick={saveQuestion}
                  disabled={savingQ || (selectedQuiz && (selectedQuiz.questionsCount || 0) >= LIMITS.questionsPerQuestionnaire)}
                >
                  {savingQ ? 'Saving...' : 'Add Question'}
                </button>

                <div className="footer">
                  Current questions in selected questionnaire: <b>{questions.length}</b>
                </div>

                {questions.length ? (
                  <div className="card" style={{ padding: 12, borderRadius: 14 }}>
                    <h3 style={{ marginBottom: 8 }}>Preview (titles only)</h3>
                    <ol style={{ margin: 0, paddingLeft: 18 }}>
                      {questions.map((q) => <li key={q.id} className="muted" style={{ marginBottom: 6 }}>{q.text}</li>)}
                    </ol>
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        </div>

        <div className="footer">Tip: To truly delete questions subcollection, use a Firebase Cloud Function or Firestore CLI recursion.</div>
      </div>
    </>
  );
}
