# PowerShel script to run a Kiuwan delivery Analysis on a private TFS or VSTS agent

# Get the values from the task's inputs bythe user
$analysisLabel = Get-VstsInput -Name 'analysislabel'
$encoding = Get-VstsInput -Name 'encoding'
$includePatterns = Get-VstsInput -Name 'includepatterns'
$excludePatterns = Get-VstsInput -Name 'excludepatterns'
$crstatus = Get-VstsInput -Name 'crstatus'

# Get other relevant Variables from the task
$buildNumber = Get-VstsTaskVariable -Name 'Build.BuildNumber'
$kiuwanUser = Get-VstsTaskVariable -Name 'KiuwanUser'
$kiuwanPasswd = Get-VstsTaskVariable -Name 'KiuwanPasswd'
$projectName = Get-VstsTaskVariable -Name 'System.TeamProject'
$sourceDirectory = Get-VstsTaskVariable -Name 'Build.SourcesDirectory'
$branchName = Get-VstsTaskVariable -Name 'Build.SourceBranchName'
$agentName = Get-VstsTaskVariable -Name 'Agent.Name'
$agentHomeDir = Get-VstsTaskVariable -Name "Agent.HomeDirectory"

# Function to download and install the KLA in the specified directory
function Get-Install-KLA ([string]$installPath) {
    Write-Host "Downloading KLA..."
    Invoke-WebRequest -OutFile $installPath\KiuwanLocalAnalyzer.zip https://www.kiuwan.com/pub/analyzer/KiuwanLocalAnalyzer.zip
    
    Write-Host "Installing KLA..."
    Expand-archive $installPath\KiuwanLocalAnalyzer.zip -DestinationPath $installPath  
    
    Write-Host "KLA successfully installed in $installPath"
}

# Check the type of agent running the task based on the tast name. Hosted agents are *always*
# called 'Hosted agent'
if ($agentName -eq "Hosted Agent") {
    Write-Host "$agentName is a Hosted agent"

    Get-Install-KLA -installPath "."

    $kla = ".\KiuwanLocalAnalyzer\bin\agent.cmd"
    $excludePatterns += ",**/KiuwanLocalAnalyzer/**"
}
# If running in a private agent check that the KIUWAN_HOME variable is set and pointing to a
# valid KLA installation or if it has been already installed in the agent home directory.
# If not, download and install it in the agent home directory
else {
    Write-Host "$agentName is a Private agent"
    # Check if the KIUWAN_HOME is defined in the agent
    if ( Test-Path Env:\KIUWAN_HOME ) {
        $kiuwanHome = $Env:KIUWAN_HOME
        Write-Host "Kiuwan Local Analyzer found at $kiuwanHome"
        $kla = "$kiuwanHome\bin\agent.cmd"        
    }
    # Check if the KLA has already been installed inthe agent home directory
    elseif ( Test-Path $agentHomeDir\KiuwanLocalAnalyzer ) {
        $kiuwanHome = "$agentHomeDir\KiuwanLocalAnalyzer"
        Write-Host "Kiuwan Local Analyzer found at $kiuwanHome"
        $kla = "$kiuwanHome\bin\agent.cmd"                
    }
    # No KLA found
    else {
        Write-Host "KIUWAN_HOME variable not set and KLA not previously installed in the agent machine."
        Write-Host "Dowloading and installing it."

        Get-Install-KLA -installPath "$agentHomeDir"

        $kiuwanHome = "$agentHomeDir\KiuwanLocalAnalyzer"
        Write-Host "KLA installed in $kiuwanHome"
        $kla = "$kiuwanHome\bin\agent.cmd"
    }
}

Write-Host "Running KLA..."
Write-host "With user $kiuwanUser for project $projectName $analysisLabel on this branch $branchName and these sources $sourceDirectory"
& $kla -n $projectName -s $sourceDirectory -l "$analysislabel $buildNumber" -as completeDelivery -cr $branchName -crs $crstatus -bn $branchName -wr --user $kiuwanUser --pass $kiuwanPasswd exclude.patterns=$excludePatterns include.patterns=$includePatterns encoding=$encoding

exit $lastexitcode


