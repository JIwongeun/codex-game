# 디자인 및 게임플레이 계획

## 한 문장

`Codex is working.` 화면 위로 개발과 vibe coding의 골칫거리들이 밀려들고, 플레이어는 작은 `>_` task node를 움직여 최대한 오래 작업을 지킨다.

이 게임은 Codex UI 복제품이 아니다. 흰 task surface, 작은 상태 행, tool-call 같은 사각 블록, 간결한 진행 문구라는 구조적 인상을 게임 문법으로 번역한다.

## 감정 목표

- 첫 3초: “Codex 기다릴 때 하는 게임이구나”를 이해한다.
- 첫 15초: 익숙한 개발 문구가 공격으로 날아오는 상황에서 웃는다.
- 첫 45초: 랜덤 탄막, snapshot 조준, 자리 이탈, band 회피의 차이를 학습한다.
- 사망 직후: 원인이 명확하고 바로 다시 시작하고 싶다.

## 시각 시스템

### Palette

화면은 white, black, gray만 사용한다. 공격 종류는 색이 아니라 다음 조합으로 구분한다.

- `log`: 얇은 gray outline, 짧은 code chip, 점선 경로
- `review`: 큰 black outline modal, 굵은 제목, snapshot target line
- `context-max`: 정사각 progress field, 아래에서 위로 차는 gray/black fill
- `merge-conflict`: 긴 band, conflict marker 반복, hatch와 흑백 반전

### Typography

- 전 화면 `Pretendard Variable`을 사용한다.
- 제목은 굵고 짧게, 상태·공격 문구는 11–14px 수준의 compact log처럼 표시한다.
- 둥근 pill과 장식적 gradient를 사용하지 않는다.
- 위험 전조는 작은 글씨를 숨기지 않고 outline, fill progress, 반복 marker로 중복 전달한다.

### Player

- 16×16 안팎의 검은 정사각 `TASK NODE`를 사용한다.
- 내부에 흰색 `>_`를 pixel line으로 그린다.
- OS cursor, OpenAI logo, Codex logo를 모사하지 않는다.
- 판정 중심과 그림 중심을 일치시킨다.

## 화면 상태

### Ready

- 상단 작은 product mark: `CODEX / WAIT MODE`
- 주 문구: `Codex is working.`
- 보조 문구: `Use the wait time.`
- task row:
  - `> survive the queue`
  - `Move with WASD / arrow keys.`
  - `One hit ends the task.`
- 실행: `CLICK / SPACE TO RUN`
- 하단 고지: `PARODY SIMULATION · NOT CONNECTED TO YOUR CODEX SESSION`

### Playing

- 왼쪽 위: `TASK RUNNING`, level, cleared count
- 오른쪽 위: 현재 생존 시간과 local best
- 아래: 조작과 음소거 hint, 패러디 고지
- 위험 알림은 상단 중앙 한 줄만 사용한다.

### Paused

- 뒤 게임 화면을 blur한다.
- 중앙에 `TASK PAUSED`, 현재 시간, `CLICK / SPACE TO RESUME`만 표시한다.
- 전체를 불투명 panel로 덮지 않는다.

### Results

- `Task failed.`와 정확한 피격 원인을 표시한다.
- 생존 시간, local best, cleared count만 유지한다.
- `CLICK / SPACE TO RETRY`로 즉시 재시작한다.

## 공격 사양

| 순서 | 내부 kind | 표시명 | 공감과 개연성 | 움직임·판정 | 난이도 상승 |
|---|---|---|---|---|---|
| 1 | `log` | `ONE MORE CHANGE` | 끝났다고 생각하면 계속 생기는 수정, CI, tool log | 임의 edge에서 반대 edge의 임의 지점으로 이동. player 좌표를 생성·예고·이동 중 전혀 읽지 않는다. chip 사각 hitbox | 0초부터, 간격 1.15→0.32초, 속도 280→620, volley 1→4 |
| 2 | `review` | `APPROVAL REQUIRED` 계열 | 흐름 중간에 뜨는 승인·review 요청 | spawn 순간 player 위치만 snapshot. 약 0.95초 modal·점선 예고 후 고정 경로로 돌진, 재조준 없음 | 12초부터, 간격 5.8→2.8초, 속도 520→820 |
| 3 | `context-max` | `CONTEXT MAX` | 대화와 수정이 길어져 simulated context가 가득 참 | 고정된 정사각 영역이 0→MAX로 차오름. warning은 무해, MAX 순간 약 0.5초 내부 치명 | 24초부터, 간격 8.5→5.5초, 영역 132→216px |
| 4 | `merge-conflict` | `MERGE CONFLICT` | 끝나려는 순간 충돌하는 branch와 changes requested | 임의 수평·수직 band가 conflict marker로 닫힘. warning은 무해, 반전된 active 약 0.6초만 치명 | 42초부터, 간격 11→7초, 두께 90→140px |

