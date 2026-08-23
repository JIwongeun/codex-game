# AGENTS.md

## 프로젝트 임무

이 저장소는 OpenAI Game Builders Seoul 2026 Track 1 제출작을 위한 브라우저 게임이다.

- 작업명: `await CODEX: CONTEXT//OVERFLOW`
- 콘셉트: Codex에게 작업을 맡기고 기다리는 짧은 공백 동안 플레이하는 무한 생존 게임
- 핵심 루프: `WASD` 또는 방향키로 작은 정사각형 agent node를 이동 → 개발·Codex 작업 로그와 범위 오류를 회피 → 한 번 피격 시 종료 → 생존 기록 갱신
- 시각 방향: Codex task surface를 연상시키는 흰 화면과 흑백 HUD를 base로 삼되, 공격은 출처에 따라 terminal·browser·Codex의 서체·문구·glyph·색 문법을 각각 사용한다. 시작 화면은 original context-loop mark, 상단 task status와 저대비 ambient attack feed로 게임의 정체성을 먼저 전달한다. 사각형과 선·문자·패턴 중심이다.
- 제출 목표일: 2026-08-25, 공식 접수 종료일 2026-08-26은 장애 대응 버퍼로 취급

## 작업 시작 전에 읽을 문서

아래 순서로 현재 상태를 확인한다.

1. `docs/PROJECT.md` — 제품 범위와 게임 규칙
2. `docs/DESIGN.md` — 시각 시스템, 공격 언어, 공정성 규칙
3. `docs/TECHNICAL.md` — 아키텍처와 서버 경계
4. `docs/DELIVERY.md` — 일정, 완료 조건, 제출 체크리스트
5. `docs/DECISIONS.md` — 확정 결정과 변경 이유
6. `docs/WORKLOG.md` — 직전 작업, 검증 결과, 다음 행동

문서와 코드가 충돌하면 실제 동작과 테스트 결과를 먼저 확인하고 같은 작업에서 문서를 고친다. 제품 방향을 임의로 확장하지 않는다.

## 우선순위

1. URL 접속만으로 로그인·설치 없이 바로 시작할 수 있는가
2. 이동, 예고, 판정, 종료, 재시작이 버그 없이 동작하는가
3. 공격의 위험 범위와 발동 시점을 색상 없이도 읽을 수 있는가
4. 개발자와 Codex 사용자가 공격의 농담과 개연성을 즉시 이해하는가
5. viewport, pause, 오디오, 로컬 기록, 배포가 안정적인가
6. 실제 플레이 피드백으로 난이도와 연출을 조정할 수 있는 구조인가
7. 랭킹과 계정은 제출 필수 품질 뒤의 최후순위다

## 고정 제품 제약

- 현재 개발 배포는 소유자 전용으로 유지하고 제출 직전에만 공개한다.
- 첫 방문자는 계정, 닉네임, 프로필 생성 없이 게스트로 시작한다.
- 시간 제한은 없다. 한 번 피격되면 종료하며 생존 시간을 기록한다.
- 조작은 `WASD`와 방향키다. 실제 OS cursor는 게임 판정에 사용하지 않는다.
- 클릭 또는 Space는 시작·재시작·pause 해제에 사용한다.
- 사용자에게 보이는 완전한 화면은 시작 화면과 게임 화면 두 개뿐이다. 내부 `results` phase는 마지막 run 정보를 보존하는 논리 상태이며 별도 결과 화면을 만들지 않고 시작 화면에 `LAST RUN`과 피격 원인만 갱신한다.
- blur/hidden pause에서는 simulation과 타이머를 멈추고 held movement key를 비운다.
- 게임은 전체 browser viewport를 Phaser `RESIZE` arena로 사용한다.
- 백엔드 없이도 게임이 끝까지 플레이되어야 한다.
- 랭킹을 추가한다면 비동기 점수 공유만 사용하며 실시간 multiplayer는 만들지 않는다.
- OpenAI API 호출은 핵심 플레이에 포함하지 않는다.
- 사용자의 실제 파일, 앱 목록, Codex session 상태를 읽지 않는다.
- Codex·vibe coding 문구는 패러디다. 실제 승인, context, test, repository 상태처럼 오인시키지 않는다.
- OpenAI 로고, 상표, 캐릭터를 복제하지 않는다. 개발 도구의 구조적 인상만 사용한다.
- 시작 화면의 game mark는 black square·white context loop·violet core로 만든 original symbol을 사용하며 OpenAI knot나 Codex 제품 logo를 모사하지 않는다.
- 색은 각 작업 surface 안에서 의미에만 연결하며 장식용 무작위 색을 만들지 않는다. terminal은 ANSI식 의미색, browser는 page/error 계열, Codex는 tool/review/context violet 계열을 사용한다.
- 기본 `log`에는 예고선과 motion rail을 표시하지 않는다. 그 외 projectile 예고선은 112px, motion rail은 28px를 넘지 않는다. player는 정적인 정사각형 아이콘이며 blink·방향 notch·화살표·corner mark를 추가하지 않는다.
- 발표 문구는 사용자가 요청할 때만 작성한다.

