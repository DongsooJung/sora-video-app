import OpenAI from "openai";

let client: OpenAI | null = null;

/**
 * OpenAI 클라이언트를 지연 생성한다.
 *
 * 모듈 로드 시점이 아니라 최초 사용 시 생성하므로, next build의
 * 페이지 데이터 수집 단계에서 OPENAI_API_KEY가 없어도 빌드가 실패하지 않는다.
 * 키가 없으면 요청 처리 시점에 명확한 에러를 던진다.
 */
export function getOpenAI(): OpenAI {
  if (!client) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error("OPENAI_API_KEY 환경변수가 설정되지 않았습니다.");
    }
    client = new OpenAI({ apiKey });
  }
  return client;
}

/**
 * 기존 `openai.xxx` 호출 형태를 유지하기 위한 지연 프록시.
 * 속성 접근 시점에 실제 클라이언트를 생성한다.
 */
export const openai = new Proxy({} as OpenAI, {
  get(_target, prop, receiver) {
    const real = getOpenAI();
    const value = Reflect.get(real, prop, receiver);
    return typeof value === "function" ? value.bind(real) : value;
  },
});
