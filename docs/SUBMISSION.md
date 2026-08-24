# Track 1 제출 패키지

2026-08-24 KST 기준 [공식 Track 1 페이지와 신청서](https://openaigame2026.com/#apply:track-1), [공식 참가 약관](https://openaigame2026.com/ko/terms)을 다시 확인해 작성했다.

## 바로 입력할 값

### 게임 제목

`await CODEX: CONTEXT//OVERFLOW`

### 게임 소개 — 171/200자

Codex가 작업하는 동안 즐기는 1-hit 생존 탄막 게임입니다. WASD로 작은 agent node를 움직여 approval, context compaction, usage limit, rm * 등 개발자와 Codex 사용자가 익숙한 위기를 피하고, 끝없이 몰아치는 작업 큐에서 최고 기록에 도전하세요.

### 플레이 가능한 게임 링크

https://await-codex-context-overflow.jygjyg99.chatgpt.site/

- 로그인, 설치, 테스트 계정과 별도 승인 없이 바로 열린다.
- 클릭 또는 `Space`로 시작하고 `WASD`·방향키로 이동한다. `Esc`는 현재 run을 취소하고 시작 화면으로 돌아간다.
- 심사 기간인 2026-08-27을 포함해 공개 상태를 유지한다.

### 게임 썸네일

업로드 파일: `public/og.png`

- 1672×941 PNG, 723,011 bytes
- 신청서의 16:9·PNG/JPG·10MB 이하 권장 조건 충족
- original context-loop mark, 게임 제목, 실제 공격 문법을 한 장에 보여주므로 별도 캡처보다 게임 정체성이 선명하다.
- OpenAI knot, ChatGPT/Codex 제품 logo와 제3자 앱 logo를 사용하지 않는다.

### 데모 영상 링크

사용자가 업로드한 공개 또는 링크 공개 영상을 입력한다. 공식 권장 길이는 3분 이내이며 실제 플레이가 포함되어야 한다.

권장 편집 구성:

1. `0:00–0:10` — 썸네일과 같은 제목, “Codex가 일하는 동안 작업 큐를 피한다” 한 문장
2. `0:10–0:35` — 링크 접속 → 클릭 즉시 시작 → WASD 이동 → 한 번 피격 시 종료
3. `0:35–1:20` — terminal command, APPROVAL wall, context compaction의 서로 다른 회피 방식
4. `1:20–2:10` — Download Access, Ultra Code 120° safe sector, parallel/retry와 stage 상승
5. `2:10–2:35` — `rm *` blackout이 다른 탄막과 겹치는 후반 집중 구간
6. `2:35–2:50` — 피격 후 같은 시작 화면에 LAST RUN과 SESSION BEST가 갱신되는 장면

여러 실제 run의 구간을 편집해도 되지만, 입력을 가장한 연출이나 자동 플레이처럼 보이지 않게 실제 키보드 플레이 화면을 중심으로 구성한다.

## Codex와 함께 게임을 만든 과정 — 제출용 원문

이 게임은 챌린지 기간에 빈 Git 저장소에서 시작해 Codex desktop agent와 대화하며 새로 구축했습니다. Codex는 단순 코드 자동완성보다 기획을 실행 가능한 규칙으로 바꾸고, 구현·검증·배포를 반복하는 협업 엔지니어로 사용했습니다.

[Codex를 어디에 사용했는가]

1. 설계와 문맥 보존: 제품 목표, 시각 언어, 공정성 규칙, 기술 경계를 AGENTS.md와 PROJECT/DESIGN/TECHNICAL/DECISIONS/WORKLOG 문서로 정리했습니다. core simulation, input, presentation, runtime, service, scene을 분리해 긴 대화와 반복 수정에도 규칙이 흔들리지 않게 했습니다.
2. 게임 구현: TypeScript, Vite, Phaser로 로그인 없는 브라우저 게임을 만들었습니다. fixed timestep, seeded RNG, 이동·충돌·stage scheduler를 Phaser와 분리된 순수 simulation으로 구현했고, terminal command, approval wall, context compaction, retry, Ultra Code, parallel agents, review, usage limit, Download Access, rm * blackout을 각기 다른 예고와 회피법으로 만들었습니다.
3. 표현과 사운드: Codex terminal, browser error, agent response가 같은 색으로 뭉개지지 않도록 문법 token별 서체·색·glyph를 나눴습니다. 외부 음원 없이 Web Audio oscillator로 BGM과 pattern cue를 합성하고 stage가 오르면 tempo와 밀도가 상승하게 했습니다.
4. QA와 배포: Codex가 unit/regression test, deterministic seed sweep, viewport·resize·focus lifecycle 점검, dependency·secret·source map·저장 데이터·라이선스 감사를 수행했습니다. production build와 공개 URL의 asset hash, sessionStorage, canvas backing resolution, console error까지 대조하고 Sites에 배포했습니다.

[Codex로 구현하거나 해결한 핵심 문제]

- 화면 크기에 따라 난이도와 글자 선명도가 달라지던 문제를 QHD logical arena와 FHD/QHD별 high-density backing canvas로 분리해, 판정 비율은 같고 작은 글자는 고해상도로 보이게 했습니다.
- 초기 APPROVAL wall은 가로 방향에서 사실상 피하기 어려웠습니다. Codex가 이동 거리와 warning 예산을 계산하고 3–4개의 문장형 opening, player보다 느린 wall, 실제 label과 collision geometry의 동일 정렬을 테스트로 고정했습니다.
- 여러 특수 공격이 같은 순간 겹치거나 후반 pattern이 굶는 문제를 최소 360ms onset, 동시 major family 3개 상한, round-robin scheduler로 해결했습니다.
- Ultra Code의 safe sector가 화면 밖을 향하는 억까를 막기 위해 edge·corner에서는 120° gap이 arena 안쪽을 향하도록 고정했습니다. rm *에는 720ms warning과 가려졌다 나온 projectile의 180ms reveal grace를 추가했습니다.
- blur/hidden 상태에서도 timer가 흐르거나 키가 눌린 채 남는 문제를 lifecycle controller와 held-key reset으로 막았고, 피격·재시작·Esc 취소·4분 ending의 상태 전환을 회귀 테스트로 검증했습니다.
- 실제 파일이나 Codex session을 읽는 것처럼 보일 수 있는 콘셉트이므로 모든 task feed를 고정된 fictional parody로 만들었습니다. 게임에는 OpenAI API, 계정, 서버 DB, analytics가 없고 session 최고 기록 숫자 하나만 브라우저 sessionStorage에 보관합니다.

[개발자가 직접 결정하고 진행한 부분]

개발자는 “Codex가 일하는 동안 생기는 대기 시간을 게임으로 바꾼다”는 원안, one-hit 생존 장르, WASD 조작, 흰 Codex task surface, 개발자·Codex 경험을 공격으로 패러디한다는 방향을 정했습니다. 각 iteration을 직접 플레이하며 마우스 조작을 키보드로 바꾸고, 플레이어 icon, 글자 크기, command syntax, approval opening, context token 낙하, Download Access, Ultra Code safe sector, rm * blackout 등 공격의 의미와 체감을 선택·수정했습니다. 또한 최종 썸네일, 공개 범위, 난이도와 제출 우선순위를 승인했습니다.

Codex는 이 결정들을 코드와 테스트로 구현하고 대안을 제시했으며, 개발자는 플레이 결과를 보고 채택·거절·재설계하는 product owner, game director, QA 역할을 맡았습니다. 즉, Codex가 대부분의 구현과 반복 검증을 담당했지만 게임의 콘셉트와 최종 규칙·미감·난이도 판단은 사람이 직접 내렸습니다. Codex는 개발 도구로 사용했으며 게임 runtime에서 AI 응답이나 OpenAI API를 호출하지 않습니다.

## 공식 요건 확인

### 필수

- [x] 브라우저에서 바로 실행되는 웹 빌드
- [x] 심사위원이 승인·설치·로그인 없이 접근 가능한 공개 HTTPS 링크
- [x] 게임 제목 80자 이내
- [x] 게임 소개 200자 이내
- [x] 16:9 PNG 썸네일 10MB 이내
- [x] 시작 화면에 조작법과 실행 방법 안내
- [x] 챌린지 기간에 새로 개발한 범위 설명

### 선택 가산점

- [ ] 3분 이내 실제 플레이 데모 영상 URL — 사용자 업로드 후 입력
- [x] Codex 사용 위치·구현 기능·해결 문제·사람의 결정 구분 설명

### 참가자 입력에서 별도로 준비할 정보

- Google 로그인 계정과 수상 연락 이메일
- 성명, 외부 공개 팀명, 선택 소속
- 거주 국가, 생년월일, 긴급 연락처
- 서울 본선 참석 가능 여부와 행사 안내 수신 여부
- 참가 약관, 개인정보 수집·이용과 국외 이전 동의
- 거주 국가·연령에 따라 필요한 법정대리인 동의

## 최종 릴리스 감사

- `pnpm check`: typecheck, 16개 test file의 131개 test, production build, production verifier 통과
- `pnpm audit --prod`와 전체 `pnpm audit`: 알려진 취약점 0건
- source map, production QA query, API key·token·환경 변수, 사용자 로컬 경로 노출 없음
- 앱 자체 backend, 계정, cookie, analytics, 외부 API·WebSocket, PII 수집 없음
- production dependency와 font의 라이선스 전문을 `THIRD_PARTY_LICENSES.txt`로 배포
- 공개 URL은 누구나 접근 가능한 `public`이다. `noindex`는 검색 억제일 뿐 접근 제어가 아니다.

남은 호스팅 제한: Sites는 존재하는 정적 asset을 애플리케이션 Worker보다 먼저 응답해 Worker에 선언한 보안 header와 immutable cache가 정상 200 응답에는 적용되지 않는다. HTML의 CSP·referrer·robots meta와 `robots.txt`는 적용되며, 사용자 입력·backend·개인정보가 없는 정적 게임이라 직접 악용 가능성은 낮은 accepted risk로 기록한다. 대회 iframe 호환 가능성을 위해 frame 차단은 추가하지 않는다.

## 제출 직전 수동 확인

1. 시크릿 창과 휴대전화 데이터 네트워크에서 링크가 로그인 없이 열리는지 확인한다.
2. FHD와 QHD에서 시작→이동→피격→새 run, `Esc`, mute, tab 전환 pause를 한 번씩 확인한다.
3. 업로드한 썸네일 preview가 잘리지 않는지 확인한다.
4. 데모 영상 링크를 로그아웃 상태에서 열어 본다.
5. 신청서 제출 후 완료 화면을 캡처하고, 8월 27일 심사 종료 전까지 production을 변경하지 않는다.
