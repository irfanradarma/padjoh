import { createClient } from "npm:@supabase/supabase-js@2";

const headers = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization,x-client-info,apikey,content-type",
  "Content-Type": "application/json",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers });
const phaseWeights = [0, 0.3, 0.3, 0.4];

async function digest(value: string) {
  const bytes = new TextEncoder().encode(value.trim());
  const result = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(result)]
    .map((x) => x.toString(16).padStart(2, "0"))
    .join("");
}

function activePhase(status: string) {
  const match = /^phase([123])_active$/.exec(status);
  return match ? Number(match[1]) : 0;
}

function completedPhase(status: string) {
  if (["phase1_results", "phase2_active"].includes(status)) return 1;
  if (["phase2_results", "phase3_active"].includes(status)) return 2;
  if (
    ["phase3_results", "groups_ready", "audit_active", "finished"].includes(
      status,
    )
  )
    return 3;
  return 0;
}

function optionRotation(userId: string, questionId: number) {
  return (
    [...`${userId}:${questionId}`].reduce(
      (sum, value) => sum + value.charCodeAt(0),
      0,
    ) % 4
  );
}

async function finalizeStudent(
  sb: any,
  run: any,
  userId: string,
  phase: number,
  automatic: boolean,
) {
  const { data: existing } = await sb
    .from("sql_case_phase_submissions")
    .select("user_id")
    .eq("run_id", run.id)
    .eq("user_id", userId)
    .eq("phase", phase)
    .maybeSingle();
  if (existing) return;

  const [
    { data: questions, error: questionError },
    { data: answers, error: answerError },
  ] = await Promise.all([
    sb.from("sql_case_questions").select("id,correct_index").eq("phase", phase),
    sb
      .from("sql_case_answers")
      .select("question_id,answer_index")
      .eq("run_id", run.id)
      .eq("user_id", userId)
      .eq("phase", phase),
  ]);
  if (questionError) throw questionError;
  if (answerError) throw answerError;
  const answerMap = new Map(
    (answers || []).map((item: any) => [
      Number(item.question_id),
      item.answer_index,
    ]),
  );
  const correct = (questions || []).filter(
    (q: any) => answerMap.get(Number(q.id)) === q.correct_index,
  ).length;
  const count = questions?.length || 1;
  const now = new Date();
  const started = new Date(run.stage_started_at).getTime();
  const elapsed = automatic
    ? run.phase_duration_seconds
    : Math.max(
        0,
        Math.min(
          run.phase_duration_seconds,
          Math.round((now.getTime() - started) / 1000),
        ),
      );
  const ratio = correct / count;
  const remainingRatio = Math.max(
    0,
    (run.phase_duration_seconds - elapsed) / run.phase_duration_seconds,
  );
  const accuracy = 80 * ratio;
  const speed = 20 * ratio * remainingRatio;
  const { error } = await sb.from("sql_case_phase_submissions").insert({
    run_id: run.id,
    user_id: userId,
    phase,
    submitted_at:
      automatic && run.stage_deadline ? run.stage_deadline : now.toISOString(),
    auto_submitted: automatic,
    elapsed_seconds: elapsed,
    correct_count: correct,
    question_count: count,
    accuracy_score: accuracy,
    speed_score: speed,
    total_score: accuracy + speed,
  });
  if (error) throw error;
}

