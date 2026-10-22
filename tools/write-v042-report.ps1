$ErrorActionPreference='Stop'
$taskRoot=Split-Path -Parent $PSScriptRoot
function Read-Json($name){Get-Content -LiteralPath (Join-Path $taskRoot $name) -Raw -Encoding UTF8|ConvertFrom-Json}
function Write-Doc($name,$body){[IO.File]::WriteAllText((Join-Path $taskRoot $name),$body,[Text.UTF8Encoding]::new($false))}
$ui=Read-Json '.qa/report.json'
$balance=Read-Json 'docs/balance-report.json'
$leaders=Read-Json 'docs/leadership-study.json'
$study=Read-Json 'docs/faction-study-v042.json'
$coverage=Read-Json 'docs/developer-coverage.json'
$progress=Read-Json 'docs/feedback-progress-v042.json'
if($ui.version -ne '0.4.2' -or $ui.failed -or $balance.violationCount -or $leaders.violationCount -or $study.violationCount -or @($ui.layouts|Where-Object overflow).Count){throw 'Release verification failed'}
foreach($prop in $ui.runtimeHashes.PSObject.Properties){if((Get-FileHash -LiteralPath (Join-Path $taskRoot $prop.Name)).Hash -ne $prop.Value){throw ('Unverified runtime '+$prop.Name)}}
if($study.engineSha256 -ne $ui.engineSha256 -or $study.expansionSha256 -ne $ui.runtimeHashes.'faction-life.js' -or $balance.engineSha256 -ne $ui.engineSha256 -or $leaders.engineSha256 -ne $ui.engineSha256){throw 'Simulation does not match release'}
$events=@($coverage.events.id|Select-Object -Unique).Count
$choices=$coverage.events.Count
$rows=foreach($row in $progress.rows){$obj=[ordered]@{};for($i=0;$i -lt $progress.columns.Count;$i++){$obj[$progress.columns[$i]]=$row[$i]};[pscustomobject]$obj}
$rows|Export-Csv -LiteralPath (Join-Path $taskRoot 'docs/46-v042-feedback-progress.csv') -Encoding UTF8 -NoTypeInformation
$complete=@($progress.rows|Where-Object {$_[3] -eq '구현·검증완료'}).Count
$partial=@($progress.rows|Where-Object {$_[3] -eq '부분구현'}).Count
$summary=[ordered]@{version='0.4.2';date='2026-10-22';runtimeHashes=$ui.runtimeHashes;engineSha256=$ui.engineSha256;simulationSha256=(Get-FileHash -LiteralPath (Join-Path $taskRoot 'tools/simulate.js')).Hash;testsPassed=$ui.passed;testsFailed=$ui.failed;originalRegression=142;previousDeveloperAndExpandedChoiceTests=553;newFeatureTests=@($ui.tests|Where-Object {$_.name.StartsWith('v042 ')}).Count;eventDefinitions=$events;eventChoices=$choices;eventChoiceFailures=@($coverage.events|Where-Object {$_.status -ne '통과'}).Count;layouts=$ui.layouts.Count;overflowCases=@($ui.layouts|Where-Object overflow).Count;standardSamples=$balance.samples;leadershipSamples=$leaders.samples;standardViolations=$balance.violationCount;leadershipViolations=$leaders.violationCount;combatComparisonSamples=$study.combatSamples;birthSamples=$study.birthSamples;entrySamples=$study.entrySamples;warStudyLives=$study.warLives;focusedViolations=$study.violationCount;deltaAuditRows=$progress.rows.Count;deltaAuditComplete=$complete;deltaAuditPartial=$partial;historicalAuditRows=1427;latestTabsAtRead=67;latestTabsReread=5;previousFullSourceTabs=63;limitations=@('Large army AI, siege and strategic territorial occupation are outside this event implementation.','New factions use existing nine contact hubs; individual headquarters and famous secret arts are not fully authored.','New birth year is 122 and first controlled year is 130; old saves retain original years.','Legacy NPC genealogy without evidence is not invented.','Birth prologue fades vertically and can be skipped or replayed; reduced motion displays all lines.','Individual martial XP, full inheritance and extended NPC AI remain partial.','No human play session or real mobile device test has been performed.')}
$summary|ConvertTo-Json -Depth 25|Set-Content -LiteralPath (Join-Path $taskRoot 'docs/verification-v042.json') -Encoding UTF8
$ui|ConvertTo-Json -Depth 20|Set-Content -LiteralPath (Join-Path $taskRoot 'docs/qa-final-data.json') -Encoding UTF8
$ui|ConvertTo-Json -Depth 20|Set-Content -LiteralPath (Join-Path $taskRoot 'docs/ui-verification.json') -Encoding UTF8
$table=($progress.rows|ForEach-Object {'| '+($_ -join ' | ')+' |'}) -join "`n"
$audit=@"
# 구현 실사 v0.4.2

