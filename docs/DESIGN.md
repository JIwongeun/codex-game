# 디자인 및 게임플레이 계획

## 한 문장

`Codex is working.` 화면에서 작은 정사각형 agent node를 움직여, 행동 자체가 개발 용어를 패러디하는 공격을 피하며 오래 버틴다.

이 게임은 Codex UI 복제품이 아니다. 흰 task surface, 건조한 상태 문구, 넓은 여백과 개발 작업의 인과관계를 terminal arcade 문법으로 번역한다.

## 핵심 설계 원칙

공격 이름과 움직임은 분리될 수 없다. 이름을 다른 개발 용어로 바꿔도 성립하는 공격은 다시 설계한다.

- `APPROVAL REQUIRED`는 요청 시점의 player 축 위치 근처 opening을 포함한 네 승인 opening을 문장 길이에 맞춰 고정하고, player보다 느린 wall로 선택 시간을 준다.
- `RETRY`는 실패할 때마다 다음 attempt의 player 위치를 다시 snapshot하고 속도를 높인 뒤, 마지막 attempt가 끝나면 비치명 `RETRY COMPLETE` 상태로 짧게 마감한다.
- `CONTEXT COMPACTION`은 넓은 frame 안의 context row를 한 점으로 압축한 뒤 실패하며 token 파편을 사방으로 잃어버린다.
- `DOWNLOAD ACCESS`는 화면의 상·하·좌·우 반쪽 중 하나를 green loading fill로 점유한 뒤 같은 색 문법의 `ACCESS!` 영역으로 활성화한다.
- `ULTRA CODE`는 첫 frame부터 120° safe sector가 비어 있는 원을 먼저 보여주고, 원주의 8개 서브에이전트가 완료한 response packet을 중앙에 모은 뒤 같은 safe sector의 final response wave로 합친다.
- `PARALLEL AGENTS`는 같은 작업 지점을 화면 반대편에서 동시에 차지하려 한다.
- `REVIEW / FIX LOOP`는 finding을 고친 직후 `ONE MORE ISSUE`를 전방위로 다시 만든다.
- `USAGE LIMIT`은 여러 usage 감소가 한 지점으로 수렴한 뒤 `LIMIT REACHED`를 전방위로 발산한다.

상단 중앙에 공격 이름이나 설명 자막을 띄우지 않는다. 화면 안의 문구, 궤적, 수렴과 분할만으로 행동을 이해하게 한다.

## 감정 목표

- 첫 3초: “Codex 기다릴 때 하는 게임이구나”를 이해한다.
- 첫 15초: 익숙한 문구 자체가 공격으로 날아오는 상황에서 웃는다.
- 첫 45초: 랜덤 탄, snapshot 조준, 점 폭발과 반복 공격의 차이를 학습한다.
- 72초 이후: review 재검출과 usage 폭발이 겹치며 패턴 조합을 읽는다.
- 사망 직후: 피격 원인이 명확하고 바로 다시 시작하고 싶다.

## 시각 시스템

### Palette와 Typography

- 바탕과 HUD는 white, black, gray를 유지한다. 공격은 하나의 terminal skin으로 통일하지 않고 `terminal`, `browser`, `codex` 작업 surface별 시각 문법을 사용한다.
- HUD와 overlay는 self-hosted `Pretendard Variable`을 사용한다. Terminal 공격은 Codex terminal과 가까운 `Cascadia Mono`·`Consolas` system stack을, Browser는 system UI sans를, Codex는 Pretendard를 10–11px로 사용한다.
- FHD와 QHD는 같은 QHD logical arena를 공유하되 각각 2×와 1.5× 고해상도 Canvas backing으로 렌더링한다. 표시 크기와 hitbox 비율은 유지하고 글자·1px line·회전 glyph의 source pixel만 늘린다.
- 투사체는 큰 사각 UI block이 아니라 실제 command, browser error, tool-state처럼 작고 보통 굵기인 한 줄 문구다.
- 투사체 전체에 한 색을 주지 않는다. 같은 한 줄 안에서도 executable, parameter, quoted string, error code, path, tool token과 본문을 각 surface의 실제 syntax 역할에 따라 나눈다.
- 문구 기준선은 진행 벡터와 평행하게 회전한다. 뒤집혀 읽히는 각도는 180도 보정하되 충돌 사각형의 방향은 동일하게 유지한다.
- 얇은 흰 외곽 stroke를 사용한다. 기본 `TOOL CALL STREAM`에는 방향선과 rail을 전혀 표시하지 않고, 조준·반복·교차 공격만 14–28px rail과 최대 112px 점선 예고를 사용한다.
- 둥근 pill, gradient, 장식용 card, 작은 chip 군집은 사용하지 않는다.