async function leaderboard(
  sb: any,
  runId: string,
  throughPhase: number,
  admin: boolean,
) {
  if (!throughPhase) return [];
  const [{ data: participants }, { data: submissions }] = await Promise.all([
    sb.from("sql_case_participants").select("user_id").eq("run_id", runId),
    sb
      .from("sql_case_phase_submissions")
      .select("*")
      .eq("run_id", runId)
      .lte("phase", throughPhase),
  ]);
  const ids = (participants || []).map((x: any) => x.user_id);
  const { data: profiles } = ids.length
    ? await sb.from("profiles").select("id,npm,name,class").in("id", ids)
    : { data: [] };
  const divisor = phaseWeights
    .slice(1, throughPhase + 1)
    .reduce((sum, value) => sum + value, 0);
  const rows = (profiles || []).map((profile: any) => {
    const mine = (submissions || []).filter(
      (x: any) => x.user_id === profile.id,
    );
    const weighted = (field: string) =>
      mine.reduce(
        (sum: number, item: any) =>
          sum + Number(item[field]) * phaseWeights[item.phase],
        0,
      ) / divisor;
    return {
      user_id: profile.id,
      name: profile.name,
      npm: admin
        ? profile.npm
        : `${String(profile.npm || "").slice(0, 4)}****${String(profile.npm || "").slice(-2)}`,
      class: profile.class,
      accuracy: weighted("accuracy_score"),
      speed: weighted("speed_score"),
      total: weighted("total_score"),
      elapsed: mine.reduce(
        (sum: number, item: any) => sum + Number(item.elapsed_seconds),
        0,
      ),
      phases_submitted: mine.length,
    };
  });
  rows.sort(
    (a: any, b: any) =>
      b.total - a.total ||
      a.elapsed - b.elapsed ||
      String(a.name).localeCompare(String(b.name)),
  );
  return rows.map((row: any, index: number) => ({ ...row, rank: index + 1 }));
}

async function generateGroups(sb: any, run: any) {
  const existing = await sb
    .from("sql_case_groups")
    .select("id")
    .eq("run_id", run.id)
    .limit(1);
  if (existing.data?.length) {
    if (run.status === "phase3_results")
      await sb
        .from("sql_case_runs")
        .update({
          status: "groups_ready",
          updated_at: new Date().toISOString(),
        })
        .eq("id", run.id);
    return;
  }
  const scores = await leaderboard(sb, run.id, 3, true);
  if (!scores.length) return;
  const groupCount = Math.max(1, Math.round(scores.length / 3));
  const baseSize = Math.floor(scores.length / groupCount);
  const remainder = scores.length % groupCount;
  const buckets = Array.from({ length: groupCount }, (_, index) => ({
    number: index + 1,
    capacity: baseSize + (index < remainder ? 1 : 0),
    total: 0,
    members: [] as any[],
  }));
  for (const student of scores) {
    const available = buckets.filter(
      (bucket) => bucket.members.length < bucket.capacity,
    );
    available.sort(
      (a, b) =>
        a.total - b.total ||
        a.members.length - b.members.length ||
        a.number - b.number,
    );
    available[0].members.push(student);
    available[0].total += student.total;
  }
  for (const bucket of buckets) {
    const { data: group, error } = await sb
      .from("sql_case_groups")
      .insert({
        run_id: run.id,
        group_number: bucket.number,
        total_qualification_score: bucket.total,
      })
      .select("id")
      .single();
    if (error) throw error;
    const { error: memberError } = await sb
      .from("sql_case_group_members")
      .insert(
        bucket.members.map((student) => ({
          group_id: group.id,
          user_id: student.user_id,
          qualification_score: student.total,
        })),
      );
    if (memberError) throw memberError;
  }
  await sb
    .from("sql_case_runs")
    .update({ status: "groups_ready", updated_at: new Date().toISOString() })
    .eq("id", run.id);
}

