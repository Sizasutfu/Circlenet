// src/lib/drafts.js

const STORAGE_KEY = 'circle_drafts';

/**
 * Get all saved drafts from localStorage.
 * @returns {Array} Array of draft objects.
 */
export function getAllDrafts() {
  if (typeof window === 'undefined') return [];
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

/**
 * Save a draft to localStorage. If draft.id exists, update it; otherwise add new.
 * @param {Object} draft - Draft object with id, type, text, etc.
 */
export function saveDraft(draft) {
  if (typeof window === 'undefined') return;
  const drafts = getAllDrafts();
  const existingIndex = drafts.findIndex(d => d.id === draft.id);
  if (existingIndex >= 0) {
    drafts[existingIndex] = { ...drafts[existingIndex], ...draft, updatedAt: new Date().toISOString() };
  } else {
    draft.id = draft.id || crypto.randomUUID?.() || Date.now().toString();
    draft.createdAt = new Date().toISOString();
    draft.updatedAt = new Date().toISOString();
    drafts.push(draft);
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(drafts));
}

/**
 * Delete a draft by id.
 * @param {string} id
 */
export function deleteDraft(id) {
  if (typeof window === 'undefined') return;
  const drafts = getAllDrafts().filter(d => d.id !== id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(drafts));
}

/**
 * Get a single draft by id.
 * @param {string} id
 * @returns {Object|null}
 */
export function getDraft(id) {
  const drafts = getAllDrafts();
  return drafts.find(d => d.id === id) || null;
}

/**
 * Clear all drafts (optional).
 */
export function clearAllDrafts() {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(STORAGE_KEY);
}