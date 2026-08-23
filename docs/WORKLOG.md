# 작업 기록

가장 최근 항목이 위로 오도록 기록한다. 각 항목은 사실로 확인한 내용만 포함한다.

## 2026-08-23 — native cursor·전체 viewport·공격 UI 재설계

### 접근 제어

- Sites access mode를 `public`에서 `custom`으로 변경
- 허용 사용자는 project owner 1명, 허용 group과 외부 방문자는 0명으로 확인
- 최종 제출 직전 다시 public으로 전환해야 함을 DELIVERY와 DECISIONS에 기록

### 구현

- 속도 기반 삼각형 추적과 WASD/방향키 이동을 제거하고 native pointer 좌표를 player 좌표에 1:1 반영
- 고정 1280×720 `FIT` Canvas를 Phaser `RESIZE` 전체 viewport arena로 전환
- live resize 시 player, memory leak, context sweep를 새 경계에 맞추는 순수 simulation 경계 추가
- `TAB STORM`을 같은 edge에서 들어오는 browser-tab volley와 점선 예고, presentation-only 잔상으로 교체
- `POP-UP`을 window silhouette, dotted trajectory, target marker로 재설계
- `MEMORY LEAK`을 회전 pixel rings와 orbit fragments로, `CONTEXT OVERFLOW`를 scan stripe band로 재설계
- player triangle과 hitbox indicator를 모두 제거하고 브라우저 native cursor 자체만 플레이어로 표시
- `Pretendard Variable` dynamic subset을 self-hosted build asset으로 추가하고 font load 뒤 Phaser를 boot하도록 변경
- warm white/black base 위에 TAB blue, POP-UP amber, MEMORY LEAK violet, CONTEXT OVERFLOW red, running green의 의미 기반 accent palette 적용
- rounded pop-up과 smooth circle을 square window, pixel ring, stepped trail로 바꿔 digital tool 질감 강화
- HUD를 전체 viewport에 반응하는 최소 상태·시간·warning UI와 browser error page형 overlay로 재구성

### 검증

- `pnpm typecheck` 통과
- Vitest 5 files, 31 tests 통과
- direct pointer coordinate, viewport edge clamp, live resize, responsive arena, deterministic input stream, 모든 공격 단계와 개체 상한 검증
- Worker/client production build 통과
- source commit `07d703d`를 Sites production version 4로 owner-only 배포
- production에서 1272×1272와 375×812 모두 Canvas rect가 viewport와 정확히 일치하고 body overflow가 없음을 확인
- production에서 `Pretendard Variable` load, native `cursor: default`, Ready → Playing → Results, TAB blue trail, POP-UP amber warning과 square window를 확인
- 개발 시간 점프에서 violet pixel-ring `MEMORY LEAK` warning을 확인하고 browser console error/warning이 없음을 확인
- 배포 후 access mode `custom`, owner 1명, group 0개, 외부 방문자 0명 유지 확인

### 남은 작업

- 실제 플레이 결과로 공격 속도·간격·warning 시간을 조정

## 2026-08-23 — 흑백 브라우저 디자인과 무한 생존 코어 전환

### 제품 방향 변경

- 네온 격자, 상단 bar, Context 게이지, panel overlay를 제거하고 흰 웹페이지와 Canvas가 이어지는 브라우저 오류 페이지 스타일로 전환
- 90초 토큰 수집·꼬리·`COMPACT` 구조를 죽림고수 기반 한 번 피격 무한 생존 구조로 대체
- 점수를 생존 밀리초로 단순화하고 `localStorage` key를 `await-codex.best-survival-ms.v2`로 분리

### 구현

