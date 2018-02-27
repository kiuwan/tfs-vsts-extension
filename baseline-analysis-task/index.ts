import path = require('path')
import os = require('os');
import tl = require('vsts-task-lib/task');
import ttl = require('vsts-task-tool-lib/tool')
import trm = require('vsts-task-lib/toolrunner');
import { extractZip } from 'vsts-task-tool-lib/tool';
import { _exist } from 'vsts-task-lib/internal';
import { isPrimitive } from 'util';

var osPlat: string = os.platform();
var agentHomeDir = tl.getVariable('Agent.HomeDirectory');

async function run() {
    try {
        // Default technologies to analyze
        let technologies = 'abap,actionscript,aspnet,c,cobol,cpp,csharp,html,java,javascript,jcl,jsp,natural,objectivec,oracleforms,perl,php,powerscript,python,rpg4,ruby,swift,vb6,vbnet,xml';

        // Get the values from the task's inputs bythe user
        let analysisLabel = tl.getInput('analysislabel');
        
        let skipclones = tl.getBoolInput('skipclones');
        let skiparch = tl.getBoolInput('skiparch');
        let ignoreclause: string = "";
        if (skipclones) {
            ignoreclause = "ignore=clones";
            if (skiparch) {
                ignoreclause += ",architecture";
            }
        }
        else if (skiparch) {
            ignoreclause = "ignore=architecture";
        }

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

        // Get other relevant Variables from the task
        let buildNumber = tl.getVariable('Build.BuildNumber');
        let kiuwanUser = tl.getVariable('KiuwanUser');
        let kiuwanPasswd = tl.getVariable('KiuwanPasswd');
        let projectName = tl.getVariable('System.TeamProject');
        let sourceDirectory = tl.getVariable('Build.SourcesDirectory');
        let agentName = tl.getVariable('Agent.Name');

        let agentHomeDir = tl.getVariable('Agent.HomeDirectory');

        let kla = 'Not installed yet';

        if (agentName === 'Hosted Agent') {
            // Download and install the agent in the Working directory
            console.log(`Hosted Agent: ${osPlat}`)
            let installPath: string = await downloadInstallKla(false, osPlat);

            console.log('KLA Installed in: ' + installPath);

            // build the KLA command for the corresponding OS
            kla = await buildKlaCommand(installPath, osPlat, true);

            // Add the kla directory to the exclude patters so it is not analyzed
            excludePatterns += ',KiuwanLocalAnalyzer/**';
        }
        else {
            // For private agents:
            // Check if the KLA is already installed, either because the KIUWAN_HOME variable
            // is set or because it was installed by a previous task execution.
            var kiuwanHome: string;
            kiuwanHome = tl.getVariable('KIUWAN_HOME');
            let klaDefaultPath = 'KiuwanLocalAnalyzer';
            let hasDefaultPath = kiuwanHome.endsWith(klaDefaultPath);
        
            if ( kiuwanHome !== undefined && kiuwanHome !== "") {
                console.log(`Kiuwan_HOME env variable defined: ${kiuwanHome}`);
                kiuwanHome = hasDefaultPath ? kiuwanHome.substring(0,kiuwanHome.lastIndexOf(klaDefaultPath)) : kiuwanHome;
                kla = await buildKlaCommand(kiuwanHome, osPlat);
            }
            else {
                // Check if it is installed in the Agent home from a previosu task run
                console.log(`Checking for KLA previously installed in the agent home: ${agentHomeDir}`);
                kla = await buildKlaCommand(agentHomeDir, osPlat);
            }

            if ( kla.length === 0) {
                // KLA not installed. So we install it in the Agent.HomeDirectory
                console.log("No KLA installation found...");
                console.log(`Downloading and installing KLA in the agent home: ${agentHomeDir}`);
                let klaInstallPath = await downloadInstallKla(true, osPlat);

                kla = await buildKlaCommand(klaInstallPath, osPlat, true);
            }
        }

        let klaArgs: string =
            `-n "${projectName}" ` +
            `-s "${sourceDirectory}" ` +
            `-l "${analysisLabel} ${buildNumber}" ` +
            '-c ' +
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

        console.log('Kiuwan Local Analyzer installed! ');
        console.log('Running Kiuwan analysis');

        let kiuwanRetCode: Number = await runKiuwanLocalAnalyzer(kla, klaArgs, 'baseline');

        switch ( kiuwanRetCode ) {
            case 1: {
                console.error(`KLA Error ${kiuwanRetCode}: Analyzer execution error .Run-time execution error (out of memory, etc.). Review log files to find exact cause.`);
                break;
            }
            case 10: {
                console.error(`KLA Error ${kiuwanRetCode}: Audit overall result = FAIL. Audit associated to the analyzed application did not pass. See audit report for exact reasons of non compliance (checkpoints not passed, etc.)`);
                break;
            }
            case 11: {
                console.error(`KLA Error ${kiuwanRetCode}: Invalid analysis configuration. Some configuration parameter has a wrong value. Review log files to find exact cause`);
                break;
            }
            case 12: {
                console.error(`KLA Error ${kiuwanRetCode}: The downloaded model does not support any of the discovered languages. The model specified for the application does not contains rules for the technologies being analyzed. Select an appropriate model or modify the model to include those technologies not currently supported`);
                break;
            }
            case 13: {
                console.error(`KLA Error ${kiuwanRetCode}: Timeout waiting for analysis results. After finishing the local analysis, results were uploaded to Kiuwan site but the second phase (index calculation) timed out. A very common reason for this problem is when your account has reached the maximun number of analyzed locs per 24h. In this case, your analysis is enqueued and local analyzer times out. This does not mean that the analysis has failed. Indeed, the analysis is only enqueued and it will be processed as soon as the limit is over. In this situation you don't need to execute again the analysis, just wait, it will be run automatically.`);
                break;
            }
            case 14: {
                console.error(`KLA Error ${kiuwanRetCode}: Analysis finished with error in Kiuwan. Although local analysis finished successfully, there was some error during analysis processing in the cloud. Visit the log page associated to the analysis.`);
                break;
            }
            case 15: {
                console.error(`KLA Error ${kiuwanRetCode}: Timeout: killed the subprocess. Local analysis timed out. Increase timeout value to a higher value.`);
                break;
            }
            case 16: {
                console.error(`KLA Error ${kiuwanRetCode}: Account limits exceeded. Some limit in the Kiuwan account is reached (max number of account’s analysis is reached, etc.). Contact Kiuwan Technical Support if you have any question on your acccount’s limits.`);
                break;
            }
            case 17: {
                console.error(`KLA Error ${kiuwanRetCode}: Delivery analysis not permitted for current user. User does not have permission to run delivery analysis for the current application.	Check the user has “Execute deliveries” privilege on the application.`);
                break;
            }
            case 18: {
                console.error(`KLA Error ${kiuwanRetCode}: No analyzable extensions found. Kiuwan recognizes the technology of a source file by its extension. But source files to analyze do not match any of the recognized extensions.`);
                break;
            }
            case 19: {
                console.error(`KLA Error ${kiuwanRetCode}: Error checking license. Error while getting or checking Kiuwan license	Contact Kiuwan Technical Support`);
                break;
            }
            case 20: {
                console.error(`KLA Error ${kiuwanRetCode}: Access denied. Lack of permissions to access some Kiuwan entity (application analyses, deliveries, etc). Review log files to find exact cause and contact your Kiuwan administrator.`);
                break;
            }
            case 23: {
                console.error(`KLA Error ${kiuwanRetCode}: Bad Credentials. User-supplied credentials are not valid. Contact your Kiuwan administrator.`);
                break;
            }
            case 24: {
                console.error(`KLA Error ${kiuwanRetCode}: Application Not Found. The invoked action cannot be completed because the associated application does not exist. Review log files to find exact cause and contact your Kiuwan administrator.`);
                break;
            }
            case 25: {
                console.error(`KLA Error ${kiuwanRetCode}: Limit Exceeded for Calls to Kiuwan API. Limit of max Kiuwan API calls per hour has been exceeded.	Contact Kiuwan Technical Support if you have any question on your acccount’s limits.`);
                break;
            }
            case 26: {
                console.error(`KLA Error ${kiuwanRetCode}: Quota Limit Reached. Some limit in the Kiuwan account is reached (max number of account’s analysis is reached, etc.). Contact Kiuwan Technical Support if you have any question on your acccount’s limits.`);
                break;
            }
            case 27: {
                console.error(`KLA Error ${kiuwanRetCode}: Analysis Not Found. The invoked action cannot be completed because the associated analysis does not exist. Review log files to find exact cause. Contact Kiuwan Technical Support`);
                break;
            }
            case 28: {
                console.error(`KLA Error ${kiuwanRetCode}: Application already exists`);
                break;
            }
            default: {
                console.log(`KLA returned ${kiuwanRetCode} Analysis finished successfully!`);
            }
        }

        if (kiuwanRetCode !== 0) {
            tl.setResult(tl.TaskResult.Failed, 'Kiuwan analysis failed! See messages above.');
        }
    }
    catch (err) {
        tl.setResult(tl.TaskResult.Failed, err.message);
        console.error('Task failed: ' + err.message);
    }
}