async function finalizeRunStage(sb: any, run: any) {
  const phase = activePhase(run.status);
  if (!phase) return run;
  const [{ data: participants }, { data: submissions }] = await Promise.all([
    sb.from("sql_case_participants").select("user_id").eq("run_id", run.id),
    sb
      .from("sql_case_phase_submissions")
      .select("user_id")
      .eq("run_id", run.id)
      .eq("phase", phase),
  ]);
  const submitted = new Set((submissions || []).map((x: any) => x.user_id));
  const expired =
    run.stage_deadline && new Date(run.stage_deadline).getTime() <= Date.now();
  if (expired) {
    for (const participant of participants || []) {
      if (!submitted.has(participant.user_id))
        await finalizeStudent(sb, run, participant.user_id, phase, true);
    }
  }
  const { count } = await sb
    .from("sql_case_phase_submissions")
    .select("user_id", { count: "exact", head: true })
    .eq("run_id", run.id)
    .eq("phase", phase);
  if ((participants?.length || 0) > 0 && count === participants.length) {
    const nextStatus = `phase${phase}_results`;
    await sb
      .from("sql_case_runs")
      .update({
        status: nextStatus,
        stage_deadline: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", run.id);
    run = { ...run, status: nextStatus, stage_deadline: null };
    if (phase === 3) {
      await generateGroups(sb, run);
      run = { ...run, status: "groups_ready" };
    }
  }
  return run;
}

async function groupPayload(
  sb: any,
  runId: string,
  userId: string,
  admin: boolean,
) {
  const { data: groups } = await sb
    .from("sql_case_groups")
    .select("*")
    .eq("run_id", runId)
    .order("group_number");
  if (!groups?.length) return { groups: [], my_group_id: null, worksheets: [] };
  const groupIds = groups.map((g: any) => g.id);
  const { data: members } = await sb
    .from("sql_case_group_members")
    .select("*")
    .in("group_id", groupIds);
  const userIds = [...new Set((members || []).map((m: any) => m.user_id))];
  const { data: profiles } = userIds.length
    ? await sb.from("profiles").select("id,npm,name,class").in("id", userIds)
    : { data: [] };
  const profileMap = new Map((profiles || []).map((p: any) => [p.id, p]));
  const enriched = groups.map((group: any) => ({
    ...group,
    members: (members || [])
      .filter((m: any) => m.group_id === group.id)
      .map((m: any) => ({ ...m, ...profileMap.get(m.user_id) })),
  }));
  const mine =
    (members || []).find((m: any) => m.user_id === userId)?.group_id || null;
  const worksheetGroupIds = admin ? groupIds : mine ? [mine] : [];
  const [{ data: procedures }, { data: worksheetRows }] = await Promise.all([
    sb.from("sql_case_audit_procedures").select("*").order("order_num"),
    worksheetGroupIds.length
      ? sb
          .from("sql_case_worksheets")
          .select("*")
          .in("group_id", worksheetGroupIds)
      : Promise.resolve({ data: [] }),
  ]);
  const worksheets = worksheetGroupIds.map((groupId: string) => ({
    group_id: groupId,
    rows: (procedures || []).map((procedure: any) => ({
      ...procedure,
      ...(worksheetRows || []).find(
        (row: any) =>
          row.group_id === groupId &&
          Number(row.procedure_id) === Number(procedure.id),
      ),
      procedure_id: procedure.id,
    })),
  }));
  return { groups: enriched, my_group_id: mine, worksheets };
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers });
  try {
    const token = (request.headers.get("Authorization") || "").replace(
      /^Bearer\s+/i,
      "",
    );
    if (!token) return json({ error: "Sign in required." }, 401);
    const sb = createClient(
      Deno.env.get("SUPABASE_URL") || "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "",
      { auth: { persistSession: false, autoRefreshToken: false } },
    );
    const {
      data: { user },
    } = await sb.auth.getUser(token);
    if (!user) return json({ error: "Invalid session." }, 401);
    const { data: profile, error: profileError } = await sb
      .from("profiles")
      .select("id,npm,name,class,is_admin")
      .eq("id", user.id)
      .single();
    if (profileError) throw profileError;
    const admin = Boolean(profile.is_admin);
    const body = await request.json();
    const action = body.action;

    if (action === "classes") {
      if (!admin) return json({ error: "Admin only." }, 403);
      const { data } = await sb
        .from("profiles")
        .select("class")
        .eq("is_admin", false)
        .neq("class", "(none)");
      const counts = new Map<string, number>();
      for (const item of data || [])
        counts.set(item.class, (counts.get(item.class) || 0) + 1);
      return json({
        classes: [...counts]
          .map(([name, count]) => ({ name, count }))
          .sort((a, b) => a.name.localeCompare(b.name)),
      });
    }

    if (action === "admin_create_run") {
      if (!admin) return json({ error: "Admin only." }, 403);
      const targetClass = String(body.class || "").trim();
      const code = String(body.checkin_code || "").trim();
      if (!targetClass || code.length < 4)
        return json(
          {
            error:
              "Class and a check-in code of at least 4 characters are required.",
          },
          400,
        );
      const { data: existing } = await sb
        .from("sql_case_runs")
        .select("id")
        .eq("class", targetClass)
        .neq("status", "finished")
        .limit(1);
      if (existing?.length)
        return json(
          { error: "This class already has an unfinished activity." },
          409,
        );
      const { data: run, error } = await sb
        .from("sql_case_runs")
        .insert({
          class: targetClass,
          checkin_code_hash: await digest(code),
          created_by: user.id,
        })
        .select("id")
        .single();
      if (error) throw error;
      return json({ id: run.id });
    }

    const targetClass = admin ? String(body.class || "").trim() : profile.class;
    let runQuery = sb
      .from("sql_case_runs")
      .select("*")
      .eq("class", targetClass)
      .order("created_at", { ascending: false })
      .limit(1);
    const { data: runRows, error: runError } = await runQuery;
    if (runError) throw runError;
    let run = runRows?.[0] || null;

    if (action === "get_state") {
      if (!run || (!admin && run.status === "hidden"))
        return json({ visible: false, class: targetClass });
      run = await finalizeRunStage(sb, run);
      const throughPhase = completedPhase(run.status);
      const { data: participant } = await sb
        .from("sql_case_participants")
        .select("checked_in_at")
        .eq("run_id", run.id)
        .eq("user_id", user.id)
        .maybeSingle();
      const payload: any = {
        visible: true,
        run: {
          id: run.id,
          class: run.class,
          title: run.title,
          status: run.status,
          phase_duration_seconds: run.phase_duration_seconds,
          stage_started_at: run.stage_started_at,
          stage_deadline: run.stage_deadline,
        },
        participant: participant || null,
        leaderboard: throughPhase
          ? await leaderboard(sb, run.id, throughPhase, admin)
          : [],
      };
      const phase = activePhase(run.status);
      if (phase && (admin || participant)) {
        if (!admin) {
          const [{ data: questions }, { data: answers }, { data: submission }] =
            await Promise.all([
              sb
                .from("sql_case_questions")
                .select("id,phase,order_num,prompt,options")
                .eq("phase", phase)
                .order("order_num"),
              sb
                .from("sql_case_answers")
                .select("question_id,answer_index")
                .eq("run_id", run.id)
                .eq("user_id", user.id)
                .eq("phase", phase),
              sb
                .from("sql_case_phase_submissions")
                .select("*")
                .eq("run_id", run.id)
                .eq("user_id", user.id)
                .eq("phase", phase)
                .maybeSingle(),
            ]);
          payload.questions = (questions || []).map((question: any) => {
            const rotation = optionRotation(user.id, Number(question.id));
            return {
              ...question,
              options: [
                ...question.options.slice(rotation),
                ...question.options.slice(0, rotation),
              ],
            };
          });
          payload.answers = (answers || []).map((answer: any) => {
            const rotation = optionRotation(
              user.id,
              Number(answer.question_id),
            );
            return {
              ...answer,
              answer_index: (answer.answer_index - rotation + 4) % 4,
            };
          });
          payload.my_submission = submission || null;
        }
      }
      if (admin) {
        const { data: classProfiles } = await sb
          .from("profiles")
          .select("id,npm,name,class")
          .eq("class", targetClass)
          .eq("is_admin", false)
          .order("name");
        const [
          { data: participants },
          { data: answers },
          { data: submissions },
        ] = await Promise.all([
          sb.from("sql_case_participants").select("*").eq("run_id", run.id),
          phase
            ? sb
                .from("sql_case_answers")
                .select("user_id")
                .eq("run_id", run.id)
                .eq("phase", phase)
            : Promise.resolve({ data: [] }),
          phase
            ? sb
                .from("sql_case_phase_submissions")
                .select("user_id,auto_submitted,submitted_at")
                .eq("run_id", run.id)
                .eq("phase", phase)
            : Promise.resolve({ data: [] }),
        ]);
        payload.monitor = (classProfiles || []).map((student: any) => ({
          ...student,
          checked_in: Boolean(
            (participants || []).find((x: any) => x.user_id === student.id),
          ),
          answered: (answers || []).filter((x: any) => x.user_id === student.id)
            .length,
          submission:
            (submissions || []).find((x: any) => x.user_id === student.id) ||
            null,
        }));
        payload.question_count = phase
          ? ({ 1: 10, 2: 5, 3: 5 } as any)[phase]
          : 0;
      }
      if (["groups_ready", "audit_active", "finished"].includes(run.status))
        Object.assign(payload, await groupPayload(sb, run.id, user.id, admin));
      return json(payload);
    }

    if (!run) return json({ error: "No activity exists for this class." }, 404);

    if (action === "checkin") {
      if (admin || run.status !== "checkin")
        return json({ error: "Check-in is not open." }, 400);
      if ((await digest(String(body.code || ""))) !== run.checkin_code_hash)
        return json({ error: "Incorrect check-in code." }, 403);
      const { error } = await sb
        .from("sql_case_participants")
        .upsert({ run_id: run.id, user_id: user.id });
      if (error) throw error;
      return json({ ok: true });
    }

    if (action === "submit_answer") {
      const phase = activePhase(run.status);
      run = await finalizeRunStage(sb, run);
      if (!phase || activePhase(run.status) !== phase)
        return json({ error: "This phase is no longer active." }, 409);
      const { data: participant } = await sb
        .from("sql_case_participants")
        .select("user_id")
        .eq("run_id", run.id)
        .eq("user_id", user.id)
        .maybeSingle();
      if (!participant)
        return json({ error: "You did not check in for this activity." }, 403);
      const { data: submitted } = await sb
        .from("sql_case_phase_submissions")
        .select("user_id")
        .eq("run_id", run.id)
        .eq("user_id", user.id)
        .eq("phase", phase)
        .maybeSingle();
      if (submitted)
        return json({ error: "Your phase has already been submitted." }, 409);
      const { data: question } = await sb
        .from("sql_case_questions")
        .select("id")
        .eq("id", Number(body.question_id))
        .eq("phase", phase)
        .maybeSingle();
      const displayIndex = Number(body.answer_index);
      if (
        !question ||
        !Number.isInteger(displayIndex) ||
        displayIndex < 0 ||
        displayIndex > 3
      )
        return json({ error: "Invalid answer." }, 400);
      const answerIndex =
        (displayIndex + optionRotation(user.id, Number(question.id))) % 4;
      const { error } = await sb.from("sql_case_answers").upsert({
        run_id: run.id,
        user_id: user.id,
        phase,
        question_id: question.id,
        answer_index: answerIndex,
        answered_at: new Date().toISOString(),
      });
      if (error) throw error;
      return json({ ok: true });
    }

    if (action === "submit_phase") {
      const phase = activePhase(run.status);
      run = await finalizeRunStage(sb, run);
      if (!phase || activePhase(run.status) !== phase)
        return json({ ok: true, completed: true });
      await finalizeStudent(sb, run, user.id, phase, false);
      run = await finalizeRunStage(sb, run);
      return json({ ok: true, completed: !activePhase(run.status) });
    }

    if (action === "save_worksheet") {
      if (run.status !== "audit_active")
        return json({ error: "The audit phase is not active." }, 409);
      const groupId = String(body.group_id || "");
      if (!admin) {
        const { data: membership } = await sb
          .from("sql_case_group_members")
          .select("user_id")
          .eq("group_id", groupId)
          .eq("user_id", user.id)
          .maybeSingle();
        if (!membership)
          return json(
            { error: "This worksheet belongs to another group." },
            403,
          );
      }
      const queryText = String(body.query_text || "");
      const conclusion = String(body.conclusion || "");
      if (queryText.length > 20000 || conclusion.length > 5000)
        return json({ error: "Worksheet content is too long." }, 400);
      const { error } = await sb.from("sql_case_worksheets").upsert({
        group_id: groupId,
        procedure_id: Number(body.procedure_id),
        query_text: queryText,
        conclusion,
        updated_by: user.id,
        updated_at: new Date().toISOString(),
      });
      if (error) throw error;
      return json({ ok: true, updated_at: new Date().toISOString() });
    }

    if (!admin) return json({ error: "Admin only." }, 403);

    if (action === "admin_open_checkin") {
      if (run.status !== "hidden")
        return json({ error: "Activity has already been opened." }, 409);
      await sb
        .from("sql_case_runs")
        .update({ status: "checkin", updated_at: new Date().toISOString() })
        .eq("id", run.id);
      return json({ ok: true });
    }

    if (action === "admin_start_phase") {
      const phase = Number(body.phase);
      const expected = phase === 1 ? "checkin" : `phase${phase - 1}_results`;
      if (run.status !== expected)
        return json(
          { error: `Phase ${phase} cannot start from the current stage.` },
          409,
        );
      const { count } = await sb
        .from("sql_case_participants")
        .select("user_id", { count: "exact", head: true })
        .eq("run_id", run.id);
      if (!count)
        return json({ error: "At least one student must check in." }, 400);
      const started = new Date();
      const deadline = new Date(started.getTime() + 300000);
      await sb
        .from("sql_case_runs")
        .update({
          status: `phase${phase}_active`,
          stage_started_at: started.toISOString(),
          stage_deadline: deadline.toISOString(),
          updated_at: started.toISOString(),
        })
        .eq("id", run.id);
      return json({ ok: true, deadline: deadline.toISOString() });
    }

    if (action === "admin_finish_phase") {
      const phase = activePhase(run.status);
      if (!phase)
        return json({ error: "No qualification phase is active." }, 409);
      const { data: participants } = await sb
        .from("sql_case_participants")
        .select("user_id")
        .eq("run_id", run.id);
      for (const participant of participants || [])
        await finalizeStudent(sb, run, participant.user_id, phase, true);
      run.stage_deadline = new Date().toISOString();
      await finalizeRunStage(sb, run);
      return json({ ok: true });
    }

    if (action === "admin_move_member") {
      if (run.status !== "groups_ready")
        return json(
          { error: "Groups can only be edited before the audit starts." },
          409,
        );
      const userId = String(body.user_id || "");
      const targetGroupId = String(body.target_group_id || "");
      const { data: target } = await sb
        .from("sql_case_groups")
        .select("id")
        .eq("id", targetGroupId)
        .eq("run_id", run.id)
        .maybeSingle();
      if (!target) return json({ error: "Invalid target group." }, 400);
      const { data: runGroups } = await sb
        .from("sql_case_groups")
        .select("id")
        .eq("run_id", run.id);
      const { data: old } = await sb
        .from("sql_case_group_members")
        .select("group_id,qualification_score")
        .eq("user_id", userId)
        .in(
          "group_id",
          (runGroups || []).map((x: any) => x.id),
        )
        .single();
      await sb
        .from("sql_case_group_members")
        .delete()
        .eq("group_id", old.group_id)
        .eq("user_id", userId);
      await sb.from("sql_case_group_members").insert({
        group_id: targetGroupId,
        user_id: userId,
        qualification_score: old.qualification_score,
      });
      const { data: groups } = await sb
        .from("sql_case_groups")
        .select("id")
        .eq("run_id", run.id);
      for (const group of groups || []) {
        const { data: members } = await sb
          .from("sql_case_group_members")
          .select("qualification_score")
          .eq("group_id", group.id);
        const total = (members || []).reduce(
          (sum: number, member: any) =>
            sum + Number(member.qualification_score),
          0,
        );
        await sb
          .from("sql_case_groups")
          .update({ total_qualification_score: total })
          .eq("id", group.id);
      }
      return json({ ok: true });
    }

    if (action === "admin_start_audit") {
      if (run.status !== "groups_ready")
        return json({ error: "Groups must be ready first." }, 409);
      const [{ data: groups }, { data: procedures }] = await Promise.all([
        sb.from("sql_case_groups").select("id").eq("run_id", run.id),
        sb.from("sql_case_audit_procedures").select("id"),
      ]);
      const rows = (groups || []).flatMap((group: any) =>
        (procedures || []).map((procedure: any) => ({
          group_id: group.id,
          procedure_id: procedure.id,
        })),
      );
      if (rows.length)
        await sb.from("sql_case_worksheets").upsert(rows, {
          onConflict: "group_id,procedure_id",
          ignoreDuplicates: true,
        });
      await sb
        .from("sql_case_runs")
        .update({
          status: "audit_active",
          stage_started_at: new Date().toISOString(),
          stage_deadline: null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", run.id);
      return json({ ok: true });
    }

    if (action === "admin_finish_audit") {
      if (run.status !== "audit_active")
        return json({ error: "Audit phase is not active." }, 409);
      await sb
        .from("sql_case_runs")
        .update({ status: "finished", updated_at: new Date().toISOString() })
        .eq("id", run.id);
      return json({ ok: true });
    }

    return json({ error: "Unknown action." }, 400);
  } catch (error) {
    const value = error as any;
    return json(
      {
        error: value?.message || value?.details || String(error),
        code: value?.code,
      },
      500,
    );
  }
});
