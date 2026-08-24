# 제품 및 게임 규칙

## 1. 제품 정의

`await CODEX: CONTEXT//OVERFLOW`는 AI 코딩 에이전트가 작업하는 동안 키보드로 작은 정사각형 agent node를 움직여 terminal·browser·Codex 작업의 골칫거리를 피하고 최고 생존 기록에 도전하는 싱글플레이 웹 아케이드다.

고전 플래시 게임 `죽림고수`의 핵심인 사방 공격, 작은 피격 판정, 생존 시간 경쟁, 즉시 재도전 감각을 근간으로 삼는다. 원작 캐릭터·배경·화살은 복제하지 않고 개발자와 브라우저라는 현재 콘셉트로 다시 설계한다.

`.io 게임`은 여기서 기술 방식이 아니라 다음 플레이 감각을 뜻한다.

- 링크를 열면 로그인 없이 즉시 시작
- WASD 또는 방향키 이동만으로 이해 가능
- 한 번의 실수로 끝나는 짧은 판과 즉시 재도전
- 시간이 지날수록 공격이 강해지는 명확한 기록 경쟁
- 서버 기능을 추가할 시간이 남으면 글로벌 생존 기록으로 비동기 경쟁

실시간 멀티플레이와 WebSocket 서버는 만들지 않는다.

## 2. 대상 플레이어

- Codex, 빌드, 테스트, 배포를 기다리는 개발자
- 짧은 휴식 동안 설치 없이 게임을 하고 싶은 심사위원과 일반 사용자
- Chrome 오프라인 공룡 게임처럼 브라우저와 한 몸인 미니게임을 좋아하는 플레이어

개발자 농담을 모르더라도 “검은 `>_` node를 움직여 닿지 않고 오래 버틴다”는 규칙은 즉시 이해할 수 있어야 한다.

## 3. 핵심 경험

플레이어는 Canvas가 직접 그리는 glyph 없는 hard-edge 검은 정사각형이다. 실제 OS cursor와 분리되어 있으며 `WASD` 또는 방향키로 움직인다. 화면 바깥에서 날아오는 tool call과 approval, context compaction, download access, retry, ultra code response, parallel agents, review/fix, usage limit와 `rm *` blackout을 읽어 짧게 움직이며 피한다. 한 번 닿으면 run이 끝나고 생존 시간이 기록되며 4분을 버티면 task-crash ending으로 완주한다.

핵심 감정은 다음 세 단계다.

1. 판독: 어떤 방향과 영역이 위험해지는지 빠르게 읽는다.
2. 회피: 안전한 작은 공간으로 cursor avatar를 정확히 옮긴다.
3. 재도전: 아깝게 끝난 기록을 바로 한 번 더 넘고 싶어진다.

## 4. MVP 게임 규칙

### 세션

- 일반 종료 조건은 한 번 피격이며, 4분 생존 시 숨겨진 task-crash ending으로 정상 종료
- 목숨 없음, 한 번 피격되면 즉시 종료
- 점수는 밀리초 단위 생존 시간
- 첫 방문은 가입·로그인·닉네임 입력 없이 익명으로 시작
- 이동은 `WASD` 또는 방향키 사용
- 시작·재시작은 클릭 또는 Space
- Game 중 `Tab`은 browser 기본 focus 이동을 막고 pause·재개를 toggle한다. Start에서는 volume slider의 keyboard 접근을 위해 기본 Tab 이동을 유지한다.
- `Esc`는 현재 run을 기록하지 않고 Start 대기화면으로 복귀
- Start의 `SFX VOLUME`과 `BGM VOLUME` slider가 두 음원군을 각각 조절하며 둘 다 기본 50%다. hover는 옅은 검정 사각 outline, click·keyboard focus는 진한 검정 사각 outline으로 표시한다. `↑`·`↓`로 두 slider를 이동하고 `←`·`→` 또는 `A`·`D`로 5%씩 조절하며 `M`은 즉시 전체 음소거
- 종료 후 현재 생존 시간과 Guest session 최고 기록을 표시

### 이동과 판정

- `WASD`와 방향키를 동일한 8방향 입력으로 합치고, 440px/s 고정 속도로 이동한다.
- 대각선 입력은 정규화해 직선보다 빠르지 않게 하며 가속과 관성은 사용하지 않는다.
- 플레이어는 화면 경계를 넘지 않는다.
- 화면에는 내부 glyph와 inset이 없는 12×12 black square를 player avatar로 직접 그리며 실제 OS cursor는 항상 기본 상태를 유지한다.
- browser tab·window blur/hidden pause 중에는 simulation과 타이머를 동결하고 held movement key를 초기화한다. 페이지로 복귀하면 Canvas focus를 복원하며 `Tab`, 클릭 또는 Space로 재개한다.
- 직선 공격은 보이는 명령어 외곽과 같은 방향으로 회전하는 사각 hitbox를 사용하고 player는 작은 원형 hitbox를 사용한다.
- 프레임률과 관계없이 60 Hz 고정 timestep으로 이동과 충돌을 판정한다.