실제 v0.4.1 작업본을 .qa/baseline-v041에 보존하고 SHA-256 기준점을 남겼다. 기존 실행 구조와 소재집·삽화를 유지했다. 최신 시트 메타데이터는 67탭이다. 이번 작업에서는 플레이테스트(피드백), 02_세력문파, 36_통합설정_v0.2, 28_문파_승급_진영, 43_v040_설정충돌의 5탭을 다시 읽었다. planning-feedback-v042.json은 이번 조회 원문이며 이전 63탭 전체 감사는 archive-v041/IMPLEMENTATION-AUDIT.md와 planning-snapshot-v041.json에 보존했다. 이번에 67탭 전체를 새로 재감사한 것으로 표시하지 않는다.

이번 변경 범위는 V-024~V-035, WAR-001~003, CF040-01/02/08/10/11의 20개 추적 묶음이다. 구현·검증완료 $complete, 부분구현 $partial, 구현표기 오류 0, 확인불가 0이다. 기존 1,427행의 모든 구현 상태를 이번에 재분류한 수치가 아니다. 부분 항목은 새 동작이 있어도 전체 요구 완료로 판정하지 않았다.

| ID | 원본 시트·셀 | 영역 | 판정 | 코드 | 실제 변경 | 검증 | 제한·후속 | 우선순위 |
|---|---|---|---|---|---|---|---|---|
$table

전체 이벤트는 기존120종을 보존한 $events 종, 선택지는 $choices 개다. 신규 세력 18곳 각각 입문·사문 사건을 연결했고 분쟁·후속·입교·개방 사건 33종을 추가했다. 목록은 코드의 Murim.EVENTS와 developer-coverage.json에서 자동 산출한다. 신규 세력의 유명 절학이나 모든 본산을 구현했다고 표기하지 않는다.

민초·상단의 생업 경로, 내공과 가용 내력 분리, 혈연/입문/진전/후계 분리, 기존 저장 복구를 회귀검사로 유지했다. 원래 서사 소재집 SHA-256은 D0FE3BDEE14FEE84A911E499771568AE154D4B3372B337D110928F934A7326AC이다.
"@
Write-Doc 'docs/IMPLEMENTATION-AUDIT.md' $audit
$qa=@"
# QA 결과 v0.4.2

Windows PowerShell과 설치된 Edge의 headless/CDP로 실제 index.html을 열었다. 별도 프레임워크·Node·빌드는 사용하지 않았다. 현재 소스 기준으로 다시 실행했다.

| 검사 | 결과 |
|---|---:|
| 이전 회귀 기준 | 142 통과 |
| 기존 개발 도구 검사·확장 선택지 | 553 통과 |
| 새 기능 집중 검사 | $($summary.newFeatureTests) 통과 |
| 합계 | $($ui.passed) 통과 / $($ui.failed) 실패 |
| PC·모바일 배치 | $($ui.layouts.Count) / 가로 넘침 $($summary.overflowCases) |
| 선택 이벤트 전체 | $events 종 · $choices 선택 · 실패 $($summary.eventChoiceFailures) |
| 표준 전체 생애 | $($balance.samples)회 · 위반 $($balance.violationCount) |
| 지도층 전체 생애 | $($leaders.samples)회 · 위반 $($leaders.violationCount) |
| v041/042 같은 시드 전투 비교 | $($study.combatSamples)회 · 두 버전 각 13,500회 |
| 자연 출생 | $($study.birthSamples)시드 · 7가구·5가문 모두 생성 |
| 26소속 정상 입문 | $($study.entrySamples)회 · 각200회 |
| 전쟁·민초 생애 | $($study.warLives)회 · 강제 무공/저장 오류 $($study.warStudy.martialViolations)/$($study.warStudy.saveFailures) |

