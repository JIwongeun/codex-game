# 디자인 및 게임플레이 계획

## 한 문장

`Codex is working.` 화면에서 작은 정사각형 agent node를 움직여, 행동 자체가 개발 용어를 패러디하는 공격을 피하며 오래 버틴다.

이 게임은 Codex UI 복제품이 아니다. 흰 task surface, 건조한 상태 문구, 넓은 여백과 개발 작업의 인과관계를 terminal arcade 문법으로 번역한다.

## 핵심 설계 원칙

공격 이름과 움직임은 분리될 수 없다. 이름을 다른 개발 용어로 바꿔도 성립하는 공격은 다시 설계한다.

- `REVIEW REQUEST`는 요청 시점의 player 위치를 snapshot하고 이후 재조준하지 않는다.
- `RETRY`는 같은 snapshot과 같은 목적을 시간차로 반복한다.
- `git branch --all`은 한 줄로 수렴한 뒤 여러 `BRANCH`로 분할된다.
- `READ()`와 `WRITE()`는 같은 자원을 반대편에서 동시에 차지하려 한다.
- 여러 `change +N`은 `git merge` 지점으로 모이고, 결과가 `BUG!` 탄으로 전방위 발산한다.
- `CONTEXT`는 0%에서 MAX까지 차오르는 동안만 피할 수 있고 MAX 순간 지정 영역이 활성화된다.

상단 중앙에 공격 이름이나 설명 자막을 띄우지 않는다. 화면 안의 문구, 궤적, 수렴과 분할만으로 행동을 이해하게 한다.

## 감정 목표

- 첫 3초: “Codex 기다릴 때 하는 게임이구나”를 이해한다.
- 첫 15초: 익숙한 문구 자체가 공격으로 날아오는 상황에서 웃는다.
- 첫 45초: 랜덤 탄, snapshot 조준, 점 폭발과 반복 공격의 차이를 학습한다.
- 72초 이후: branch 분할과 merge 폭발이 겹치며 패턴 조합을 읽는다.
- 사망 직후: 피격 원인이 명확하고 바로 다시 시작하고 싶다.

## 시각 시스템

### Palette와 Typography

- 바탕과 HUD는 white, black, gray를 유지한다. 공격은 하나의 terminal skin으로 통일하지 않고 `terminal`, `browser`, `codex` 작업 surface별 시각 문법을 사용한다.
- HUD와 overlay는 self-hosted `Pretendard Variable`을 사용한다. 공격은 surface에 따라 10–11px monospace 또는 Pretendard/system sans를 선택한다.
- 투사체는 큰 사각 UI block이 아니라 실제 command, browser error, tool-state처럼 작고 보통 굵기인 한 줄 문구다.
- 문구 기준선은 진행 벡터와 평행하게 회전한다. 뒤집혀 읽히는 각도는 180도 보정하되 충돌 사각형의 방향은 동일하게 유지한다.
- 얇은 흰 외곽 stroke를 사용한다. 기본 `LOG STREAM`에는 방향선과 rail을 전혀 표시하지 않고, 조준·반복·교차 공격만 14–28px rail과 최대 112px 점선 예고를 사용한다.
- 둥근 pill, gradient, 장식용 card, 작은 chip 군집은 사용하지 않는다.

| 역할 | 값 | 사용 범위 |
|---|---|---|
| surface | `#FFFFFF` | 전체 Canvas와 label clearance |
| ink | `#171717` | HUD, player, 일반 UI |
| muted | `#686868` | 보조 상태와 조작 안내 |
| terminal command | `#246B92` | `$ pnpm`, `$ git`, shell prompt |
| terminal success | `#287A50` | `branch`, `read()`, change |
| terminal warning | `#9A5B13` | `warning:`, `rebase`, `write()` |
| terminal error | `#B83D45` | `error:`, `failed`, `TS2322`, `BUG!` |
| browser ink | `#465160` | 일반 page 상태 |
| browser accent | `#356DA5` | page 응답·navigation 상태 |
| browser error | `#B64747` | `404`, `ERR_*`, network failure |
| Codex tool | `#6754A3` | tool, review, retry, context 상태 |

색은 패턴을 이해하는 유일한 단서가 아니다. 문구, 이동, 짧은 예고선과 warning/active 상태가 색 없이도 공격을 구분해야 한다. 같은 의미에는 언제나 같은 색을 쓰고 entity마다 임의 accent를 배정하지 않는다.

### 작업 surface별 문법

| surface | 서체·크기 | 문구 문법 | 형태 |
|---|---|---|---|
| Terminal | system monospace 10–11px | `$ command`, `error:`, `warning:`, `git:` | 별도 box 없이 shell text 자체. command/success/warning/error 의미색 사용 |
| Browser | Pretendard/system sans 10px | `404 Not Found`, `ERR_CONNECTION_REFUSED`, `PAGE_UNRESPONSIVE` | 문구 앞에 6×8 page-outline glyph. browser ink/accent/error 사용 |
| Codex | Pretendard Variable 10–11px | `codex:`, `[review]`, `[context]`, `retry n/m` | 문구 앞에 3×3 tool-state square. context만 별도 progress field 사용 |

