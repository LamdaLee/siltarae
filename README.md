# 실타래 실습실 (siltarae)
## 실타래 실습실 웹 배포 (Vercel)

- 화면: `prototype/index.html` (Claude 아티팩트와 같은 파일). 배포할 때 `scripts/build-web.sh`가 `dist/index.html`로 묶는다.
- AI: `api/ai.mjs`가 OpenAI로 연결한다. Vercel 환경변수 `OPENAI_API_KEY`가 없으면 화면은 체험용 예시 답변으로 동작한다.
- 선택 환경변수: `OPENAI_MODEL`(기본 `gpt-4.1-mini`), `ALLOWED_ORIGIN`(내 사이트 주소만 허용).
- 공개 사이트에 키를 넣을 때는 OpenAI 대시보드에서 프로젝트 월 예산 한도를 꼭 걸어 둔다.