전체 생애 표준·지도층 11,160회와 집중 전쟁 생애 500회는 서로 다른 실험이다. 전투 27,000회, 출생 10,000회, 입문 5,200회를 생애 횟수에 합산하지 않는다. 이전 v0.4.1의 490검사 및 기존 생애 통계는 archive-v041과 verification-v041.json에 남겨두었으며 새 결과로 재사용하지 않았다.

기존 두 검사의 조건을 정당하게 바꿨다. 자연 출생 개수는 확장 출생을 허용하고 7가구·5가문을 별도 검증한다. 모든 세력 입문 검사는 V-027의 성인·악명·성향 자격을 갖춘 인물로 변경했다. 기존120종 고정 카탈로그 검사는 실제 Murim.EVENTS 전체로 확장했다. 검사는 삭제하지 않았다. 과거 강제 입문 fixture에서 새 세력이 이미 해산된 경우에는 필수 테스트 맥락 구성에서만 복구하며 정상 심사에서는 생존 상태를 그대로 검사한다.

실제 이전 엔진 저장 fixture는 v0.3.2 3종, v0.4.0 4종, v0.4.1 2종이다. 과거 연도·성씨·혈연·NPC·기록·재산·대기 사건·전투를 보존한다. v041 비교 엔진은 baseline-v041의 원본 birth-model/engine을 함께 격리 실행했다. 새 저장 필드는 생성·이행·validSave에 연결했다.

최종 검증에서 HTML·JS·CSS $(@($ui.runtimeHashes.PSObject.Properties).Count)파일의 로드 전후 SHA-256을 고정했다. 엔진: $($ui.engineSha256). 상세 결과는 verification-v042.json, qa-final-data.json, developer-coverage.json, faction-study-v042.json, balance-report.json, leadership-study.json에 있다.

전체 생애 실험은 이번 세션에서 최종 엔진·확장 규칙으로 새로 실행했다. 마지막 출생 연출 CSS/화면 보완 후에는747개 검사를 다시 실행하고, 엔진·태생·소재집·확장 규칙·시뮬레이션 정책 해시가 동일한 이번 세션의 생애 결과만 재사용했다. 이전 릴리스의 통계를 새로 실행한 것으로 표시하지 않았다.

