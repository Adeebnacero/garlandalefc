// ---------------------------------------------------------------------------
// Mapping functions between Supabase's snake_case Postgres rows and the
// camelCase shape the rest of the app works in. Pure functions, no side
// effects - kept separate so the data-shape contract with the database is
// in one place rather than scattered through component code.
// ---------------------------------------------------------------------------

export function fromDbPlayer(row) {
  return {
    id: row.id,
    name: row.name || "",
    dob: row.dob || "",
    ageGroupOverride: row.age_group_override || "",
    phone: row.phone || "",
    email: row.email || "",
    guardianName: row.guardian_name || "",
    guardianPhone: row.guardian_phone || "",
    joinDate: row.join_date || "",
    monthlyFee: row.monthly_fee ?? 0,
    documentsComplete: !!row.documents_complete,
    notes: row.notes || "",
    regNo: row.reg_no || "",
    squadNumber: row.squad_number === null || row.squad_number === undefined ? "" : row.squad_number,
    tierId: row.tier_id || "",
    active: row.active === false ? false : true,
    statusLog: (row.player_status_log || []).map((s) => ({ id: s.id, status: s.status, changedAt: s.changed_at })),
    payments: (row.payments || [])
      .map((p) => ({ id: p.id, amount: Number(p.amount), date: p.date, method: p.method }))
      .sort((a, b) => new Date(b.date) - new Date(a.date)),
  };
}

export function toDbPlayer(form) {
  return {
    name: form.name,
    dob: form.dob || null,
    age_group_override: form.ageGroupOverride || "",
    phone: form.phone || "",
    email: form.email || "",
    guardian_name: form.guardianName || "",
    guardian_phone: form.guardianPhone || "",
    join_date: form.joinDate || null,
    documents_complete: !!form.documentsComplete,
    notes: form.notes || "",
    reg_no: form.regNo && form.regNo.trim() ? form.regNo.trim() : null,
    squad_number: form.squadNumber === "" || form.squadNumber === null || form.squadNumber === undefined ? null : Number(form.squadNumber),
    tier_id: form.tierId || null,
    active: form.active === false ? false : true,
  };
}

export function fromDbTier(row) {
  return {
    id: row.id,
    name: row.name || "",
    monthlyFee: Number(row.monthly_fee) || 0,
    description: row.description || "",
  };
}

export function toDbTier(form) {
  return {
    name: form.name || "",
    monthly_fee: Number(form.monthlyFee) || 0,
    description: form.description || "",
  };
}

export function fromDbMatch(row) {
  return {
    id: row.id,
    leagueName: row.league_name || "",
    homeTeam: row.home_team || "",
    opponent: row.opponent || "",
    homeAway: row.home_away || "H",
    venue: row.venue || "",
    matchDate: row.match_date || "",
    kickoffTime: row.kickoff_time || "",
    division: row.division || "",
    competition: row.competition || "",
    ageGroup: row.age_group || "",
    cornerFlags: row.corner_flags || "",
    fieldConditions: row.field_conditions || "",
    fieldMarking: row.field_marking || "",
    firstAidPresent: row.first_aid_present || "",
    refereeName: row.referee_name || "",
    assistantRef1: row.assistant_ref_1 || "",
    assistantRef2: row.assistant_ref_2 || "",
    halfTimeScoreHome: row.half_time_score_home || "",
    fullTimeScoreHome: row.full_time_score_home || "",
    halfTimeScoreAway: row.half_time_score_away || "",
    fullTimeScoreAway: row.full_time_score_away || "",
    coachName: row.coach_name || "",
    coachRegNo: row.coach_reg_no || "",
    managerName: row.manager_name || "",
    managerRegNo: row.manager_reg_no || "",
    captainPlayerId: row.captain_player_id || "",
    physioName: row.physio_name || "",
    physioRegNo: row.physio_reg_no || "",
    comments: row.comments || "",
  };
}

export function toDbMatch(form) {
  return {
    league_name: form.leagueName || "Cape Town Tygerberg LFA",
    home_team: form.homeTeam || "Garlandale FC",
    opponent: form.opponent || "",
    home_away: form.homeAway || "H",
    venue: form.venue || "",
    match_date: form.matchDate || null,
    kickoff_time: form.kickoffTime || null,
    division: form.division || "",
    competition: form.competition || "",
    age_group: form.ageGroup || "",
    corner_flags: form.cornerFlags || "",
    field_conditions: form.fieldConditions || "",
    field_marking: form.fieldMarking || "",
    first_aid_present: form.firstAidPresent || "",
    referee_name: form.refereeName || "",
    assistant_ref_1: form.assistantRef1 || "",
    assistant_ref_2: form.assistantRef2 || "",
    half_time_score_home: form.halfTimeScoreHome || "",
    full_time_score_home: form.fullTimeScoreHome || "",
    half_time_score_away: form.halfTimeScoreAway || "",
    full_time_score_away: form.fullTimeScoreAway || "",
    coach_name: form.coachName || "",
    coach_reg_no: form.coachRegNo || "",
    manager_name: form.managerName || "",
    manager_reg_no: form.managerRegNo || "",
    captain_player_id: form.captainPlayerId || null,
    physio_name: form.physioName || "",
    physio_reg_no: form.physioRegNo || "",
    comments: form.comments || "",
  };
}

export function fromDbItem(row) {
  return {
    id: row.id,
    name: row.name || "",
    category: row.category || "",
    size: row.size || "",
    quantityOnHand: row.quantity_on_hand ?? 0,
  };
}

export function toDbItem(form) {
  return {
    name: form.name || "",
    category: form.category || "",
    size: form.size || "",
    quantity_on_hand: Number(form.quantityOnHand) || 0,
  };
}
