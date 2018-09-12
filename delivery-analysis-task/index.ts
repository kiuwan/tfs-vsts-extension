import os = require('os');
import tl = require('vsts-task-lib/task');
import { buildKlaCommand, setAgentTempDir, setAgentToolsDir, downloadInstallKla, runKiuwanLocalAnalyzer, getKiuwanRetMsg, auditFailed } from 'kiuwan-common/utils';

var osPlat: string = os.platform();
var agentHomeDir = tl.getVariable('Agent.HomeDirectory');
var agentTempDir = tl.getVariable('Agent.TempDirectory');
if (!agentTempDir) {
    agentTempDir = setAgentTempDir(agentHomeDir,osPlat);
}
var agentToolsDir = tl.getVariable('Agent.ToolsDirectory');
if (!agentToolsDir) {
    agentToolsDir = setAgentToolsDir(agentHomeDir,osPlat);
}
const toolName = 'KiuwanLocalAnalyzer';
const toolVersion = '1.0.0';

async function run() {
    try {
        // Default technologies to analyze
        let technologies = 'abap,actionscript,aspnet,c,cobol,cpp,csharp,html,java,javascript,jcl,jsp,natural,objectivec,oracleforms,perl,php,powerscript,python,rpg4,ruby,swift,vb6,vbnet,xml';

        // Get the values from the task's inputs bythe user
        let analysisLabel = tl.getInput('analysislabel');
        let failOnAudit = tl.getBoolInput('failonaudit');

        let skipclones = tl.getBoolInput('skipclones');
        let skiparch = tl.getBoolInput('skiparch');
        let ignoreclause: string = "";
        if (skipclones) {
            ignoreclause = "ignore=clones";
            if (skiparch) {
                ignoreclause += ",architecture,insights";
            }
        }
        else if (skiparch) {
            ignoreclause = "ignore=architecture,insights";
        }

        let analysisScope = tl.getInput('analysisscope');
        let crStatus = tl.getInput('crstatus');
        let encoding = tl.getInput('encoding');
        let includePatterns = tl.getInput('includepatterns');
        if (includePatterns === null) {
            includePatterns = "**/*";
        }
        let excludePatterns = tl.getInput('excludepatterns');
        let memory = tl.getInput('memory');
        memory += 'm';
        let timeout = Number(tl.getInput('timeout'));
        timeout = timeout * 60000
        let dbanalysis = tl.getBoolInput('dbanalysis');
        if (dbanalysis) {
            let dbtechnology = tl.getInput('dbtchenology');
            technologies += dbtechnology;
        }

        // Get the Kiuwan connection service authorization
        let kiuwanConnection = tl.getInput("kiuwanConnection", true);
        let kiuwanEndpointAuth = tl.getEndpointAuthorization(kiuwanConnection, true);
        // Get user and password from variables defined in the build, otherwise get them from
        // the Kiuwan service endpoint authorization
        let kiuwanUser = tl.getVariable('KiuwanUser');
        if (kiuwanUser === undefined || kiuwanUser === "") {
            kiuwanUser = kiuwanEndpointAuth.parameters["username"];
        }
        let kiuwanPasswd = tl.getVariable('KiuwanPasswd');
        if (kiuwanPasswd === undefined || kiuwanPasswd === "") {
            kiuwanPasswd = kiuwanEndpointAuth.parameters["password"];
        }

        // Get other relevant Variables from the task
        let buildNumber = tl.getVariable('Build.BuildNumber');
        let changeRequest = tl.getVariable('Build.SourceBranchName');
        let branchName = tl.getVariable('Build.SourceBranchName');
        // Now the project name may come from different sources
        // the System.TeamProject variable, an existing Kiuwan app name or a new one
        let projectSelector = tl.getInput('projectnameselector');
        let projectName = '';
        if (projectSelector === 'default') {
            projectName = tl.getVariable('System.TeamProject');
            console.log(`Kiuwan application from System.TeamProject: ${projectName}`);
        }
        if (projectSelector === 'kiuwanapp') {
            projectName = tl.getInput('kiuwanappname');
            console.log(`Kiuwan application from Kiuwan app list: ${projectName}`);
        }
        if (projectSelector === 'appname') {
            projectName = tl.getInput('customappname');
            console.log(`Kiuwan application from user input: ${projectName}`);
        }

        let sourceDirectory = tl.getVariable('Build.SourcesDirectory');
        let agentName = tl.getVariable('Agent.Name');

        let kla = 'Not installed yet';

        // We treat al agents equal now:
        // Check if the KLA is already installed, either because the KIUWAN_HOME variable
        // is set or because it was installed by a previous task execution.
        var kiuwanHome: string;
        kiuwanHome = tl.getVariable('KIUWAN_HOME');

        if (kiuwanHome !== undefined && kiuwanHome !== "") {
            let klaDefaultPath = 'KiuwanLocalAnalyzer';
            let hasDefaultPath = kiuwanHome.endsWith(klaDefaultPath);
            console.log(`Kiuwan_HOME env variable defined: ${kiuwanHome}`);
            kiuwanHome = hasDefaultPath ? kiuwanHome.substring(0, kiuwanHome.lastIndexOf(klaDefaultPath)) : kiuwanHome;
            kla = await buildKlaCommand(kiuwanHome, osPlat);
        }
        else {
            // Check if it is installed in the Agent tools directory from a previosu task run
            // It will download and install it in the Agent Tools directory if not found
            let klaInstallPath = await downloadInstallKla(kiuwanConnection,toolName,toolVersion,osPlat);

            // Get the appropriate kla command depending on the platform
            kla = await buildKlaCommand(klaInstallPath, osPlat);
        }

        let klaArgs: string =
            `-n "${projectName}" ` +
            `-s "${sourceDirectory}" ` +
            `-l "${analysisLabel} ${buildNumber}" ` +
            `-as ${analysisScope} ` +
            `-crs ${crStatus} ` +
            `-cr "${changeRequest}" ` +
            `-bn "${branchName}" ` +
            '-wr ' +
            `--user ${kiuwanUser} ` +
            `--pass ${kiuwanPasswd} ` +
            `exclude.patterns=${excludePatterns} ` +
            `include.patterns=${includePatterns} ` +
            `encoding=${encoding} ` +
            `supported.technologies=${technologies} ` +
            `memory.max=${memory} ` +
            `timeout=${timeout} ` +
            `${ignoreclause}`;

        console.log('Running Kiuwan analysis');

        let kiuwanRetCode: Number = await runKiuwanLocalAnalyzer(kla, klaArgs);

        let kiuwanMsg: string = getKiuwanRetMsg(kiuwanRetCode);

        if ( kiuwanRetCode === 0 ) {
            tl.setResult(tl.TaskResult.Succeeded, kiuwanMsg);
        }
        else {
            if ( auditFailed(kiuwanRetCode) && !failOnAudit ) {
                tl.setResult(tl.TaskResult.Succeeded, kiuwanMsg);
            }
            else {
                tl.setResult(tl.TaskResult.Failed, kiuwanMsg);
            }
        }
    }
    catch (err) {
        tl.setResult(tl.TaskResult.Failed, err.message);
        console.error('Task failed: ' + err.message);
    }
}

run();