실제 사람의 장시간 플레이, 스마트폰 기기 직접 검사, 독립 문파별 새 절학 밸런스, 대규모 군대 AI는 이번 통과 항목에 포함하지 않는다. 지도층 표준 실험은 기존8문파를 대상으로 하며 추가18소속의 전체 생애 지도층 비교는 후속이다. 26소속 입문과 3×7 전쟁 분기는 별도 실제 검사로 확인했다.
"@
Write-Doc 'docs/QA-RESULT.md' $qa
$mode=[IO.File]::ReadAllText((Join-Path $taskRoot 'docs/archive-v041/TEST-MODE.md'))
$mode=$mode.Replace('8문파 정상 입문 심사/우회 입문','26소속 정상 입문 심사/우회 입문').Replace('현행 mentorloss의 생애1회 제한은 보류 장부 CF040-10. 사부마다 반복되는 정상 부고는 미완이다.','사부 NPC별1회 부고를 보관하며 교체한 사부의 사망도 후속 큐에 반영한다.').Replace('일반 플레이 분포는 기존6종 유지. 확장 가문은 테스트 생성으로 제공한다.','일반 플레이에서도7가구·5가문을 추첨한다. 과거 noble은 남궁 본가 직계로 유지한다.').Replace('모든 120종의 268개 선택지는',"모든 $events 종의 $choices 개 선택지는").Replace('개별 무공 XP, 다축 상대 전력, 일반전 독립 사망률은 구현 완료 범위가 아니다.','개별 무공 XP와 완전한 가산·상속 모형은 후속 범위다.')
$mode=$mode.Replace('# 테스트 모드 v0.4.1','# 테스트 모드 v0.4.2').Replace('전체 120종 자동 목록',"전체 $events 종 자동 목록").Replace('일반전과 생사결은 현행 lethal 공식을 공유한다.','일반 적대전은 hostile, 생사결은 lethal로 사망 위험을 구분한다.').Replace('나머지 상대 프로필을 다축 공식으로 계산하지 않는다.','일반 게임 상대는 실제 NPC 프로필에서 전투력을 계산한다. 개발 도구의 지정 전투력은 통제 실험용 우선값이며 다른 프로필 수치를 덮어쓴 것으로 해석하지 않는다.')
$mode+="`n`n## v0.4.2 추가 도구`n`n세계·저장 → 세력 전쟁에서 무림맹 대 사파연합/마교/혈교를 선택하고 실제 전쟁 시작을 누른다. 사건 패널에서 war-로 검색하면 7소속의 본 사건21종과 복구7종이 나타난다. 필수 맥락 구성은 유효한 전쟁을 준비하고 중복 보상 기록을 테스트 복사본에서만 초기화한다. 일반 플레이 원본에는 쓰지 않는다. 실제 시간 진행으로 전황·NPC 중재·휴전·복구를 확인한다.`n`n수치 패널에서 악명도 조절할 수 있다. 정상 사파 심사는 악명12 또는 의협-15 이하, 교단은 성인·악명25·의협-25 이하 또는 납치 생존 연고를 검사한다. 조건 우회 입문과 정상 입문은 구분된다. 전체26소속은 문파·NPC 목록에 자동 표시된다.`n`n출생 도구는 7가구·5가문·본가/분가·직계/방계·출생 인정 상태를 지원한다. 자연 추첨에서도 확장 태생이 생성되며 과거 noble 출생은 다시 추첨하지 않는다. 일반 세션에서는 새 이름 입력 후 전체 화면으로 출생·유년을 읽고 스스로 삶을 살아가기 버튼으로 시작한다.`n"
Write-Doc 'docs/TEST-MODE.md' $mode
$conflicts=@'
# 규칙 충돌 장부 v0.4.2

원본 행과 과거 보류 근거는 archive-v041/RULE-CONFLICTS.md,43-v040-rule-conflicts.csv에 보존한다. 이번 지시의 “시뮬레이션 후 가능한 보류 작업 적용”에 따라 아래 항목만 재개했다.

| ID·원문 | 이번 처리 | 여전히 보류하는 범위 |
|---|---|---|
| CF040-01 · 03_출생_세계!A8:F14;36_통합설정_v0.2!A14:I14 | 기존6추첨의 큰 비율을 유지한 새 실험 계수. 명문8%는5가문 균등, 무가12%중 몰락3%; 본가65%,직계40% 독립 추첨 | 구형7가구30/25/15/15/5/5/5를 확정값으로 채택하지 않음 |
| CF040-02 · 02_세력문파!A13:E17;09_무협지역거점!A13:G19 | 5가문 자연 출생·가입·가주 표기,26소속 기본 사건 | 독립 본산 지도·고유 절학 수치·가산/입양 권리 |
| CF040-08 · 09_전투_수명!A2:D9;36_통합설정_v0.2!A55:I56;피드백!A33:I35 | 일반전/생사결 위험 분리,실제 상대 NPC 프로필,등급·일시 외상·후유장애 | 공용 무공 XP와 기존 핵심 성장 식은 유지 |
| CF040-10 · 36_통합설정_v0.2!A54:I54;22_제자_사승!A17:F17 | 사부 인물당 부고1회로 재개. 교체 사부 사망도 처리 | 없음 |
| CF040-11 · 24_가문_세가!A5:F9;36_통합설정_v0.2!A42:I44 | 이름 접두어로 혈족 추정 금지. 실제 가문·계통·인정이 있는 후보만 추천,새 자녀 부모 기록 | 과거 NPC 미기록 혈연·입양/상속 권리는 창작하지 않음 |

