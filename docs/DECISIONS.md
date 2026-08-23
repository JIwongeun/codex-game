# 결정 기록

이 문서는 제품이나 기술 방향이 바뀌어도 이전 판단의 이유를 잃지 않기 위한 기록이다. 새 결정은 기존 항목을 지우지 않고 상태를 `대체됨`으로 표시한 뒤 새 항목을 추가한다.

## D-001 — 실시간 멀티플레이를 만들지 않는다

- 날짜: 2026-08-23
- 상태: 확정
- 배경: `.io` 같은 즉시성과 글로벌 경쟁을 원하지만 개발 기간은 3일이다.
- 결정: 플레이는 싱글플레이로 완결하고 다른 플레이어와는 비동기 글로벌 랭킹으로만 경쟁한다.
- 결과: WebSocket, authoritative game server, 매치메이킹이 필요 없다. 게임은 정적 웹 빌드로 배포할 수 있다.

## D-002 — 핵심 게임은 Context 기반 Snake 아케이드다

- 날짜: 2026-08-23
- 상태: 대체됨 — D-011 참고
- 배경: 개발자와 Codex 사용자가 바로 이해하면서 구현량이 작은 규칙이 필요하다.
- 결정: 토큰을 먹어 꼬리와 미확정 점수를 키우고 `COMPACT`로 점수를 확정하는 90초 게임을 만든다.
- 결과: 땅따먹기 flood fill과 복잡한 공격 조준을 구현하지 않는다.

## D-003 — 게임 런타임은 Phaser 3.90을 사용한다

- 날짜: 2026-08-23
- 상태: 확정
- 배경: 입력, Canvas/WebGL, 오디오, Scene 수명주기가 필요하지만 자체 엔진을 만들 시간은 없다. Phaser 4보다 축적된 사례와 API 안정성을 우선한다.
- 결정: TypeScript + Vite + Phaser 3.90을 사용하고 React는 사용하지 않는다.
- 결과: UI는 Phaser와 최소 DOM으로 구현한다. 새 프레임워크를 추가하지 않는다.

## D-004 — 서버는 랭킹 경계에만 둔다

- 날짜: 2026-08-23
- 상태: 확정, 구현은 최후순위
- 배경: 글로벌 점수는 중앙 저장소가 필요하지만 게임 플레이까지 서버에 의존하면 장애와 일정 위험이 커진다.
- 결정: 클라이언트에서 게임을 완전히 실행하고, 랭킹 등록·조회만 serverless HTTP API와 DB로 처리한다.
- 결과: 랭킹 장애 시 로컬 최고점을 보여주며 플레이는 계속된다. 핵심 게임, 공개 배포, QA, 제출 필수 자료가 끝나기 전에는 공급자 선택이나 서버 구현을 시작하지 않는다.

## D-005 — 런타임 OpenAI API를 핵심 기능으로 사용하지 않는다

- 날짜: 2026-08-23
- 상태: 확정
- 배경: API 키, 비용, 지연, 네트워크 장애는 짧은 웹 게임의 핵심 재미와 무관하다.
- 결정: Codex는 개발 과정에 적극 활용하되, 제출 게임의 핵심 플레이는 OpenAI API 없이 동작한다.
- 결과: 개발 과정은 `docs/WORKLOG.md`에 기록하고 선택 가산점 자료에 활용한다.

## D-006 — 실제 앱과 브랜드 로고를 사용하지 않는다

- 날짜: 2026-08-23
- 상태: 확정
- 배경: 브라우저는 설치 앱 정보를 임의로 읽을 수 없고, 실제 앱 로고는 제3자 권리 문제가 생길 수 있다.
- 결정: `TAB SWARM`, `MEMORY LEAK`, `NOTIFICATION`처럼 일반 개념을 바탕으로 한 오리지널 도형과 아이콘을 만든다.
- 결과: 실제 제품을 떠올릴 수 있는 유머는 사용하되 로고, 이름, 고유 캐릭터를 복제하지 않는다.

## D-007 — Codex 장기 문맥은 저장소 문서로 보존한다