| 역할 | 값 | 사용 범위 |
|---|---|---|
| surface | `#FFFFFF` | 전체 Canvas와 label clearance |
| ink | `#171717` | HUD, player, 일반 UI |
| muted | `#686868` | 보조 상태와 조작 안내 |
| terminal executable | `#D18D00` | Codex terminal의 `git`, `pnpm`, `npm`, `cat` |
| terminal string | `#147BD1` | quoted commit message와 문자열 argument |
| terminal parameter | `#6F6F6B` | `-m`, `--watch`, `--force` |
| terminal output | `#171717` | subcommand와 일반 출력 본문 |
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
| Terminal | Cascadia Mono·Consolas 10–11px | `$ command`, `error:`, `warning:`, `git:` | prompt와 바로 뒤 한 칸은 하나의 token으로 묶고, Phaser에서는 그 token 뒤의 중복 stroke padding만 제거한다. 이후 executable·parameter·string·output의 실제 공백과 색 역할은 그대로 유지 |
| Browser | system UI sans 10px | `404 Not Found`, `ERR_CONNECTION_REFUSED`, `PAGE_UNRESPONSIVE` | 문구 앞에 6×8 page-outline glyph. error code·path와 일반 상태 본문을 분리 |
| Codex | Pretendard Variable 10–11px | `[tool]`, `[approval]`, `[context]`, `[effort]`, `[agent]`, `[review]`, `[usage]` | 문구 앞에 3×3 tool-state square. tool token·진행 수치와 본문을 분리 |

- 한 projectile은 한 줄, 약 26자 이하를 목표로 한다. `MAX`, `BUG!`, error code처럼 즉시 판독할 token만 대문자를 허용한다.
- surface는 label 문자열을 보고 renderer가 추측하지 않는다. core `ProjectileState.surface`에 `terminal | browser | codex`로 명시한다.
- label 뒤에 큰 box, pill, badge를 붙이지 않는다. 흰 배경 가독성을 위한 2px white stroke만 허용한다.
- 실제 제품 로고나 browser favicon을 복제하지 않고 page outline, tool square 같은 범용 glyph만 사용한다.

### 선과 Motion

- 기본 `TOOL CALL STREAM`은 무작위 edge-to-edge 흐름이므로 telegraph dot, motion rail, 화살촉을 모두 표시하지 않는다.
- 조준·반복·교차 projectile telegraph는 2px dot, 14px 간격, 60–112px 길이로 공격 앞부분에만 둔다.
- 해당 projectile의 active motion rail은 1px 두께, 14–28px 길이로 문구 뒤에만 둔다. 끝점 block이나 화살촉을 붙이지 않는다.
- convergence sequence는 origin부터 중심까지 선을 잇지 않고, 이동 중인 문구 바로 뒤의 20px trail만 그린다.
- 회전은 실제 velocity와 평행하게 하되 글자가 거꾸로 보이면 읽기 방향만 180도 보정한다.
- 큰 scale pulse, 화면 전체 trajectory, 장식용 corner marker, 굵은 poster typography는 사용하지 않는다.

### Player

- 아이콘은 내부 글자, inset, core가 없는 12×12 black square 하나다.
- 실제 피격 반경은 5px로 시각 외곽보다 작아 정밀 회피에 관용을 둔다.
- 아이콘은 시간과 입력 방향에 따라 변하지 않는다. blink, 폭 변화, 방향 notch, 화살표, corner mark를 표시하지 않는다.
- OS cursor, OpenAI logo, Codex logo를 모사하지 않는다.

### 화면 상태

