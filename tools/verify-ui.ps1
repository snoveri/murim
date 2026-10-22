param([string]$BrowserPath = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', [int]$Samples = 1440, [switch]$ReuseSimulation, [switch]$UnitOnly, [switch]$PackagedFixtures, [string]$ProjectPath = '')
$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$browserProfileRoot = Join-Path $projectRoot '.qa/browser-profile'
if ($ProjectPath) {
  $reviewProject = [IO.Path]::GetFullPath((Join-Path $projectRoot $ProjectPath))
  if (-not $reviewProject.StartsWith($projectRoot + [IO.Path]::DirectorySeparatorChar,[StringComparison]::OrdinalIgnoreCase)) { throw 'Review project must stay inside this workspace.' }
  $projectRoot = $reviewProject
}
$verificationTools = Join-Path $projectRoot 'tools'
$qaRoot = Join-Path $projectRoot '.qa'
New-Item -ItemType Directory -Path $qaRoot -Force | Out-Null
$profilePath = $browserProfileRoot
$browserProcess = Start-Process -FilePath $BrowserPath -ArgumentList @('--headless=new','--disable-gpu','--no-first-run','--no-default-browser-check','--disable-extensions','--enable-logging=stderr','--remote-debugging-port=19341', ('--user-data-dir="' + $profilePath + '"'), 'about:blank') -WindowStyle Hidden -PassThru -RedirectStandardError (Join-Path $qaRoot 'browser-errors.log')
$socket = New-Object System.Net.WebSockets.ClientWebSocket
$cancel = [System.Threading.CancellationToken]::None
$script:messageId = 0
try {
  $pageTarget = $null
  $readinessError = ''
  for ($attempt = 0; $attempt -lt 30; $attempt++) {
    try {
      $httpClient = New-Object Net.WebClient
      $httpClient.Proxy = $null
      $httpClient.Encoding = [Text.Encoding]::UTF8
      $targets = $httpClient.DownloadString('http://127.0.0.1:19341/json/list') | ConvertFrom-Json
      $httpClient.Dispose()
      foreach ($candidate in $targets) { if ($candidate.type -eq 'page' -and $candidate.url -eq 'about:blank') { $pageTarget = $candidate; break } }
      if ($pageTarget) { break }
    } catch { $readinessError = $_.Exception.Message }
    Start-Sleep -Milliseconds 300
  }
  if (-not $pageTarget) { throw ('Headless browser did not become ready. ' + $readinessError) }
  $socket.ConnectAsync([Uri]$pageTarget.webSocketDebuggerUrl, $cancel).GetAwaiter().GetResult()
  function Invoke-CDP([string]$method, [hashtable]$params = @{}) {
    $script:messageId++
    $commandId = $script:messageId
    $json = @{id=$commandId; method=$method; params=$params} | ConvertTo-Json -Depth 40 -Compress
    $bytes = [Text.Encoding]::UTF8.GetBytes($json)
    $socket.SendAsync([ArraySegment[byte]]::new($bytes), [System.Net.WebSockets.WebSocketMessageType]::Text, $true, $cancel).GetAwaiter().GetResult()
    do {
      $stream = New-Object IO.MemoryStream
      do {
        $buffer = New-Object byte[] 65536
        $received = $socket.ReceiveAsync([ArraySegment[byte]]::new($buffer),$cancel).GetAwaiter().GetResult()
        $stream.Write($buffer,0,$received.Count)
      } while (-not $received.EndOfMessage)
      $message = [Text.Encoding]::UTF8.GetString($stream.ToArray()) | ConvertFrom-Json
      $stream.Dispose()
    } while ($message.id -ne $commandId)
    if ($message.error) { throw ($message.error | ConvertTo-Json -Compress) }
    return $message.result
  }
  function Evaluate([string]$expression) {
    $result = Invoke-CDP 'Runtime.evaluate' @{expression=$expression; returnByValue=$true; awaitPromise=$true}
    if ($result.exceptionDetails) { throw ($result.exceptionDetails | ConvertTo-Json -Depth 10 -Compress) }
    return $result.result.value
  }
  function Resize([int]$width,[int]$height) { Invoke-CDP 'Emulation.setDeviceMetricsOverride' @{width=$width;height=$height;deviceScaleFactor=1;mobile=$false} | Out-Null }
  function Capture([string]$name) {
    Evaluate 'new Promise(resolve=>setTimeout(resolve,400))' | Out-Null
    $shot = Invoke-CDP 'Page.captureScreenshot' @{format='png';captureBeyondViewport=$false}
    [IO.File]::WriteAllBytes((Join-Path $qaRoot ($name+'.png')), [Convert]::FromBase64String($shot.data))
  }
  Resize 1366 768
  Invoke-CDP 'Page.enable' | Out-Null
  $fileUri = [Uri]::new((Join-Path $projectRoot 'index.html')).AbsoluteUri
  $loadedEngineHash = (Get-FileHash -LiteralPath (Join-Path $projectRoot 'engine.js')).Hash
  $loadedStoryHash = (Get-FileHash -LiteralPath (Join-Path $projectRoot 'story-pool.js')).Hash
  $loadedRuntimeHashes=@{}
  foreach($runtimeName in @('index.html','birth-model.js','faction-life.js','engine.js','game.js','story-pool.js','feedback-ui.js','life-panels.js','dev-tools.js','styles.css','game.css','feedback.css','life-panels.css','dev-tools.css','feedback-v042.css')){
    $runtimePath=Join-Path $projectRoot $runtimeName
    if(Test-Path -LiteralPath $runtimePath){$loadedRuntimeHashes[$runtimeName]=(Get-FileHash -LiteralPath $runtimePath).Hash}
  }
  Invoke-CDP 'Page.navigate' @{url=$fileUri} | Out-Null
  Start-Sleep -Seconds 2
  Evaluate 'Promise.race([document.fonts.ready.then(()=>true),new Promise(resolve=>setTimeout(()=>resolve(false),4000))])' | Out-Null
  Evaluate 'localStorage.removeItem(STORAGE);state=Murim.createLife("무명",20261021,{started:true});navigate("chronicle");true' | Out-Null
  Capture 'main-1366'
  $tests = Get-Content -Encoding UTF8 -Raw -LiteralPath (Join-Path $verificationTools 'game-qa.js')
  $results = Evaluate $tests
  if (-not $ProjectPath) {
    $legacyEnginePath = Join-Path $projectRoot '.qa/incoming-v032/engine.js'
    $fixturePath = Join-Path $projectRoot 'docs/fixtures-v032.json'
    if (Test-Path -LiteralPath $legacyEnginePath) {
      $legacyEngineSource = Get-Content -Encoding UTF8 -Raw -LiteralPath $legacyEnginePath
      $fixtureScript = @'
const a=Murim.createLife('소연','v032-fixture',{started:true});Murim.queue(a,'waybill');Murim.dispatch(a);Murim.resolveEvent(a,a.pendingEvent.uid,0);Murim.hearRumor(a,'manual',true);Murim.advanceNarrative(a,.34);
const b=Murim.createLife('청운','v032-pending',{started:true});Murim.queue(b,'inkseal');Murim.dispatch(b);
const c=Murim.createLife('하린','v032-combat',{started:true});Murim.queue(c,'duel');Murim.dispatch(c);Murim.resolveEvent(c,c.pendingEvent.uid,0);
return [a,b,c];
'@
      $legacyFixtures = Evaluate ('(()=>{'+$legacyEngineSource+"`n"+$fixtureScript+'})()')
      $legacyFixtures | ConvertTo-Json -Depth 50 | Set-Content -LiteralPath $fixturePath -Encoding UTF8
    }
    if (Test-Path -LiteralPath $fixturePath) {
      $fixtureJSON = Get-Content -Encoding UTF8 -Raw -LiteralPath $fixturePath
      Evaluate ('globalThis.__legacy032Fixtures='+$fixtureJSON+';true') | Out-Null
      $migrationTests = Get-Content -Encoding UTF8 -Raw -LiteralPath (Join-Path $verificationTools 'legacy-migration-qa.js')
      $results = @($results) + @(Evaluate $migrationTests)
    }
  }
  if (Test-Path -LiteralPath (Join-Path $verificationTools 'story-ui-qa.js')) {
    $storyTests = Get-Content -Encoding UTF8 -Raw -LiteralPath (Join-Path $verificationTools 'story-ui-qa.js')
    $results = @($results) + @(Evaluate $storyTests)
  }
  if (Test-Path -LiteralPath (Join-Path $verificationTools 'narrative-study.js')) {
    $narrativeSource = Get-Content -Encoding UTF8 -Raw -LiteralPath (Join-Path $verificationTools 'narrative-study.js')
    $narrativeReport = Evaluate $narrativeSource
    $narrativeReport | ConvertTo-Json -Depth 30 | Set-Content -LiteralPath (Join-Path $projectRoot 'docs/narrative-study.json') -Encoding UTF8
    $results = @($results) + @($narrativeReport.checks)
  }
  if (-not $ProjectPath -and (Test-Path -LiteralPath (Join-Path $verificationTools 'dev-qa.js'))) {
    $baselineEnginePath=Join-Path $projectRoot '.qa/baseline-v040/engine.js'
    if(Test-Path -LiteralPath $baselineEnginePath){
      $baselineSource=Get-Content -Encoding UTF8 -Raw -LiteralPath $baselineEnginePath
      $baselineFixtures=@"
const a=Murim.createLife('원본','v040-quarter',{started:true,originId:'noble'});Murim.advanceNarrative(a,.34);
const b=Murim.createLife('원본','v040-event',{started:true});Murim.queue(b,'inkseal');Murim.dispatch(b);
const c=Murim.createLife('원본','v040-combat',{started:true});Murim.queue(c,'duel');Murim.dispatch(c);Murim.resolveEvent(c,c.pendingEvent.uid,0);
const d=Murim.createLife('원본','v040-chain',{started:true});Murim.queue(d,'waybill');Murim.dispatch(d);Murim.resolveEvent(d,d.pendingEvent.uid,0);
return [a,b,c,d];
"@
      $old040=Evaluate ('(()=>{'+$baselineSource+$baselineFixtures+'})()')
      $old040Json=$old040 | ConvertTo-Json -Depth 60 -Compress
      [IO.File]::WriteAllText((Join-Path $projectRoot 'docs/fixtures-v040.json'),$old040Json,[Text.UTF8Encoding]::new($false))
      Evaluate ('globalThis.__legacy040Fixtures='+$old040Json+';true') | Out-Null
    }elseif(Test-Path -LiteralPath (Join-Path $projectRoot 'docs/fixtures-v040.json')){
      Evaluate ('globalThis.__legacy040Fixtures='+[IO.File]::ReadAllText((Join-Path $projectRoot 'docs/fixtures-v040.json'))+';true') | Out-Null
    }
    $developerSource = Get-Content -Encoding UTF8 -Raw -LiteralPath (Join-Path $verificationTools 'dev-qa.js')
    $developerResults = Evaluate $developerSource
    $results = @($results) + @($developerResults)
    Evaluate '({events:globalThis.__devCoverage041,birthStats:globalThis.__birthStats041})' | ConvertTo-Json -Depth 20 | Set-Content -LiteralPath (Join-Path $projectRoot 'docs/developer-coverage.json') -Encoding UTF8
  }
  $baseline041Path=if($PackagedFixtures){Join-Path $projectRoot 'tools/fixtures/v041/engine.js'}else{Join-Path $projectRoot '.qa/baseline-v041/engine.js'}
  if(-not (Test-Path -LiteralPath $baseline041Path)){$baseline041Path=Join-Path $projectRoot 'tools/fixtures/v041/engine.js'}
  if(Test-Path -LiteralPath $baseline041Path){
    $oldBirth=(Get-Content -LiteralPath (Join-Path (Split-Path -Parent $baseline041Path) 'birth-model.js') -Raw -Encoding UTF8).Replace('globalThis.MurimBirth=MurimBirth;','')
    $oldEngine=(Get-Content -LiteralPath $baseline041Path -Raw -Encoding UTF8).Replace(': globalThis.MurimBirth;',': MurimBirth;')
    Evaluate ('globalThis.__baseline041=(()=>{'+$oldBirth+$oldEngine+';return Murim;})();globalThis.__fixtures041=(()=>{const a=__baseline041.createLife("원본","v041-pending",{originId:"noble",started:true});__baseline041.queue(a,"festival");__baseline041.dispatch(a);const b=__baseline041.createLife("원본","v041-combat",{originId:"orphan",started:true});__baseline041.queue(b,"duel");__baseline041.dispatch(b);__baseline041.resolveEvent(b,b.pendingEvent.uid,0);return [a,b];})();true')|Out-Null
    Evaluate 'globalThis.__fixtures041'|ConvertTo-Json -Depth 50|Set-Content -LiteralPath (Join-Path $projectRoot 'docs/fixtures-v041.json') -Encoding UTF8
  }
  if(Test-Path -LiteralPath (Join-Path $verificationTools 'faction-qa.js')){$results=@($results)+@(Evaluate (Get-Content -LiteralPath (Join-Path $verificationTools 'faction-qa.js') -Raw -Encoding UTF8))}
  @{tests=$results;passed=@($results | Where-Object pass).Count;failed=@($results | Where-Object { -not $_.pass }).Count} | ConvertTo-Json -Depth 15 | Set-Content -LiteralPath (Join-Path $qaRoot 'unit-report.json') -Encoding UTF8
  if($UnitOnly){Invoke-CDP 'Browser.close' | Out-Null;@{passed=@($results|Where-Object pass).Count;failed=@($results|Where-Object {-not $_.pass}).Count}|ConvertTo-Json -Compress;return}
  if(Test-Path -LiteralPath (Join-Path $verificationTools 'faction-study.js')){
    $baseline041Path=if(Test-Path -LiteralPath (Join-Path $projectRoot '.qa/baseline-v041/engine.js')){Join-Path $projectRoot '.qa/baseline-v041/engine.js'}else{Join-Path $projectRoot 'tools/fixtures/v041/engine.js'}
    if(-not (Test-Path -LiteralPath $baseline041Path)){Evaluate 'globalThis.__baseline041=null;true'|Out-Null}
    $factionStudy=Evaluate ((Get-Content -LiteralPath (Join-Path $verificationTools 'faction-study.js') -Raw -Encoding UTF8)+';runFactionStudy(globalThis.__baseline041||null)')
    $factionStudy|Add-Member -NotePropertyName engineSha256 -NotePropertyValue $loadedEngineHash
    $factionStudy|Add-Member -NotePropertyName expansionSha256 -NotePropertyValue $loadedRuntimeHashes['faction-life.js']
    $factionStudy|ConvertTo-Json -Depth 30|Set-Content -LiteralPath (Join-Path $projectRoot 'docs/faction-study-v042.json') -Encoding UTF8
  }
  if ($ReuseSimulation) {
    $balance = Get-Content -Encoding UTF8 -Raw -LiteralPath (Join-Path $projectRoot 'docs/balance-report.json') | ConvertFrom-Json
    $leadership = Get-Content -Encoding UTF8 -Raw -LiteralPath (Join-Path $projectRoot 'docs/leadership-study.json') | ConvertFrom-Json
    $previousVerification=Get-Content -LiteralPath (Join-Path $projectRoot 'docs/verification-v042.json') -Raw -Encoding UTF8|ConvertFrom-Json
    if($previousVerification.runtimeHashes.'faction-life.js' -ne $loadedRuntimeHashes['faction-life.js'] -or $previousVerification.simulationSha256 -ne (Get-FileHash -LiteralPath (Join-Path $projectRoot 'tools/simulate.js')).Hash){throw 'Rules or simulation policy changed; rerun without -ReuseSimulation'}
    $currentHash = (Get-FileHash -LiteralPath (Join-Path $projectRoot 'engine.js') -Algorithm SHA256).Hash
    if ($balance.engineSha256 -ne $currentHash -or $leadership.engineSha256 -ne $currentHash) { throw 'Engine changed; rerun without -ReuseSimulation' }
    if($balance.birthModelSha256 -ne $loadedRuntimeHashes['birth-model.js']){throw 'Birth model changed; rerun without -ReuseSimulation'}
    $currentStoryHash = (Get-FileHash -LiteralPath (Join-Path $projectRoot 'story-pool.js') -Algorithm SHA256).Hash
    if ($balance.storyPoolSha256 -ne $currentStoryHash -or $leadership.storyPoolSha256 -ne $currentStoryHash) { throw 'Story pool changed; rerun without -ReuseSimulation' }
  } else {
  $simulationSource = Get-Content -Encoding UTF8 -Raw -LiteralPath (Join-Path $verificationTools 'simulate.js')
  $balance = Evaluate ($simulationSource + "`nrunBalance(" + $Samples + ")")
  $balance | Add-Member -NotePropertyName birthModelSha256 -NotePropertyValue $loadedRuntimeHashes['birth-model.js']
  $balance | Add-Member -NotePropertyName engineSha256 -NotePropertyValue (Get-FileHash -LiteralPath (Join-Path $projectRoot 'engine.js') -Algorithm SHA256).Hash
  $balance | Add-Member -NotePropertyName storyPoolSha256 -NotePropertyValue (Get-FileHash -LiteralPath (Join-Path $projectRoot 'story-pool.js') -Algorithm SHA256).Hash
  $balance | ConvertTo-Json -Depth 30 | Set-Content -LiteralPath (Join-Path $projectRoot 'docs/balance-report.json') -Encoding UTF8
  $csvExpression = @'
const csvFields=['seed','origin','policy','age','cause','rank','inner','wealth','events','transitions','survived60','rank60','inner60','career60','wealth60','memoryCount','closedMemoryCount','activeSeconds','estimatedSeconds']; csvFields.join(',')+'\n'+balanceRows.map(r=>csvFields.map(k=>JSON.stringify(r[k]??null)).join(',')).join('\n')
'@
  Evaluate $csvExpression | Set-Content -LiteralPath (Join-Path $projectRoot 'docs/balance-runs.csv') -Encoding UTF8
  $leadership = Evaluate 'runBalance(1152,"leadership")'
  $leadership | Add-Member -NotePropertyName birthModelSha256 -NotePropertyValue $loadedRuntimeHashes['birth-model.js']
  $leadership | Add-Member -NotePropertyName engineSha256 -NotePropertyValue $balance.engineSha256
  $leadership | Add-Member -NotePropertyName storyPoolSha256 -NotePropertyValue $balance.storyPoolSha256
  $leadership | ConvertTo-Json -Depth 30 | Set-Content -LiteralPath (Join-Path $projectRoot 'docs/leadership-study.json') -Encoding UTF8
  }
  $layouts = @()
  foreach ($screen in @('chronicle','plan','map','event','people','character','history','settings')) {
    Evaluate ('navigate("' + $screen + '");true') | Out-Null
    Capture ($screen+'-1366')
    $overflow = Evaluate 'document.documentElement.scrollWidth>innerWidth'
    $layouts += @{screen=$screen;width=1366;overflow=$overflow}
  }
  Resize 1920 1080
  Evaluate 'navigate("chronicle");true' | Out-Null
  Capture 'main-1920'
  foreach ($screen in @('chronicle','plan','map','event','people','character','history','settings')) {
    Resize 390 844
    Evaluate ('navigate("' + $screen + '");true') | Out-Null
    $layouts += @{screen=$screen;width=390;overflow=(Evaluate 'document.documentElement.scrollWidth>innerWidth')}
    if ($screen -eq 'chronicle') { Capture 'mobile-chronicle' }
  }
  Capture 'mobile-settings'
  if (-not $ProjectPath) {
    foreach ($detailWidth in @(1366,390)) {
      Resize $detailWidth 844
      foreach ($detail in @('기본','능력','무공','생업','상태','업적','용어')) {
        Evaluate ('detailTab='+('"'+$detail+'"')+';navigate("character");true') | Out-Null
        $layouts += @{screen=('character-'+$detail);width=$detailWidth;overflow=(Evaluate 'document.documentElement.scrollWidth>innerWidth')}
        Capture ('detail-'+$detail+'-'+$detailWidth)
      }
    }
    Evaluate 'window.__qaPanelState=state;state=Murim.createLife("소연",44,{started:true});Murim.hearRumor(state,"manual",true);Murim.hearRumor(state,"trade",true);Murim.hearRumor(state,"relief",true);navigate("chronicle");true' | Out-Null
    foreach ($panelWidth in @(1366,390)) {
      Resize $panelWidth 844
      $layouts += @{screen='multiple-rumors';width=$panelWidth;overflow=(Evaluate 'document.documentElement.scrollWidth>innerWidth')}
      Capture ('rumors-'+$panelWidth)
    }
    Evaluate 'state=window.__qaPanelState;delete window.__qaPanelState;detailTab="기본";navigate("chronicle");true' | Out-Null
  }
  Evaluate 'window.__qaVisualState=state;state=Murim.createLife("무명",451,{started:true});state.age=30;state.tick=120;state.inner=1.2;state.swordXP=1000;state.operationXP=700;state.methodXP=600;state.knowledgeXP=1200;Murim.queue(state,"bandit");Murim.dispatch(state);Murim.resolveEvent(state,state.pendingEvent.uid,2);navigate("event");true' | Out-Null
  Resize 1366 768
  Capture 'combat-1366'
  $layouts += @{screen='combat';width=1366;overflow=(Evaluate 'document.documentElement.scrollWidth>innerWidth')}
  Resize 390 844
  Capture 'combat-390'
  $layouts += @{screen='combat';width=390;overflow=(Evaluate 'document.documentElement.scrollWidth>innerWidth')}
  Evaluate 'state=window.__qaVisualState;delete window.__qaVisualState;navigate("chronicle");true' | Out-Null
  Evaluate 'globalThis.__devLayoutState=state;state=Murim.createLife("배치",44,{started:true});navigate("settings");settingsTab="게임 설정";render();MurimDev.enable();true' | Out-Null
  foreach($devWidth in @(1366,390)){
    Resize $devWidth 844
    foreach($devTab in @('사건','전투','수치','소문','문파·NPC','출생','세계·저장','로그·큐')){
      Evaluate ('MurimDev.open();[...document.querySelectorAll("[data-dev-tab]")].find(b=>b.dataset.devTab==='+('"'+$devTab+'"')+').click();true') | Out-Null
      $layouts+=@{screen=('developer-'+$devTab);width=$devWidth;overflow=(Evaluate 'document.documentElement.scrollWidth>innerWidth||document.getElementById("developerPanel").getBoundingClientRect().right>innerWidth')}
      if($devTab -eq '출생' -or $devTab -eq '사건'){Capture ('developer-'+$devTab+'-'+$devWidth)}
    }
  }
  Evaluate 'MurimDev.disable();state=globalThis.__devLayoutState;delete globalThis.__devLayoutState;navigate("chronicle");true' | Out-Null
  if ((Get-FileHash -LiteralPath (Join-Path $projectRoot 'engine.js')).Hash -ne $loadedEngineHash -or (Get-FileHash -LiteralPath (Join-Path $projectRoot 'story-pool.js')).Hash -ne $loadedStoryHash) { throw 'Production source changed during verification; rerun against a stable source.' }
  foreach($runtimeName in $loadedRuntimeHashes.Keys){if((Get-FileHash -LiteralPath (Join-Path $projectRoot $runtimeName)).Hash -ne $loadedRuntimeHashes[$runtimeName]){throw ('Runtime changed during verification: '+$runtimeName)}}
  $report = @{runtimeHashes=$loadedRuntimeHashes;version=$balance.version;engineSha256=$loadedEngineHash;storyPoolSha256=$loadedStoryHash;tests=$results;layouts=$layouts;passed=@($results | Where-Object pass).Count;failed=@($results | Where-Object { -not $_.pass }).Count}
  $report | ConvertTo-Json -Depth 12 | Set-Content -LiteralPath (Join-Path $qaRoot 'report.json') -Encoding UTF8
  ([pscustomobject]$report) | Select-Object version,engineSha256,passed,failed | ConvertTo-Json -Compress
  @{samples=$balance.samples;violations=$balance.violationCount;overall=$balance.overall;byPolicy=$balance.byPolicy;pairedWealth=$balance.pairedWealth} | ConvertTo-Json -Depth 15 -Compress
  Invoke-CDP 'Browser.close' | Out-Null
  if ($report.failed -gt 0 -or $balance.violationCount -gt 0 -or $leadership.violationCount -gt 0 -or @($layouts | Where-Object overflow).Count -gt 0) { throw 'Game verification failed; see .qa/report.json and docs/balance-report.json' }
} finally { $socket.Dispose(); if (-not $browserProcess.HasExited) { Stop-Process -Id $browserProcess.Id -ErrorAction SilentlyContinue } }
