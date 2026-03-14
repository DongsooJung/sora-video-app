-- Supabase SQL: 프로젝트 대시보드 > SQL Editor에서 실행하세요

-- 비디오 생성 기록 테이블
create table if not exists videos (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade,
  openai_video_id text,
  prompt text not null,
  enhanced_prompt text,
  model text not null default 'sora-2',
  size text not null default '1280x720',
  duration integer not null default 4,
  status text not null default 'queued',
  video_url text,
  error_message text,
  created_at timestamptz default now(),
  completed_at timestamptz
);

-- ChatGPT 프롬프트 히스토리 테이블
create table if not exists chat_history (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade,
  video_id uuid references videos(id) on delete set null,
  role text not null,
  content text not null,
  created_at timestamptz default now()
);

-- RLS (Row Level Security) 활성화
alter table videos enable row level security;
alter table chat_history enable row level security;

-- 사용자 본인 데이터만 접근 가능하도록 정책 설정
create policy "Users can view own videos" on videos
  for select using (auth.uid() = user_id);

create policy "Users can insert own videos" on videos
  for insert with check (auth.uid() = user_id);

create policy "Users can update own videos" on videos
  for update using (auth.uid() = user_id);

create policy "Users can view own chat history" on chat_history
  for select using (auth.uid() = user_id);

create policy "Users can insert own chat history" on chat_history
  for insert with check (auth.uid() = user_id);

-- 인덱스
create index idx_videos_user_id on videos(user_id);
create index idx_videos_status on videos(status);
create index idx_chat_history_video_id on chat_history(video_id);