## 기술 기준

- 패키지 관리자: `pnpm`
- 언어와 빌드: TypeScript + Vite
- 게임 엔진: Phaser 3
- UI: 게임 Canvas와 최소 DOM만 사용
- 게임 규칙과 판정은 Phaser Scene에서 분리된 순수 simulation으로 유지한다.
- 시간 기반 동작은 frame 수가 아니라 fixed timestep과 delta time을 사용한다.
- 새 production dependency는 핵심 구현에 꼭 필요할 때만 추가하고 이유를 기록한다.

## 구현 경계

- `core/`: state, seeded RNG, 난이도, spawn, movement, collision. Phaser를 import하지 않는다.
- `input/`: 키 입력과 lifecycle reset.
- `presentation/`: Graphics/Text 렌더링과 HUD. 판정 상태를 변경하지 않는다.
- `runtime/`: fixed timestep.
- `services/`: local best와 sound.
- `scenes/`: 위 모듈을 연결하고 lifecycle과 event만 조정한다.

기본 `log` 공격은 생성·예고·이동 중 player 좌표를 읽지 않는다. `review`만 생성 순간 player 위치를 snapshot하고 이후 재조준하지 않는다. 범위 공격은 warning 중 무해하고 active 단계에서만 치명적이어야 한다.

## 범위 제한

MVP 이전에는 다음을 구현하지 않는다.

- 실시간 multiplayer, 채팅, 친구 기능
- 사용자 계정, 이메일, 소셜 로그인
- 여러 맵, 스킨 상점, 업적, 스토리 모드
- 복잡한 장비·스킬 트리
- 완전한 치트 방지 또는 서버 권위형 simulation
- 실제 Codex 작업 상태 연동

## 작업 방식

- 가장 작은 플레이 가능한 변경을 만든다.
- 기존 스타일을 따르고 요청과 무관한 코드나 문서를 정리하지 않는다.
- 제품 결정이 달라지면 `docs/DECISIONS.md`에 새 결정과 대체된 결정을 기록한다.
- 의미 있는 작업이 끝나면 `docs/WORKLOG.md`에 변경, 검증, 남은 위험, 다음 행동을 추가한다.
- 비밀값은 커밋하지 않는다. 공개 가능한 변수명만 `.env.example`에 둔다.
- 중요 분기에서 검증된 상태를 commit하고 요청된 remote와 owner-only production에 push한다.

## 필수 검증

```bash
pnpm check
```

`pnpm check`는 typecheck, unit test, production build를 모두 통과해야 한다. 플레이가 바뀌면 최소한 다음을 확인한다.

- Ready → Playing → Results → Retry
- WASD·방향키 이동과 대각선 속도 정규화
- viewport resize 중 player와 hazard 경계 유효성
- `log` 경로가 player 위치와 무관함
- `review`가 snapshot 조준 뒤 재조준하지 않음
- 범위 공격 warning 무해·active 치명
- blur/hidden pause와 held-key reset
- 개발 전용 `?qaElapsedSeconds=84` Stage 8 조합 공격 확인
- production build에서 개발 query가 무시됨

검증하지 못한 항목은 완료했다고 표현하지 말고 WORKLOG에 남긴다.
