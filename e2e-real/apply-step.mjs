// The adapter's applyStep for testkit/red-green.mjs (`--adapter e2e-real/apply-step.mjs`): what brings the running
// stack in line with a changed file. A migration is applied by resetting the database, which also drops every user,
// so the moderators are seeded again. Anything else needs no step: the real config's web server builds the app.
// The runner runs these after the mutation and again after it puts the file back.
export function applyStep(file) {
  if (file.startsWith('supabase/migrations/')) {
    return [
      ['npx', 'supabase', 'db', 'reset'],
      ['node', 'e2e-real/db.mjs', 'seed'],
    ];
  }
  return [];
}
