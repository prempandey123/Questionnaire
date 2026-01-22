# Employee Questionnaire (React + Firebase)

This is a Firebase-only questionnaire/quiz system:
- Employee side: view published questionnaires and attempt
- Admin side: hardcoded login, create questionnaires, add up to 20 questions each, view results, export to Excel

## Tech
- React (CRA)
- React Router
- Firebase Firestore
- XLSX + file-saver for export

## Firestore Collections
- `questionnaires` (documents)
  - subcollection: `questions` (each question has `options` array with `isCorrect`)
- `quizResults` (submissions)

## Setup
1) Install deps:
```bash
npm install
```
2) Run:
```bash
npm start
```

## Admin Login
Edit `src/config.js`:
- username: `admin`
- password: `admin@123`

## Notes
- This MVP uses Firestore directly. For production security (hiding correct answers), use a backend/Cloud Function to calculate scores and restrict access via Firestore rules.
