// Log IDs and event names only — never message bodies, mood notes, or
// emergency contact details (see CLAUDE.md rule 6).
function log(level, event, meta = {}) {
  console.log(JSON.stringify({ time: new Date().toISOString(), level, event, ...meta }));
}

module.exports = {
  info: (event, meta) => log('info', event, meta),
  warn: (event, meta) => log('warn', event, meta),
  error: (event, meta) => log('error', event, meta),
};
