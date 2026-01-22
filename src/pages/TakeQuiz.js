import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import Header from '../components/Header';
import { getQuestionnaire, listQuestions, submitResult } from '../utils/firestore';

function calcScore(questions, selected) {
  let score = 0;
  let total = 0;
  for (const q of questions) {
    const pts = Number(q.points || 1);
    total += pts;
    const sel = selected[q.id];
    const opt = (q.options || []).find((o, idx) => String(idx) === String(sel));
    if (opt && opt.isCorrect) score += pts;
  }
  return { score, total };
}

export default function TakeQuiz() {
  const { quizId } = useParams();
  const nav = useNavigate();
  const [quiz, setQuiz] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [selected, setSelected] = useState({});
  const [index, setIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState('');

  const name = localStorage.getItem('emp_name') || '';
  const department = localStorage.getItem('emp_dept') || '';

  useEffect(() => {
    if (!name.trim()) {
      nav('/', { replace: true });
      return;
    }

    (async () => {
      try {
        setLoading(true);
        const qz = await getQuestionnaire(quizId);
        if (!qz.isPublished) {
          throw new Error('This questionnaire is not published yet.');
        }
        const qs = await listQuestions(quizId);
        setQuiz(qz);
        setQuestions(qs);
        setIndex(0);
      } catch (e) {
        setErr(e?.message || 'Failed to load questionnaire');
      } finally {
        setLoading(false);
      }
    })();
  }, [quizId, name, nav]);

  const current = questions[index];

  const answeredCount = useMemo(() => Object.keys(selected).length, [selected]);

  const choose = (questionId, optionIndex) => {
    setSelected((prev) => ({ ...prev, [questionId]: String(optionIndex) }));
  };

  const next = () => setIndex((i) => Math.min(i + 1, questions.length - 1));
  const prev = () => setIndex((i) => Math.max(i - 1, 0));

  const submit = async () => {
    setErr('');

    if (questions.length === 0) {
      setErr('No questions found for this questionnaire.');
      return;
    }

    // Simple validation: must answer all questions
    if (answeredCount < questions.length) {
      setErr(`Please answer all questions (${answeredCount}/${questions.length}).`);
      return;
    }

    try {
      setSubmitting(true);
      const { score, total } = calcScore(questions, selected);

      const answers = questions.map((q) => ({
        questionId: q.id,
        selectedOptionIndex: selected[q.id]
      }));

      await submitResult({
        name,
        department,
        quizId,
        quizTitle: quiz?.title || '',
        answers,
        score,
        total
      });

      nav('/submitted', { replace: true, state: { score, total, title: quiz?.title } });
    } catch (e) {
      setErr(e?.message || 'Failed to submit');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <Header />
      <div className="container">
        {loading ? (
          <div className="card"><p className="muted">Loading...</p></div>
        ) : err ? (
          <div className="card"><div className="alert">{err}</div></div>
        ) : (
          <div className="row">
            <div className="col">
              <div className="card">
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center' }}>
                  <div>
                    <div className="badge">{quiz?.questionsCount || questions.length} questions</div>
                    <h2 style={{ marginTop: 10 }}>{quiz?.title}</h2>
                    <div className="muted">Employee: <b>{name}</b> {department ? `(${department})` : ''}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div className="muted" style={{ fontSize: 13 }}>Progress</div>
                    <div style={{ fontWeight: 800, fontSize: 18 }}>{answeredCount}/{questions.length}</div>
                  </div>
                </div>

                <hr style={{ border: '0', borderTop: '1px solid var(--border)', margin: '16px 0' }} />

                {!current ? (
                  <div className="alert">No question available.</div>
                ) : (
                  <>
                    <h3>Q{index + 1}. {current.text}</h3>
                    <div className="muted" style={{ marginBottom: 10 }}>Points: {current.points || 1}</div>

                    <div style={{ display: 'grid', gap: 10 }}>
                      {(current.options || []).map((opt, idx) => {
                        const checked = String(selected[current.id]) === String(idx);
                        return (
                          <label key={idx} className="card" style={{ padding: 12, borderRadius: 14, cursor: 'pointer' }}>
                            <input
                              type="radio"
                              name={`q_${current.id}`}
                              checked={checked}
                              onChange={() => choose(current.id, idx)}
                              style={{ marginRight: 10 }}
                            />
                            {opt.text}
                          </label>
                        );
                      })}
                    </div>

                    {err ? <div className="alert" style={{ marginTop: 12 }}>{err}</div> : null}

                    <div style={{ display: 'flex', gap: 10, marginTop: 16, justifyContent: 'space-between' }}>
                      <button className="btn secondary" onClick={prev} disabled={index === 0}>Previous</button>
                      {index < questions.length - 1 ? (
                        <button className="btn" onClick={next}>Next</button>
                      ) : (
                        <button className="btn" onClick={submit} disabled={submitting}>
                          {submitting ? 'Submitting...' : 'Submit'}
                        </button>
                      )}
                    </div>
                  </>
                )}
              </div>
            </div>

            <div className="col">
              <div className="card">
                <h3>Question Navigator</h3>
                <p className="muted">Click to jump to a question.</p>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {questions.map((q, i) => {
                    const done = selected[q.id] !== undefined;
                    const active = i === index;
                    return (
                      <button
                        key={q.id}
                        className={`btn ${active ? '' : 'secondary'}`}
                        onClick={() => setIndex(i)}
                        style={{ padding: '8px 10px', minWidth: 48, opacity: done ? 1 : 0.8, borderColor: done ? 'var(--accent)' : undefined }}
                      >
                        {i + 1}
                      </button>
                    );
                  })}
                </div>
                <div className="footer">Answer all questions to submit.</div>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
