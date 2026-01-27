// Hardcoded admin login (as requested).
// Tip: for production, move these to Vercel environment variables.
export const ADMIN_LOGIN = {
  username: 'admin',
  password: 'admin@123'
};

// Firestore limits (as requested)
export const LIMITS = {
  maxQuestionnaires: 50,
  questionsPerQuestionnaire: 15
};

// Organization departments (edit as per your org)
// Employee must select one before starting a quiz.
export const DEPARTMENTS = [
  'HR',
  'Administration',
  'Finance',
  'Accounts',
  'Operations',
  'IT',
  'Security',
  'Production',
  'Quality',
  'Safety',
  'Stores',
  'Logistics',
  'Maintenance',
  'Purchase',
  'Sales',
  'Marketing',
  'Customer Support',
  'R&D',
  'Legal',
  'Other'
];
