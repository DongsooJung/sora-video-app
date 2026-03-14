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

    const { prompt, model, size, duration } = await request.json();

    if (!prompt) {
      return NextResponse.json(
        { error: "Prompt is required" },
        { status: 400 }
      );
    }

    const seconds = String(duration || 4) as "4" | "8" | "12";

    // Sora 비디오 생성 요청
    const video = await openai.videos.create({
      prompt,
      model: model || "sora-2",
      size: size || "1280x720",
      seconds,
    });

    // DB에 기록 저장
    const { data, error } = await supabase
      .from("videos")
      .insert({
        user_id: user.id,
        openai_video_id: video.id,
        prompt,
        model: model || "sora-2",
        size: size || "1280x720",
        duration: duration || 4,
        status: video.status,
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ video: data, openai_video: video });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