- 날짜: 2026-08-23
- 상태: 확정
- 배경: 긴 작업과 새 세션 사이에 목표, 결정, 다음 행동이 사라질 수 있다.
- 결정: 루트 `AGENTS.md`에 불변 지침과 문서 읽기 순서를 두고, 상세 설계는 `docs/`, 매 작업 결과는 `docs/WORKLOG.md`에 기록한다.
- 결과: 새 작업자는 대화 기록 없이도 저장소만 읽고 현재 범위와 다음 행동을 확인할 수 있어야 한다.

## D-008 — 모든 플레이어는 자동 게스트로 진입한다

- 날짜: 2026-08-23
- 상태: 대체됨 — D-009 참고
- 배경: `.io` 게임처럼 링크를 연 즉시 플레이해야 하며 계정 생성은 이탈과 구현 비용을 늘린다.
- 결정: 첫 방문에서 익명 게스트 ID와 표시명을 자동 생성하고 브라우저에 유지한다. 로그인과 시작 전 이름 입력은 만들지 않는다.
- 결과: 닉네임 변경은 결과 화면의 선택 기능이다. 게스트 ID는 인증 수단으로 신뢰하지 않고 랭킹 제출 검사는 run session으로 처리한다.

## D-009 — 익명 즉시 플레이와 게스트 식별을 분리한다

- 날짜: 2026-08-23
- 상태: 확정
- 배경: 링크를 연 사용자가 곧바로 플레이해야 하지만 글로벌 랭킹은 최후순위다. 랭킹이 없는데 게스트 ID와 표시명을 먼저 구현할 이유가 없다.
- 결정: MVP에서 게스트란 계정과 이름 입력 없이 익명으로 즉시 플레이한다는 경험만 뜻한다. 로컬 최고점만 저장한다. 게스트 ID, 표시명, 랭킹 서버는 제출 필수 작업을 모두 마친 뒤 시간이 남을 때만 구현한다.
- 결과: 현재 게임에는 인증, 프로필, 서버가 없다. 글로벌 랭킹을 시작할 때 D-004의 서버 경계와 게스트별 최고점 정책을 다시 검토한다.

## D-010 — 1차 graybox 규칙을 결정론적 simulation으로 고정한다

- 날짜: 2026-08-23
- 상태: 대체됨 — D-011 참고. 60 Hz, seed RNG, Phaser 분리 원칙은 유지
- 배경: UI와 연출을 붙이기 전에 위험·보상 루프와 충돌 순서를 자동 검증할 기반이 필요하다.
- 결정: 60 Hz 고정 timestep과 seed RNG를 사용한다. 화면 경계는 wrap하고 자기 꼬리 충돌은 끈다. Context는 24개가 최대이며 2초 안에 `COMPACT`하지 않으면 피해를 받는다. 충격파는 범위 안 적을 제거하지만 별도 제거 점수는 주지 않는다. 시간 종료 시 미확정 점수는 폐기한다.
- 결과: Phaser Scene은 입력과 표현만 담당한다. 판정 순서는 이동 → 수집 → `COMPACT` → 적 갱신 → 충돌/Overflow → 생성 → 타이머/종료이며, 같은 tick의 `COMPACT`가 충돌보다 먼저 처리된다.

## D-011 — 핵심 게임을 죽림고수 기반 무한 생존형으로 전환한다

- 날짜: 2026-08-23
- 상태: 확정, 수치는 플레이 테스트로 조정 가능
- 배경: 90초 수집·`COMPACT` 구조는 설명할 규칙과 HUD 정보가 많고, Codex 대기 중 짧게 반복하는 게임으로서 첫눈에 이해되는 회피 재미가 약했다. 사용자는 고전 `죽림고수`처럼 마우스 포인터로 공격을 피하며 오래 버티는 방향을 요청했다.
- 결정: 시간 제한, 목숨, 토큰, 꼬리, `COMPACT`, 점수 배율을 제거한다. 포인터를 이동해 사방의 직선 공격과 예고형 범위 공격을 피하고, 한 번 피격되면 종료하며 생존 밀리초를 기록한다.
- 결과: 게임 규칙은 이동 → 공격 갱신 → 공격 생성 → 충돌 → 종료로 단순해진다. `TAB`은 즉시 직선 이동하고 `POP-UP`은 경로를 예고한 뒤 돌진한다. `MEMORY LEAK` 원형 범위와 `CONTEXT OVERFLOW` 수평·수직 범위는 예고 단계에서 무해하고 활성 단계에서만 치명적이다. 같은 seed·입력·tick에는 같은 결과를 유지한다.