### 난이도 단계

난이도는 12초 단위 Stage 1–10으로 표시한다. 속도와 생성 간격은 108초까지 연속 상승하고, 해금·동시 수·분할 수는 stage 경계에서 증가한 뒤 Stage 10 상한에 고정된다.

1. Stage 1 `TOOL CALL STREAM` — player 좌표와 무관하며 방향선도 없는 terminal·browser·Codex 작업 탄막
2. Stage 2 `APPROVAL REQUIRED` — player보다 느린 permission wall이 1.4초 warning 뒤 이동하며, 생성 순간 player 축 위치에서 도달 가능한 네 opening을 문장별 폭으로 고정
3. Stage 3 `CONTEXT COMPACTION` — 넓은 context frame의 문장 조각이 중심으로 압축되고, 실패 순간 12–20개 token 파편이 물풍선처럼 튄 뒤 중력을 받아 아래로 떨어짐
4. Stage 4 `RETRY LOOP` — 3–5번의 실패가 각 attempt 시작 때 player 위치를 다시 snapshot하고 더 빨라져 재시도하며, 마지막 attempt 뒤 `RETRY COMPLETE`로 짧게 마감
5. Stage 5 `ULTRA CODE` — 첫 frame부터 120° safe sector를 비운 원형 warning을 표시하고, 원주의 8개 서브에이전트가 완료 응답을 중앙에 전달한 뒤 같은 safe sector를 유지한 final response wave로 합쳐짐. edge·corner에서 생성되면 safe sector는 화면 안쪽을 향함
6. Stage 6 `PARALLEL AGENTS` — 여러 agent가 반대편에서 같은 snapshot을 동시에 교차
7. Stage 7 `REVIEW / FIX LOOP` — 여러 finding을 고친 뒤 `ONE MORE ISSUE`가 8–16방향으로 재발산
8. Stage 8 `DOWNLOAD ACCESS` + `USAGE LIMIT` — 상·하·좌·우 반 화면 중 하나가 loading 100% 뒤 `ACCESS!` 영역이 되며, 5h·weekly usage는 한 지점으로 소모된 뒤 세 limit 결말 중 하나가 12–20방향으로 발산
9. Stage 9 `rm *` — 720ms outline warning 뒤 무작위 정사각형 영역이 모든 공격 presentation을 가리고, 각 square의 backup 100%에서 중앙으로 접혀 복구되는 wildcard blackout
10. Stage 10 — 앞 패턴의 속도·빈도·분할 수와 blackout 중첩을 최고치까지 상승

각 용어는 label뿐 아니라 이동과 결과로 의미를 전달한다. 고정 phrase bank에는 실제 작업에서 반복되는 terminal·browser 오류와 `rereading same file`, `waiting for output`, `still waiting`, `approve again` 같은 Codex·vibe coding 패러디를 함께 둔다. 실제 Codex session이나 workspace 상태는 읽지 않는다.

예고 단계는 항상 무해하고, 활성화 단계만 피격 또는 시야 차단을 발생시킨다. 특수 패턴은 각자 timer를 유지하되 onset을 최소 360ms 떨어뜨리고 서로 다른 active major family는 최대 세 개로 제한한다. 작은 logical viewport에서는 공격 속도를 낮추지 않고 생성 간격만 1.22배 늘린다. 공격 개체와 범위 수에는 별도 상한을 둔다.

## 5. 점수 원칙

```text
현재 점수 = 현재 run의 생존 밀리초
Guest session 최고 기록 = 현재 browser page session에서 가장 긴 생존 밀리초
```

- 수집물, 점수 배율, 보너스 점수는 없다.
- 운보다 궤적 판독과 작은 이동 정확도가 기록 차이를 만들어야 한다.
- 개발 전용 시간 점프가 production 기록에 영향을 주지 않아야 한다.
- Guest 최고 기록 하나만 `sessionStorage`에 저장한다.
- 새로고침에서는 같은 Guest session 기록을 유지하지만 browser session이 끝나면 초기화한다.
- 글로벌 랭킹을 나중에 구현하면 최고 생존 시간 하나만 반영한다.

## 6. 화면과 피드백