CF040-03(연간/분기 계수),04(구간/지수 XP),05(심법 상성 등급),06(105/120세),07(구형 경제),09(개별 무공 XP)는 직접 충돌 또는 불충분한 확정 근거가 있어 핵심 공식을 교체하지 않았다. 기존 구현된 충돌 이행은 다시 구현하지 않았다.

CF042-01 · 플레이테스트(피드백)!A27:I27와36_통합설정_v0.2의CON-004: 교단의 악행 설정은 최신 피드백을 적용했다. 납치·강제 포교·인신 약탈을 벌이는 조직으로 묘사하고 입교 문턱을 높였다. 사용자가 “교단은 악의 세력, 개인의 선택은 유지”로 확정했다. 현재 구현은 명령 거부·포로 구출·탈퇴를 허용한다. 이 충돌은 결정 완료이며 모든 개인의 도덕성을 소속값 하나로 덮어쓰지 않는다.

CF042-02 · 플레이테스트(피드백)!A29:I29: 새 삶의 출생 연도를122년으로 통일했다. 8세 직접 조작은130년부터다. 과거 저장의 birthYear와 기록 연도는 바꾸지 않았다. 시작 시점122년을 반드시 “8세 조작 연도”로 해석할 경우에는 별도 결정이 필요하다.
'@
Write-Doc 'docs/RULE-CONFLICTS.md' $conflicts
$changelog=@'
# 구현 기록 v0.4.2

기준 v0.4.1은 .qa/baseline-v041 및 docs/baseline-v041-manifest.json으로 보존했다. 이번 실제 변경은 다음과 같다. v0.4.1 기록은 archive-v041/IMPLEMENTATION-CHANGELOG.md에 남겼다.

| 파일 | 변경·이유 | 근거 |
|---|---|---|
| faction-life.js | 18소속 데이터·입교 자격·개방 동냥·7관점 전쟁/휴전/복구·외상/후유장애 | V-027/028/034,WAR-001~003 |
| engine.js | 7가구·5가문 자연 출생·122년 시작·교단 심사·실제 상대 프로필·승패7등급·일반전/생사결 분리·후유증·인물별 부고·가문 후보 증거·새 자녀 부모 기록·가주/군영통령/대행수 구분 | V-024/031~035,CF040-01/02/08/10/11 |
| birth-model.js | 버전 표기·본가 직계의 인정된 출생에 한해 후계 후보 표시,후계 지정은 별도 | V-031,CF040-01/02 |
| game.js/feedback-ui.js | 실제 출생·유년 세로 페이드인/아웃·다시 읽기·진행 시작·전투력/관찰 근거·외상 목록·전쟁 진행 표시 | V-029~034,WAR-001~003 |
| feedback-v042.css | 기존 분위기로 스크롤·지도 선택 크기/점/높이·전체 화면 출생 연출 | V-025/026/029/030 |
| dev-tools.js | 26소속 자동 반영·전쟁 실행·war 사건 유효 맥락·악명 수치·출생 설명 | V-027/028/031,WAR-001~003 |
| index.html | faction-life를engine앞에추가,새CSS,실제v0.4.2표기 | 저장·실행 구조 보호 |
| tools/faction-qa.js/faction-study.js | 새동작·과거저장·전투비교·1만출생·26소속입문·500전쟁생애 | 실제 QA-RESULT 참조 |
| tools/verify-ui.ps1/game-qa.js/dev-qa.js/simulate.js | 신규 검사 연결·실제v041fixture·새 자격/출생 카탈로그 반영·전쟁 선택 정책·파일 해시 검사 | 기존 검사 삭제 없음 |