- 마우스 포인터를 따라가되 가까우면 멈추는 이동과 WASD/방향키 대체 입력
- `TAB STORM`: 화면 사방에서 포인터 방향으로 날아오는 직선 공격
- `POP-UP`: 12초 이후 진행 경로를 예고한 뒤 돌진하는 직선 공격
- `MEMORY LEAK`: 24초 이후 원형 경고 뒤 짧게 활성화하는 범위 공격
- `CONTEXT OVERFLOW`: 42초 이후 수평 또는 수직 band를 경고한 뒤 활성화하는 범위 공격
- 15초 단위 level, 120초까지 연속 상승하는 속도·간격·동시 공격 수, 개체 상한
- 한 번 피격 종료, 생존 기록, 회피 통계, 클릭/Space 즉시 재시작
- 흑백 renderer와 HUD가 공유하는 `presentation/theme.ts` 추가
- 개발 전용 `?qaElapsedSeconds=45` 후반 공격 검증 경로 추가

### 검증

- `pnpm check`: typecheck, 5 files의 28 tests, Worker/client production build 통과
- 동일 seed·입력 stream 결정성, 무입력 정지, arena clamp, 예고 중 무해, 활성 후 피격, 직선·원형·band 충돌, 모든 공격 단계 spawn, 결과 상태 동결, entity 상한 검증
- 실제 브라우저와 production 정적 preview에서 시작 화면, 마우스 이동, 초반 직선 공격 회피, 45초 단계의 원형·band 예고, 한 번 피격 결과 화면 확인
- 브라우저 console error/warning 없음
- source commit `cf889b2`를 Sites production version 2로 배포
- 공개 URL에서 Ready → Playing → 피격 Results → Retry, 로컬 최고 생존 기록 갱신, 새 JavaScript bundle과 `og.png` 응답 확인

### 남은 위험

- 난이도 수치는 자동 검증 가능한 1차 기준이다. 실제 사용자의 첫 사망 시간 분포를 보고 공격 간격과 예고 시간을 조정해야 한다.
- Cloudflare plugin의 로컬 Worker preview에서만 Canvas가 mount되지 않는 현상이 있었지만 동일 production asset의 정적 preview와 실제 Sites production에서는 정상 동작했다. 배포 correctness는 공개 URL 결과를 기준으로 확인했다.

### 다음 행동

1. 실제 사용자의 초반 생존 시간과 사망 원인을 보고 수치를 한 차례 조정한다.
2. 12초·24초·42초 단계의 체감 난이도와 예고 시간을 조정한다.
3. 제출용 썸네일과 플레이 영상을 준비한다.

## 2026-08-23 — 공개 HTTPS 배포와 외부 실행 검증

### 완료한 변경