- 한 projectile은 한 줄, 약 26자 이하를 목표로 한다. `MAX`, `BUG!`, error code처럼 즉시 판독할 token만 대문자를 허용한다.
- surface는 label 문자열을 보고 renderer가 추측하지 않는다. core `ProjectileState.surface`에 `terminal | browser | codex`로 명시한다.
- label 뒤에 큰 box, pill, badge를 붙이지 않는다. 흰 배경 가독성을 위한 2px white stroke만 허용한다.
- 실제 제품 로고나 browser favicon을 복제하지 않고 page outline, tool square 같은 범용 glyph만 사용한다.

### 선과 Motion

- 기본 `LOG STREAM`은 무작위 edge-to-edge 흐름이므로 telegraph dot, motion rail, 화살촉을 모두 표시하지 않는다.
- 조준·반복·교차 projectile telegraph는 2px dot, 14px 간격, 60–112px 길이로 공격 앞부분에만 둔다.
- 해당 projectile의 active motion rail은 1px 두께, 14–28px 길이로 문구 뒤에만 둔다. 끝점 block이나 화살촉을 붙이지 않는다.
- convergence sequence는 origin부터 중심까지 선을 잇지 않고, 이동 중인 문구 바로 뒤의 20px trail만 그린다.
- 회전은 실제 velocity와 평행하게 하되 글자가 거꾸로 보이면 읽기 방향만 180도 보정한다.
- 큰 scale pulse, 화면 전체 trajectory, 장식용 corner marker, 굵은 poster typography는 사용하지 않는다.

### Player

- 아이콘은 12×12 black square, 4×4 white inset, 2×2 Codex violet core로 구성한 정사각형 agent node다.
- 16×16 white clearance를 먼저 그려 흰 화면에서도 외곽이 공격 문구에 묻히지 않게 한다.
- 실제 피격 반경은 5px로 시각 외곽보다 작아 정밀 회피에 관용을 둔다.
- 아이콘은 시간과 입력 방향에 따라 변하지 않는다. blink, 폭 변화, 방향 notch, 화살표, corner mark를 표시하지 않는다.
- OS cursor, OpenAI logo, Codex logo를 모사하지 않는다.

### 화면 상태

- Start: 최초 진입과 game over 뒤에 모두 사용하는 하나의 화면이다. 상단에는 original context-loop mark와 `await CODEX`, background task 상태를 표시하고 같은 mark를 browser tab icon에도 사용한다. 본문은 `Codex is working.`, objective·control·fail state·last run·local best와 하나의 실행 CTA를 제공한다. game over 뒤에는 `LAST RUN` 값에 생존 시간과 정확한 피격 계열을 갱신한다. 뒤에는 실제 attack surface와 같은 terminal·browser·Codex 문구가 저대비 blur 상태로 천천히 떠다닌다.
- Game: 왼쪽 위 stage와 cleared, 오른쪽 위 현재 시간과 local best, 하단 조작과 fictional feed 고지만 유지한다.
- Pause는 별도 화면이 아니라 마지막 Game 장면 위의 일시적인 blur 계층이다.

## 7개 공격 패턴

| 해금 | 패턴 | 화면 문구 | 행동과 개연성 |
|---|---|---|---|
| Stage 1 | `LOG STREAM` | Terminal `$ pnpm test`, Browser `ERR_*`, Codex `codex: inspecting...` 등 | player 좌표를 전혀 읽지 않고 임의 edge에서 반대 edge로 흐른다. 세 작업 surface의 로그가 방향 예고 없이 작업 화면을 가로지른다. |
| Stage 2 | `REVIEW REQUEST` | `[review] approval required`, `git: needs rebase` 등 | 생성 순간 player 위치를 snapshot하고 짧은 점선 경로를 고정한 뒤 돌진한다. 코드가 움직여도 이미 요청된 review 대상은 바뀌지 않는다. |
| Stage 3 | `CONTEXT MAX` | `[context] 0–100%` | snapshot 지점의 정사각 context field가 차오른 뒤 0.5초 활성화된다. 경고 중에는 무해하다. |
| Stage 4 | `RETRY LOOP` | `retry 1/3`, `2/3`, `3/3` | 같은 snapshot을 향해 260ms 간격으로 같은 작업을 반복한다. 후반에는 최대 5회다. |
| Stage 5 | `FORK BOMB` | `$ git branch --all` → `branch` | 명령어 하나가 지정 지점으로 들어가고 완료 순간 8–16개 branch 탄으로 균등 원형 분할된다. |
| Stage 6 | `RACE CONDITION` | `read()` / `write()` | 같은 snapshot을 향해 화면 반대편 두 작업이 동시에 교차한다. 후반에는 수평·수직 pair가 최대 3쌍 겹친다. |
| Stage 7 | `MERGE → BUG!` | 여러 `change +N`, `$ git merge` → `BUG!` | 4–8개 변경이 player snapshot 지점으로 수렴한다. merge 완료 순간 12–20개 `BUG!` 탄이 원형 발산한다. |

