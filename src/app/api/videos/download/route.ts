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

    const { data: dbVideo } = await supabase
      .from("videos")
      .select()
      .eq("id", videoId)
      .eq("user_id", user.id)
      .single();

    if (!dbVideo || !dbVideo.openai_video_id) {
      return NextResponse.json({ error: "Video not found" }, { status: 404 });
    }

    // OpenAI에서 비디오 상태 확인
    const videoInfo = await openai.videos.retrieve(dbVideo.openai_video_id);

    if (videoInfo.status !== "completed") {
      return NextResponse.json(
        { error: "Video is not ready yet", status: videoInfo.status },
        { status: 202 }
      );
    }

    // SDK의 downloadContent 사용하여 비디오 스트림 가져오기
    const videoResponse = await openai.videos.downloadContent(
      dbVideo.openai_video_id
    );

    // DB 상태 업데이트
    if (dbVideo.status !== "completed") {
      await supabase
        .from("videos")
        .update({ status: "completed", completed_at: new Date().toISOString() })
        .eq("id", videoId);
    }

    // 비디오를 스트리밍으로 전달
    const headers = new Headers();
    headers.set("Content-Type", "video/mp4");
    headers.set(
      "Content-Disposition",
      `attachment; filename="sora-${videoId}.mp4"`
    );

    return new NextResponse(videoResponse.body, { headers });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
