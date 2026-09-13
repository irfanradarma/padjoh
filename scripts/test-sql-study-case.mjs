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
async function passwordToken(email, password) {
  const client = createClient(url, anonKey, {
    auth: { persistSession: false },
  });
  const { data, error } = await client.auth.signInWithPassword({
    email,
    password,
  });
  if (error) throw error;
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

const TEST_CLASS = `SQL-E2E-${Date.now()}`;
const createdUserIds = [];
let runId;
try {
  const { data: authUsers, error: userError } =
    await service.auth.admin.listUsers({ perPage: 1000 });
  if (userError) throw userError;
  const adminUser = authUsers.users.find(
    (item) => item.email === "superadmin@npm.app",
  );
  if (!adminUser) throw new Error("The admin test account is unavailable.");
  const adminToken = await tokenFor(adminUser.email);
  const students = [];
  for (let index = 0; index < 5; index += 1) {
    const email = `sql-e2e-${Date.now()}-${index}@npm.app`;
    const password = `Test-${crypto.randomUUID()}!`;
    const { data: created, error: createError } =
      await service.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      });
    if (createError) throw createError;
    createdUserIds.push(created.user.id);
    const profile = {
      id: created.user.id,
      npm: `E2E-${Date.now()}-${index + 1}`,
      name: `E2E Student ${index + 1}`,
      class: TEST_CLASS,
      is_admin: false,
    };
    const { error: profileError } = await service
      .from("profiles")
      .update(profile)
      .eq("id", profile.id);
    if (profileError) throw profileError;
    students.push({
      profile,
      token: await passwordToken(email, password),
    });
  }

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
      class: TEST_CLASS,
      checkin_code: "CASE-TEST-ONLY",
    })
  ).id;
  await call(adminToken, "admin_open_checkin", { class: TEST_CLASS });
  for (const student of students)
    await call(student.token, "checkin", { code: "CASE-TEST-ONLY" });
  let state = await call(adminToken, "get_state", { class: TEST_CLASS });
  if (state.monitor.filter((item) => item.checked_in).length !== 5)
    throw new Error("Check-in monitor mismatch.");

  await call(adminToken, "admin_start_phase", { class: TEST_CLASS, phase: 1 });
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
  state = await call(adminToken, "get_state", { class: TEST_CLASS });
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

  await call(adminToken, "admin_start_phase", { class: TEST_CLASS, phase: 2 });
  for (const student of students) await call(student.token, "submit_phase");
  state = await call(adminToken, "get_state", { class: TEST_CLASS });
  if (state.run.status !== "phase2_results")
    throw new Error("All-submitted transition failed.");

  await call(adminToken, "admin_start_phase", { class: TEST_CLASS, phase: 3 });
  for (const student of students) await call(student.token, "submit_phase");
  state = await call(adminToken, "get_state", { class: TEST_CLASS });
  const sizes = state.groups
    .map((group) => group.members.length)
    .sort((a, b) => b - a);
  if (state.run.status !== "groups_ready" || JSON.stringify(sizes) !== "[3,2]")
    throw new Error("Balanced group generation failed.");

  await call(adminToken, "admin_start_audit", { class: TEST_CLASS });
  state = await call(adminToken, "get_state", { class: TEST_CLASS });
  const studentById = new Map(
    students.map((student) => [student.profile.id, student]),
  );
  const ownGroup = state.groups.find((group) =>
    group.members.some((member) => member.user_id === students[0].profile.id),
  );
  for (const group of state.groups) {
    const groupWorksheet = state.worksheets.find(
      (worksheet) => worksheet.group_id === group.id,
    );
    for (let index = 0; index < groupWorksheet.rows.length; index += 1) {
      const member =
        group.id === ownGroup.id && index === 0
          ? group.members.find(
              (item) => item.user_id === students[0].profile.id,
            )
          : group.members[index % group.members.length];
      await call(studentById.get(member.user_id).token, "claim_procedure", {
        procedure_id: groupWorksheet.rows[index].procedure_id,
      });
    }
  }

  let own = await call(students[0].token, "get_state");
  const ownWorksheet = own.worksheets[0];
  if (!ownWorksheet.allocation_complete)
    throw new Error("Procedure allocation did not unlock the workspace.");
  const firstRow = ownWorksheet.rows[0];
  if ("validation_sql" in firstRow)
    throw new Error("The hidden validation query leaked to the client.");
  const answerQuery =
    "SELECT DATE(captured_at) AS activity_date, COUNT(*) AS traffic_events, " +
    "ROUND(AVG(bytes_sent), 0) AS avg_bytes_sent, " +
    "SUM(bytes_sent) AS total_bytes_sent FROM network_traffic " +
    "GROUP BY DATE(captured_at) ORDER BY activity_date";
  await call(students[0].token, "save_worksheet", {
    group_id: ownGroup.id,
    procedure_id: firstRow.procedure_id,
    query_text: answerQuery,
    conclusion: "Traffic harian telah dianalisis.",
  });

  const teammateId = ownGroup.members.find(
    (member) => member.user_id !== students[0].profile.id,
  )?.user_id;
  if (teammateId) {
    const teammateState = await call(
      studentById.get(teammateId).token,
      "get_state",
    );
    const privateRow = teammateState.worksheets[0].rows[0];
    if ("query_text" in privateRow || "conclusion" in privateRow)
      throw new Error("An assignee's workpaper leaked to a teammate.");
  }

  const submission = await call(students[0].token, "submit_worksheet", {
    group_id: ownGroup.id,
    procedure_id: firstRow.procedure_id,
    query_text: answerQuery,
    conclusion: "Traffic harian telah dianalisis.",
  });
  if (!submission.validation?.passed)
    throw new Error("A correct SQL result did not pass automatic grading.");
  await call(adminToken, "admin_review_worksheet", {
    class: TEST_CLASS,
    group_id: ownGroup.id,
    procedure_id: firstRow.procedure_id,
    approved: true,
    feedback: "Kesimpulan diterima.",
  });
  own = await call(students[0].token, "get_state");
  if (own.worksheets[0].rows[0].status !== "completed")
    throw new Error("Admin conclusion review was not applied.");

  const outsider = students.find(
    (student) =>
      !ownGroup.members.some((member) => member.user_id === student.profile.id),
  );
  let crossGroupBlocked = false;
  try {
    await call(outsider.token, "save_worksheet", {
      group_id: ownGroup.id,
      procedure_id: firstRow.procedure_id,
      query_text: "SELECT 1",
      conclusion: "Unauthorized",
    });
  } catch {
    crossGroupBlocked = true;
  }
  if (!crossGroupBlocked) throw new Error("Cross-group write was not blocked.");
  await call(adminToken, "admin_finish_audit", { class: TEST_CLASS });
  console.log(
    JSON.stringify({
      student_database_access: true,
      checkin: 5,
      timeout_auto_submitted: 4,
      all_submit_transition: true,
      groups: sizes,
      owned_workpapers: true,
      automatic_query_grading: true,
      admin_conclusion_review: true,
      cross_group_blocked: true,
      final_status: "finished",
    }),
  );
} finally {
  if (runId) await service.from("sql_case_runs").delete().eq("id", runId);
  for (const userId of createdUserIds)
    await service.auth.admin.deleteUser(userId).catch(() => undefined);
}