story-pool.js와 삽화, 기존 CSS 리소스를 보존했다. 기존 저장의 출생·연도·가족·NPC·이미 익힌 무공·재산·이벤트를 다시 추첨하지 않는다. 새 소속 목록은 기존 world.sects에 없는 ID만 이행 시 추가한다.

첫 실험에서 전쟁의 평화·우세 수치가 종료 임계값에 충분히 닿지 못하는 구조를 확인해 NPC 전황의 분기당1회 진행과 중재+2·참전승리+3을 연결했다. 최종 결과는 수정 후 재실행한 해시와만 연결한다. 일반 적대전 위험은 생사결의0.35배, 등급에 따라 추가 조정하며 비무 사망은0이다. 기존 전투력 핵심 가중치를 유지하고 후유증만 추가 반영한다.
'@
Write-Doc 'docs/IMPLEMENTATION-CHANGELOG.md' $changelog
$wars=$study.warStudy
$combatTable=($study.combat|Where-Object {$_.stance -eq 'normal' -and $_.enemyPower -eq 75}|ForEach-Object {"| $($_.rules) | $($_.kind) | $($_.winPct)% | $($_.deathPct)% | $($_.injuryPct)% | $($_.permanentPct)% |"}) -join "`n"
$birthTable=($study.birth.households.PSObject.Properties|ForEach-Object {"| $($_.Name) | $($_.Value) |"}) -join "`n"
$balanceDoc=@"
# 밸런스 v0.4.2

모든 숫자는 실제 실행한 한 실험의 결과이며 수학적으로 유일한 최적값이라는 뜻은 아니다. 핵심 성장·수련·수명·경제의 충돌 수치는 유지하고 이번 피드백에 필요한 태생·입교·전투·분쟁 계수만 조정했다.

## 전투 통제 비교

v041과v042에서 같은 시드300개×3전투유형×5대응×3상대전력(35/75/115)을 실행했다. 각버전13,500회·합계27,000회다. 아래는 건강95·내공1.5·일류·정상대응·상대전력75의 통제 사례이며 모든 플레이어에게 고정되는 실제 확률이 아니다.

| 버전 | 유형 | 승리 | 사망 | 피해 기록 | 지속후유증 |
|---|---|---:|---:|---:|---:|
$combatTable

비무4,500회에서 사망0. 지속후유증은 휴식으로 없어지지 않지만 명의 소문의 치료로 줄일 수 있다. 일시 외상은 분기1·휴식4 회복, 기본 injury 회복은 기존대로 별도 유지한다. 등급별 부상 확률은 승리1.5/8/22/42%, 비무는0.45배이며 패배·압도적패배의 지속후유증 위험은 다르다. 판정의 세부값과 분포는 faction-study-v042.json에 있다.

## 자연 태생

가구 목표 가중치는 고아18·농가28·장인18·상인16·하급무가9·명문8·몰락3이다. 기존 6개 원시 추첨의 18/28/18/16/12/8 틀에서 명문8을5가문에 균등 배분하고 무가12중25%를몰락으로 분리했다. 본가65/분가35, 직계40/방계60은 독립 추첨이며 무공·소속·후계 지정은 부여하지 않는다. 기존 noble 저장은 남궁 본가 직계 그대로 유지한다.

| 가구 | 10,000회 관측 |
|---|---:|
$birthTable

5가문의 관측 횟수는 남궁$($study.birth.clans.namgung),당가$($study.birth.clans.tang),팽가$($study.birth.clans.paeng),제갈$($study.birth.clans.zhuge),모용$($study.birth.clans.murong)이다. 최초 재산·지원은 기존 출생 템플릿을 유지했고 독립적인 가산 경제를 완성했다고 표시하지 않는다.

## 세력·분쟁

자격을 갖춘 성인으로26소속을각200회 심사했다. 교단 기본 입문은 마교26%,혈교22%이며재능·평판·연령에따라변한다. 사파는 악명12 또는의협-15이하, 교단은성인·악명25·의협-25이하또는납치생존연고를요구한다. 출생별강제차단은없다. 세부성공률은5200회실제결과를참조한다.

