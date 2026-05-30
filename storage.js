// ═══════════════════════════════════════════
// LOCAL STORAGE HELPERS
// ═══════════════════════════════════════════
function lsGet(key) {
  try { return JSON.parse(localStorage.getItem('ct5_' + key)); } catch(e) { return null; }
}
function lsSet(key, val) {
  try { localStorage.setItem('ct5_' + key, JSON.stringify(val)); } catch(e) {}
}
function lsDel(key) {
  try { localStorage.removeItem('ct5_' + key); } catch(e) {}
}

// ═══════════════════════════════════════════
// SYNC DOT
// ═══════════════════════════════════════════
var syncFadeTimer = null;
function showSync(state) {
  var dot = document.getElementById('sync-dot');
  dot.className = state;
  if (state === 'saved') {
    clearTimeout(syncFadeTimer);
    syncFadeTimer = setTimeout(function() { dot.style.opacity = '0'; }, 3000);
  }
}
