import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import Header from '../components/Header';
import { getQuestionnaire, listQuestions, submitResult } from '../utils/firestore';
import { LIMITS } from '../config';

const TOTAL_TIME_SEC = 120; // 2 minutes

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

  const [timeLeft, setTimeLeft] = useState(TOTAL_TIME_SEC);

  // Language: 'en' | 'hi'
  const [lang, setLang] = useState(localStorage.getItem('quiz_lang') || 'en');

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState('');

  const name = localStorage.getItem('emp_name') || '';
  const department = localStorage.getItem('emp_dept') || '';
  const employeeId = localStorage.getItem('emp_id') || '';

  useEffect(() => {
    if (!name.trim() || !/^HSL\d{4}$/.test(employeeId.trim().toUpperCase())) {
      nav('/', { replace: true });
      return;
    }

    (async () => {
      try {
        setLoading(true);
        setErr('');
        setTimeLeft(TOTAL_TIME_SEC);

        const qz = await getQuestionnaire(quizId);
        if (!qz.isPublished) throw new Error('This questionnaire is not published yet.');

        const qsAll = await listQuestions(quizId);
        const qs = (qsAll || []).slice(0, LIMITS.questionsPerQuestionnaire); // 15
        setQuiz(qz);
        setQuestions(qs);
        setSelected({});
        setIndex(0);
      } catch (e) {
        setErr(e?.message || 'Failed to load questionnaire');
      } finally {
        setLoading(false);
      }
    })();
  }, [quizId, name, nav]);

  // Timer (auto-submit at 0)
  useEffect(() => {
    if (loading || submitting || err) return;
    if (questions.length === 0) return;

    if (timeLeft <= 0) {
      submit({ force: true });
      return;
    }

    const t = setInterval(() => setTimeLeft((s) => s - 1), 1000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeLeft, loading, submitting, err, questions.length]);

  const current = questions[index];

  const answeredCount = useMemo(() => Object.keys(selected).length, [selected]);
  const progressPct = useMemo(() => {
    if (!questions.length) return 0;
    return Math.round((answeredCount / questions.length) * 100);
  }, [answeredCount, questions.length]);

  const choose = (questionId, optionIndex) => {
    setSelected((prev) => ({ ...prev, [questionId]: String(optionIndex) }));
  };

  const next = () => setIndex((i) => Math.min(i + 1, questions.length - 1));
  const prev = () => setIndex((i) => Math.max(i - 1, 0));

  const submit = async ({ force } = { force: false }) => {
    setErr('');

    if (questions.length === 0) {
      setErr('No questions found for this questionnaire.');
      return;
    }

    // If not forced, require all answers.
    if (!force && answeredCount < questions.length) {
      setErr(`Please answer all questions (${answeredCount}/${questions.length}).`);
      return;
    }

    try {
      setSubmitting(true);
      const { score, total } = calcScore(questions, selected);

      const answers = questions.map((q) => {
        const selIdx = selected[q.id] ?? null;
        const opts = Array.isArray(q.options) ? q.options : [];
        const chosen = selIdx !== null ? opts[Number(selIdx)] : null;
        const correct = opts.find((o) => o.isCorrect) || null;
        return {
          questionId: q.id,
          questionText: q.text || '',
          questionTextHi: q.textHi || '',
          selectedOptionIndex: selIdx,
          selectedOptionText: chosen?.text ?? null,
          selectedOptionTextHi: chosen?.textHi ?? null,
          correctOptionText: correct?.text ?? null,
          correctOptionTextHi: correct?.textHi ?? null,
          isCorrect: Boolean(chosen && chosen.isCorrect)
        };
      });

      await submitResult({
        employeeId: employeeId.trim().toUpperCase(),
        name,
        department,
        quizId,
        quizTitle: quiz?.title || '',
        answers,
        score,
        total,
        timeTakenSec: TOTAL_TIME_SEC - Math.max(timeLeft, 0)
      });

      nav('/submitted', { replace: true, state: { score, total, title: quiz?.title } });
    } catch (e) {
      setErr(e?.message || 'Failed to submit');
    } finally {
      setSubmitting(false);
    }
  };

  const mm = String(Math.floor(Math.max(timeLeft, 0) / 60)).padStart(2, '0');
  const ss = String(Math.max(timeLeft, 0) % 60).padStart(2, '0');

  const setLanguage = (next) => {
    setLang(next);
    localStorage.setItem('quiz_lang', next);
  };

  const qText = current ? (lang === 'hi' && current.textHi ? current.textHi : current.text) : '';

  return (
    <>
      <Header />
      <div className="container">
        {loading ? (
          <div className="card"><p className="muted">Loading...</p></div>
        ) : err ? (
          <div className="card"><div className="error">{err}</div></div>
        ) : (
          <div className="grid grid-2">
            <div className="card">
              <div className="section-title">
                <div>
                  <span className="pill">🧠 {questions.length} Questions • ⏱ 02:00</span>
                  <h2 style={{ marginTop: 10 }}>{quiz?.title}</h2>
                  <div className="muted">Employee: <b>{name}</b> {department ? `(${department})` : ''} <span className="muted">•</span> <span className="pill" style={{ padding: '4px 10px' }}>{employeeId}</span></div>
                </div>

                <div style={{ textAlign: 'right' }}>
                  <div className="pill" style={{ justifyContent: 'center', minWidth: 120 }}>
                    ⏳ <b>{mm}:{ss}</b>
                  </div>

                  <div style={{ marginTop: 10, display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                    <button
                      className={`btn ${lang === 'en' ? 'btn-primary' : 'secondary'}`}
                      style={{ padding: '8px 10px' }}
                      onClick={() => setLanguage('en')}
                      type="button"
                    >
                      EN
                    </button>
                    <button
                      className={`btn ${lang === 'hi' ? 'btn-primary' : 'secondary'}`}
                      style={{ padding: '8px 10px' }}
                      onClick={() => setLanguage('hi')}
                      type="button"
                    >
                      HI
                    </button>
                  </div>

                  <div style={{ marginTop: 10 }}>
                    <div className="muted" style={{ fontSize: 12 }}>Progress</div>
                    <div className="kpi">
                      <div className="big">{answeredCount}/{questions.length}</div>
                      <div className="pill">{progressPct}%</div>
                    </div>
                    <div className="progress-bar" style={{ marginTop: 10 }}>
                      <div style={{ width: `${progressPct}%` }} />
                    </div>
                  </div>
                </div>
              </div>

              <div className="hr" />

              {!current ? (
                <div className="alert">No question available.</div>
              ) : (
                <>
                  <h3>Q{index + 1}. {qText}</h3>
                  <div className="muted" style={{ marginBottom: 12 }}>Points: {current.points || 1}</div>

                  <div className="stack">
                    {(current.options || []).map((opt, idx) => {
                      const checked = String(selected[current.id]) === String(idx);
                      return (
                        <label key={idx} className={`option ${checked ? 'selected' : ''}`}>
                          <input
                            type="radio"
                            name={`q_${current.id}`}
                            checked={checked}
                            onChange={() => choose(current.id, idx)}
                          />
                          <div>{lang === 'hi' && opt.textHi ? opt.textHi : opt.text}</div>
                        </label>
                      );
                    })}
                  </div>

                  {err ? <div className="error" style={{ marginTop: 12 }}>{err}</div> : null}

                  <div style={{ display: 'flex', gap: 10, marginTop: 16, justifyContent: 'space-between' }}>
                    <button className="btn secondary" onClick={prev} disabled={index === 0}>Previous</button>

                    {index < questions.length - 1 ? (
                      <button className="btn btn-primary" onClick={next}>Next</button>
                    ) : (
                      <button className="btn btn-primary" onClick={() => submit({ force: false })} disabled={submitting}>
                        {submitting ? 'Submitting...' : 'Submit'}
                      </button>
                    )}
                  </div>
                </>
              )}
            </div>

            <div className="card">
              <div className="section-title">
                <h3>Navigator</h3>
                <span className="pill">Click to jump</span>
              </div>

              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {questions.map((q, i) => {
                  const done = selected[q.id] !== undefined;
                  const active = i === index;
                  return (
                    <button
                      key={q.id}
                      className={`btn ${active ? 'btn-primary' : 'secondary'}`}
                      onClick={() => setIndex(i)}
                      style={{
                        padding: '8px 10px',
                        minWidth: 46,
                        opacity: done ? 1 : 0.75,
                        borderColor: done ? 'rgba(255,212,0,0.65)' : undefined
                      }}
                      title={done ? 'Answered' : 'Pending'}
                    >
                      {i + 1}
                    </button>
                  );
                })}
              </div>

              <div className="hr" />

              <div className="muted" style={{ fontSize: 13, lineHeight: 1.5 }}>
                • Timer ends at <b>00:00</b> → auto submit (unanswered treated as wrong).<br/>
                • Answer all questions for best score.
              </div>

              <div style={{ marginTop: 14, display: 'flex', justifyContent: 'space-between', gap: 10 }}>
                <button className="btn secondary" onClick={() => nav('/', { replace: true })}>Exit</button>
                <button className="btn btn-danger" onClick={() => submit({ force: true })} disabled={submitting}>
                  Force Submit
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