## D-012 — 브라우저 오류 페이지와 한 몸인 흑백 시각 언어를 사용한다

- 날짜: 2026-08-23
- 상태: 대체됨, D-019가 browser error page 대신 Codex task surface를 사용
- 배경: 기존 네온 격자, 상단 상태 바, 패널형 overlay가 일반적인 게임 UI처럼 보여 “Codex를 기다리는 브라우저 안의 게임”이라는 콘셉트를 약하게 만들었다.
- 결정: 웹페이지와 Canvas를 흰색으로 연결하고 격자, 프레임, 점수 게이지, 카드형 modal을 제거한다. 검정·회색을 기본으로 링크 파랑과 위험 빨강만 사용한다. 시작·결과 화면은 넓은 여백과 브라우저 오류 문구 같은 타이포그래피를 사용한다.
- 결과: 시각 token은 `presentation/theme.ts`에 모으고 renderer와 HUD가 공유한다. 실제 제품 로고나 Chrome 공룡 캐릭터는 복제하지 않는다.

## D-013 — native cursor와 전체 viewport를 게임 규칙으로 사용한다

- 날짜: 2026-08-23
- 상태: 일부 대체됨, D-018이 player 입력과 표현을 변경하고 전체 viewport 규칙은 유지
- 배경: 고정 1280×720 `FIT` Canvas와 속도 기반 삼각형 추적은 브라우저 창이 잘려 보이고 커서와 플레이어 사이의 지연을 만들었다. 직선 화살과 단순한 원·band는 개발자 브라우저 콘셉트도 충분히 전달하지 못했다.
- 결정: Phaser `RESIZE`로 현재 browser viewport 전체를 arena로 사용한다. 운영체제 native cursor hotspot을 플레이어 좌표에 직접 반영하고 키보드 방향 이동, 추적 속도, dead zone, 삼각형 캐릭터와 별도 hitbox indicator를 제거한다. 화면에는 브라우저가 그리는 native cursor만 플레이어로 남긴다. 공격은 브라우저 탭 군집, pop-up 창, 동심원 memory leak, stripe context sweep로 표현하며 예고와 활성 상태를 시각적으로 분리한다.
- 결과: `GameState`가 동적 arena 크기를 소유하고 resize를 순수 simulation 함수로 처리한다. renderer의 잔상은 presentation-only state로 유지해 판정 결정성을 해치지 않는다.

## D-014 — 완성 전 Sites 접근을 소유자 전용으로 제한한다

- 날짜: 2026-08-23
- 상태: 확정, 제출 직전 public으로 대체 예정
- 배경: 사용자는 개발 중인 게임을 본인만 플레이하고 완성 후 공개하기를 요청했다.
- 결정: Sites access mode를 `custom`으로 바꾸고 owner 외 사용자·그룹·외부 방문자 allowlist를 비운다. 별도의 클라이언트 비밀번호 gate는 우회 가능하므로 만들지 않는다.
- 결과: 현재 production URL은 호스팅 owner만 접근한다. 최종 제출 전 access mode를 `public`으로 전환하고 익명 브라우저 접근을 다시 검증해야 한다.

## D-015 — 흑백 기반 위에 공격별 digital accent와 Pretendard Variable을 사용한다

