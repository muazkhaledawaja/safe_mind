const { query } = require('../config/db');

// Writes one row per privileged action (CLAUDE.md rule 4). `metadata` must
// never contain message bodies, mood notes, or emergency contact details —
// IDs and event facts only.
async function writeAudit({ actorId, action, entityType, entityId, metadata, ip }) {
  await query(
    'INSERT INTO audit_logs (actor_id, action, entity_type, entity_id, metadata, ip_address) VALUES (?, ?, ?, ?, ?, ?)',
    [actorId ?? null, action, entityType, entityId ?? null, metadata ? JSON.stringify(metadata) : null, ip ?? null]
  );
}

module.exports = { writeAudit };
