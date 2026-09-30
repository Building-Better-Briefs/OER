const KEY = 'offline-builder-preview-open';
export function readBuilderStudentPreviewOpen() {
  try { return localStorage.getItem(KEY) !== 'false'; } catch { return true; }
}
export function writeBuilderStudentPreviewOpen(open: boolean) {
  try { localStorage.setItem(KEY, open ? 'true' : 'false'); } catch {}
}
