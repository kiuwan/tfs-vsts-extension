
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


// ***
// *** ENTRY EXECUTION POINT
// ***

run();


// ***
// *** METHODS IMPLEMENTATION
// ***

async function run() {
    try {
        // Default technologies to analyze
        let technologies: string = kwutils.getKiuwanTechnologies();

        // Get the values from the task's inputs bythe user
        let analysisLabel = azuretasklib.getInput('analysislabel');
        if (analysisLabel == null) {
            analysisLabel = "";
        }

        //Luis Sanchez: This block was totally wrong, and I ammended it. 
        let includeinsight = azuretasklib.getBoolInput('includeinsight');
        let skipclones = azuretasklib.getBoolInput('skipclones');
        let ignoreclause = "";

        if (skipclones) {
            if (!includeinsight) {
                ignoreclause = "ignore=clones,insights"
            } else { //include insights
                ignoreclause = "ignore=clones";
            }
        } else { //skipclones = false
            if (!includeinsight) {
                ignoreclause = "ignore=insights"
            }
        }
        //in any other case, the ignoreclause will be empty (no insights and skipclones false)


        let uploadsnippets = azuretasklib.getBoolInput('uploadsnippets');
        let uploadfiles = azuretasklib.getBoolInput('uploadfiles');

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

        // Get the Kiuwan connection URL for API Calls based on the Kiuwan connection service nane selected in the task
        let kiuwanConnectionInput: string | undefined = azuretasklib.getInput("kiuwanConnection", true);
        let kiuwanConnection: string = (kiuwanConnectionInput === undefined) ? "" : kiuwanConnectionInput;

        // For DEBUG mode only since we dont have a TFS EndpointUrl object available
        // let kiuwanUrl: url.UrlWithStringQuery = url.parse("https://www.kiuwan.com/");
        let kiuwanUrl: url.Url = url.parse(azuretasklib.getEndpointUrl(kiuwanConnection, false));

        // Get the Kiuwan connection service authorization
        // Get user, password and domain ID from variables defined in the build, otherwise get them from the Kiuwan service endpoint authorization
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
        azuretasklib.debug(`[KW] Kiuwan auth domain: ${kiuwanDomainId}`);

        // Get other relevant Variables from the task
        let buildNumber = azuretasklib.getVariable('Build.BuildNumber');
        let sourceBranchName = azuretasklib.getVariable('Build.SourceBranchName');
        // Now the project name may come from different sources
        // the System.TeamProject variable, an existing Kiuwan app name or a new one
        let projectSelector = azuretasklib.getInput('projectnameselector');
        let projectName: string | undefined = '';
        if (projectSelector === 'default') {
            projectName = azuretasklib.getVariable('System.TeamProject');
            console.log(`[KW] Kiuwan application from System.TeamProject: ${projectName}`);
        }
        if (projectSelector === 'kiuwanapp') {
            projectName = azuretasklib.getInput('kiuwanappname');
            console.log(`[KW] Kiuwan application from Kiuwan app list: ${projectName}`);
        }
        if (projectSelector === 'appname') {
            projectName = azuretasklib.getInput('customappname');
            console.log(`[KW] Kiuwan application from user input: ${projectName}`);
        }

        let sourceDirectory = azuretasklib.getVariable('Build.SourcesDirectory');
        if (!kwutils.isBuild()) {
            // This means the task is running from a release pipeline
            console.log(`[KW] This is a release.`);
            // We assume that the task is executed in a Release pipeline and construct the sourceDirectory 
            // with the Agent release directory and the Primary Artifact's source alias
            let primaryArtifactSourceAlias = azuretasklib.getVariable('Release.PrimaryArtifactSourceAlias');

            if (primaryArtifactSourceAlias === undefined) {
                console.log("[KW] Release.PrimaryArtifactSourceAlias not set... Trying to use the the project name as artifact alias to build the source path");
                primaryArtifactSourceAlias = azuretasklib.getVariable('Build.ProjectName');
            }
            sourceDirectory = azuretasklib.getVariable('Agent.ReleaseDirectory') + kwutils.getPathSeparator(osPlat) + primaryArtifactSourceAlias;
        }
        console.log(`[KW] Kiuwan sourcecode directory: ${sourceDirectory}`);

        let kla = 'Not installed yet';

        // We treat all agents equal now:
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
        console.log(`[BT] Agent proxy url: ${agent_proxy_conf?.proxyUrl}`);
        console.log(`[BT] Agent proxy user: ${agent_proxy_conf?.proxyUsername}`);
        console.log(`[BT] Agent proxy password: ${agent_proxy_conf?.proxyPassword}`);

        //Luis Sanchez: process the agent.properties file
        //get the proxy parameters from the service connection definition (to be deprecated)
        //let proxyUrl = tl.getEndpointDataParameter(kiuwanConnection, "proxyurl", true);
        //let proxyUser = tl.getEndpointDataParameter(kiuwanConnection, "proxyuser", true);
        //let proxyPassword = tl.getEndpointDataParameter(kiuwanConnection, "proxypassword", true);

        //get the proxy parameter from the AGENT configuration
        let proxyUrl = "";
        let proxyUser = "";
        let proxyPassword = "";
        if (!(agent_proxy_conf?.proxyUrl === undefined)) { //if proxy defined, then get the rest
            proxyUrl = agent_proxy_conf?.proxyUrl;
            if (!(agent_proxy_conf?.proxyUsername === undefined)) { //user defined
                proxyUser = agent_proxy_conf?.proxyUsername;
            }//end checking user
            if (!(agent_proxy_conf?.proxyPassword === undefined)) { //password defined
                proxyPassword = agent_proxy_conf?.proxyPassword;
            }//end checking pass
        }//end checking proxy undefined

        //In any other cases, proxy, user and pass are going to be empty string, processed in the function below
        //Pass the parameters and the agent path to this function for processing
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

        let overrideModel: boolean = azuretasklib.getBoolInput('overrideappmodel');
        let appModel: string | undefined = azuretasklib.getInput('appmodel');
        let modelOption = ' ';
        if (overrideModel) {
            console.log(`[KW] OverrideModel ${overrideModel} value ${appModel}.`);
            modelOption = `--model-name "${appModel}" `;
        }
        else {
            console.log(`[KW] OverrideModel ${overrideModel}.`);
        }


        let domainOption = ' ';
        if (kiuwanDomainId !== undefined && kiuwanDomainId !== "" && kiuwanDomainId !== "0") {
            domainOption = `--domain-id ${kiuwanDomainId} `;
        }
        azuretasklib.debug(`[KW] Domain option: ${domainOption}`);
        azuretasklib.debug(`[KW] Model option: ${modelOption}`);

        let klaArgs: string =
            `-n "${projectName}" ` +
            `-s "${sourceDirectory}" ` +
            `-l "${analysisLabel} ${sourceBranchName} ${buildNumber}" ` +
            '-c ' +
            '-wr ' +
            `--user "${kiuwanUser}" ` +
            `--pass ${kiuwanPasswd} ` +
            `${domainOption}` +
            `${modelOption}` +
            `${advancedArgs} ` +
            `supported.technologies=${technologies} ` +
            `memory.max=${memory} ` +
            `timeout=${timeout} ` +
            `dump.code=${uploadsnippets} ` +
            `upload.analyzed.code=${uploadfiles} ` +
            `${ignoreclause}`;

        console.log(`[KW] Running Kiuwan analysis: ${kla} ${klaArgs}`);

        let kiuwanRetCode: Number = await kwutils.runKiuwanLocalAnalyzer(kla, klaArgs);

        let kiuwanMsg: string = kwutils.getKiuwanRetMsg(kiuwanRetCode);

        if (kiuwanRetCode === 0) {
            if (!kwutils.isBuild()) {
                console.log("[KW] this is a release, we don't need to get the results");
                azuretasklib.setResult(azuretasklib.TaskResult.Succeeded, kiuwanMsg + ", Results uploaded to Kiuwan. Go check!");
            }
            else {
                let kiuwanEndpoint = `/saas/rest/v1/apps/${projectName}`;
                let kiuwanAnalysisResult = await kwutils.getLastAnalysisResults(kiuwanUrl, kiuwanUser, kiuwanPasswd, kiuwanDomainId, kiuwanEndpoint, klaAgentProperties);

                azuretasklib.debug(`[KW] Result of last analysis for ${projectName}: ${kiuwanAnalysisResult}`);

                const kiuwanResultsPath = kwutils.saveKiuwanResults(`${kiuwanAnalysisResult}`, "baseline");

                kwutils.uploadKiuwanResults(kiuwanResultsPath, 'Kiuwan Baseline Results', "baseline");

                azuretasklib.setResult(azuretasklib.TaskResult.Succeeded, kiuwanMsg + ", Results uploaded.");
            }
        }
        else {
            azuretasklib.setResult(azuretasklib.TaskResult.Failed, kiuwanMsg);
        }
    }
    catch (err) {
        azuretasklib.setResult(azuretasklib.TaskResult.Failed, err.message);
        console.error('[KW] Task failed: ' + err.message);
    }
}