`LOG`, `REVIEW`, `RETRY`, `RACE`, `BRANCH`, `BUG`는 각각 별도 projectile kind와 회전 사각 hitbox를 가진다. `CONTEXT MAX`만 warning/active를 갖는 area hazard다. `FORK`와 `MERGE`는 수렴 완료 시 projectile을 생성하는 sequence state다.

## 10단계 시간 곡선

Stage는 12초 단위다. Stage 10은 108초부터이며 모든 수치가 최고 난이도에 고정된다.

| Stage | 시간 | 변화 |
|---|---:|---|
| 1 | 0–11.99초 | 무작위 `LOG STREAM` |
| 2 | 12–23.99초 | snapshot `REVIEW REQUEST` 해금 |
| 3 | 24–35.99초 | 일점 `CONTEXT MAX` 해금 |
| 4 | 36–47.99초 | `RETRY LOOP` 3연사 해금 |
| 5 | 48–59.99초 | `FORK BOMB` 8방향 분할 해금, log 2연사 가능 |
| 6 | 60–71.99초 | `RACE CONDITION` 1 pair 해금, retry 4회 |
| 7 | 72–83.99초 | `MERGE → BUG!` 4개 수렴·12방향 발산 해금 |
| 8 | 84–95.99초 | context 2개, fork 12방향, race 2 pair 조합 |
| 9 | 96–107.99초 | log 3연사, retry 5회, merge 6개·16방향 |
| 10 | 108초 이후 | context 3개, fork 16방향, race 3 pair, merge 8개·20방향과 최대 속도·최저 간격 |

단계 사이에서 속도와 생성 간격은 연속 보간한다. 해금·동시 수·분할 수는 표의 stage 경계에서만 바뀐다.

## 공정성과 가독성 불변식

- 모든 조준·영역·수렴 공격은 치명 단계 전에 경로 또는 진행률을 보인다.
- 기본 `LOG STREAM`은 player를 조준하지 않고 방향 예고·rail도 표시하지 않는다. 생성 후 telegraph 시간 동안은 판정만 비활성이다.
- 조준점은 생성 뒤 추적하지 않는다. 움직여서 회피할 수 있어야 한다.
- 회전한 문구와 collision rectangle은 같은 각도를 사용한다.
- radial projectile은 폭발 중심에서 56px 떨어져 생성되어 중심에 있던 player를 즉시 판정하지 않는다.
- projectile은 최대 48개, context hazard와 convergence sequence는 각각 최대 4개다.
- entity cap에 걸리면 일부 탄만 안전하게 생략하고 결정성은 유지한다.
- 작은 viewport resize 후에도 player, context와 sequence 중심은 유효 범위에 남는다.

## 코드 책임

- `core/model.ts`: projectile, hazard, convergence sequence와 event 계약
- `core/rules.ts`: 12초 단위 Stage 1–10, 해금과 연속 난이도 곡선
- `core/simulation.ts`: seeded spawn, snapshot, 수렴·분할, 회전 충돌, entity cap
- `presentation/GameRenderer.ts`: 회전 텍스트, 경로, context progress, convergence와 particle 표현
- `presentation/ReadyOverlay.ts`: 최초 진입과 game over가 공유하는 Start DOM layout, original game mark, last run·local best와 ambient attack feed
- `presentation/Hud.ts`: Game 화면의 stage·시간·best만 표시. 공격명 announcement와 별도 Results UI는 금지
- `presentation/PauseOverlay.ts`: focus pause 표현
- `services/SoundService.ts`: warning, convergence burst, hit의 최소 tone

Presentation은 판정을 만들지 않고 simulation state만 그린다. 문구 폭과 방향에 필요한 hitbox는 simulation model에 명시한다.

## 현재 완료 조건

- 7개 패턴이 각각 문구의 의미와 일치하는 spawn·예고·이동·분할을 가진다.
- Stage 1–10 경계와 Stage 10 cap이 자동 테스트로 고정된다.
- 상단 중앙 공격 설명이 없고 실제 공격 표현만으로 판독 가능하다.
- 흰 task surface와 흑백 HUD, terminal·browser·Codex별 서체·glyph·의미색, 전체 viewport 규칙을 유지한다.
- typecheck, deterministic simulation tests, seeded entity-cap soak와 production build가 통과한다.
- owner-only production에서 사용자가 실제 가독성과 난이도를 확인한다.