- Start: 최초 진입과 game over 뒤에 모두 사용하는 하나의 화면이다. 상단에는 original context-loop mark와 `await CODEX`, background task 상태를 표시하고 같은 mark를 browser tab icon과 Open Graph·Twitter 공유 카드에도 사용한다. 본문은 `Codex is working.`, objective·control·fail state·last run·session best와 하나의 실행 CTA로 구성한다. game over 뒤에는 `LAST RUN` 값에 생존 시간과 정확한 피격 계열을 갱신한다. 뒤에는 실제 attack renderer와 같은 surface별 token 문법의 문구가 opacity `0.16`의 낮은 대비로 무작위 viewport 바깥에서 생성되어 반대 edge 바깥까지, 플레이보다 느린 34–56초 속도로 흐른다. 최초 진입에서도 animation 중간 지점부터 갑자기 나타나지 않는다.
- Game: 왼쪽 위 stage와 cleared, 오른쪽 위 현재 시간과 session best, 하단 이동·`Esc` 복귀·음소거 조작과 fictional feed 고지만 유지한다.
- Pause는 별도 화면이 아니라 마지막 Game 장면 위의 일시적인 blur 계층이다.

### Sound

- 첫 시작 click 또는 Space로 AudioContext를 연 뒤 original 32-step E minor arpeggio·bass·pulse loop를 재생한다. 최초 저음량안보다 약 6dB 높여 gameplay 중 분명히 들리게 하되 warning·hit peak보다 낮게 유지한다. Stage 1의 132 BPM에서 stage마다 4 BPM씩 올라 Stage 10의 168 BPM에 고정된다.
- BGM은 `playing`에서만 진행하고 game over·blur·hidden pause에서 즉시 멈춘다. 재시작과 명시적 pause 해제 뒤에는 첫 step부터 다시 시작한다.
- Start에는 `SFX VOLUME`과 `BGM VOLUME` slider를 각각 한 줄로 둔다. 둘 다 기본 50%이며 검정 1px rail과 검정색의 굵은 가로 직사각형 handle, Start의 monospace label과 검정 수치만 사용한다. 각 slider는 해당 음원군만 조절하고 `M`은 두 값을 보존한 채 전체를 즉시 음소거한다.
- 기본 `TOOL CALL STREAM`은 별도 SFX 없이 흘러가고, `APPROVAL`, `COMPACTION`, `RETRY`, `ULTRA CODE`, `PARALLEL AGENTS`, `REVIEW`, `USAGE LIMIT`은 각각 prompt beep·impact·반복 click·agent collection charge·final response snap·dual tone·review pair·low alarm으로 구분한다. Retry 마지막에는 warning click과 구분되는 상승 2음 completion cue를 한 번 재생한다.
- Stage가 바뀔 때는 push/webhook delivery를 연상시키는 2음과 agent task completion을 연상시키는 상승 3음을 번갈아 한 번만 재생하고 Stage 10은 4음으로 마감한다. compaction activation과 review 재발산에는 error popup형 하강음을, parallel agents에는 delivery cue를 겹친다.
- Slack·Windows·macOS·ChatGPT의 실제 음원, sample과 고유 notification melody를 복제하지 않는다. 익숙한 짧은 attack·간격·상승/하강 contour만 E minor 기반 original motif로 재구성한다.
- 외부 음원 파일과 음악 dependency를 사용하지 않고 Web Audio oscillator로 실시간 합성한다.

## 9개 Codex 경험 공격 패턴