120초 이후에는 수치를 고정한다. 새로운 규칙을 계속 추가하지 않고 기존 네 규칙의 조합 밀도만 올린다.

## 문구 Pool

### Generic development

- `CI: FAILED`
- `TS2322`
- `lint: 38 errors`
- `git commit --amend`
- `rebase required`
- `PR #404`
- `working tree dirty`
- `tests still running...`

### Codex·vibe coding

- `one more change`
- `retrying tool 3/3`
- `approval required`
- `context left: 12%`
- `reading AGENTS.md`
- `checking workspace...`
- `almost done`
- `fixing one last test`

### Review modal variants

- `APPROVAL REQUIRED`
- `REQUEST CHANGES`
- `NEEDS REBASE`
- `RUN COMMAND?`

공격 다양성은 같은 판정 계열 안에서 label, hitbox 폭, 진입 edge, target edge, axis, hatch·marker 리듬을 seeded 변형하는 방식으로 확보한다. 새 공격을 추가할 때도 기존 kind 하나에 억지로 예외를 넣지 말고, 새로운 예고·이동·판정 규칙이 실제로 필요할 때만 별도 kind로 추가한다.

이 문구는 모두 게임 안의 가상 상태다. 실제 repository, Codex task, context, approval 상태를 읽거나 표시하지 않는다. 숫자와 상태가 등장할 때는 ready/footer의 패러디 고지와 `SIM` 표기를 함께 유지한다.

## 공정성과 가독성 불변식

- 모든 공격은 치명 단계 전에 시각 경고가 있다.
- warning과 active는 fill/outline 반전으로 구분되며 색상에 의존하지 않는다.
- 기본 `log`는 player targeting을 절대 하지 않는다.
- `review`와 `context-max`는 spawn 후 위치를 추적하지 않는다.
- 75초 전에는 area hazard를 동시에 둘 이상 active로 만들지 않는다.
- projectile은 최대 28개, hazard는 최대 8개로 제한한다.
- HUD와 공격 글자가 겹쳐도 player와 active 범위가 묻히지 않게 위험 표현 depth를 우선한다.
- 작은 viewport에서도 공격 hitbox와 시각 형태가 같은 위치에 머문다.

## 코드 책임

- `core/model.ts`: 의미 있는 kind와 hitbox 계약
- `core/rules.ts`: 해금 시각과 난이도 곡선
- `core/simulation.ts`: seeded spawn, 이동, 단계, 충돌
- `presentation/GameRenderer.ts`: 공격별 문자·선·패턴 표현과 player node
- `presentation/Hud.ts`: Ready, Playing, Results 상태와 위험 알림
- `presentation/PauseOverlay.ts`: focus pause 표현
- `services/SoundService.ts`: warning, active, hit의 최소 tone

Presentation은 판정을 만들지 않고 simulation state만 그린다. 문구 폭 때문에 필요한 hitbox는 simulation model에 명시하여 보이는 크기와 판정 크기를 맞춘다.

## 이번 1차 구현의 완료 조건

- 네 공격이 사양대로 spawn·예고·발동·충돌한다.
- 화면 전체가 strict monochrome이며 기존 blue, amber, violet, red, green accent가 남지 않는다.
- Ready, pause, results가 같은 Codex task surface 문법을 공유한다.
- cursor avatar가 `>_` task node로 교체된다.
- core 회귀 테스트, typecheck, production build가 통과한다.
- owner-only production URL에서 사용자가 직접 조작감과 가독성을 확인할 수 있다.