- 날짜: 2026-08-23
- 상태: 일부 대체됨, D-019가 accent color를 제거하고 Pretendard Variable 규칙은 유지
- 배경: 흰 화면과 검정 타이포만 강조한 1차 UI는 둥글고 무채색인 일반 웹 UI처럼 보여 개발 도구·픽셀·digital 콘셉트가 약했다. 사용자는 흑백은 base일 뿐 전체 palette 제한이 아니며 font는 Pretendard Variable이어야 한다고 명확히 했다.
- 결정: warm white와 black을 base로 유지하되 `TAB` blue, `POP-UP` amber, `MEMORY LEAK` violet, `CONTEXT OVERFLOW` red, running status green을 사용한다. rounded rectangle과 smooth ring을 square frame, pixel ring, stepped trail로 바꾼다. 모든 Phaser HUD/overlay와 DOM fallback font는 self-hosted `Pretendard Variable`로 통일한다.
- 결과: `pretendard@1.3.9`를 production dependency로 고정하고 dynamic unicode subset CSS를 bundle한다. font license는 OFL-1.1이다. 게임은 font load가 끝난 뒤 boot해 Phaser text texture에도 같은 face가 적용되도록 한다.

## D-016 — pointer hotspot은 유지하고 검은 pixel cursor와 투명 pause 계층을 사용한다

- 날짜: 2026-08-23
- 상태: 대체됨, D-017을 거쳐 D-018이 pointer 입력을 제거
- 배경: 운영체제 기본 커서는 게임의 digital 도구 시각 언어와 충분히 연결되지 않았고, 기존 pause 화면은 마지막 플레이 장면을 거의 흰색으로 덮어 맥락을 잃게 했다.
- 결정: pointer 입력과 충돌 좌표의 1:1 규칙은 유지하되 Canvas 안에서 24×32 hard-edge black PNG cursor를 CSS hotspot `(1, 1)`로 사용한다. pause는 Phaser 결과 overlay와 분리한 DOM 계층에서 `backdrop-filter`로 마지막 장면을 흐리고 중앙 문구만 표시한다.
- 결과: 별도 player sprite나 추적 지연 없이 cursor 외형만 제품 언어에 맞는다. pause 안내는 입력을 가로채지 않아 기존 클릭·Space 재개 흐름을 유지하며, Scene 종료 시 DOM 계층을 제거한다.

## D-017 — pause 입력을 동결하고 frozen cursor 복귀로만 재개한다

- 날짜: 2026-08-23
- 상태: 대체됨, D-018이 pointer 입력과 frozen cursor gate를 제거
- 배경: pause 중 custom cursor와 gameplay target이 계속 움직여, 다른 위치로 옮긴 뒤 재개하면 공격을 피하는 순간이동 플레이가 가능했다. 24×32 cursor 외형도 일반적인 시스템 pointer보다 크고 넓게 보였다.
- 결정: 입력은 실제 pointer 위치와 gameplay target을 분리한다. blur/hidden부터 gameplay target을 동결하고 Canvas는 OS 기본 cursor로 복구한다. 마지막 player 위치에는 동일한 검은 cursor 이미지를 pause blur 아래에 남기며, 반경 18px 안으로 돌아온 pointer click만 재개한다. 다른 위치의 click과 keyboard action은 재개하지 않는다. 검은 cursor는 32×32 canvas 안에 일반적인 시스템 화살표 비율로 좁게 그린 hard-edge PNG와 hotspot `(2, 1)`을 사용한다.
- 결과: pause 중 OS cursor는 자유롭게 움직이지만 게임 좌표는 변하지 않는다. 재개 직후에도 동결 좌표를 유지하고 다음 pointer move부터 다시 1:1 추적한다. 웹 플랫폼은 사용자의 OS cursor bitmap과 배율을 읽어 색만 바꿀 수 없으므로 외형은 공통 시스템 화살표에 가까운 custom asset으로 유지한다.

## D-018 — 플레이어 입력을 WASD·방향키로 단순화한다

- 날짜: 2026-08-23
- 상태: 일부 대체됨, 입력 결정은 유지하고 D-019가 cursor silhouette 표현을 task node로 변경
- 배경: 실제 OS pointer와 custom cursor 외형, pause 중 pointer 위치, 재개 gate를 동시에 관리하면 브라우저별 동작과 exploit을 계속 조정해야 한다. 사용자는 pointer 조작 대신 WASD와 방향키 조작으로 전환해 입력을 단순화하기로 했다.
- 결정: 실제 OS cursor는 게임 판정에서 제외하고 항상 기본 모양을 사용한다. 플레이어는 Canvas가 직접 그리는 검은 cursor silhouette이며 `WASD`와 방향키로 440px/s 고정 속도의 8방향 이동을 한다. 대각선 입력은 정규화하고 가속·관성은 두지 않는다. click·Space는 시작·재시작·pause 해제 action으로 유지하며 blur/hidden에서 held movement key를 초기화한다.
- 결과: `InputIntent`는 pointer position 대신 direction vector를 전달하고 60Hz simulation이 delta time으로 player를 이동·경계 clamp한다. `GameCursor`와 pause resume gate를 제거해 OS cursor 상태와 gameplay 좌표가 완전히 분리된다.

