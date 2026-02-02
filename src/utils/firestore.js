import {
  collection,
  doc,
  addDoc,
  setDoc,
  getDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  serverTimestamp
} from 'firebase/firestore';

import { db } from '../firebase';
import { LIMITS } from '../config';

// Collections
const questionnairesCol = collection(db, 'questionnaires');
const resultsCol = collection(db, 'quizResults');

export async function countQuestionnaires() {
  const snap = await getDocs(questionnairesCol);
  return snap.size;
}

export async function createQuestionnaire({ title, description, designation, isPublished, departments }) {
  const current = await countQuestionnaires();
  if (current >= LIMITS.maxQuestionnaires) {
    throw new Error(`Maximum ${LIMITS.maxQuestionnaires} questionnaires reached.`);
  }

  const ref = await addDoc(questionnairesCol, {
    title: title.trim(),
    description: description.trim(),
    designation: (designation || '').trim(),
    isPublished: Boolean(isPublished),
    // If empty/undefined => available to all departments
    departments: Array.isArray(departments) ? departments : [],
    questionsCount: 0,
    createdAt: serverTimestamp()
  });
  return ref.id;
}

export async function updateQuestionnaire(quizId, data) {
  const ref = doc(db, 'questionnaires', quizId);
  await updateDoc(ref, data);
}

export async function deleteQuestionnaire(quizId) {
  // Note: subcollection deletion requires batching or Cloud Function.
  // For MVP, we only delete the questionnaire doc.
  await deleteDoc(doc(db, 'questionnaires', quizId));
}

export async function listQuestionnaires({ department, onlyPublished } = {}) {
  const constraints = [];
  if (onlyPublished) constraints.push(where('isPublished', '==', true));
  if (department) constraints.push(where('departments', 'array-contains', department));

  const q = constraints.length
    ? query(questionnairesCol, ...constraints)
    : query(questionnairesCol);

  const snap = await getDocs(q);
  const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));

  // client-side sort to avoid composite index requirement
  list.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
  return list;
}

export async function getQuestionnaire(quizId) {
  const snap = await getDoc(doc(db, 'questionnaires', quizId));
  if (!snap.exists()) throw new Error('Questionnaire not found');
  return { id: snap.id, ...snap.data() };
}

export async function addQuestion(quizId, question) {
  // question: {
  //   text, textHi (optional),
  //   options: [{ text, textHi (optional), isCorrect }],
  //   points
  // }
  const qCol = collection(db, 'questionnaires', quizId, 'questions');
  const qSnap = await getDocs(qCol);
  if (qSnap.size >= LIMITS.questionsPerQuestionnaire) {
    throw new Error(`This questionnaire already has ${LIMITS.questionsPerQuestionnaire} questions.`);
  }

  const ref = await addDoc(qCol, {
    text: question.text.trim(),
    textHi: (question.textHi || '').trim(),
    points: Number(question.points || 1),
    options: question.options.map(o => ({
      text: (o.text || '').trim(),
      textHi: (o.textHi || '').trim(),
      isCorrect: Boolean(o.isCorrect)
    })),
    createdAt: serverTimestamp()
  });

  // Update count on parent doc
  await updateDoc(doc(db, 'questionnaires', quizId), {
    questionsCount: qSnap.size + 1
  });

  return ref.id;
}

export async function listQuestions(quizId) {
  const qCol = collection(db, 'questionnaires', quizId, 'questions');
  const snap = await getDocs(query(qCol, orderBy('createdAt', 'asc')));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function submitResult({ employeeId, name, department, quizId, quizTitle, answers, score, total, timeTakenSec }) {
  // Keep schema compatible with your earlier project (quizResults)
  await addDoc(resultsCol, {
    employeeId: (employeeId || '').trim().toUpperCase(),
    name: name.trim(),
    department: (department || '').trim(),
    quizId,
    quizTitle,
    score,
    total,
    answers,
    timeTakenSec: typeof timeTakenSec === 'number' ? timeTakenSec : null,
    createdAt: serverTimestamp()
  });
}

export async function listResults({ quizId } = {}) {
  const q = quizId
    ? query(resultsCol, where('quizId', '==', quizId), orderBy('createdAt', 'desc'), limit(500))
    : query(resultsCol, orderBy('createdAt', 'desc'), limit(500));

  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function deleteResult(resultId) {
  await deleteDoc(doc(db, 'quizResults', resultId));
}
