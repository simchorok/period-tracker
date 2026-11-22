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

const errorRes = (message: string, status: number) =>
  new Response(JSON.stringify({ error: message }), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const okRes = (body: unknown) =>
  new Response(JSON.stringify(body), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

// ── 메인 ─────────────────────────────────────────────
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return errorRes("Method not allowed", 405);

  try {
    // ── 1. 입력값 파싱 ───────────────────────────────
    let body: {
      user_id?: string;
      log_date?: string;
      top_tag?: string;
      recent_tags?: { date: string; tags: string[] }[];
      cycle_phase?: string | null;
    };
    try { body = await req.json(); }
    catch { return errorRes("요청 데이터가 올바르지 않아요.", 400); }

    const { user_id, log_date, top_tag, recent_tags = [], cycle_phase } = body;

    // ── 2. 입력값 검증 ───────────────────────────────
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!user_id || !uuidRegex.test(user_id)) return errorRes("유효하지 않은 사용자예요.", 400);
    if (!top_tag) return errorRes("태그 정보가 없어요.", 400);

    // ── 3. 최근 3일 반복 패턴 파악 ───────────────────
    const recentTagFlat = recent_tags.flatMap(r => r.tags);
    const repeatCount = recentTagFlat.filter(t => t === top_tag).length;
    const hasRepeat = repeatCount >= 2;

    // ── 4. 프롬프트 생성 ─────────────────────────────
    const prompt = `
당신은 이 사람의 감정과 몸의 리듬을 함께 지켜봐온 가장 가까운 친구예요.
오늘 이 사람이 선택한 감정 태그를 보고, 그 감정을 더 깊이 이해하고 싶어서 질문 하나를 건네는 상황이에요.

【오늘 선택한 태그】
${top_tag}

【현재 사이클 단계】
${cycle_phase ?? "알 수 없음 (생리 기록 없음)"}

【최근 3일 태그 기록】
${recent_tags.length > 0
  ? recent_tags.map(r => `${r.date}: ${r.tags.join(', ')}`).join('\n')
  : "없음"}

【반복 패턴】
${hasRepeat ? `최근 ${repeatCount}일 연속으로 '${top_tag}'이 나타나고 있어요.` : "반복 없음"}

【질문 작성 규칙】
- 반드시 오늘 선택한 태그(${top_tag})를 자연스럽게 녹여서 질문할 것
- 사이클 단계가 있다면 그 맥락을 반영할 것
- 최근 같은 감정이 반복됐다면 그것도 언급해서 "나를 기억하고 있다"는 느낌을 줄 것
- 질문은 1개, 2~3문장 이내
- 단정짓지 말고 열린 질문으로 끝낼 것
- 답하고 싶어지는 따뜻한 말투로
- 분석가가 아닌 오랜 친구처럼

【말투 예시】
❌ "무기력한 이유가 무엇인가요?"
✅ "오늘 무기력함을 느꼈군요. 몸이 무거운 건지, 마음이 무거운 건지 어떤 느낌이었어요?"

❌ "반복되는 패턴이 감지됩니다."
✅ "3일째 비슷한 감정이 이어지고 있네요. 이번엔 어떤 점이 달랐어요?"

질문 텍스트만 반환하세요. 다른 텍스트, 따옴표, 마크다운 없이 순수 텍스트만.
`;

    // ── 5. Claude API 호출 ───────────────────────────
    let question: string | null = null;
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
          max_tokens: 200,
          messages: [{ role: "user", content: prompt }],
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error?.message ?? "Claude API error");
      }
      question = (await res.json()).content?.[0]?.text?.trim() ?? null;
    } catch {
      return errorRes("질문 생성 중 오류가 발생했어요. 잠시 후 다시 시도해주세요.", 500);
    }

    if (!question) return errorRes("질문 생성에 실패했어요.", 500);

    // ── 6. DB에 질문 저장 (답변은 나중에 저장) ────────
    const db = createClient(supabaseUrl, supabaseServiceKey);
    await db.from("daily_logs").upsert({
      user_id,
      log_date,
      tag_question: question,
    }, { onConflict: "user_id,log_date" });

    return okRes({ question });

  } catch {
    return errorRes("서버 오류가 발생했습니다. 잠시 후 다시 시도해주세요.", 500);
  }
});