| 해금 | 패턴 | 화면 문구 | 행동과 개연성 |
|---|---|---|---|
| Stage 1 | `TOOL CALL STREAM` | `$ rg --files -g AGENTS.md`, `[tool] rereading same file`, `ERR_*` 등 | player 좌표를 전혀 읽지 않고 임의 edge에서 반대 edge로 흐른다. 실제 작업 surface의 로그가 방향 예고 없이 화면을 가로지른다. |
| Stage 2 | `APPROVAL REQUIRED` | `[approval] ALLOW ONCE`, `ALLOW SESSION`, `REVIEW`, `DENY` | 1.4초 warning 뒤 player보다 느린 permission wall 하나가 edge에서 들어온다. 네 opening은 문장 실제 폭보다 8px 여유 있게 생성되고 label과 같은 중심을 쓰며, 하나는 player 축 위치에서 도달 가능하다. |
| Stage 3 | `CONTEXT COMPACTION` | `[context] compacting 0–100%` → `COMPACTION FAILED` → `[tok] ...` | 기존 대비 가로·세로 1.5배인 snapshot frame 안에서 context row와 중첩 frame이 한 점으로 수축한다. 실패 순간 frame 전체가 장판으로 변하지 않고 12–20개의 짧은 token 파편이 서로 다른 속도로 튄 뒤 수평 감속·중력을 받아 포물선으로 떨어진다. |
| Stage 4 | `RETRY LOOP` | `[tool] retry 1/3`, `FAILED · retry 2/3`, `RETRY COMPLETE · 3/3` | 한 attempt 동안 목표를 고정하고 실패 지점에 도달하면 560ms warning 뒤 현재 player 위치를 다시 snapshot한다. 후반에는 최대 5회이며 매번 1.12배 빨라진다. 마지막 attempt 뒤에는 판정을 끄고 420ms completion 표시 후 제거한다. |
| Stage 5 | `ULTRA CODE` | `[ultra] 8 agents running · [safe] 120°` → `4/2/1 agents remaining` → `8/8 done · FINAL RESPONSE` | 첫 frame부터 120° gap과 긴 양쪽 경계를 가진 원형 warning을 표시한다. 위험 원주의 8개 agent response card가 완료될 때마다 packet을 중앙 document core로 전달하고, 모두 완료되면 같은 gap의 final response annulus가 viewport 바깥에서 center로 수축한다. arena 바깥 20% band에서 생성된 safe sector는 화면 중앙 쪽으로 고정한다. |
| Stage 6 | `PARALLEL AGENTS` | `[agent 1] working`, `[agent 2] working` | 같은 snapshot을 향해 화면 반대편 agent 두 개가 동시에 교차한다. 후반에는 수평·수직 pair가 최대 3쌍 겹친다. |
| Stage 7 | `REVIEW / FIX LOOP` | 여러 `[review] Pn finding` → `[fix] ... reviewing again` → `ONE MORE ISSUE` | 네 finding이 한 지점으로 모이고, 수정 완료 순간 8–16개 새 issue가 원형 발산한다. 반복 review마다 새 문제를 찾는 경험을 행동으로 만든다. |
| Stage 8 | `DOWNLOAD ACCESS` | `[download] loading 0–100%` → `[access] ACCESS!` | 상·하·좌·우 중 무작위 반 화면이 success-green으로 3.3초간 edge부터 채워지고 완료 뒤 같은 green active 영역이 720ms 유지된다. 대각 hatch를 사용하지 않고 중앙 경계선과 fill만으로 범위를 표시하며, player 위치를 조준하지 않는다. |
| Stage 8 | `USAGE LIMIT` | 여러 `[usage] -N%` → `[usage] N% left` → `5H LIMIT REACHED`·`WEEKLY LIMIT REACHED`·`RESETS IN 4 DAYS` | 4–8개 usage 감소가 player snapshot으로 수렴하고, seed로 정해진 실제 limit 결말이 12–20개 탄으로 원형 발산한다. |

`TOOL CALL`, `CONTEXT TOKEN`, `AGENT`, `FINDING`, `LIMIT`은 projectile kind와 회전 사각 hitbox를 사용한다. `APPROVAL`은 gap이 있는 screen gate, `RETRY`는 attempt chain, `ULTRA CODE`는 agent completion presentation과 safe sector가 있는 swept annulus 전용 state다. `COMPACTION` frame은 warning/failed visual state를 갖지만 큰 frame 자체는 치명 영역이 아니며, 실패 때 생성된 `CONTEXT TOKEN`이 실제 판정을 담당한다. `DOWNLOAD ACCESS`는 arena 절반의 green loading fill과 active 판정을 가진 독립 hazard다. `REVIEW LOOP`와 `USAGE LIMIT`은 수렴 완료 시 projectile을 생성하는 sequence state다.

### 공격군 차별화 재설계 기준

아래 표는 속도·조준 여부가 아니라 플레이어에게 요구하는 회피 판단을 기준으로 현재 구현을 기록한다.

