# 실타래 실습실 (siltarae)
## 실타래 실습실 웹 배포 (Vercel)

- 화면: `prototype/index.html` (Claude 아티팩트와 같은 파일). 배포할 때 `scripts/build-web.sh`가 `dist/index.html`로 묶는다.
- AI: `api/ai.mjs`가 OpenAI로 연결한다. Vercel 환경변수 두 개가 모두 있어야 AI가 켜지고, 하나라도 없으면 화면은 체험용 예시 답변으로 동작한다.
  - `OPENAI_API_KEY`: OpenAI 키
  - `ALLOWED_ORIGIN`: AI를 부를 수 있는 사이트 주소. 예: `https://siltarea-teal.vercel.app,https://shaula.kr` (Vercel 주소와, 이 실습실을 비춰 주는 shaula.kr) (끝에 `/` 없이, 여러 개면 쉼표로 구분)
- 선택 환경변수: `OPENAI_MODEL`(기본 `gpt-4.1-mini`).
- 서버가 실습과 관계없는 요청은 거절하라는 지시를 항상 앞에 붙인다. 그래도 프로그램으로 주소를 흉내 내면 막을 수 없으니,
  공개 사이트에 키를 넣을 때는 OpenAI 대시보드에서 프로젝트 월 예산 한도를 꼭 걸어 둔다.