- Canvas는 browser viewport 전체를 채우되 gameplay 좌표는 QHD `2560×1440`을 기준으로 정규화한다. FHD `1920×1080`은 같은 logical arena를 `0.75×`로 표시해 개체 크기·속도·간격의 화면 비율을 QHD와 같게 유지한다. 다른 화면비는 logical 높이 1440을 유지하고 가로 범위만 화면비에 맞춰 조정해 letterbox를 만들지 않는다. 물리 display는 FHD와 QHD 두 render profile로 분류하고 FHD는 기본 2×, QHD는 1.5× backing buffer에 그린 뒤 원래 viewport 크기로 표시한다. backing은 `4096×2304`를 넘지 않으며 camera zoom에 같은 배율을 곱해 arena·판정·이동 체감을 바꾸지 않는다. 비정수 camera zoom에서도 linear antialiasing과 Phaser Text 최소 2× internal resolution을 함께 사용한다.
- 순백 웹페이지와 흰 Canvas를 이어 붙여 별도 게임 프레임처럼 보이지 않게 한다.
- 격자, 패널, 상단 점수 바, 장식용 배경은 사용하지 않는다.
- 바탕과 HUD는 white, black, gray를 유지한다. 공격은 terminal의 monospace·ANSI 의미색, browser의 sans·page error glyph, Codex의 Pretendard·tool marker·context progress처럼 작업 출처별 문법을 사용한다.
- 둥근 card와 부드러운 장식을 피하고 각진 1px frame, square pixel, stepped trail, tool-call row로 개발 도구의 digital 질감을 만든다.
- HUD와 overlay는 `Pretendard Variable`을 사용한다. 공격은 surface에 따라 10–11px monospace 또는 Pretendard/system sans를 사용한다. 상단 중앙 공격명 announcement는 표시하지 않는다.
- 사용자에게 보이는 완전한 화면은 Start와 Game 두 개뿐이다. Start는 최초 진입과 game over 뒤에 공유하며 original context-loop game mark, 상단 background task 상태, 큰 `Codex is working.` headline, objective·control·fail state·last run·session best와 하나의 실행 CTA로 구성한다. 뒤에는 실제 공격과 같은 token 문법과 edge-to-edge 진행 방향을 가진 저대비 terminal·browser·Codex 문구가 느린 속도로 화면을 가로지른다. 별도 Results 화면은 만들지 않는다.
- 탭 blur/hidden으로 멈춘 동안에는 결과 화면처럼 장면을 덮지 않는다. 마지막 게임 장면을 흐리게 남기고 중앙 pause 문구만 표시한다.
- pause 중에는 마지막 장면과 player 위치를 blur 아래에 그대로 남기고 중앙 재개 문구만 표시한다.
- 공격의 실루엣, 예고 범위, 실제 위험 범위를 명확히 구분한다.
- 실제 제3자 로고와 고유 캐릭터는 사용하지 않는다.

## 7. MVP 포함 범위

- Start ↔ Game 두 화면. 내부에서는 `ready | playing | results` phase로 최초 시작과 마지막 run 정보를 구분하지만 `ready`와 `results`는 같은 Start 화면을 사용
- 정적인 정사각형 agent node의 WASD·방향키 8방향 이동
- 한 번 피격 시 종료와 생존 시간 기록
- 실제 Codex 사용자 경험에서 가져온 공격 패턴 8종과 수렴·분할 sequence
- 12초 단위 Stage 1–10 난이도 상승과 공격 상한
- Stage마다 `1K`에서 `512K`까지 두 배로 증가하는 context load 표기와 Stage 10 3회 적색 비상등·siren, near-white danger surface·low alarm pulse
- 4분 생존 task-crash ending
- browser session 한정 Guest 최고 생존 기록 하나
- 음소거 가능한 procedural BGM과 공격·stage notification 효과음
- 로그인 없는 public production URL과 검색 색인 차단

## 8. MVP 제외 범위

- player 공격, 스킬, 아이템, 성장 선택지
- 목숨, 회복, 무적 시간
- 수집물, 꼬리, `COMPACT`, 점수 배율
- 실시간 다른 플레이어 또는 봇으로 위장한 플레이어
- 회원가입과 로그인
- 스킨, 상점, 재화, 업적, 여러 맵
- 실제 앱·브라우저 정보 접근
- 런타임 OpenAI API 기능
- 핵심 게임과 제출 준비가 끝나기 전의 서버, 게스트 ID, 글로벌 랭킹

## 9. 후순위 확장 기능

아래 기능은 핵심 게임, 공개 배포, QA, 제출 필수 자료가 모두 끝난 경우에만 구현한다.

- 자동 생성 게스트 ID와 표시명
- 게스트별 최고 생존 기록 하나를 보여주는 글로벌 Top 10
- 점수 제출 실패 재시도

## 10. 재미 검증 기준

- 새 플레이어가 짧은 안내만 보고 WASD 또는 방향키로 이동해 첫 공격을 피한다.
- 첫 판 종료 후 5초 안에 재시작 방법을 이해한다.
- 사망 원인이 공격 실루엣이나 결과 문구로 이해된다.
- 12초 단위 해금과 48·60·72초의 특수 패턴이 서로 다르게 느껴진다.
- 예고 범위에서 벗어날 실제 시간이 충분하다.
- 60 FPS가 아닌 환경에서도 플레이 속도가 크게 달라지지 않는다.

## 11. Graybox에서 조정할 항목

- player 이동 속도, 작은 충돌 반경과 화면 경계 clamp
- 직선 공격 속도, 생성 간격, 동시 발사 수
- 범위 공격 예고 시간, 크기, 활성 시간
- 난이도 단계 해제 시점과 최대 개체 수

8개 공격의 의미와 Stage 1–10 경계는 유지하고 속도·간격·크기·탄 수만 실제 플레이 결과에 따라 조정한다.
