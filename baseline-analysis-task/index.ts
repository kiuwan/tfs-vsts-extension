import os = require('os');
import url = require('url');
//LS: change old deprecated libraries from the new one
//import tl = require('vsts-task-lib/task');
import tl = require('azure-pipelines-task-lib/task');
import {
    buildKlaCommand, setAgentTempDir, setAgentToolsDir,
    downloadInstallKla, runKiuwanLocalAnalyzer, getKiuwanRetMsg,
    getLastAnalysisResults, saveKiuwanResults, uploadKiuwanResults,
    isBuild, getKlaAgentPropertiesPath, processAgentProperties
} from 'kiuwan-common/utils';
//LS: change old library
//import { debug } from 'vsts-task-tool-lib';
import { debug } from 'azure-pipelines-task-lib/task';

var osPlat: string = os.platform();
var agentHomeDir = tl.getVariable('Agent.HomeDirectory');
var agentTempDir = tl.getVariable('Agent.TempDirectory');
if (!agentTempDir) {
    agentTempDir = setAgentTempDir(agentHomeDir, osPlat);
}
var agentToolsDir = tl.getVariable('Agent.ToolsDirectory');
if (!agentToolsDir) {
    agentToolsDir = setAgentToolsDir(agentHomeDir, osPlat);
}
const toolName = 'KiuwanLocalAnalyzer';
const toolVersion = '1.0.0';

function getPathSeparator(os: string) {
    let sep: string = "\\";

    if (!os.startsWith("win")) {
        sep = "/";
    }

    return sep;
}

