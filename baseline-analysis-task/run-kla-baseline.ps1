# PowerShel script to run a Kiuwan baseline Analysis on a private TFS or VSTS agent

$analysisLabel = Get-VstsInput -Name 'analysislabel'
$buildNumber = Get-VstsTaskVariable -Name'Build.BuildNumber'
$kiuwanUser = Get-VstsTaskVariable -Name 'KiuwanUser'
$kiuwanPasswd = Get-VstsTaskVariable -Name 'KiuwanPasswd'
$projectName = Get-VstsTaskVariable -Name 'System.TeamProject'
$sourceDirectory = Get-VstsTaskVariable -Name 'Build.SourcesDirectory'
$encoding = Get-VstsInput -Name 'encoding'
$includePatterns = Get-VstsInput -Name 'inputpatterns'
$excludePatterns = Get-VstsInput -Name 'exputpatterns'

Write-Host "Running KLA..."
Write-host "With user $kiuwanUser for project $projectName $analysisLabel on this sources $sourceDirectory"
agent.cmd -n $projectName -s $sourceDirectory -l "$analysislabel $buildNumber" -c -wr --user $kiuwanUser --pass $kiuwanPasswd exclude.patterns=$excludePatterns include.patterns=$includePatterns encoding=$encoding

