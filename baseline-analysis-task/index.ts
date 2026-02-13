import * as os from 'os';
import * as url from 'url';
import * as tl from 'azure-pipelines-task-lib/task';
import * as kwutils from 'kiuwan-common/utils';

let osPlat: string = os.platform();
let agentHomeDir = tl.getVariable('Agent.HomeDirectory');
let agentTempDir = tl.getVariable('Agent.TempDirectory');
if (!agentTempDir) {
    agentTempDir = kwutils.setAgentTempDir(agentHomeDir, osPlat);
}
let agentToolsDir = tl.getVariable('Agent.ToolsDirectory');
if (!agentToolsDir) {
    agentToolsDir = kwutils.setAgentToolsDir(agentHomeDir, osPlat);
}
const toolName = 'KiuwanLocalAnalyzer';
const toolVersion = '1.0.0';

run();

async function run() {
    try {
        // Default technologies to analyze
        let technologies: string = kwutils.getKiuwanTechnologies();

        // Get the values from the task's inputs bythe user
        let analysisLabel = tl.getInput('analysislabel');
        if (analysisLabel == null) {
            analysisLabel = "";
        }

        //Luis Sanchez: This block was totally wrong, and I ammended it. 
        let includeinsight = tl.getBoolInput('includeinsight');
        let skipclones = tl.getBoolInput('skipclones');
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
        let uploadsnippets = tl.getBoolInput('uploadsnippets');
        let uploadfiles = tl.getBoolInput('uploadfiles');

        let encoding = tl.getInput('encoding');
        if (encoding == null) {
            encoding = "UTF-8";
        }

        let includePatterns = tl.getInput('includepatterns');
        if (includePatterns == null) {
            includePatterns = "**/*";
        }

        let excludePatterns = tl.getInput('excludepatterns');
        if (excludePatterns == null) {
            excludePatterns = "";
        }

        let memory = tl.getInput('memory');
        if (memory == null) {
            memory = "1024";
        }
        memory += 'm';

        let timeout = tl.getInput('timeout') == null ? Number('60') : Number(tl.getInput('timeout'));
        timeout = timeout * 60000;

        let dbanalysis = tl.getBoolInput('dbanalysis');
        if (dbanalysis) {
            let dbtechnology = tl.getInput('dbtechnology');
            technologies += ',' + dbtechnology;
            tl.debug(`Including database technology: ${dbtechnology}`);
            tl.debug(`Analyzing technologies: ${technologies}`);
        }

        // Get the Kiuwan connection URL for API Calls based on the Kiuwan connection service nane selected in the task
        let kiuwanConnectionInput: string | undefined = tl.getInput("kiuwanConnection", true);
        let kiuwanConnection: string = (kiuwanConnectionInput === undefined) ? "" : kiuwanConnectionInput;

        // For DEBUG mode only since we dont have a TFS EndpointUrl object available
        let kiuwanUrl: url.Url = url.parse(tl.getEndpointUrl(kiuwanConnection, false));

        // Get user, password and domain ID from variables defined in the build, otherwise get them from the
        // Kiuwan service endpoint authorization
        let kiuwanUser = tl.getVariable('KiuwanUser');
        if (kiuwanUser === undefined || kiuwanUser === "") {
            kiuwanUser = tl.getEndpointAuthorizationParameter(kiuwanConnection, "username", false);
        }
        let kiuwanPasswd = tl.getVariable('KiuwanPasswd');
        if (kiuwanPasswd === undefined || kiuwanPasswd === "") {
            kiuwanPasswd = tl.getEndpointAuthorizationParameter(kiuwanConnection, "password", false);
        }
        let kiuwanDomainId = tl.getVariable('KiuwanDomainId');
        if (kiuwanDomainId === undefined || kiuwanDomainId === "") {
            kiuwanDomainId = tl.getEndpointDataParameter(kiuwanConnection, "domainid", true);
        }
        tl.debug(`[KW] Kiuwan auth domain: ${kiuwanDomainId}`);

        // Get other relevant Variables from the task
        let buildNumber = tl.getVariable('Build.BuildNumber');
        let sourceBranchName = tl.getVariable('Build.SourceBranchName');
        // Now the project name may come from different sources
        // the System.TeamProject variable, an existing Kiuwan app name or a new one
        let projectSelector = tl.getInput('projectnameselector');
        let projectName: string | undefined = '';
        if (projectSelector === 'default') {
            projectName = tl.getVariable('System.TeamProject');
            tl.debug(`[KW] Kiuwan application from System.TeamProject: ${projectName}`);
        }
        if (projectSelector === 'kiuwanapp') {
            projectName = tl.getInput('kiuwanappname');
            tl.debug(`[KW] Kiuwan application from Kiuwan app list: ${projectName}`);
        }
        if (projectSelector === 'appname') {
            projectName = tl.getInput('customappname');
            tl.debug(`[KW] Kiuwan application from user input: ${projectName}`);
        }

        let sourceDirectory = tl.getVariable('Build.SourcesDirectory');
        if (!kwutils.isBuild()) {
            // This means the task is running from a release pipeline
            tl.debug(`[KW] This is a release.`);
            // We assume that the task is executed in a Release pipeline and construct the sourceDirectory 
            // with the Agent release directory and the Primary Artifact's source alias
            let primaryArtifactSourceAlias = tl.getVariable('Release.PrimaryArtifactSourceAlias');

            if (primaryArtifactSourceAlias === undefined) {
                tl.debug("[KW] Release.PrimaryArtifactSourceAlias not set... Trying to use the the project name as" +
                    " artifact alias to build the source path");
                primaryArtifactSourceAlias = tl.getVariable('Build.ProjectName');
            }
            sourceDirectory = tl.getVariable('Agent.ReleaseDirectory') +
                kwutils.getPathSeparator(osPlat) +
                primaryArtifactSourceAlias;
        }
        tl.debug(`[KW] Kiuwan sourcecode directory: ${sourceDirectory}`);

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
        let agent_proxy_conf = tl.getHttpProxyConfiguration();
        tl.debug(`[BT] Agent proxy url: ${agent_proxy_conf?.proxyUrl}`);
        tl.debug(`[BT] Agent proxy user: ${agent_proxy_conf?.proxyUsername}`);

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
        let overrideDotKiuwan: boolean = tl.getBoolInput('overridedotkiuwan');

        if (overrideDotKiuwan) {
            advancedArgs = `.kiuwan.analysis.excludesPattern=${excludePatterns} ` +
                `.kiuwan.analysis.includesPattern=${includePatterns} ` +
                `.kiuwan.analysis.encoding=${encoding}`;
        } else {
            advancedArgs = `exclude.patterns=${excludePatterns} ` +
                `include.patterns=${includePatterns} ` +
                `encoding=${encoding}`;
        }

        let overrideModel: boolean = tl.getBoolInput('overrideappmodel');
        let appModel: string | undefined = tl.getInput('appmodel');
        let modelOption = ' ';
        if (overrideModel) {
            tl.debug(`[KW] OverrideModel ${overrideModel} value ${appModel}.`);
            modelOption = `--model-name "${appModel}" `;
        } else {
            tl.debug(`[KW] OverrideModel ${overrideModel}.`);
        }

        let domainOption = ' ';
        if (kiuwanDomainId !== undefined && kiuwanDomainId !== "" && kiuwanDomainId !== "0") {
            domainOption = `--domain-id ${kiuwanDomainId} `;
        }
        tl.debug(`[KW] Domain option: ${domainOption}`);
        tl.debug(`[KW] Model option: ${modelOption}`);

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

        tl.debug(`[KW] Running Kiuwan analysis: ${kla} ${klaArgs}`);

        let kiuwanRetCode: Number = await kwutils.runKiuwanLocalAnalyzer(kla, klaArgs);
        let kiuwanMsg: string = kwutils.getKiuwanRetMsg(kiuwanRetCode);

        if (kiuwanRetCode === 0) {
            if (!kwutils.isBuild()) {
                tl.debug("[KW] this is a release, we don't need to get the results");
                tl.setResult(tl.TaskResult.Succeeded, kiuwanMsg + ", Results uploaded to Kiuwan. Go check!");
            } else {
                let kiuwanEndpoint = `/saas/rest/v1/apps/${projectName}`;
                let kiuwanAnalysisResult = await kwutils.getLastAnalysisResults(kiuwanUrl, kiuwanUser, kiuwanPasswd, 
                    kiuwanDomainId, kiuwanEndpoint, klaAgentProperties);
                tl.debug(`[KW] Result of last analysis for ${projectName}: ${kiuwanAnalysisResult}`);
                const kiuwanResultsPath = kwutils.saveKiuwanResults(`${kiuwanAnalysisResult}`, "baseline");
                kwutils.uploadKiuwanResults(kiuwanResultsPath, 'Kiuwan Baseline Results', "baseline");
                tl.setResult(tl.TaskResult.Succeeded, kiuwanMsg + ", Results uploaded.");
            }
        } else {
            tl.setResult(tl.TaskResult.Failed, kiuwanMsg);
        }
    } catch (err) {
        tl.setResult(tl.TaskResult.Failed, err.message);
        tl.error('[KW] Task failed: ' + err.message);
    }
}