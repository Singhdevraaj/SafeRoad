// Community verification rules, kept pure so they are easy to test.
// A submission becomes VERIFIED once enough independent people confirm it,
// and REJECTED once enough dispute it. An admin decision is final.
export function nextStatus({ confirms = 0, disputes = 0, current, pending, locked = false }) {
  if (locked) return current;
  if (confirms >= 3 && confirms - disputes >= 2) return 'VERIFIED';
  if (disputes >= 3 && disputes - confirms >= 2) return 'REJECTED';
  return current === 'VERIFIED' || current === 'REJECTED' ? pending : current;
}

// Returns new confirm/dispute arrays with `voterKey` counted once, on the chosen side.
export function castVote({ confirms = [], disputes = [] }, voterKey, vote) {
  const c = confirms.filter((key) => key !== voterKey);
  const d = disputes.filter((key) => key !== voterKey);
  (vote === 'confirm' ? c : d).push(voterKey);
  return { confirms: c, disputes: d };
}
