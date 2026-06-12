// Display label -> Lambda `language` field + Monaco language id.
export const LANGUAGES = [
  { label: 'C++', api: 'cpp', monaco: 'cpp' },
  { label: 'Java', api: 'java', monaco: 'java' },
  { label: 'Python', api: 'python', monaco: 'python' },
  { label: 'TypeScript', api: 'typescript', monaco: 'typescript' },
];

// File metadata used by the Save dialog. Java compiler requires the filename
// to match the public class, hence Main.java rather than code.java — but
// once the user opens the Save dialog they can type whatever they want.
export const EXTENSION = {
  cpp: 'cpp',
  java: 'java',
  python: 'py',
  typescript: 'ts',
};
export const DEFAULT_BASENAME = {
  cpp: 'code',
  java: 'Main',
  python: 'code',
  typescript: 'code',
};

// Resolve the deployed Lambda URL at build time. Empty string -> mock mode.
export const LAMBDA_URL = import.meta.env.VITE_LAMBDA_URL || '';

// 30s outermost timeout — matches the README's 10/20/30 cascading timeout strategy.
export const REQUEST_TIMEOUT_MS = 30_000;

// Map Lambda error codes to a UI-friendly status label.
export const ERROR_LABEL = {
  ERROR_TLE: 'Time Limit Exceeded',
  ERROR_MLE: 'Memory Limit Exceeded',
  ERROR: 'Error',
};

// Status -> visual severity. "Output Limit Exceeded" is a successful run that
// just produced more than 4KB of stdout, so it's a warning, not an error.
const WARNING_STATUSES = new Set(['Output Limit Exceeded']);
const SUCCESS_STATUSES = new Set(['Finished']);

export function getStatusKind(status) {
  if (SUCCESS_STATUSES.has(status)) return 'success';
  if (WARNING_STATUSES.has(status)) return 'warning';
  return 'error';
}
