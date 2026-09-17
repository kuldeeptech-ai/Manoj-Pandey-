import { DEFAULT_SCHOOL_SETTINGS, DEFAULT_SUBJECTS, DEFAULT_STUDENTS } from '../src/data/defaultData';
import { DEFAULT_GRADE_RULES, calculateStudentResult } from '../src/utils/calculations';

export default async function handler(req: any, res: any) {
  // Enable CORS for public portal access
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const roll = (req.query.roll as string)?.trim().toLowerCase();
  const admission = (req.query.admission as string)?.trim().toLowerCase();
  const studentId = (req.query.id as string)?.trim().toLowerCase();

  if (!roll && !admission && !studentId) {
    return res.status(400).json({ error: 'Please enter Roll Number or Admission Number.' });
  }

  // Check if Google Sheet Web App URL is configured in environment or default
  const sheetUrl = process.env.VITE_GOOGLE_SHEET_URL || process.env.GOOGLE_SHEET_URL || 'https://script.google.com/macros/s/AKfycbwFMPA6Zf3SfRQF2eWP3zt7TjAXy47lAmP8zGlEiSmwN4ksFC-IKuyGWln3g0YEM7HRNg/exec';
  if (sheetUrl && sheetUrl.trim().startsWith('http')) {
    try {
      const targetQuery = roll || admission || studentId;
      const sheetRes = await fetch(
        `${sheetUrl.trim()}?roll=${encodeURIComponent(targetQuery)}&admission=${encodeURIComponent(targetQuery)}`
      );
      if (sheetRes.ok) {
        const json = await sheetRes.json();
        if (json && json.student) {
          const currentSubjects = (json.subjects && json.subjects.length > 0) ? json.subjects : DEFAULT_SUBJECTS;
          const currentSchool = json.school ? { ...DEFAULT_SCHOOL_SETTINGS, ...json.school } : DEFAULT_SCHOOL_SETTINGS;
          const result = calculateStudentResult(json.student, currentSubjects, currentSchool, DEFAULT_GRADE_RULES);
          return res.status(200).json(result);
        }
      }
    } catch (e) {
      console.warn('Google Sheet fetch error in Vercel API:', e);
    }
  }

  // Fallback to default student store
  const matched = DEFAULT_STUDENTS.find((s) => {
    if (roll && s.rollNo.trim().toLowerCase() === roll) return true;
    if (admission && s.admissionNo.trim().toLowerCase() === admission) return true;
    if (studentId && s.id.trim().toLowerCase() === studentId) return true;
    return false;
  });

  if (!matched) {
    return res.status(404).json({
      error: 'RESULT NOT FOUND',
      message: 'Please check your Roll Number / Admission Number or contact school administration.',
    });
  }

  const result = calculateStudentResult(
    matched,
    DEFAULT_SUBJECTS,
    DEFAULT_SCHOOL_SETTINGS,
    DEFAULT_GRADE_RULES
  );

  return res.status(200).json(result);
}