async function buildKlaCommand(klaPath: string, platform: string, chmod?: boolean) {
    let command: string;
    let defaultKiuwanDir: string = 'KiuwanLocalAnalyzer';
    let dirExist: boolean;

    if (platform === 'linux' || platform === 'darwin') {
        // Define the KLA command if install directory exisits
        dirExist = _exist(`${klaPath}/${defaultKiuwanDir}`);
        console.log(`${klaPath}/${defaultKiuwanDir}: ${dirExist}`);
        command = dirExist ? `${klaPath}/${defaultKiuwanDir}/bin/agent.sh` : "";
        if (chmod) {
            let ret = await tl.exec('chmod', `+x ${klaPath}/${defaultKiuwanDir}/bin/agent.sh`);
            console.log(`chmod retuned: ${ret}`);
        }
    }
    else {
        dirExist = _exist(`${klaPath}\\${defaultKiuwanDir}`);
        command = dirExist ? `${klaPath}\\${defaultKiuwanDir}\\bin\\agent.cmd` : "";
    }

    return command;
}

async function downloadInstallKla(isPrivate: boolean, platform: string) {
    // The downloadTool ALWAYS downloads to the AgentTempDirectory.
    // For private agents,We set the AgentTemDirectory variable to AgentHome directory 
    // to install it there (insubsiquent task runs we check for it there)
    if ( isPrivate ) {
        tl.setVariable('Agent.TempDirectory', agentHomeDir);
    }

    let downloadPath: string = await ttl.downloadTool('https://www.kiuwan.com/pub/analyzer/KiuwanLocalAnalyzer.zip', 'KiuwanLocalAnalyzer.zip');

    let extPath: string = await ttl.extractZip(downloadPath);

    // the extractZip tool ALWAYS extracts to a uuidv4 created directory.
    // for pricvate agents we want to move the KLA directory to the Agent.HomeDirectory
    let origPath: string;
    let destPath: string;
    if ( isPrivate ) {
        if (platform === 'linux' || platform === 'darwin') {
            origPath = `${extPath}/KiuwanLocalAnalyzer`
            destPath = path.normalize(`${extPath}/..`);
            tl.exec('mv',`${origPath} ${destPath}`);
        } 
        else {
            origPath = `${extPath}\\KiuwanLocalAnalyzer`
            destPath = path.normalize(`${extPath}\\..`);            
            tl.exec('powershell',`-command "Move-Item -Path '${origPath}' -Destination '${destPath}'"`);
        }

        extPath = destPath;
    }

    return extPath;
}

async function runKiuwanLocalAnalyzer(command: string, args: string, mode: string) {
    let exitCode: Number = 0;

    // Run KLA with ToolRunner
    if (mode == 'delivery') {
        args +=" -as completeDelivery";
    }

    let kiuwan = tl.tool(command).line(args);
//    let kiuwan = tl.tool('C:\\Program Files\\Java\\jdk1.8.0_66\\bin\\java.exe').arg('-version');

    let options = <trm.IExecOptions>{
        cwd: '.',
        env: process.env,
        silent: false,
        windowsVerbatimArguments: false,
        failOnStdErr: false,
        errStream: process.stdout,
        outStream: process.stdout,
        ignoreReturnCode: true
    }

    kiuwan.on('stdout', (data) => {
        let output = data.toString().trim();
        tl.debug(output);
    })

    exitCode = await kiuwan.exec(options);

    return exitCode;
}

run();