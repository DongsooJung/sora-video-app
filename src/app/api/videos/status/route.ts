import { NextRequest, NextResponse } from "next/server";
import { openai } from "@/lib/openai";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const videoId = request.nextUrl.searchParams.get("id");
    if (!videoId) {
      return NextResponse.json(
        { error: "Video ID is required" },
        { status: 400 }
      );
    }

    // DB에서 비디오 정보 가져오기
    const { data: dbVideo } = await supabase
      .from("videos")
      .select()
      .eq("id", videoId)
      .eq("user_id", user.id)
      .single();

    if (!dbVideo) {
      return NextResponse.json({ error: "Video not found" }, { status: 404 });
    }

    // 아직 완료되지 않은 경우 OpenAI에서 상태 확인
    if (dbVideo.status !== "completed" && dbVideo.status !== "failed") {
      const openaiVideo = await openai.videos.retrieve(
        dbVideo.openai_video_id
      );

      const updateData: Record<string, unknown> = {
        status: openaiVideo.status,
      };

      if (openaiVideo.status === "completed") {
        updateData.completed_at = new Date().toISOString();
      }

      await supabase.from("videos").update(updateData).eq("id", videoId);

      return NextResponse.json({
        ...dbVideo,
        status: openaiVideo.status,
        openai_video: openaiVideo,
      });
    }

    return NextResponse.json(dbVideo);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