| 패턴 | 고유 화면 문법 | 요구하는 회피 행동 | 상태 |
|---|---|---|---|
| `TOOL CALL STREAM` | 실제 작업 문구가 임의 edge를 계속 가로지르는 유일한 일반 text 탄막 | 작은 방향 전환으로 흐름 피하기 | 현재 baseline 유지 |
| `APPROVAL REQUIRED` | permission wall이 3–4개의 서로 떨어진 approval opening을 남김 | 가까운 opening을 고르고 wall보다 빠르게 위치를 맞춤 | 적용 완료 |
| `CONTEXT COMPACTION` | 넓은 context frame과 row가 중심으로 수축한 뒤 token 조각이 물풍선처럼 튀고 아래로 쏟아짐 | frame에서 이탈한 뒤 낙하 파편 사이를 다시 회피 | 적용 완료 |
| `DOWNLOAD ACCESS` | 화면 경계부터 상·하·좌·우 반쪽 하나를 채우는 loading fill과 `ACCESS!` 반화면 | 긴 loading 동안 중앙 경계를 넘어 안전한 반쪽으로 이탈 | 적용 완료 |
| `RETRY LOOP` | 한 chain이 매 실패 때 목표를 다시 잡고 더 빨라짐 | attempt warning마다 새 경로를 읽고 시간차 회피 | 적용 완료 |
| `ULTRA CODE` | 첫 frame부터 120°가 비어 있는 원형 warning 위의 8개 response card가 중앙 document core로 모이고 같은 gap의 final response wave로 전환 | 넓은 safe sector를 먼저 읽고 그 각도를 따라 이동 | 적용 완료 |
| `PARALLEL AGENTS` | 반대 edge의 agent pair가 같은 snapshot을 교차하며 축별 corridor를 만듦 | 교차축 사이의 열린 corridor를 따라가기 | 적용 완료 |
| `REVIEW / FIX LOOP` | 여러 finding이 fix 지점으로 모인 뒤 `ONE MORE ISSUE`가 8–16방향으로 재발산 | 수렴 중심에서 벗어난 뒤 넓은 radial gap 선택 | 적용 완료 |
| `USAGE LIMIT` | 여러 usage 감소가 한 지점으로 소모된 뒤 limit 결과가 12–20방향으로 고밀도 발산 | 수렴점 반대편으로 선이동한 뒤 좁은 radial gap 유지 | 적용 완료 |

문구를 지웠을 때 실루엣·타이밍·안전 공간이 같은 두 패턴은 같은 공격으로 간주하고 다시 설계한다. Stage 1–8은 새 회피 문법을 하나씩 학습시키고, Stage 9–10은 최대 세 종류의 고강도 패턴을 읽을 수 있는 예고 순서로 겹친다. 단순히 모든 timer를 동시에 울려 피할 수 없는 화면을 만드는 것은 난이도 상승으로 인정하지 않는다.

## 10단계 시간 곡선

Stage는 12초 단위다. Stage 10은 108초부터이며 모든 수치가 최고 난이도에 고정된다.

| Stage | 시간 | 변화 |
|---|---:|---|
| 1 | 0–11.99초 | 무작위 `TOOL CALL STREAM` |
| 2 | 12–23.99초 | gap `APPROVAL REQUIRED` 해금 |
| 3 | 24–35.99초 | 일점 `CONTEXT COMPACTION` 해금 |
| 4 | 36–47.99초 | `RETRY LOOP` 3연사 해금 |
| 5 | 48–59.99초 | agent-response `ULTRA CODE` safe-sector wave 해금 |
| 6 | 60–71.99초 | `PARALLEL AGENTS` 1 pair 해금, retry 4회 |
| 7 | 72–83.99초 | `REVIEW / FIX LOOP` 4개 수렴·8방향 발산 해금 |
| 8 | 84–95.99초 | 독립 `DOWNLOAD ACCESS` 반화면과 `USAGE LIMIT` 4개 수렴·12방향 발산, 세 limit 결말 중 하나 선택 |
| 9 | 96–107.99초 | `rm *` blackout 해금, retry 5회, review 12방향, usage 6개·16방향 |
| 10 | 108초 이후 | download access 최저 간격, agent 3 pair, review 16방향, usage 8개·20방향, blackout 최대 4개와 최대 속도·최저 간격 |

단계 사이에서 속도와 생성 간격은 연속 보간한다. 해금·동시 수·분할 수는 표의 stage 경계에서만 바뀐다.

## 공정성과 가독성 불변식

