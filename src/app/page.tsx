"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";

type Video = {
  id: string;
  openai_video_id: string;
  prompt: string;
  enhanced_prompt?: string;
  model: string;
  size: string;
  duration: number;
  status: string;
  video_url?: string;
  created_at: string;
  completed_at?: string;
};

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

export default function Home() {
  const supabase = createClient();
  const [activeTab, setActiveTab] = useState<"generate" | "gallery" | "chat">("generate");

  // Generate state
  const [prompt, setPrompt] = useState("");
  const [model, setModel] = useState("sora-2");
  const [size, setSize] = useState("1280x720");
  const [duration, setDuration] = useState(4);
  const [generating, setGenerating] = useState(false);
  const [enhancing, setEnhancing] = useState(false);
  const [currentVideo, setCurrentVideo] = useState<Video | null>(null);

  // Gallery state
  const [videos, setVideos] = useState<Video[]>([]);
  const [loadingVideos, setLoadingVideos] = useState(false);

  // Chat state
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const [userEmail, setUserEmail] = useState("");

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUserEmail(data.user?.email || "");
    });
  }, [supabase.auth]);

  const fetchVideos = useCallback(async () => {
    setLoadingVideos(true);
    const res = await fetch("/api/videos/list");
    const data = await res.json();
    if (data.videos) setVideos(data.videos);
    setLoadingVideos(false);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoadingVideos(true);
      const res = await fetch("/api/videos/list");
      const data = await res.json();
      if (!cancelled && data.videos) setVideos(data.videos);
      if (!cancelled) setLoadingVideos(false);
    })();
    return () => { cancelled = true; };
  }, []);

  // 프롬프트 최적화
  async function enhancePrompt() {
    if (!prompt.trim()) return;
    setEnhancing(true);
    try {
      const res = await fetch("/api/chat/enhance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt }),
      });
      const data = await res.json();
      if (data.enhanced_prompt) {
        setPrompt(data.enhanced_prompt);
      }
    } catch {
      alert("프롬프트 최적화에 실패했습니다.");
    }
    setEnhancing(false);
  }

  // 비디오 생성
  async function generateVideo() {
    if (!prompt.trim()) return;
    setGenerating(true);
    setCurrentVideo(null);
    try {
      const res = await fetch("/api/videos/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, model, size, duration }),
      });
      const data = await res.json();
      if (data.error) {
        alert(`오류: ${data.error}`);
      } else {
        setCurrentVideo(data.video);
        pollVideoStatus(data.video.id);
      }
    } catch {
      alert("비디오 생성에 실패했습니다.");
    }
    setGenerating(false);
  }

  // 비디오 상태 폴링
  async function pollVideoStatus(videoId: string) {
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/videos/status?id=${videoId}`);
        const data = await res.json();
        setCurrentVideo((prev) =>
          prev && prev.id === videoId ? { ...prev, status: data.status } : prev
        );
        if (data.status === "completed" || data.status === "failed") {
          clearInterval(interval);
          fetchVideos();
        }
      } catch {
        clearInterval(interval);
      }
    }, 5000);
  }

  // 채팅 전송
  async function sendChat(e: React.FormEvent) {
    e.preventDefault();
    if (!chatInput.trim() || chatLoading) return;
    const userMsg = chatInput;
    setChatInput("");
    setChatMessages((prev) => [...prev, { role: "user", content: userMsg }]);
    setChatLoading(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: userMsg }),
      });
      const data = await res.json();
      if (data.reply) {
        setChatMessages((prev) => [
          ...prev,
          { role: "assistant", content: data.reply },
        ]);
      }
    } catch {
      setChatMessages((prev) => [
        ...prev,
        { role: "assistant", content: "오류가 발생했습니다. 다시 시도해주세요." },
      ]);
    }
    setChatLoading(false);
  }

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages]);

  // 로그아웃
  async function handleLogout() {
    await supabase.auth.signOut();
    window.location.href = "/login";
  }

  // 프롬프트에 적용 (채팅에서)
  function applyToPrompt(text: string) {
    setPrompt(text);
    setActiveTab("generate");
  }

  return (
    <div className="flex min-h-screen flex-col bg-black text-white">
      {/* Header */}
      <header className="flex items-center justify-between border-b border-zinc-800 px-6 py-4">
        <h1 className="text-xl font-bold">Sora Video Studio</h1>
        <div className="flex items-center gap-4">
          <span className="text-sm text-zinc-400">{userEmail}</span>
          <button
            onClick={handleLogout}
            className="rounded-lg border border-zinc-700 px-3 py-1.5 text-sm text-zinc-300 hover:bg-zinc-800"
          >
            로그아웃
          </button>
        </div>
      </header>

      {/* Tabs */}
      <nav className="flex border-b border-zinc-800">
        {(
          [
            ["generate", "비디오 생성"],
            ["gallery", "갤러리"],
            ["chat", "AI 어시스턴트"],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className={`px-6 py-3 text-sm font-medium transition ${
              activeTab === key
                ? "border-b-2 border-blue-500 text-blue-400"
                : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            {label}
          </button>
        ))}
      </nav>

      {/* Content */}
      <main className="flex-1 overflow-auto p-6">
        {/* ── Generate Tab ── */}
        {activeTab === "generate" && (
          <div className="mx-auto max-w-3xl space-y-6">
            {/* Prompt */}
            <div>
              <label className="mb-2 block text-sm font-medium text-zinc-300">
                비디오 프롬프트
              </label>
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                rows={4}
                className="w-full rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-3 text-white placeholder-zinc-500 focus:border-blue-500 focus:outline-none"
                placeholder="생성할 비디오를 설명해주세요... (예: 가을 숲길을 걸어가는 사람, 시네마틱 촬영)"
              />
              <div className="mt-2 flex gap-2">
                <button
                  onClick={enhancePrompt}
                  disabled={enhancing || !prompt.trim()}
                  className="rounded-lg bg-purple-600 px-4 py-2 text-sm font-medium text-white hover:bg-purple-700 disabled:opacity-50"
                >
                  {enhancing ? "최적화 중..." : "GPT로 프롬프트 최적화"}
                </button>
              </div>
            </div>

            {/* Settings */}
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="mb-1 block text-sm text-zinc-400">모델</label>
                <select
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                  className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2.5 text-white"
                >
                  <option value="sora-2">Sora 2 (빠름)</option>
                  <option value="sora-2-pro">Sora 2 Pro (고품질)</option>
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm text-zinc-400">해상도</label>
                <select
                  value={size}
                  onChange={(e) => setSize(e.target.value)}
                  className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2.5 text-white"
                >
                  <option value="1280x720">1280x720 (가로)</option>
                  <option value="720x1280">720x1280 (세로)</option>
                  <option value="1792x1024">1792x1024 (와이드)</option>
                  <option value="1024x1792">1024x1792 (세로 와이드)</option>
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm text-zinc-400">길이</label>
                <select
                  value={duration}
                  onChange={(e) => setDuration(Number(e.target.value))}
                  className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2.5 text-white"
                >
                  <option value={4}>4초</option>
                  <option value={8}>8초</option>
                  <option value={12}>12초</option>
                </select>
              </div>
            </div>

            {/* Generate Button */}
            <button
              onClick={generateVideo}
              disabled={generating || !prompt.trim()}
              className="w-full rounded-xl bg-blue-600 py-4 text-lg font-semibold text-white transition hover:bg-blue-700 disabled:opacity-50"
            >
              {generating ? "생성 중..." : "비디오 생성하기"}
            </button>

            {/* Current Video Status */}
            {currentVideo && (
              <div className="rounded-xl border border-zinc-700 bg-zinc-900 p-6">
                <h3 className="mb-2 font-semibold">현재 작업</h3>
                <p className="mb-1 text-sm text-zinc-400">
                  프롬프트: {currentVideo.prompt.slice(0, 100)}...
                </p>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-zinc-400">상태:</span>
                  <StatusBadge status={currentVideo.status} />
                </div>
                {currentVideo.status === "completed" && (
                  <a
                    href={`/api/videos/download?id=${currentVideo.id}`}
                    className="mt-3 inline-block rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700"
                  >
                    다운로드
                  </a>
                )}
              </div>
            )}
          </div>
        )}

        {/* ── Gallery Tab ── */}
        {activeTab === "gallery" && (
          <div className="mx-auto max-w-5xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold">내 비디오</h2>
              <button
                onClick={fetchVideos}
                disabled={loadingVideos}
                className="rounded-lg border border-zinc-700 px-3 py-1.5 text-sm text-zinc-300 hover:bg-zinc-800"
              >
                {loadingVideos ? "로딩..." : "새로고침"}
              </button>
            </div>

            {videos.length === 0 ? (
              <div className="flex h-64 items-center justify-center rounded-xl border border-zinc-800 text-zinc-500">
                아직 생성한 비디오가 없습니다
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                {videos.map((v) => (
                  <div
                    key={v.id}
                    className="rounded-xl border border-zinc-800 bg-zinc-900 p-4"
                  >
                    <div className="mb-3 flex items-center justify-between">
                      <StatusBadge status={v.status} />
                      <span className="text-xs text-zinc-500">
                        {new Date(v.created_at).toLocaleDateString("ko-KR")}
                      </span>
                    </div>
                    <p className="mb-2 line-clamp-3 text-sm text-zinc-300">
                      {v.prompt}
                    </p>
                    <div className="flex flex-wrap gap-2 text-xs text-zinc-500">
                      <span>{v.model}</span>
                      <span>{v.size}</span>
                      <span>{v.duration}초</span>
                    </div>
                    {v.status === "completed" && (
                      <a
                        href={`/api/videos/download?id=${v.id}`}
                        className="mt-3 inline-block rounded-lg bg-green-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-green-700"
                      >
                        다운로드
                      </a>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── Chat Tab ── */}
        {activeTab === "chat" && (
          <div className="mx-auto flex h-[calc(100vh-200px)] max-w-3xl flex-col">
            <div className="mb-4 rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
              <p className="text-sm text-zinc-400">
                AI 어시스턴트에게 비디오 프롬프트 작성을 도움받으세요. 원하는 비디오를
                설명하면 최적화된 Sora 프롬프트를 제안합니다.
              </p>
            </div>

            <div className="flex-1 space-y-4 overflow-auto rounded-xl border border-zinc-800 bg-zinc-950 p-4">
              {chatMessages.length === 0 && (
                <div className="flex h-full items-center justify-center text-zinc-600">
                  대화를 시작해보세요
                </div>
              )}
              {chatMessages.map((msg, i) => (
                <div
                  key={i}
                  className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm ${
                      msg.role === "user"
                        ? "bg-blue-600 text-white"
                        : "bg-zinc-800 text-zinc-200"
                    }`}
                  >
                    <p className="whitespace-pre-wrap">{msg.content}</p>
                    {msg.role === "assistant" && (
                      <button
                        onClick={() => applyToPrompt(msg.content)}
                        className="mt-2 text-xs text-blue-400 hover:underline"
                      >
                        프롬프트에 적용
                      </button>
                    )}
                  </div>
                </div>
              ))}
              {chatLoading && (
                <div className="flex justify-start">
                  <div className="rounded-2xl bg-zinc-800 px-4 py-3 text-sm text-zinc-400">
                    생각 중...
                  </div>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>

            <form onSubmit={sendChat} className="mt-4 flex gap-2">
              <input
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                placeholder="비디오 아이디어를 설명해주세요..."
                className="flex-1 rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-3 text-white placeholder-zinc-500 focus:border-blue-500 focus:outline-none"
              />
              <button
                type="submit"
                disabled={chatLoading || !chatInput.trim()}
                className="rounded-xl bg-blue-600 px-6 py-3 font-medium text-white hover:bg-blue-700 disabled:opacity-50"
              >
                전송
              </button>
            </form>
          </div>
        )}
      </main>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    queued: "bg-yellow-900/50 text-yellow-400",
    in_progress: "bg-blue-900/50 text-blue-400",
    completed: "bg-green-900/50 text-green-400",
    failed: "bg-red-900/50 text-red-400",
  };
  const labels: Record<string, string> = {
    queued: "대기 중",
    in_progress: "생성 중",
    completed: "완료",
    failed: "실패",
  };
  return (
    <span
      className={`rounded-full px-2.5 py-1 text-xs font-medium ${styles[status] || "bg-zinc-800 text-zinc-400"}`}
    >
      {labels[status] || status}
    </span>
  );
}
