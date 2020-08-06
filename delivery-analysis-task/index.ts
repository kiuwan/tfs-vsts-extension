
// ***
// *** DEPENDENCIES
// ***

import * as os from 'os';
import * as url from 'url';
import * as azuretasklib from 'azure-pipelines-task-lib/task';
import * as kwutils from '../kiuwan-common/utils';


// ***
// *** GLOBAL VARIABLES AND CONSTANTS
// ***

let osPlat: string = os.platform();
let agentHomeDir = azuretasklib.getVariable('Agent.HomeDirectory');
let agentTempDir = azuretasklib.getVariable('Agent.TempDirectory');
if (!agentTempDir) {
    agentTempDir = kwutils.setAgentTempDir(agentHomeDir, osPlat);
}
let agentToolsDir = azuretasklib.getVariable('Agent.ToolsDirectory');
if (!agentToolsDir) {
    agentToolsDir = kwutils.setAgentToolsDir(agentHomeDir, osPlat);
}
const toolName = 'KiuwanLocalAnalyzer';
const toolVersion = '1.0.0';
const inBuild = kwutils.isBuild();
console.log(`[KW] in build?: ${inBuild}`);


// ***
// *** ENTRY EXECUTION POINT
// ***

if (inBuild) {
    console.log('[KW] Running build logic...');
    run();
}
else {
    console.log('[KW] Running release logic... Exisiting, basically!');
    exit();
}


// ***
// *** METHODS IMPLEMENTATION
// ***

