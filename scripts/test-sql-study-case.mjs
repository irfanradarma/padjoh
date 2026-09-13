import { createClient } from "@supabase/supabase-js";

const url = "https://cdypfbswmzwvfjoqzykh.supabase.co";
const serviceKey = process.env.TASK_SERVICE_KEY;
const anonKey = process.env.TASK_ANON_KEY;
if (!serviceKey || !anonKey)
  throw new Error("TASK_SERVICE_KEY and TASK_ANON_KEY are required.");

const service = createClient(url, serviceKey, {
  auth: { persistSession: false },
});
async function tokenFor(email) {
  const { data: link, error } = await service.auth.admin.generateLink({
    type: "magiclink",
    email,
  });
  if (error) throw error;
  const client = createClient(url, anonKey, {
    auth: { persistSession: false },
  });
  const { data, error: verifyError } = await client.auth.verifyOtp({
    token_hash: link.properties.hashed_token,
    type: "magiclink",
  });
  if (verifyError) throw verifyError;
  return data.session.access_token;
}
async function call(token, action, extra = {}) {
  const response = await fetch(`${url}/functions/v1/sql-study-case`, {
    method: "POST",
    headers: {
      apikey: anonKey,
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({ action, ...extra }),
  });
  const body = await response.json();
  if (!response.ok || body.error)
    throw new Error(`${action}: ${body.error || response.status}`);
  return body;
}

let runId;
try {
  const { data: authUsers, error: userError } =
    await service.auth.admin.listUsers({ perPage: 1000 });
  if (userError) throw userError;
  const adminUser = authUsers.users.find(
    (item) => item.email === "superadmin@npm.app",
  );
  const { data: profiles, error: profileError } = await service
    .from("profiles")
    .select("id,name,class")
    .eq("class", "4KS-TEST")
    .eq("is_admin", false)
    .order("name");
  if (profileError) throw profileError;
  if (!adminUser || profiles.length !== 5)
    throw new Error("Test accounts are incomplete.");
  const emailById = new Map(
    authUsers.users.map((item) => [item.id, item.email]),
  );
  const adminToken = await tokenFor(adminUser.email);
  const students = [];
  for (const profile of profiles)
    students.push({
      profile,
      token: await tokenFor(emailById.get(profile.id)),
    });

  const databaseResponse = await fetch(`${url}/functions/v1/mysql-console`, {
    method: "POST",
    headers: {
      apikey: anonKey,
      authorization: `Bearer ${students[0].token}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      action: "query",
      database: "audit_incident_lab",
      sql: "SELECT COUNT(*) AS total_users FROM users",
    }),
  });
  const databaseResult = await databaseResponse.json();
  if (!databaseResponse.ok || databaseResult.rows?.[0]?.total_users !== 30)
    throw new Error(
      `Student database access failed: ${databaseResult.error || databaseResponse.status}`,
    );

  runId = (
    await call(adminToken, "admin_create_run", {
      class: "4KS-TEST",
      checkin_code: "CASE-TEST-ONLY",
    })
  ).id;
  await call(adminToken, "admin_open_checkin", { class: "4KS-TEST" });
  for (const student of students)
    await call(student.token, "checkin", { code: "CASE-TEST-ONLY" });
  let state = await call(adminToken, "get_state", { class: "4KS-TEST" });
  if (state.monitor.filter((item) => item.checked_in).length !== 5)
    throw new Error("Check-in monitor mismatch.");

  await call(adminToken, "admin_start_phase", { class: "4KS-TEST", phase: 1 });
  const phase1 = await call(students[0].token, "get_state");
  const correctDisplayIndex = phase1.questions[0].options.findIndex(
    (option) =>
      option === "SELECT * FROM users WHERE account_status = 'ACTIVE';",
  );
  await call(students[0].token, "submit_answer", {
    question_id: phase1.questions[0].id,
    answer_index: correctDisplayIndex,
  });
  await call(students[0].token, "submit_phase");
  await service
    .from("sql_case_runs")
    .update({ stage_deadline: new Date(Date.now() - 1000).toISOString() })
    .eq("id", runId);
  state = await call(adminToken, "get_state", { class: "4KS-TEST" });
  const { data: phase1Submissions } = await service
    .from("sql_case_phase_submissions")
    .select("user_id,auto_submitted,correct_count,accuracy_score,speed_score")
    .eq("run_id", runId)
    .eq("phase", 1);
  if (
    state.run.status !== "phase1_results" ||
    phase1Submissions.length !== 5 ||
    phase1Submissions.filter((item) => item.auto_submitted).length !== 4
  )
    throw new Error("Timeout auto-submit failed.");
  const manualSubmission = phase1Submissions.find(
    (item) => item.user_id === students[0].profile.id,
  );
  if (
    manualSubmission.correct_count !== 1 ||
    Number(manualSubmission.accuracy_score) !== 8 ||
    Number(manualSubmission.speed_score) <= 0
  )
    throw new Error("Shuffled-answer scoring failed.");

  await call(adminToken, "admin_start_phase", { class: "4KS-TEST", phase: 2 });
  for (const student of students) await call(student.token, "submit_phase");
  state = await call(adminToken, "get_state", { class: "4KS-TEST" });
  if (state.run.status !== "phase2_results")
    throw new Error("All-submitted transition failed.");

  await call(adminToken, "admin_start_phase", { class: "4KS-TEST", phase: 3 });
  for (const student of students) await call(student.token, "submit_phase");
  state = await call(adminToken, "get_state", { class: "4KS-TEST" });
  const sizes = state.groups
    .map((group) => group.members.length)
    .sort((a, b) => b - a);
  if (state.run.status !== "groups_ready" || JSON.stringify(sizes) !== "[3,2]")
    throw new Error("Balanced group generation failed.");

  await call(adminToken, "admin_start_audit", { class: "4KS-TEST" });
  const own = await call(students[0].token, "get_state");
  const ownGroup = own.my_group_id;
  const firstRow = own.worksheets[0].rows[0];
  await call(students[0].token, "save_worksheet", {
    group_id: ownGroup,
    procedure_id: firstRow.procedure_id,
    query_text: "SELECT COUNT(*) AS total_users FROM users;",
    conclusion: "Temporary integration test.",
  });
  const group = own.groups.find((item) => item.id === ownGroup);
  const teammateId = group.members.find(
    (member) => member.user_id !== students[0].profile.id,
  )?.user_id;
  if (teammateId) {
    const teammate = students.find(
      (student) => student.profile.id === teammateId,
    );
    const teammateState = await call(teammate.token, "get_state");
    if (!teammateState.worksheets[0].rows[0].query_text.includes("COUNT"))
      throw new Error("Shared worksheet is not visible to teammates.");
  }
  const outsider = students.find(
    (student) =>
      !group.members.some((member) => member.user_id === student.profile.id),
  );
  let crossGroupBlocked = false;
  try {
    await call(outsider.token, "save_worksheet", {
      group_id: ownGroup,
      procedure_id: firstRow.procedure_id,
      query_text: "SELECT 1",
      conclusion: "Unauthorized",
    });
  } catch {
    crossGroupBlocked = true;
  }
  if (!crossGroupBlocked) throw new Error("Cross-group write was not blocked.");
  await call(adminToken, "admin_finish_audit", { class: "4KS-TEST" });
  console.log(
    JSON.stringify({
      student_database_access: true,
      checkin: 5,
      timeout_auto_submitted: 4,
      all_submit_transition: true,
      groups: sizes,
      shared_workpaper: true,
      cross_group_blocked: true,
      final_status: "finished",
    }),
  );
} finally {
  if (runId) await service.from("sql_case_runs").delete().eq("id", runId);
}
