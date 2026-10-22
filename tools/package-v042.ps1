$ErrorActionPreference='Stop'
Add-Type -AssemblyName System.IO.Compression.FileSystem
Add-Type -AssemblyName System.IO.Compression
$taskRoot=[IO.Path]::GetFullPath((Split-Path -Parent $PSScriptRoot))
$taskTarget=[IO.Path]::GetFullPath((Join-Path $taskRoot '무협생활_v0.4.2_피드백_분쟁통합.zip'))
if(-not $taskTarget.StartsWith($taskRoot+[IO.Path]::DirectorySeparatorChar,[StringComparison]::OrdinalIgnoreCase)){throw 'Package target escaped workspace'}
$taskCheck=Get-Content -Encoding UTF8 -Raw (Join-Path $taskRoot 'docs/verification-v042.json') | ConvertFrom-Json
if($taskCheck.testsFailed -or $taskCheck.standardViolations -or $taskCheck.leadershipViolations -or $taskCheck.focusedViolations -or $taskCheck.eventChoiceFailures -or $taskCheck.overflowCases){throw 'Package contains failed verification'}
foreach($taskProp in $taskCheck.runtimeHashes.PSObject.Properties){if((Get-FileHash -LiteralPath (Join-Path $taskRoot $taskProp.Name)).Hash -ne $taskProp.Value){throw ('Unverified file: '+$taskProp.Name)}}
$taskRuntime=@('index.html','birth-model.js','faction-life.js','engine.js','story-pool.js','game.js','feedback-ui.js','life-panels.js','dev-tools.js','styles.css','game.css','feedback.css','life-panels.css','dev-tools.css','feedback-v042.css','README.md')
$taskManifest=foreach($taskRelative in $taskRuntime){$taskFile=Join-Path $taskRoot $taskRelative;[ordered]@{path=$taskRelative;bytes=(Get-Item -LiteralPath $taskFile).Length;sha256=(Get-FileHash -LiteralPath $taskFile).Hash}}
[ordered]@{version='0.4.2';date='2026-10-22';files=@($taskManifest);testsPassed=$taskCheck.testsPassed;standardSamples=$taskCheck.standardSamples;leadershipSamples=$taskCheck.leadershipSamples} | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath (Join-Path $taskRoot 'docs/release-manifest.json') -Encoding UTF8
$taskExcluded=@('merge-v032.ps1','freeze-v040.ps1','update-entry-v041.ps1','finish-v041.ps1','patch-lookups-v041.ps1','extend-qa-v041.ps1','runtime-hashes-v041.ps1','package-v041.ps1','write-v041-report.ps1','package-v042.json')
$taskFiles=@($taskRuntime | ForEach-Object {Get-Item -LiteralPath (Join-Path $taskRoot $_)})
foreach($taskFolder in @('assets','docs','tools')){$taskFiles+=@(Get-ChildItem -LiteralPath (Join-Path $taskRoot $taskFolder) -Recurse -File | Where-Object {$_.Name -notin $taskExcluded})}
$taskStream=[IO.File]::Open($taskTarget,[IO.FileMode]::Create)
$taskArchive=[IO.Compression.ZipArchive]::new($taskStream,[IO.Compression.ZipArchiveMode]::Create,$false)
try{foreach($taskFile in $taskFiles){if(-not $taskFile.FullName.StartsWith($taskRoot+[IO.Path]::DirectorySeparatorChar,[StringComparison]::OrdinalIgnoreCase)){throw 'Package source escaped workspace'};$taskRelative=$taskFile.FullName.Substring($taskRoot.Length+1).Replace([char]92,[char]47);[IO.Compression.ZipFileExtensions]::CreateEntryFromFile($taskArchive,$taskFile.FullName,('murim_prototype/'+$taskRelative),[IO.Compression.CompressionLevel]::Optimal) | Out-Null}}finally{$taskArchive.Dispose();$taskStream.Dispose()}
$taskInspection=[IO.Compression.ZipFile]::OpenRead($taskTarget)
try{
  foreach($taskRecord in $taskManifest){$taskEntry=$taskInspection.GetEntry('murim_prototype/'+$taskRecord.path);if(-not $taskEntry){throw ('Missing runtime '+$taskRecord.path)};$taskStream=$taskEntry.Open();$taskHasher=[Security.Cryptography.SHA256]::Create();try{$taskHash=[BitConverter]::ToString($taskHasher.ComputeHash($taskStream)).Replace('-','');if($taskHash -ne $taskRecord.sha256){throw 'Archive runtime hash mismatch'}}finally{$taskHasher.Dispose();$taskStream.Dispose()}}
  if(@($taskInspection.Entries | Where-Object {$_.FullName -match '/\.qa/|browser-profile|\.zip$'}).Count){throw 'Archive includes private QA/cache/archive files'}
  $taskEntryCount=$taskInspection.Entries.Count
}finally{$taskInspection.Dispose()}
$taskResult=[ordered]@{version='0.4.2';path=$taskTarget;bytes=(Get-Item -LiteralPath $taskTarget).Length;entries=$taskEntryCount;sha256=(Get-FileHash -LiteralPath $taskTarget).Hash;runtimeHashesVerified=$taskManifest.Count}
$taskResult | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $taskRoot 'docs/package-v042.json') -Encoding UTF8
$taskResult | ConvertTo-Json