async function run() {
    try {
        // Default technologies to analyze
        let technologies = kwutils.getKiuwanTechnologies();

        // Get the values from the task's inputs by the user
        let changeRequest = azuretasklib.getInput('changerequest');
        if (changeRequest == null) {
            changeRequest = "";
        }

        let failOnAudit = azuretasklib.getBoolInput('failonaudit');

        let failOnNoFiles = azuretasklib.getBoolInput('failonnofiles');

        //Luis Sanchez: This block was totally wrong, and I ammended it. 
        // the difference with the baseline is that we skip architecture always
        let includeinsight = azuretasklib.getBoolInput('includeinsight');
        let skipclones = azuretasklib.getBoolInput('skipclones');
        let ignoreclause = "ignoreOnDelivery=architecture";

        if (skipclones) { 
            if (!includeinsight){
                ignoreclause = "ignoreOnDelivery=clones,insights,architecture"
            }else{ //include insights
                ignoreclause = "ignoreOnDelivery=clones,architecture";
            }      
        }else{ //skipclones = false
            if (!includeinsight){
                ignoreclause="ignoreOnDelivery=insights,architecture"
            }
        }
        //in any other case, the ignoreclause will be empty (no insights and skipclones false)

        let analysisScope = azuretasklib.getInput('analysisscope');

        let crStatus = azuretasklib.getInput('crstatus');

        let encoding = azuretasklib.getInput('encoding');
        if (encoding == null) {
            encoding = "UTF-8";
        }

        let includePatterns = azuretasklib.getInput('includepatterns');
        if (includePatterns == null) {
            includePatterns = "**/*";
        }

        let excludePatterns = azuretasklib.getInput('excludepatterns');
        if (excludePatterns == null) {
            excludePatterns = "";
        }

        let memory = azuretasklib.getInput('memory');
        if (memory == null) {
            memory = "1024";
        }
        memory += 'm';

        let timeout = azuretasklib.getInput('timeout') == null ? Number('60') : Number(azuretasklib.getInput('timeout'));
        timeout = timeout * 60000;

        let dbanalysis = azuretasklib.getBoolInput('dbanalysis');
        if (dbanalysis) {
            let dbtechnology = azuretasklib.getInput('dbtechnology');
            technologies += ',' + dbtechnology;
            azuretasklib.debug(`Including database technology: ${dbtechnology}`);
            azuretasklib.debug(`Analyzing technologies: ${technologies}`);
        }

        // Get the Kiuwan connection service authorization
        let kiuwanConnectionInput: string | undefined = azuretasklib.getInput("kiuwanConnection", true);
        let kiuwanConnection: string = (kiuwanConnectionInput === undefined) ? "" : kiuwanConnectionInput;

        // For DEBUG mode only since we dont have a TFS EndpointUrl object available
        // let kiuwanUrl = url.parse("https://www.kiuwan.com/");
        let kiuwanUrl: url.Url = url.parse(azuretasklib.getEndpointUrl(kiuwanConnection, false));

        // Get user, password and domain ID from variables defined in the build, otherwise get them from
        // the Kiuwan service endpoint authorization
        let kiuwanUser = azuretasklib.getVariable('KiuwanUser');
        if (kiuwanUser === undefined || kiuwanUser === "") {
            kiuwanUser = azuretasklib.getEndpointAuthorizationParameter(kiuwanConnection, "username", false);
        }
        let kiuwanPasswd = azuretasklib.getVariable('KiuwanPasswd');
        if (kiuwanPasswd === undefined || kiuwanPasswd === "") {
            kiuwanPasswd = azuretasklib.getEndpointAuthorizationParameter(kiuwanConnection, "password", false);
        }
        let kiuwanDomainId = azuretasklib.getVariable('KiuwanDomainId');
        if (kiuwanDomainId === undefined || kiuwanDomainId === "") {
            kiuwanDomainId = azuretasklib.getEndpointDataParameter(kiuwanConnection, "domainid", true);
        }
        azuretasklib.debug(`[KW] Kiuwan domain: ${kiuwanDomainId}`);

        // Get other relevant Variables from the task
        let uploadsnippets = azuretasklib.getBoolInput('uploadsnippets');
        let uploadfiles = azuretasklib.getBoolInput('uploadfiles');
        let buildNumber = azuretasklib.getVariable('Build.BuildNumber');
        let branch = azuretasklib.getVariable('Build.SourceBranch');
        let branchName = azuretasklib.getVariable('Build.SourceBranchName');
        let overridelabel: boolean = azuretasklib.getBoolInput('overridedeliverylabel');
        let deliveryLabel: string | undefined = '';

        if (!overridelabel) {

            /**
             * Build.Reason Possible values
             * 
             * Manual: A user manually queued the build.
             * IndividualCI: Continuous integration (CI) triggered by a Git push or a TFVC check-in.
             * BatchedCI: Continuous integration (CI) triggered by a Git push or a TFVC check-in, and the Batch changes was selected.
             * Schedule: Scheduled trigger.
             * ValidateShelveset: A user manually queued the build of a specific TFVC shelveset.
             * CheckInShelveset: Gated check-in trigger.
             * PullRequest: The build was triggered by a Git branch policy that requires a build.
             * BuildCompletion: The build was triggered by another build
             **/
            let buildReasonVariable: string | undefined = azuretasklib.getVariable("Build.Reason");
            let buildReason: string = (buildReasonVariable === undefined) ? "Manual" : buildReasonVariable;

            console.log(`BuildReason: ${buildReason}`);


            // Build.Repository.Provider possible values: TfsGit, TfsVersionControl, Git, GitHub, Svn
            let repositoryType = azuretasklib.getVariable("Build.Repository.Provider");
            switch (repositoryType) {
                case "TfsVersionControl": {
                    let ChangeSet = azuretasklib.getVariable("Build.SourceVersion"); // Tfvc
                    let ChangeSetMsg = azuretasklib.getVariable("Build.SourceVersionMessage"); // Tfvc
                    let shelveSet = azuretasklib.getVariable("Build.SourceTfvcShelveset"); //Tfvc
                    if (buildReason === "ValidateShelveset" || buildReason === "CheckInShelveset") {
                        deliveryLabel = `${shelveSet} Build ${buildNumber}`;
                    }
                    else if (buildReason.includes("CI")) {
                        deliveryLabel = `C${ChangeSet}: ${ChangeSetMsg} Build: ${buildNumber}`;
                    }
                    else {
                        deliveryLabel = `${branchName} Build ${buildNumber}`;
                    }
                    break;
                }
                case "Git":
                case "GitHub":
                case "TfsGit": {
                    let commitId = azuretasklib.getVariable("Build.SourceVersion"); // Git
                    let commitMsg = azuretasklib.getVariable("Build.SourceVersionMessage"); // Git
                    if (buildReason === "PullRequest" || buildReason.includes("CI")) {
                        deliveryLabel = `${commitId}: ${commitMsg} Build ${buildNumber}`;
                    }
                    else {
                        deliveryLabel = `${branchName} Build ${buildNumber}`;
                    }
                    break;
                }
                case "Svn": {
                    deliveryLabel = `${branchName} Build ${buildNumber}`;
                    break;
                }
                default:
                    deliveryLabel = `${branchName} Build ${buildNumber}`;
            }

        } else {
            deliveryLabel = azuretasklib.getInput("deliverylabel");
            
        }

        // Now the project name may come from different sources
        // the System.TeamProject variable, an existing Kiuwan app name or a new one
        let projectSelector = azuretasklib.getInput('projectnameselector');
        let projectName: string | undefined = '';
        if (projectSelector === 'default') {
            projectName = azuretasklib.getVariable('System.TeamProject');
            console.log(`Kiuwan application from System.TeamProject: ${projectName}`);
        }
        if (projectSelector === 'kiuwanapp') {
            projectName = azuretasklib.getInput('kiuwanappname');
            console.log(`Kiuwan application from Kiuwan app list: ${projectName}`);
        }
        if (projectSelector === 'appname') {
            projectName = azuretasklib.getInput('customappname');
            console.log(`Kiuwan application from user input: ${projectName}`);
        }

        let sourceDirectory = azuretasklib.getVariable('Build.SourcesDirectory');
        // Change the source directory to the alternate, if set for partial deliveries
        if (analysisScope === "partialDelivery") {
            let altSourceDirectory = azuretasklib.getInput('alternativesourcedir');
            if (altSourceDirectory !== undefined || altSourceDirectory !== "") {
                sourceDirectory = altSourceDirectory;
            }
        }

        let kla = 'Not installed yet';

        // We treat al agents equal now:
        // Check if the KLA is already installed in the Agent tools directory from a previosu task run
        // It will download and install it in the Agent Tools directory if not found
        let klaInstallPath = await kwutils.downloadInstallKla(kiuwanConnection, toolName, toolVersion, osPlat);

        // Get the appropriate kla command depending on the platform
        kla = await kwutils.buildKlaCommand(klaInstallPath, osPlat);

        // Get the appropriate kla agent properties file depending on the platform
        let klaAgentProperties = 'Not installed yet';
        klaAgentProperties = await kwutils.getKlaAgentPropertiesPath(klaInstallPath, osPlat);

        //Luis Sanchez: getting the AGENT proxy configuration
        let agent_proxy_conf = azuretasklib.getHttpProxyConfiguration();
        console.log(`[DT] Agent proxy url: ${agent_proxy_conf?.proxyUrl}`);
        console.log(`[DT] Agent proxy user: ${agent_proxy_conf?.proxyUsername}`);
        console.log(`[DT] Agent proxy password: ${agent_proxy_conf?.proxyPassword}`);
        
        //Luis Sanchez: process the agent.properties file
        //get the proxy parameters from the service connection definition (to be deprecated)
        //let proxyUrl = azuretasklib.getEndpointDataParameter(kiuwanConnection, "proxyurl", true);
        //let proxyUser = azuretasklib.getEndpointDataParameter(kiuwanConnection, "proxyuser", true);
        //let proxyPassword = azuretasklib.getEndpointDataParameter(kiuwanConnection, "proxypassword", true);

        //get the proxy parameter from the AGENT configuration
        let proxyUrl = "";
        let proxyUser = "";
        let proxyPassword = "";
        if (!(agent_proxy_conf?.proxyUrl === undefined)){ //if proxy defined, then get the rest
            proxyUrl = agent_proxy_conf?.proxyUrl;
            if (!(agent_proxy_conf?.proxyUsername === undefined)){ //user defined
                proxyUser = agent_proxy_conf?.proxyUsername;
            }//end checking user
            if (!(agent_proxy_conf?.proxyPassword === undefined)){ //password defined
                proxyPassword = agent_proxy_conf?.proxyPassword;
            }//end checking pass
        }//end checking proxy undefined

        //if no proxy/user/password, those values will be empty string and processed in the function below
        //pass the parameters and the agent path to this function for processing
        await kwutils.processAgentProperties(klaAgentProperties, proxyUrl, proxyUser, proxyPassword);
        //end Luis
        //End of Luis Sanchez addings

        let advancedArgs = "";
        let overrideDotKiuwan: boolean = azuretasklib.getBoolInput('overridedotkiuwan');

        if (overrideDotKiuwan) {
            advancedArgs = `.kiuwan.analysis.excludesPattern=${excludePatterns} ` +
                `.kiuwan.analysis.includesPattern=${includePatterns} ` +
                `.kiuwan.analysis.encoding=${encoding}`;
        }
        else {
            advancedArgs = `exclude.patterns=${excludePatterns} ` +
                `include.patterns=${includePatterns} ` +
                `encoding=${encoding}`;
        }

        let domainOption = ' ';
        if (kiuwanDomainId !== undefined && kiuwanDomainId !== "" && kiuwanDomainId !== "0") {
            domainOption = `--domain-id ${kiuwanDomainId} `;
        }
        azuretasklib.debug(`[KW] Domain option: ${domainOption}`);

        let klaArgs: string =
            `-n "${projectName}" ` +
            `-s "${sourceDirectory}" ` +
            `-l "${deliveryLabel}" ` +
            `-as ${analysisScope} ` +
            `-crs ${crStatus} ` +
            `-cr "${changeRequest}" ` +
            `-bn "${branch}" ` +
            '-wr ' +
            `--user "${kiuwanUser}" ` +
            `--pass ${kiuwanPasswd} ` +
            `${domainOption}` +
            `${advancedArgs} ` +
            `supported.technologies=${technologies} ` +
            `memory.max=${memory} ` +
            `timeout=${timeout} ` +
            `dump.code=${uploadsnippets} ` +
            `upload.analyzed.code=${uploadfiles} ` +
            `${ignoreclause}`;

        console.log('Running Kiuwan analysis');

        console.log(`${kla} ${klaArgs}`);
        let kiuwanRetCode: Number = await kwutils.runKiuwanLocalAnalyzer(kla, klaArgs);

        let kiuwanMsg: string = kwutils.getKiuwanRetMsg(kiuwanRetCode);

        if (kiuwanRetCode === 0 || kwutils.auditFailed(kiuwanRetCode)) {
            let kiuwanEndpoint = `/saas/rest/v1/apps/${projectName}/deliveries?changeRequest=${changeRequest}&label=${deliveryLabel}`;
            let kiuwanDeliveryResult = await kwutils.getLastAnalysisResults(kiuwanUrl, kiuwanUser, kiuwanPasswd, kiuwanDomainId, kiuwanEndpoint, klaAgentProperties);

            azuretasklib.debug(`[KW] Result of last delivery for ${projectName}: ${kiuwanDeliveryResult}`);

            const kiuwanResultsPath = kwutils.saveKiuwanResults(`${kiuwanDeliveryResult}`, "delivery");

            kwutils.uploadKiuwanResults(kiuwanResultsPath, 'Kiuwan Delivery Results', "delivery");
        }

        if (kiuwanRetCode === 0) {
            azuretasklib.setResult(azuretasklib.TaskResult.Succeeded, kiuwanMsg);
        }
        else {
            if (kwutils.auditFailed(kiuwanRetCode) && !failOnAudit) {
                azuretasklib.setResult(azuretasklib.TaskResult.Succeeded, kiuwanMsg);
            }
            else {
                if (kwutils.noFilesToAnalyze(kiuwanRetCode) && !failOnNoFiles) {
                    azuretasklib.setResult(azuretasklib.TaskResult.Succeeded, kiuwanMsg);
                }
                else {
                    azuretasklib.setResult(azuretasklib.TaskResult.Failed, kiuwanMsg);
                }
            }
        }
    }
    catch (err) {
        azuretasklib.setResult(azuretasklib.TaskResult.Failed, err.message);
        console.error('Task failed: ' + err.message);
    }
}

async function exit() {
    azuretasklib.setResult(azuretasklib.TaskResult.SucceededWithIssues, "This task is for build pipelines only. Skipped...")
}
