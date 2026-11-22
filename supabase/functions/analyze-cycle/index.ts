import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ── 환경변수 ──────────────────────────────────────────
const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const claudeApiKey = Deno.env.get("ANTHROPIC_API_KEY")!;

// ── CORS ─────────────────────────────────────────────
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ── 응답 헬퍼 ────────────────────────────────────────
const errorRes = (message: string, status: number) =>
  new Response(JSON.stringify({ error: message }), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const okRes = (body: unknown) =>
  new Response(JSON.stringify(body), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

// ── 사이클 계절 구간 계산 ─────────────────────────────
function calcSeasons(startDate: string, endDate: string, cycleLength: number) {
  const start = new Date(startDate);
  const end = new Date(endDate);
  const fmt = (d: Date) => `${d.getMonth() + 1}/${d.getDate()}`;
  const addDay = (d: Date, n: number) => {
    const r = new Date(d); r.setDate(r.getDate() + n); return r;
  };
  const springEnd = addDay(start, Math.round(cycleLength * 0.4));
  const summerEnd = addDay(start, Math.round(cycleLength * 0.55));
  const fallEnd   = addDay(start, cycleLength - 1);
  return {
    winter: `${fmt(start)} ~ ${fmt(end)} (생리기)`,
    spring: `${fmt(addDay(end, 1))} ~ ${fmt(springEnd)} (여포기)`,
    summer: `${fmt(addDay(springEnd, 1))} ~ ${fmt(summerEnd)} (배란기)`,
    fall:   `${fmt(addDay(summerEnd, 1))} ~ ${fmt(fallEnd)} (황체기)`,
  };
}

// ── 메인 ─────────────────────────────────────────────
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return errorRes("Method not allowed", 405);

  try {
    let body: {
      user_id?: string;
      period_end_date?: string;
      period_start_date?: string;
      case_type?: string;
    };
    try { body = await req.json(); }
    catch { return errorRes("요청 데이터가 올바르지 않아요.", 400); }

    const { user_id, period_end_date, period_start_date, case_type } = body;

    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;

    if (!user_id || !uuidRegex.test(user_id))
      return errorRes("유효하지 않은 사용자예요.", 400);
    if (!period_end_date || !dateRegex.test(period_end_date))
      return errorRes("날짜 형식이 올바르지 않아요.", 400);
    if (!case_type || !["CASE1", "CASE2"].includes(case_type))
      return errorRes("유효하지 않은 케이스 타입이에요.", 400);

    const db = createClient(supabaseUrl, supabaseServiceKey);

    if (case_type === "CASE1" && period_start_date) {
      const startDate = new Date(period_start_date);
      const endDate   = new Date(period_end_date);
      const periodDays = Math.round((endDate.getTime() - startDate.getTime()) / 86400000) + 1;

      if (periodDays < 2 || periodDays > 10)
        return errorRes(`생리 기간이 올바르지 않아요. 2~10일 사이로 입력해주세요. (현재: ${periodDays}일)`, 400);

      const { data: prevPeriod } = await db
        .from("period_records")
        .select("end_date")
        .eq("user_id", user_id)
        .lt("start_date", period_start_date)
        .order("start_date", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (prevPeriod) {
        const prevEnd = new Date(prevPeriod.end_date);
        const daysSincePrev = Math.round((startDate.getTime() - prevEnd.getTime()) / 86400000);
        if (daysSincePrev < 18)
          return errorRes("직전 생리 종료일로부터 18일이 지나지 않았어요.", 400);
      }
    }

    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);

    const { count } = await db
      .from("cycle_reports")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user_id)
      .gte("created_at", monthStart.toISOString());

    if (count !== null && count >= 3)
      return errorRes("이번 달 리포트 발송 횟수를 초과했어요. 다음 달에 다시 확인해주세요.", 429);

    const { data: existingByEnd } = await db
      .from("cycle_reports")
      .select("id, ai_analysis")
      .eq("user_id", user_id)
      .eq("period_end_date", period_end_date)
      .maybeSingle();

    if (existingByEnd)
      return okRes({ status: "already_exists", ai_analysis: existingByEnd.ai_analysis });

    if (period_start_date) {
      const { data: existingByStart } = await db
        .from("cycle_reports")
        .select("id, ai_analysis")
        .eq("user_id", user_id)
        .eq("period_start_date", period_start_date)
        .maybeSingle();

      if (existingByStart)
        return okRes({ status: "already_exists", ai_analysis: existingByStart.ai_analysis });
    }

    const noDataMsg = "상태 기록을 입력하면 해당 데이터를 분석해서 더 많은 인사이트를 드릴 수 있어요 🌿";
    let prompt = "";

    if (case_type === "CASE1") {
      const { data: allPeriods } = await db
        .from("period_records")
        .select("start_date, end_date")
        .eq("user_id", user_id)
        .order("start_date", { ascending: false });

      const recentPeriods = allPeriods?.slice(0, 6) ?? [];
      const cycleCount    = recentPeriods.length;
      const currentPeriod = recentPeriods[0];

      let cycleLength = 28;
      if (cycleCount >= 2) {
        const d1 = new Date(recentPeriods[0].start_date);
        const d2 = new Date(recentPeriods[1].start_date);
        cycleLength = Math.round((d1.getTime() - d2.getTime()) / 86400000);
      }

      const seasons    = currentPeriod ? calcSeasons(currentPeriod.start_date, currentPeriod.end_date, cycleLength) : null;
      const oldestStart = recentPeriods[recentPeriods.length - 1]?.start_date ?? period_end_date;

      const { data: logs } = await db
        .from("daily_logs")
        .select("log_date, mood, symptom, energy, etc, memo, tag_question, tag_answer, weight")
        .eq("user_id", user_id)
        .gte("log_date", oldestStart)
        .order("log_date", { ascending: true });

      const hasLogs = (logs?.length ?? 0) > 0;

      prompt = `
당신은 이 사람의 몸과 마음의 리듬을 몇 달째 함께 지켜봐온 가장 가까운 친구예요.
데이터를 보면서 "아, 역시 이 시기에 힘들었구나. 그게 당연한 거야"라고 말해주는 사람이에요.

'달의 기록'은 여성이 자신의 몸 상태를 매일 기록하고, 사이클의 리듬을 이해해 나를 덜 탓하고 더 잘 돌볼 수 있도록 돕는 앱이에요.

【이 리포트 전체를 관통하는 핵심 메시지】
"특정 시기에 지치고 예민해지는 건 의지력 문제가 아니에요. 몸의 리듬이에요.
이 패턴을 알면 다음엔 나를 덜 탓할 수 있어요."
모든 항목에서 이 메시지가 자연스럽게 느껴져야 해요.

【이번 사이클 계절 구간 - 반드시 이 날짜 기준으로 분석할 것】
❄️ 겨울 ${seasons?.winter ?? "계산 불가"}
🌸 봄 ${seasons?.spring ?? "계산 불가"}
☀️ 여름 ${seasons?.summer ?? "계산 불가"}
🍂 가을 ${seasons?.fall ?? "계산 불가"}

【사이클 씽킹 개념】
- ❄️ 겨울(생리기): 에너지 최저, 몸이 쉬어야 하는 시기. 무기력한 게 당연함
- 🌸 봄(여포기): 에너지 서서히 상승, 가벼워지는 시기
- ☀️ 여름(배란기): 에너지 최고조, 자신감 넘치는 시기
- 🍂 가을(황체기): 에너지 하강, 예민해지고 감정 기복이 생기는 시기. 이것도 당연함

【데이터 필드 설명】
- log_date: 기록 날짜
- mood: 감정 상태
- symptom: 신체 증상
- energy: 에너지 레벨
- etc: 기타 메모
- memo: 유저가 직접 작성한 자유 메모 (없을 수 있음)
- tag_question: AI가 유저에게 건넨 질문 (없을 수 있음)
- tag_answer: 유저가 질문에 답변한 내용 (없을 수 있음, 가장 개인화된 맥락 데이터)
- weight: 그날 몸무게(kg) (없을 수 있음)

【생리 기록 (최근 ${cycleCount}사이클)】
${JSON.stringify(recentPeriods, null, 2)}

【데일리 상태 기록】
${hasLogs ? JSON.stringify(logs, null, 2) : "없음"}

【데이터 활용 우선순위】
tag_answer > memo > 태그 순으로 개인화 맥락이 풍부해요.
tag_answer가 있는 날은 반드시 그 내용을 분석에 반영하고, encouragement에서 직접 언급해주세요.

【분석 전 반드시 할 것】

아래 2가지를 데이터에서 찾아낸 뒤 분석을 시작할 것.

① 이 사람만의 인과 패턴 1개
   특정 행동/감정 태그 다음날 어떤 변화가 생겼는지,
   또는 같은 계절마다 반복되는 태그 조합을 찾을 것.
   예: "술 마신 다음날 에너지가 항상 떨어짐"
       "황체기마다 예민함 + 두통이 세트로 등장"

② tag_answer와 실제 데이터의 연결고리 1개
   이 사람이 직접 쓴 답변이 태그 데이터와 어떻게 연결되는지 찾을 것.
   예: "'인간관계에 에너지를 많이 씀'이라고 했는데,
        그 다음날 실제로 에너지가 방전 태그"

찾은 ①②를 pattern, energy_flow, encouragement에 나눠서 녹일 것.
섹션별로 따로 쓰지 말고, ①②의 발견이 전체 흐름에서 하나의 이야기가 되도록 쓸 것.

단, 아래 중 하나 이상을 발견할 것:
- 2회 이상 반복되는 태그 조합 (1회성은 제외)
- tag_answer에서 언급했지만 태그 데이터와 연결되지 않은 내용
- mood 태그와 energy 태그가 반대인 날

【각 항목 작성 지침】

summary (2문장):
- 이번 사이클 길이와 생리 기간을 구체적인 날짜와 함께 언급
- 어떤 감정/에너지 상태가 많았는지, 전반적인 흐름이 어땠는지도 함께 언급
${cycleCount >= 2 ? "- 전 사이클과 비교해 달라진 점을 '좋다/나쁘다'가 아니라 '이번엔 이랬네요' 식으로 중립적으로 표현" : ""}
- 판단하지 말고 관찰하듯 서술

pattern (각 계절별 1문장, 총 2-3문장):
${hasLogs
  ? `- 날짜 숫자(예: 4/16, 4월 16일 등) 절대 언급 금지. 시기는 반드시 계절 용어로만 표현 (겨울/봄/여름/가을, 또는 생리기/여포기/배란기/황체기)
- 계절별로 분리해서 각각 1문장씩 서술. 한 문장에 여러 계절 절대 섞지 말 것
- 형식: "겨울엔 ~했어요." "봄엔 ~이 나타났어요." 식으로 계절마다 끊어서 작성
- 날짜가 아닌 '이 시기의 리듬과 패턴'이 전달되어야 함
- "가을에 예민했던 건 황체기 호르몬 변화 때문이에요. 당신 탓이 아니에요" 식으로
  증상의 원인을 몸의 리듬으로 안심시킬 것
- 데이터에 없는 계절 구간은 절대 언급하지 말 것`
  : `- "${noDataMsg}"`}

energy_flow (1-2문장):
${hasLogs
  ? `- 날짜 숫자 언급 금지. 계절 용어로만 시기 표현
- 에너지가 높았던 계절과 낮았던 계절의 흐름을 계절 용어로 서술
- 에너지가 낮았던 시기가 있다면 "방전된 게 아니에요, 몸이 쉬어야 할 타이밍이었어요" 식으로 재해석`
  : `- "${noDataMsg}"`}

next_preview (1문장):
${cycleCount >= 2
  ? `- 다음 생리 예상 시작일 언급
- 다가올 계절(특히 힘든 시기가 있었다면 그 계절)에 대한 따뜻한 예고
- "미리 알고 있으면 덜 힘들어요" 느낌으로`
  : "- null로 반환"}

encouragement (1-2문장):
- 이번 사이클을 함께 보낸 것처럼 따뜻하게 돌아보는 메시지
- 날짜 숫자 언급 금지. 계절 용어나 tag_answer/memo의 실제 내용으로 표현
- 반드시 이 사람의 tag_answer 또는 memo 또는 태그 중 실제 기록된 내용을 1개 이상 구체적으로 언급
- 마지막 문장은 반드시 이 사람의 실제 기록/답변 내용으로 마무리할 것. "다음 사이클이 기다려져요" 같은 일반적인 문장으로 끝내지 말 것
- 절대 일반적인 응원 문구 금지. 이 사람만의 이야기를 할 것
- 완전한 문장으로 끝낼 것

【계절별 톤 가이드】
- ❄️ 겨울 기록이 많다면: 따뜻하고 포근하게. "충분히 쉬어도 괜찮아요" 느낌
- 🌸 봄 기록이 많다면: 설레고 가볍게. "이 에너지를 즐겨요" 느낌
- ☀️ 여름 기록이 많다면: 활기차고 응원하는 톤
- 🍂 가을 기록이 많다면: 공감하고 위로하는 톤. "힘들었던 거 알아요, 당연해요" 느낌

diet (2문장):
- 식단·운동 조언. 시기는 계절 용어(겨울/봄/여름/가을)로 표현하고, 생리 기록이 없으면 이번 달 흐름 기준으로 쓸 것
- weight 기록이 있으면 시기별 몸무게 변화를 함께 언급. 가을·겨울에 늘었다면 "붓기 때문일 수 있어요, 실패가 아니에요" 식으로 안심시킬 것
- weight 기록이 없으면 몸무게는 언급하지 말고 다가올 시기에 맞는 식단·운동만 조언
- 칼로리 숫자, 굶기, 극단적인 식단 제한, 감량 압박 절대 금지
- 날짜 숫자 언급 금지

【말투 가이드】
- 마치 오랜 친구처럼 따뜻하고 공감하는 말투
- "~했군요", "~이셨겠어요", "~해요" 등 부드러운 존댓말
- 사이클 씽킹 계절 용어(봄/여름/가을/겨울) 사용
- 의학적 진단이나 단정적 표현 금지
- 데이터가 부족하더라도 있는 데이터로 최선을 다해 분석

반드시 아래 JSON 형식으로만 응답하세요. 마크다운 코드블록 절대 금지:

{
  "summary": "...",
  "pattern": "${hasLogs ? "..." : noDataMsg}",
  "energy_flow": "${hasLogs ? "..." : noDataMsg}",
  "next_preview": ${cycleCount >= 2 ? '"..."' : "null"},
  "encouragement": "...",
  "diet": "..."
}

규칙:
- 한국어로 작성
- null은 실제 null로 반환
- JSON 외 텍스트 절대 포함 금지
- 마크다운 코드블록(\`\`\`json) 절대 사용 금지
`;

    } else {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const { data: logs } = await db
        .from("daily_logs")
        .select("log_date, mood, symptom, energy, etc, memo, tag_question, tag_answer, weight")
        .eq("user_id", user_id)
        .gte("log_date", thirtyDaysAgo.toISOString().split("T")[0])
        .order("log_date", { ascending: true });

      if (!logs || logs.length === 0)
        return okRes({ status: "no_data" });

      prompt = `
당신은 이 사람의 몸과 마음의 리듬을 함께 지켜봐온 가장 가까운 친구예요.
데이터를 보면서 "아, 역시 이 시기에 힘들었구나. 그게 당연한 거야"라고 말해주는 사람이에요.

'달의 기록'은 여성이 자신의 몸 상태를 매일 기록하고, 나의 리듬을 이해해 나를 덜 탓하고 더 잘 돌볼 수 있도록 돕는 앱이에요.

【이 리포트 전체를 관통하는 핵심 메시지】
"지치고 예민해지는 게 의지력 문제가 아니에요. 몸의 리듬이에요.
이 패턴을 알면 나를 덜 탓할 수 있어요."

【데이터 필드 설명】
- log_date: 기록 날짜
- mood: 감정 상태
- symptom: 신체 증상
- energy: 에너지 레벨
- etc: 기타 메모
- memo: 유저가 직접 작성한 자유 메모 (없을 수 있음)
- tag_question: AI가 유저에게 건넨 질문 (없을 수 있음)
- tag_answer: 유저가 질문에 답변한 내용 (없을 수 있음, 가장 개인화된 맥락 데이터)
- weight: 그날 몸무게(kg) (없을 수 있음)

【데이터 활용 우선순위】
tag_answer > memo > 태그 순으로 개인화 맥락이 풍부해요.
tag_answer가 있는 날은 반드시 그 내용을 분석에 반영하고, encouragement에서 직접 언급해주세요.

【데일리 상태 기록 (최근 30일)】
${JSON.stringify(logs, null, 2)}

【각 항목 작성 지침】

summary (2문장):
- 이번 달 전반적인 컨디션 흐름 요약
- 어떤 감정/에너지 상태가 많았는지, 전반적인 흐름이 어땠는지

pattern (2문장):
- 자주 반복된 감정/신체 증상 패턴 분석
- 특정 시기(월초/월중/월말)나 요일에 집중된 패턴이 있다면 언급
- 생리 기록이 없어서 사이클 단계는 알 수 없지만, 날짜 흐름 기준으로 분석

energy_flow (1-2문장):
- 에너지 레벨의 월간 흐름 분석
- 에너지가 높았던 시기와 낮았던 시기, 그 변화 흐름
- 에너지가 낮았던 날이 있다면 "방전된 게 아니라 쉬어야 할 타이밍이었어요" 식으로 재해석

encouragement (1-2문장):
- 이번 달을 함께 보낸 것처럼 따뜻하게 돌아보는 메시지
- 반드시 이 사람이 실제로 기록한 구체적인 감정이나 증상이나 tag_answer 내용을 1개 이상 언급할 것
- 마지막 문장은 반드시 이 사람의 실제 기록/답변 내용으로 마무리. 일반적인 응원 문구로 끝내지 말 것
- 생리 기록을 추가하면 더 풍부한 분석을 받을 수 있다는 자연스러운 유도 포함
- 완전한 문장으로 끝낼 것

diet (2문장):
- 식단·운동 조언. 시기는 계절 용어(겨울/봄/여름/가을)로 표현하고, 생리 기록이 없으면 이번 달 흐름 기준으로 쓸 것
- weight 기록이 있으면 시기별 몸무게 변화를 함께 언급. 가을·겨울에 늘었다면 "붓기 때문일 수 있어요, 실패가 아니에요" 식으로 안심시킬 것
- weight 기록이 없으면 몸무게는 언급하지 말고 다가올 시기에 맞는 식단·운동만 조언
- 칼로리 숫자, 굶기, 극단적인 식단 제한, 감량 압박 절대 금지
- 날짜 숫자 언급 금지

【말투 가이드】
- 마치 오랜 친구처럼 따뜻하고 공감하는 말투
- "~했군요", "~이셨겠어요", "~해보세요" 같은 부드러운 존댓말
- 의학적 진단이나 단정적인 표현 금지
- 데이터가 부족하더라도 있는 데이터로 최선을 다해 분석

반드시 아래 JSON 형식으로만 응답하세요. 마크다운 코드블록 절대 금지:

{
  "summary": "...",
  "pattern": "...",
  "energy_flow": "...",
  "next_preview": null,
  "encouragement": "...",
  "diet": "..."
}

규칙:
- 한국어로 작성
- null은 실제 null로 반환
- JSON 외 텍스트 절대 포함 금지
- 마크다운 코드블록(\`\`\`json) 절대 사용 금지
`;
    }

    let rawText: string | null = null;
    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": claudeApiKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: "claude-haiku-4-5-20251001",
          max_tokens: 2048,
          messages: [{ role: "user", content: prompt }],
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error?.message ?? "Claude API error");
      }
      rawText = (await res.json()).content?.[0]?.text ?? null;
    } catch {
      return errorRes("AI 분석 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.", 500);
    }

    if (!rawText || rawText.length > 10000)
      return errorRes("AI 응답이 올바르지 않습니다. 잠시 후 다시 시도해주세요.", 500);

    const cleanText = rawText.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```\s*$/i, "").trim();
    let aiAnalysis = cleanText;
    try { JSON.parse(cleanText); }
    catch {
      aiAnalysis = JSON.stringify({ summary: cleanText, pattern: null, energy_flow: null, next_preview: null, encouragement: null });
    }

    const { error: insertError } = await db
      .from("cycle_reports")
      .insert({ user_id, period_end_date, period_start_date: period_start_date ?? null, ai_analysis: aiAnalysis });

    if (insertError)
      return errorRes("리포트 저장 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.", 500);

    return okRes({ status: "success", ai_analysis: aiAnalysis });

  } catch {
    return errorRes("서버 오류가 발생했습니다. 잠시 후 다시 시도해주세요.", 500);
  }
});