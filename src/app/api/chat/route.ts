import { NextRequest, NextResponse } from "next/server";
import { openai } from "@/lib/openai";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { message, videoId } = await request.json();

    if (!message) {
      return NextResponse.json(
        { error: "Message is required" },
        { status: 400 }
      );
    }

    // 이전 대화 기록 가져오기
    const { data: history } = await supabase
      .from("chat_history")
      .select("role, content")
      .eq("user_id", user.id)
      .eq("video_id", videoId || null)
      .order("created_at", { ascending: true })
      .limit(20);

    const messages = [
      {
        role: "system" as const,
        content: `당신은 Sora AI 비디오 생성 전문 어시스턴트입니다.
사용자가 원하는 비디오를 만들기 위한 최적의 프롬프트를 작성하도록 도와주세요.
프롬프트 작성 팁:
- 구체적인 시각적 설명을 포함하세요 (색상, 조명, 카메라 앵글)
- 동작과 움직임을 명확하게 설명하세요
- 분위기와 스타일을 지정하세요 (시네마틱, 애니메이션, 리얼리스틱 등)
- 해상도와 화면비에 맞는 구도를 고려하세요

사용자가 요청하면 영어로 최적화된 Sora 프롬프트도 생성해주세요.`,
      },
      ...(history || []).map((h) => ({
        role: h.role as "user" | "assistant",
        content: h.content,
      })),
      { role: "user" as const, content: message },
    ];

    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages,
      temperature: 0.7,
    });

    const reply = completion.choices[0].message.content || "";

    // 대화 기록 저장
    await supabase.from("chat_history").insert([
      {
        user_id: user.id,
        video_id: videoId || null,
        role: "user",
        content: message,
      },
      {
        user_id: user.id,
        video_id: videoId || null,
        role: "assistant",
        content: reply,
      },
    ]);

    return NextResponse.json({ reply });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
