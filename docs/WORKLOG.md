# 작업 기록

가장 최근 항목이 위로 오도록 기록한다. 각 항목은 사실로 확인한 내용만 포함한다.

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