- 모든 조준·영역·수렴 공격은 치명 단계 전에 경로 또는 진행률을 보인다.
- 기본 `TOOL CALL STREAM`은 player를 조준하지 않고 방향 예고·rail도 표시하지 않는다. 생성 후 telegraph 시간 동안은 판정만 비활성이다.
- approval의 네 opening, reasoning center·120° safe sector와 한 retry attempt의 목표는 생성 뒤 추적하지 않는다. reasoning center가 arena의 바깥 20% band에 있으면 safe sector는 arena center를 향하고 중앙 60% 안에서만 random 방향을 사용한다. retry는 다음 attempt warning이 시작될 때만 새 위치를 snapshot한다.
- 서로 다른 major pattern onset은 최소 360ms 떨어지고 동시에 active한 major family는 세 개를 넘지 않는다. 기본 tool stream은 이 상한과 무관하다.
- approval wall은 Stage 10에서도 378 logical px/s 이하로 player의 440 logical px/s보다 느리다. wall은 한 번에 하나만 유지하지만 다른 major와 독립적으로 실행되며 공통 360ms onset·세 family 상한을 따른다.
- download access는 정확히 logical arena의 절반만 차지하고 3.3초 loading 중에는 무해하다. QHD 좌·우 반 화면의 최장 이탈 시간보다 250ms 이상 긴 warning을 유지한다.
- `rm *`은 720ms outline warning 뒤에만 projectile을 가리며 warning 중 player와 projectile은 그대로 보인다. approval·retry·reasoning·area hazard처럼 경로 자체가 위험인 major geometry는 blackout 위에 계속 표시한다. Stage 10에서는 하나의 major family로 계산하면서 최대 4개까지 겹칠 수 있다.
- blackout을 빠져나온 projectile은 180ms 동안 반투명하게 다시 드러나고 충돌이 유예된다. blackout 안에 남아 있는 player와 projectile 사이 판정은 계속 위험하다.
- QHD `2560×1440`을 logical reference로 사용한다. FHD는 같은 arena를 `0.75×`로 표시하며 다른 화면비는 logical 높이 1440을 유지한다. 기준 logical 면적의 55%보다 작은 viewport는 모든 spawn interval을 1.22배 늘리고 projectile 속도는 유지한다.
- 회전한 문구와 collision rectangle은 같은 각도를 사용한다.
- radial projectile은 폭발 중심에서 56px 떨어져 생성되어 중심에 있던 player를 즉시 판정하지 않는다.
- projectile은 최대 56개, compaction hazard와 convergence sequence는 각각 최대 4개다.
- entity cap에 걸리면 일부 탄만 안전하게 생략하고 결정성은 유지한다.
- 작은 viewport resize 후에도 player, context와 sequence 중심은 유효 범위에 남는다.
- resize 뒤 retry velocity를 새 target으로 재계산하고 blackout 면적 비율을 보존한다.

## 코드 책임

- `core/model.ts`: projectile, hazard, convergence sequence와 event 계약
- `core/rules.ts`: 12초 단위 Stage 1–10, 해금과 연속 난이도 곡선
- `core/simulation.ts`: seeded spawn, snapshot, 수렴·분할, 회전 충돌, entity cap
- `presentation/attackText.ts`: terminal·browser·Codex label을 surface별 syntax token으로 분리하고 공통 색 역할 제공
- `presentation/GameRenderer.ts`: token별 회전 텍스트, 경로, context progress, convergence와 particle 표현
- `presentation/ReadyOverlay.ts`: 최초 진입과 game over가 공유하는 Start DOM layout, original game mark, last run·session best와 ambient attack feed
- `presentation/Hud.ts`: Game 화면의 stage·시간·best만 표시. 공격명 announcement와 별도 Results UI는 금지
- `presentation/PauseOverlay.ts`: focus pause 표현
- `runtime/FocusPauseController.ts`: blur·hidden에서 fixed-step backlog와 held input을 비우고 명시적 action 전까지 pause 유지
- `services/SoundService.ts`: warning, convergence burst, hit의 최소 tone과 즉시 mute 시 active gain 차단

Presentation은 판정을 만들지 않고 simulation state만 그린다. 문구 폭과 방향에 필요한 hitbox는 simulation model에 명시한다.

## 현재 완료 조건

- 8개 Codex 패턴과 Stage 9 `rm *` wildcard가 각각 의미에 맞는 spawn·예고·이동·분할을 가진다.
- Stage 1–10 경계와 Stage 10 cap이 자동 테스트로 고정된다.
- 상단 중앙 공격 설명이 없고 실제 공격 표현만으로 판독 가능하다.
- 흰 task surface와 흑백 HUD, terminal·browser·Codex별 서체·glyph·의미색, 전체 viewport 규칙을 유지한다.
- typecheck, deterministic simulation tests, lifecycle·mute tests, seeded entity-cap soak와 production build 검증이 통과한다.
- public production URL에서 사용자가 실제 가독성과 난이도를 확인한다. 검색 색인은 차단하지만 URL 접근 자체는 공개다.