## D-019 — Codex task surface와 개발·vibe coding 공격 언어를 사용한다

- 날짜: 2026-08-23
- 상태: 일부 대체됨 — D-020이 네 공격 계열과 작은 block 표현을 대체. monochrome task surface와 `>_` player는 유지
- 배경: browser tab, pop-up, memory leak 중심 표현은 Codex를 기다리는 게임이라는 핵심 콘셉트와 개발자 공감을 충분히 전달하지 못했다. 색상별 공격도 사용자가 요청한 strict black-and-white 방향과 맞지 않았다.
- 결정: 전체 화면을 white, black, gray만 쓰는 가상 Codex task surface로 바꾼다. player는 로고와 무관한 `>_` task node다. 공격은 `log`, `review`, `context-max`, `merge-conflict` 네 판정 계열로 구성하고 고정 phrase bank에서 일반 개발과 Codex·vibe coding 패러디를 seed 기반으로 선택한다. `log`는 player 좌표를 전혀 읽지 않고 임의 edge-to-edge로 이동하며, `review`만 생성 순간 위치를 snapshot하고 재조준하지 않는다.
- 결과: 색 대신 task chip, approval modal, context fill, conflict band의 실루엣과 outline·hatch·inverse 단계로 위험을 구분한다. 실제 workspace, Codex session, context, approval 상태는 읽지 않으며 Ready와 HUD에 fictional simulation임을 명시한다. 새 공격 다양성은 우선 네 계열 안의 label·경로·pattern 변형으로 확보하고 새로운 판정 규칙이 필요할 때만 kind를 추가한다.

## D-020 — 공격의 행동을 개발 용어의 의미와 결합하고 Stage 1–10으로 확장한다

- 날짜: 2026-08-23
- 상태: 확정, 수치만 플레이 테스트로 조정 가능
- 배경: 네 개의 작은 task chip·modal·band는 화면에서 일반 UI block처럼 보였고, 공격 이름을 다른 용어로 바꿔도 움직임이 성립해 개발 패러디의 개연성이 약했다. 긴 `merge-conflict` band는 `context-max` 영역 회피와 역할도 겹쳤다.
- 결정: 투사체 block을 제거하고 명령어·상태 문구 자체를 진행 방향에 맞춰 회전시킨다. collision도 같은 방향의 oriented rectangle을 사용한다. 공격은 `LOG STREAM`, snapshot `REVIEW REQUEST`, 일점 `CONTEXT MAX`, 반복 `RETRY LOOP`, 분할 `FORK BOMB`, 교차 `RACE CONDITION`, 수렴 후 발산하는 `MERGE → BUG!`의 일곱 행동 패턴으로 나눈다. 기존 `merge-conflict` band는 제거한다. 12초 단위 Stage 1–10에서 Stage 7까지 패턴을 해금하고 Stage 8–10은 동시 수·속도·빈도·radial 탄 수를 올린다. Stage 10은 108초부터 최고 난이도에 고정한다.
- 결과: `log`, `review`, `retry`, `branch`, `race`, `bug` projectile, `context-max` hazard, `fork-bomb`·`merge-bug` convergence sequence가 core state에서 분리된다. `RETRY`는 같은 snapshot을 시간차 반복하고, `READ()`와 `WRITE()`는 반대편에서 교차하며, `git branch --all`과 `git merge`는 각각 `BRANCH`와 `BUG!` radial projectile을 만든다. 상단 중앙 공격명 announcement는 제거하고 실제 공격 표현만으로 판독하게 한다.
