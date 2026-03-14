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

    const { prompt } = await request.json();

    if (!prompt) {
      return NextResponse.json(
        { error: "Prompt is required" },
        { status: 400 }
      );
    }

    // ChatGPT로 Sora 프롬프트 최적화
    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: `You are a Sora video prompt optimization expert.
Take the user's rough idea and transform it into a detailed, high-quality Sora prompt in English.
Include: specific visual details, camera movements, lighting, mood, style, and composition.
Output ONLY the optimized prompt, nothing else.`,
        },
        { role: "user", content: prompt },
      ],
      temperature: 0.8,
    });

    const enhanced = completion.choices[0].message.content || prompt;

    return NextResponse.json({ enhanced_prompt: enhanced });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
