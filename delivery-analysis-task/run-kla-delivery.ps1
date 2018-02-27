# PowerShel script to run a Kiuwan delivery Analysis on a private TFS or VSTS agent

# Default technologies to analyze
$technologies ="abap,actionscript,aspnet,c,cobol,cpp,csharp,html,java,javascript,jcl,jsp,natural,objectivec,oracleforms,perl,php,powerscript,python,rpg4,ruby,swift,vb6,vbnet,xml"

# Get the values from the task's inputs bythe user
$analysisLabel = Get-VstsInput -Name 'analysislabel'
$analysisscope = Get-VstsInput -Name 'analysisscope'
$skipclones = Get-VstsInput -Name 'skipclones'
$ignoreclause = ""
if ($skipclones) {
    $ignoreclause = "ignore=clones"
}
$encoding = Get-VstsInput -Name 'encoding'
$includePatterns = Get-VstsInput -Name 'includepatterns'
$excludePatterns = Get-VstsInput -Name 'excludepatterns'
$memory = Get-VstsInput -Name 'memory'
$memory += "m"
$timeout = Get-VstsInput -Name 'timeout'
$timeout = [int]$timeout * 60000
$dbanalysis = Get-VstsInput -Name 'dbanalysis'
if ($dbanalysis) {
    $dbtechnology = Get-VstsInput -Name 'dbtchenology'
    $technologies += ",$dbtechnology"
}
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
Write-Host "With user $kiuwanUser for project $projectName $analysisLabel on this branch $branchName and these sources $sourceDirectory"
Write-Host "$kla -n $projectName -s $sourceDirectory -l "$analysislabel $buildNumber" -c -wr --user $kiuwanUser --pass $kiuwanPasswd exclude.patterns=$excludePatterns include.patterns=$includePatterns encoding=$encoding supported.technologies=$technologies memory.max=$memory timeout=$timeout $ignoreclause"
& $kla -n $projectName -s $sourceDirectory -l "$analysislabel $buildNumber" -as $analysisscope -cr $branchName -crs $crstatus -bn $branchName -wr --user $kiuwanUser --pass $kiuwanPasswd exclude.patterns=$excludePatterns include.patterns=$includePatterns encoding=$encoding supported.technologies=$technologies memory.max=$memory timeout=$timeout $ignoreclause

switch ( $lastexitcode ) {
    1 {
        Write-Error "KLA Error ${lastexitcode}: Analyzer execution error .Run-time execution error (out of memory, etc.). Review log files to find exact cause."
    }
    10 {
        Write-Error "KLA Error ${lastexitcode}: Audit overall result = FAIL. Audit associated to the analyzed application did not pass. See audit report for exact reasons of non compliance (checkpoints not passed, etc.)"
    }
    11 {
        Write-Error "KLA Error ${lastexitcode}: Invalid analysis configuration. Some configuration parameter has a wrong value. Review log files to find exact cause"
    }
    2 {
        Write-Error "KLA Error ${lastexitcode}: The downloaded model does not support any of the discovered languages. The model specified for the application does not contains rules for the technologies being analyzed. Select an appropriate model or modify the model to include those technologies not currently supported"
    }
    3 {
        Write-Error "KLA Error ${lastexitcode}: Timeout waiting for analysis results. After finishing the local analysis, results were uploaded to Kiuwan site but the second phase (index calculation) timed out. A very common reason for this problem is when your account has reached the maximun number of analyzed locs per 24h. In this case, your analysis is enqueued and local analyzer times out. This does not mean that the analysis has failed. Indeed, the analysis is only enqueued and it will be processed as soon as the limit is over. In this situation you don't need to execute again the analysis, just wait, it will be run automatically."
    }
    14 {
        Write-Error "KLA Error ${lastexitcode}: Analysis finished with error in Kiuwan. Although local analysis finished successfully, there was some error during analysis processing in the cloud. Visit the log page associated to the analysis."
    }
    15 {
        Write-Error "KLA Error ${lastexitcode}: Timeout: killed the subprocess. Local analysis timed out. Increase timeout value to a higher value."
    }
    16 {
        Write-Error "KLA Error ${lastexitcode}: Account limits exceeded. Some limit in the Kiuwan account is reached (max number of account’s analysis is reached, etc.). Contact Kiuwan Technical Support if you have any question on your acccount’s limits."
    }
    17 {
        Write-Error "KLA Error ${lastexitcode}: Delivery analysis not permitted for current user. User does not have permission to run delivery analysis for the current application.	Check the user has “Execute deliveries” privilege on the application."
    }
    18 {
        Write-Error "KLA Error ${lastexitcode}: No analyzable extensions found. Kiuwan recognizes the technology of a source file by its extension. But source files to analyze do not match any of the recognized extensions."
    }
    19 {
        Write-Error "KLA Error ${lastexitcode}: Error checking license. Error while getting or checking Kiuwan license	Contact Kiuwan Technical Support"
    }
    2 {
        Write-Error "KLA Error ${lastexitcode}: Access denied. Lack of permissions to access some Kiuwan entity (application analyses, deliveries, etc). Review log files to find exact cause and contact your Kiuwan administrator."
    }
    23 {
        Write-Error "KLA Error ${lastexitcode}: Bad Credentials. User-supplied credentials are not valid. Contact your Kiuwan administrator."
    }
    24 {
        Write-Error "KLA Error ${lastexitcode}: Application Not Found. The invoked action cannot be completed because the associated application does not exist. Review log files to find exact cause and contact your Kiuwan administrator."
    }
    25 {
        Write-Error "KLA Error ${lastexitcode}: Limit Exceeded for Calls to Kiuwan API. Limit of max Kiuwan API calls per hour has been exceeded.	Contact Kiuwan Technical Support if you have any question on your acccount’s limits."
    }
    26 {
        Write-Error "KLA Error ${lastexitcode}: Quota Limit Reached. Some limit in the Kiuwan account is reached (max number of account’s analysis is reached, etc.). Contact Kiuwan Technical Support if you have any question on your acccount’s limits."
    }
    27 {
        Write-Error "KLA Error ${lastexitcode}: Analysis Not Found. The invoked action cannot be completed because the associated analysis does not exist. Review log files to find exact cause. Contact Kiuwan Technical Support"
    }
    28 {
        Write-Error "KLA Error ${lastexitcode}: Application already exists"
    }
}