분쟁은 무전쟁 기간에 연3.5% 검사,동시1개,최대12분기,휴전뒤32분기재발간격이다. NPC가분기마다전황·협상을진행하고플레이어중재는평화+2,당사세력의전투승리는전황+3이다. 민초500개생애에서 전쟁이있던삶$($wars.livesWithWar),시작$($wars.started),종료$($wars.ended),직접받은전쟁선택$($wars.notices),무공강제발생$($wars.martialViolations),저장실패$($wars.saveFailures)였다. 플레이어가죽거나80세관측을마칠때진행중인전쟁은종료수에포함하지않는다.

## 전체 생애

최종 표준$($balance.samples)회에서60세생존$($balance.overall.survival60)%,사망나이중앙$($balance.overall.deathAge.p50)세. 전체활동시간중앙$($balance.overall.minutes.activeP50)분,선택당12초독서를가정하면중앙$($balance.overall.minutes.with12secChoicesP50)분·90백분위$($balance.overall.minutes.with12secChoicesP90)분이다. 고정30분보장이나실제사람의플레이시간측정이아니다. 민초정책의60세내공·무공경지는0을유지했다.
"@
Write-Doc 'docs/BALANCE.md' $balanceDoc
$readme=@"
# 무협생활 v0.4.2

ZIP을 풀고 index.html을 Edge 또는 Chrome으로 연다. 빌드는 필요 없다. 이름만 정하면 출생·가족·재능을 추첨하고 유년기를 읽은 뒤8세부터 사계절의 일을 직접 고른다. 1년12초, 중요한 사건과 전투는 자동 정지한다. 무공 없이도 생업과 인연으로 일생을 완성할 수 있다.

이번 버전은 플레이테스트 V-024~V-035를 반영했다. 26소속,7가구와5가문 자연 출생,전투 정보·승패등급·회복 가능한 외상과 지속후유장애,무림맹 대 사파연합/마교/혈교의 분쟁과7소속별 선택을 지원한다. 기존120사건을 보존해 전체$events 사건·$choices 선택지가 된다. 신규 세력의 모든 본산·절학·상속권·대규모 AI까지 구현된 것은 아니다.

설정 → 게임 설정 → 테스트 모드에서 현재 삶의 복사본을 조작한다. 세계·저장 → 세력 전쟁에서 분쟁을 즉시 시작할 수 있다. 사건에서 war-를 검색하면 소속별 전쟁·복구 사건을 시험할 수 있다. 원본 복원·종료로 테스트 이전 상태를 돌린다. 테스트 조작은 일반 자동 저장 슬롯에 쓰지 않는다.

v0.3.x·v0.4.0·v0.4.1 저장을 이행하며 과거 출생·연도·성씨·혈연·NPC·재산·무공·대기 사건·전투를 보존한다. 과거 noble은 남궁 본가 직계로 유지한다. 새 삶의 출생연도는122년이며8세의조작시점은130년이다.

- [실제 변경·잔여 작업](docs/IMPLEMENTATION-AUDIT.md)
- [테스트 모드](docs/TEST-MODE.md)
- [검증 결과](docs/QA-RESULT.md)
- [수치 실험](docs/BALANCE.md)
- [충돌과 보류](docs/RULE-CONFLICTS.md)
- [구현 기록](docs/IMPLEMENTATION-CHANGELOG.md)

현재 소스에서 $($ui.passed)검사 통과·실패0,PC/모바일50배치넘침0,전체생애11,160회·전쟁생애500회·전투비교27,000회·자연출생10,000회·정상입문5,200회를새로실행했다. 상세한범위와미실행항목은QA문서에있다. 소스기준은v0.4.1이며검증원본해시는verification-v042.json에기록한다.
"@
Write-Doc 'README.md' $readme
([pscustomobject]$summary)|Select-Object version,testsPassed,eventDefinitions,eventChoices,standardSamples,leadershipSamples,deltaAuditComplete,deltaAuditPartial|ConvertTo-Json