async function run() {
    try {
        // Default technologies to analyze
        let technologies = 'abap,actionscript,aspnet,c,cobol,cpp,csharp,go,groovy,html,java,javascript,jcl,jsp,kotlin,natural,objectivec,oracleforms,other,perl,php,powerscript,python,rpg4,ruby,scala,sqlscript,swift,vb6,vbnet,xml';

        //NOTE (Luis Sanchez):
        // value == null is preferred to check if value is null or undefined, so I have changed
        // that expresion in the places where (value===null || value===undefined) was checked due
        // to some error I found in execution time.

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
            if (!includeinsight){
                ignoreclause = "ignore=clones,insights"
            }else{ //include insights
                ignoreclause = "ignore=clones";
            }      
        }else{ //skipclones = false
            if (!includeinsight){
                ignoreclause="ignore=insights"
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
            debug(`Including database technology: ${dbtechnology}`);
            debug(`Analyzing technologies: ${technologies}`);
        }

        // Get the Kiuwan connection URL for API Calls based on the Kiuwan connection service nane selected in the task
        let kiuwanConnection = tl.getInput("kiuwanConnection", true);

        // For DEBUG mode only since we dont have a TFS EndpointUrl object available
        // let kiuwanUrl: url.UrlWithStringQuery = url.parse("https://www.kiuwan.com/");
        let kiuwanUrl: url.Url = url.parse(tl.getEndpointUrl(kiuwanConnection, false));

        // Get the Kiuwan connection service authorization
        let kiuwanEndpointAuth = tl.getEndpointAuthorization(kiuwanConnection, true);
        // Get user, password and domain ID from variables defined in the build, otherwise get them from
        // the Kiuwan service endpoint authorization
        let kiuwanUser = tl.getVariable('KiuwanUser');
        if (kiuwanUser === undefined || kiuwanUser === "") {
            //kiuwanUser = kiuwanEndpointAuth.parameters["username"];
            kiuwanUser = tl.getEndpointAuthorizationParameter(kiuwanConnection, "username", false);
        }
        let kiuwanPasswd = tl.getVariable('KiuwanPasswd');
        if (kiuwanPasswd === undefined || kiuwanPasswd === "") {
            //kiuwanPasswd = kiuwanEndpointAuth.parameters["password"];
            kiuwanPasswd = tl.getEndpointAuthorizationParameter(kiuwanConnection, "password", false);
        }
        let kiuwanDomainId = tl.getVariable('KiuwanDomainId');
        let kiuwanDomainId_d = '';
        if (kiuwanDomainId === undefined || kiuwanDomainId === "") {
            //kiuwanDomainId = kiuwanEndpointAuth.parameters["domainid"];
            kiuwanDomainId = tl.getEndpointDataParameter(kiuwanConnection, "domainid", true);
        }
        debug(`[KW] Kiuwan auth domain: ${kiuwanDomainId}`);

        // Get other relevant Variables from the task
        let buildNumber = tl.getVariable('Build.BuildNumber');
        let sourceBranchName = tl.getVariable('Build.SourceBranchName');
        // Now the project name may come from different sources
        // the System.TeamProject variable, an existing Kiuwan app name or a new one
        let projectSelector = tl.getInput('projectnameselector');
        let projectName = '';
        if (projectSelector === 'default') {
            projectName = tl.getVariable('System.TeamProject');
            console.log(`[KW] Kiuwan application from System.TeamProject: ${projectName}`);
        }
        if (projectSelector === 'kiuwanapp') {
            projectName = tl.getInput('kiuwanappname');
            console.log(`[KW] Kiuwan application from Kiuwan app list: ${projectName}`);
        }
        if (projectSelector === 'appname') {
            projectName = tl.getInput('customappname');
            console.log(`[KW] Kiuwan application from user input: ${projectName}`);
        }

        let sourceDirectory = tl.getVariable('Build.SourcesDirectory');
        if (!isBuild()) {
            // This means the task is running from a release pipeline
            console.log(`[KW] This is a release.`);
            // We assume that the task is executed in a Release pipeline and construct the sourceDirectory 
            // with the Agent release directory and the Primary Artifact's source alias
            let primaryArtifactSourceAlias = tl.getVariable('Release.PrimaryArtifactSourceAlias');

            if (primaryArtifactSourceAlias === undefined) {
                console.log("[KW] Release.PrimaryArtifactSourceAlias not set... Trying to use the the project name as artifact alias to build the source path");
                primaryArtifactSourceAlias = tl.getVariable('Build.ProjectName');
            }
            sourceDirectory = tl.getVariable('Agent.ReleaseDirectory') +
                getPathSeparator(osPlat) +
                primaryArtifactSourceAlias;
        }
        console.log(`[KW] Kiuwan sourcecode directory: ${sourceDirectory}`);

        let agentName = tl.getVariable('Agent.Name');

        let kla = 'Not installed yet';

        // We treat all agents equal now:
        // Check if the KLA is already installed in the Agent tools directory from a previosu task run
        // It will download and install it in the Agent Tools directory if not found
        let klaInstallPath = await downloadInstallKla(kiuwanConnection, toolName, toolVersion, osPlat);

        // Get the appropriate kla command depending on the platform
        kla = await buildKlaCommand(klaInstallPath, osPlat);

        // Get the appropriate kla agent properties file depending on the platform
        let klaAgentProperties = 'Not installed yet';
        klaAgentProperties = await getKlaAgentPropertiesPath(klaInstallPath, osPlat);

        //Luis Sanchez: getting the AGENT proxy configuration
        let agent_proxy_conf = tl.getHttpProxyConfiguration();
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
        if (!(agent_proxy_conf?.proxyUrl === undefined)){ //if proxy defined, then get the rest
            proxyUrl = agent_proxy_conf?.proxyUrl;
            if (!(agent_proxy_conf?.proxyUsername === undefined)){ //user defined
                proxyUser = agent_proxy_conf?.proxyUsername;
            }//end checking user
            if (!(agent_proxy_conf?.proxyPassword === undefined)){ //password defined
                proxyPassword = agent_proxy_conf?.proxyPassword;
            }//end checking pass
        }//end checking proxy undefined

        //In any other cases, proxy, user and pass are going to be empty string, processed in the function below
        //Pass the parameters and the agent path to this function for processing
        await processAgentProperties(klaAgentProperties, proxyUrl, proxyUser, proxyPassword);
        //end Luis
        //End of Luis Sanchez addings

        let advancedArgs = "";
        let overrideDotKiuwan: boolean = tl.getBoolInput('overridedotkiuwan');

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

        let overrideModel: boolean = tl.getBoolInput('overrideappmodel');
        let appModel: string = tl.getInput('appmodel');
        let modelOption= ' ';
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
        debug(`[KW] Domain option: ${domainOption}`);
        debug(`[KW] Model option: ${modelOption}`);

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

        let kiuwanRetCode: Number = await runKiuwanLocalAnalyzer(kla, klaArgs);
        // let kiuwanRetCode = 0;

        let kiuwanMsg: string = getKiuwanRetMsg(kiuwanRetCode);

        if (kiuwanRetCode === 0) {
            if (!isBuild()) {
                console.log("[KW] this is a release, we don't need to get the results");
                tl.setResult(tl.TaskResult.Succeeded, kiuwanMsg + ", Results uploaded to Kiuwan. Go check!");
            }
            else {
                let kiuwanEndpoint = `/saas/rest/v1/apps/${projectName}`;
                let kiuwanAnalysisResult = await getLastAnalysisResults(kiuwanUrl, kiuwanUser, kiuwanPasswd, kiuwanDomainId, kiuwanEndpoint, klaAgentProperties);

                tl.debug(`[KW] Result of last analysis for ${projectName}: ${kiuwanAnalysisResult}`);

                const kiuwanResultsPath = saveKiuwanResults(`${kiuwanAnalysisResult}`, "baseline");

                uploadKiuwanResults(kiuwanResultsPath, 'Kiuwan Baseline Results', "baseline");

                tl.setResult(tl.TaskResult.Succeeded, kiuwanMsg + ", Results uploaded.");
            }
        }
        else {
            tl.setResult(tl.TaskResult.Failed, kiuwanMsg);
        }
    }
    catch (err) {
        tl.setResult(tl.TaskResult.Failed, err.message);
        console.error('[KW] Task failed: ' + err.message);
    }
}

run();