- Cloudflare Vite plugin과 얇은 Worker asset adapter를 추가해 client와 hosting bundle을 한 번에 build하도록 구성
- Sites project를 public access로 만들고 source commit `75b3e21`을 production version 1로 배포
- 공개 URL 확정: [https://await-codex-context-overflow.jygjyg99.chatgpt.site](https://await-codex-context-overflow.jygjyg99.chatgpt.site)
- hosting project 식별자만 `.openai/hosting.json`에 저장하고 배포 credential은 저장소와 bundle에 남기지 않음
- 서버 API, DB, 계정, session 없이 브라우저 단독 플레이와 로컬 최고점만 유지

### 검증

- `pnpm check`: typecheck, 5 files의 36 tests, Worker/client production build 통과
- 로컬 production Worker에서 root와 SPA fallback, hashed JavaScript asset 응답 확인
- 공개 root HTML과 hashed JavaScript asset이 HTTP 200으로 응답함을 확인
- 공개 브라우저에서 Ready 화면, 클릭 시작, 90초 타이머 진행, 마우스 이동과 클릭 `COMPACT` 확인
- 공개 브라우저 console에는 Phaser 시작 정보 외 warning/error 없음
- 로그인, 승인, 개발자 PC 실행 없이 공개 URL만으로 진입 가능

### 알려진 배포 특성

- 현재 게임은 client-side router가 없는 단일 root 페이지라 제출 URL에는 영향이 없지만, 공개 host에서 임의의 존재하지 않는 path는 404를 반환한다. route를 추가할 때 SPA fallback을 다시 설정하고 검증한다.
- 공개 host의 asset cache header는 hosting provider가 제어한다. 현재 correctness에는 영향이 없으며 bundle 분할과 초기 로딩 최적화는 플레이 polish 이후에 판단한다.

### 다음 행동

1. 다른 PC 또는 휴대폰 네트워크에서 공개 링크를 한 번 더 수동 확인한다.
2. 초반 난이도, COMPACT 보상, 타격감과 적 개성을 플레이 테스트로 조정한다.
3. 썸네일과 3분 이하 플레이 영상을 준비한다.

## 2026-08-23 — 플레이 가능한 Phaser 1차 MVP 연결

### 완료한 변경

- 단일 `GameScene`에서 Ready → Playing → Results → Retry 흐름 연결
- 마우스, WASD/방향키, 클릭, Space의 edge-triggered 입력 controller 구현
- touch drag 이동과 짧은 tap `COMPACT` fallback 구현
- domain state만 읽는 Graphics renderer와 HUD 구현
- fixed timestep accumulator, frame delta 제한, background suspend/resume latch 구현
- 손상 값과 접근 실패를 견디는 versioned local best score 구현
- 사용자 입력 이후 활성화되는 Web Audio 기반 기본 효과음과 `M` 음소거 구현
- production에 포함되지 않는 DEV 전용 `?qaRunSeconds=5` 종료 검증 경로 구현
- 추적 적의 경계 순간이동을 제거하고 초반 생성·피격 회복 수치 조정
- 독립 아키텍처 리뷰에서 발견한 AudioContext Promise rejection, 시작/재시작 시 held-key 초기화, Scene 재진입 상태 잔존 문제 수정

### 자동 검증

- `pnpm check`: 통과
- Vitest: 5 files, 36 tests 통과
- production build: 통과
- 알려진 비차단 경고: Phaser를 포함한 JavaScript chunk가 Vite 기본 500 kB 경고를 넘음. gzip 약 328 kB

### 실제 브라우저 검증

- production preview에서 계정·이름·서버 요청 없는 Ready 화면 확인
- 첫 클릭은 시작만 수행하고 `COMPACT`로 재사용되지 않음
- 마우스 이동, 토큰 수집, 클릭 `COMPACT`, 점수 확정 확인
- 사망 결과, 클릭/Space 재시작, run state 초기화 확인
- 로컬 최고점 저장과 reload 후 유지 확인
- `M` 음소거 상태 표시 확인
- 1280×720, 1024×768, 375×812에서 Canvas FIT와 상태 유지 확인
- DEV 5초 run에서 시간 종료, 생존 보너스 1,500점, Results, 재시작 확인
- production에서 `qaRunSeconds` query가 무시되고 90초로 시작함을 확인
- browser console warning/error 없음
- 최종 production build에서 Ready 화면과 약 20초 플레이·사망 Results 흐름을 재검증

### 남은 위험

- 자동화 브라우저가 background animation을 제한해 production의 실제 벽시계 90초 완주는 수행하지 못했다. domain에서 5,400 tick 종료를 검증했고 DEV 단축 run으로 같은 Scene 종료 경로를 검증했다.
- 실제 window blur와 touch device gesture는 자동화 surface에서 직접 재현하지 못했다. handler, accumulator reset, touch gesture 경계는 코드와 단위 검증 대상으로 유지한다.
- 모바일 portrait에서는 16:9 Canvas 전체가 보이지만 글자가 작다. 모바일 최적화는 현재 컷 기준상 후순위다.
- 공개 배포, 외부 Chrome/Edge 확인, 썸네일과 영상은 아직 남아 있다.

### 다음 행동

1. 실제 사용자 graybox 테스트로 초반 난이도와 COMPACT 보상 감각을 조정한다.
2. 타격감, 적 개성, 개발자 패러디 연출을 고도화한다.
3. 제출 직전에 공개 배포, 외부 브라우저, 썸네일과 녹화물을 검증한다.

## 2026-08-23 — 결정론적 게임 코어 구현

### 완료한 변경

- Phaser와 분리된 model, math, seed RNG, rules, simulation 모듈 구현
- 60 Hz 기준 이동, 화면 wrap, 토큰 수집, 꼬리 성장 구현
- Context 단계별 배율, `COMPACT` 점수 확정과 충격파 구현
- Context 24개와 2초 Overflow 피해 구현
- `TAB SWARM`, `MEMORY LEAK`, `NOTIFICATION`의 생성·이동·분열·예고/돌진 규칙 구현
- 피격, 무적, 목숨 소진, 90초 종료, 생존 보너스, 재시작 상태 구현
- Graphify 지식 그래프 생성: 240 nodes, 478 edges, 12 communities

### 검증

- `pnpm check`: 통과
- Vitest: 3 files, 25 tests 통과
- 25개 seed × 최대 5,400 tick soak에서 NaN, 음수 상태, 개체 상한 초과 없음
- 같은 seed와 입력 stream의 최종 state 일치
- 정확한 90초 종료, COMPACT/충돌 우선순위, 무적, Overflow 단발 피해, 결과 상태 불변 검증

### 남은 위험

- core가 아직 Phaser Scene과 연결되지 않아 실제 조작감은 검증하지 않았다.
- 현재 수치는 자동 검증용 1차 기준이며 브라우저 플레이 후 조정이 필요하다.

### 다음 행동

1. 입력 controller, renderer, HUD, local best service를 구현한다.
2. GameScene에서 fixed timestep과 lifecycle을 연결한다.
3. production 브라우저에서 시작부터 재시작까지 직접 검증한다.

## 2026-08-23 — 저장소 초기화와 개발 기반 구성

### 목표

- 빈 Git 저장소의 현재 상태를 확인한다.
- 제품, 기술, 서버 경계, 일정과 장기 작업 지침을 문서화한다.
- TypeScript + Vite + Phaser 3 개발 환경을 만든다.

### 확인한 초기 상태

- Git tracked file 없음
- worktree 변경 없음
- 기존 `graphify-out/graph.json` 없음
- Node.js 24.13.1, npm 11.8.0, pnpm 11.19.0 사용 가능

### 완료한 변경

- 루트 `AGENTS.md`와 문서 읽기 순서 정의
- 제품 및 게임 규칙 문서 작성
- 클라이언트/랭킹 서버 경계 문서 작성
- 3일 일정과 제출 체크리스트 작성
- 결정 기록 작성
- TypeScript + Vite + Phaser 3.90 + Vitest 스캐폴드 생성
- 1280×720 반응형 Phaser boot 화면 생성
- pnpm lockfile 생성
- 로그인이나 이름 입력 없이 익명으로 즉시 진입하는 요구사항 확정
- 글로벌 랭킹과 게스트 식별 구현을 제출 필수 작업 이후의 최후순위로 변경

### 검증

- `pnpm typecheck`: 통과
- `pnpm test`: 1 file, 2 tests 통과
- `pnpm build`: 통과
- production preview: 1280×720 Canvas 렌더링 확인
- 브라우저 console warning/error: 없음
- 알려진 비차단 경고: Phaser가 포함된 초기 JavaScript chunk가 Vite 기본 500 kB 경고 기준을 넘는다. gzip 약 320 kB이며 현재 boot 시간에 문제는 확인되지 않았다.

### 남은 위험

- 실제 핵심 루프의 재미가 아직 검증되지 않았다.
- 글로벌 랭킹 공급자와 배포 공급자는 아직 선택하지 않았다.
- 공식 접수 종료 시각이 공개 페이지에 명시되지 않았다.

### 다음 행동

1. 이동 → 토큰 → 꼬리 → COMPACT graybox를 구현한다.
2. 실제 조작으로 위험/보상 루프를 검증한다.
3. 재미가 확인된 뒤 적과 90초 세션을 추가한다.
