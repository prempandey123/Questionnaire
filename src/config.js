// Hardcoded admin login (as requested).
// Tip: for production, move these to Vercel environment variables.
export const ADMIN_LOGIN = {
  username: 'questionnaire',
  password: 'Questionnaire@123'
};

// Firestore limits (as requested)
export const LIMITS = {
  maxQuestionnaires: 100,
  questionsPerQuestionnaire: 15
};

// Organization departments (edit as per your org)
// Employee must select one before starting a quiz.
export const DEPARTMENTS = [
  'HRS',
  'Pickling',
  'Mills',
  'Annealing',
  'Finishing',
  'Mechanical',
  'Electrical & Automation',
  'Quality Assurance',
  'Production',
  'Utility',
  'Tube Plant',
  'Finance & Accounts',
  'Human Resources',
  'Information Technology',
  'Administration',
  'Safety',
  'Purchase',
  'Store',
  'Security',
  'Transport',
  'PPIC',
  'Dispatch',
  'Packing',
  'Sales & Marketing'
];
