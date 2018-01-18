# PowerShel script to run a Kiuwan delivery Analysis on a private TFS or VSTS agent

$analysisLabel = Get-VstsInput -Name 'analysislabel'
$buildNumber = Get-VstsTaskVariable -Name'Build.BuildNumber'
$kiuwanUser = Get-VstsTaskVariable -Name 'KiuwanUser'
$kiuwanPasswd = Get-VstsTaskVariable -Name 'KiuwanPasswd'
$projectName = Get-VstsTaskVariable -Name 'System.TeamProject'
$sourceDirectory = Get-VstsTaskVariable -Name 'Build.SourcesDirectory'
$branchName = Get-VstsTaskVariable -Name 'Build.SourceBranchName'
$encoding = Get-VstsInput -Name 'encoding'
$includePatterns = Get-VstsInput -Name 'inputpatterns'
$excludePatterns = Get-VstsInput -Name 'exputpatterns'

Write-Host "Running KLA..."
Write-host "With user $kiuwanUser for project $projectName $analysisLabel on this branch $branchName and these sources $sourceDirectory"
agent.cmd -n $projectName -s $sourceDirectory -l "$analysislabel $buildNumber" -as completeDelivery -cr $branchName -bn $branchName -wr --user $kiuwanUser --pass $kiuwanPasswd exclude.patterns=$excludePatterns include.patterns=$includePatterns encoding=$encoding
