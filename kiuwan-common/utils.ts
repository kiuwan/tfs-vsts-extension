//LS: new libraries
//import tl = require('vsts-task-lib/task'); 
import tl = require('azure-pipelines-task-lib/task');
//import ttl = require('vsts-task-tool-lib/tool')
//import trm = require('vsts-task-lib/toolrunner');
import ttl = require('azure-pipelines-tool-lib/tool')
import trm = require('azure-pipelines-task-lib/toolrunner');
import path = require('path');
import fs = require('fs');
import https = require('https');
import http = require('http');
import { Url, domainToUnicode, resolve } from 'url';
//LS: change old libraries for new ones
//import { _exist } from 'vsts-task-lib/internal';
import { _exist } from 'azure-pipelines-task-lib/internal';
import { reject, timeout, async } from 'q';
import { userInfo, type } from 'os';

//This is used to read the properties file to get some kiuwan information
var PropertiesReader = require('properties-reader');


export function isBuild(): boolean {
    let s = tl.getVariable("System.HostType");
    if (s === "build") {
        return true;
    }
    else { // For any other value, 'release' or 'deployent', and even undefined we assume is not a build
        return false;
    }
}

export async function getLastAnalysisResults(kiuwanUrl: Url, kiuwanUser: string, kiuwanPassword: string, domainId: string, kiuwanEndpoint: string, klaAgentProperties: String) {
    const method = 'GET';
    const auth = `${kiuwanUser}:${kiuwanPassword}`;

    const encodedPath = encodeURI(kiuwanEndpoint);

    let agent_properties_file = klaAgentProperties;
    tl.debug(`[KW_LGV] kiuwan_agent_properties_file: ${agent_properties_file}`);
    let properties = PropertiesReader(agent_properties_file);
    let property_proxy_host = properties.get('proxy.host');
    let property_proxy_port = properties.get('proxy.port');
    let property_proxy_auth = properties.get('proxy.authentication');
    let property_proxy_un = properties.get('proxy.username');
    let property_proxy_pw = properties.get('proxy.password');
    tl.debug(`[KW_LGV] kiuwan_agent_property_proxy_host: [${property_proxy_host}]`);
    tl.debug(`[KW_LGV] kiuwan_agent_property_proxy_port: ${property_proxy_port}`);
    tl.debug(`[KW_LGV] kiuwan_agent_property_proxy_auth: ${property_proxy_auth}`);
    tl.debug(`[KW_LGV] kiuwan_agent_property_proxy_un: ${property_proxy_un}`);
    tl.debug(`[KW_LGV] kiuwan_agent_property_proxy_pw: ${property_proxy_pw}`);

    let use_proxy = false;
    let proxy_auth= false;

    if (property_proxy_host != "null" && property_proxy_host != "") {
        use_proxy = true;
        if (property_proxy_auth == "None") {
            proxy_auth = false;
        } else if (property_proxy_auth == "Basic") {
            proxy_auth = true;
        } else {
            tl.debug(`[KW] Proxy auth protocol not supported: ${property_proxy_auth}`);
        }
    }

    tl.debug(`[KW_LGV] use_proxy: ${use_proxy}`);
    tl.debug(`[KW_LGV] proxy_auth: ${proxy_auth}`);

    var options: https.RequestOptions | http.RequestOptions;
    var host = (kiuwanUrl.host.indexOf(':') == -1) ? kiuwanUrl.host : kiuwanUrl.host.substring(0, kiuwanUrl.host.indexOf(':'));
    tl.debug(`[KW] Host: ${host}`);
    tl.debug(`[KW] port: ${kiuwanUrl.port}`);
    tl.debug(`[KW] path: ${encodedPath}`);
    tl.debug(`[KW] method: ${method}`);
    tl.debug(`[KW] auth: ${auth}`);
    tl.debug(`[KW_LGV] kiuwanEndpoint: ${kiuwanEndpoint}`);
    tl.debug(`[KW_LGV] protocol: ${kiuwanUrl.protocol}`);

    options = {
        protocol: kiuwanUrl.protocol,
        host: host,
        port: kiuwanUrl.port,
        path: encodedPath,
        method: method,
        rejectUnauthorized: false,
        auth: auth
    }

    if (domainId !== undefined && domainId !== '' && domainId !== "0") {
        options.headers = { 'X-KW-CORPORATE-DOMAIN-ID': domainId };
    }

    tl.debug(`[KW] Kiuwan API call: ${kiuwanUrl.protocol}//${kiuwanUrl.host}${encodedPath}`);

    if (kiuwanUrl.protocol === 'http:') { //to be deprecated as kiuwan is not http anymore
        return callKiuwanApiHttp(options);
    }
    if (kiuwanUrl.protocol === 'https:') {
        tl.debug(`[KW] [getLastAnalysisResults] useproxy: ${use_proxy}`);
        if ( use_proxy ) {
            if ( proxy_auth ){ //we have user and pw for the proxy
                const auth_p = 'Basic ' + Buffer.from(property_proxy_un + ':' + property_proxy_pw).toString('base64');
                tl.debug(`[LS] [getLastAnalysisResults] calling httpApiHttpsProxy with auth: ${auth_p}`);
                return callKiuwanApiHttpsProxy(options, property_proxy_host, property_proxy_port, auth_p);
            } else {
                tl.debug(`[LS] [getLastAnalysisResults] calling httpApiHttpsProxy with NO auth`);
                return callKiuwanApiHttpsProxyNoAuth(options, property_proxy_host, property_proxy_port);
            }
            
        } else {
            return callKiuwanApiHttps(options);
        }
    }
}

export function saveKiuwanResults(result: string, type: string): string {
    // write result to file
    let fileName = "";
    switch (type) {
        case "baseline":
            fileName = "kiuwanBaselineResult.json";
            break;
        case "delivery":
            fileName = "kiuwanDeliveryResult.json";
            break;
        default:
    }

    const resultsDirPath = path.join(tl.getVariable('build.artifactStagingDirectory'), '.kiuwanResults');
    const resultsFilePath = path.join(resultsDirPath, fileName);

    if (!_exist(resultsDirPath)) {
        fs.mkdirSync(resultsDirPath);
    }
    fs.writeFileSync(resultsFilePath, result);

    return resultsFilePath;
}

export function uploadKiuwanResults(resultsPath: string, title: string, type: string) {
    tl.debug(`[KW] Uploading Kiuwan results from ${resultsPath}`);

    let attachmentType = "";
    switch (type) {
        case "baseline":
            attachmentType = "Kiuwantask.Baseline.Results";
            break;
        case "delivery":
            attachmentType = "Kiuwantask.Delivery.Results";
            break;
        default:
    }

    tl.command(
        'task.addattachment',
        {
            type: attachmentType,
            name: title
        },
        resultsPath
    );

    tl.debug('[KW] Results uploaded successfully')
}

async function callKiuwanApiHttpsProxy(options: https.RequestOptions, proxy_host, proxy_port, proxy_auth ) {
    
    tl.debug("[KW] Calling Kiuwan https API with proxy");

    let k_host = options.host;  tl.debug(`[KW_LGV] [callKiuwanApiHttpsProxy] kiuwan.host: ${k_host}`);
    let k_path = options.path;  tl.debug(`[KW_LGV] [callKiuwanApiHttpsProxy] kiuwan.path: ${k_path}`);
    let k_auth = options.auth;  
    let p_host = proxy_host;    tl.debug(`[KW_LGV] [callKiuwanApiHttpsProxy] proxy.host: ${p_host}`);
    let p_port = proxy_port;    tl.debug(`[KW_LGV] [callKiuwanApiHttpsProxy] proxy.port: ${p_port}`);
    let p_auth = proxy_auth;


    return new Promise((resolve, reject) => {

        //Luis sanchez comment: why these new instances¿?
        const http = require('http')
        const https = require('https')

        http.request({
            host: p_host, // IP address of proxy server
            port: p_port, // port of proxy server
            method: 'CONNECT',
            path: k_host, //destination, add 443 port for https!
            headers: {
                'Proxy-Authorization': p_auth
            },
        }).on('connect', (res, socket) => {
            if (res.statusCode === 200) { // connected to proxy server
                tl.debug ('[LS] Connected to proxy server, doing the https call...');
                https.get({
                    host: k_host, 
                    path: k_path, 
                    auth: k_auth,
                    socket: socket, // using a tunnel
                    agent: false    // cannot use a default agent
                }, (res) => {
                    tl.debug ('[LS] ...reading response ...');
                    let chunks = []
                    if (res.statusCode != 200) {
                        tl.debug(`[KW] [callKiuwanApiHttpsProxy] Kiuwan call error reading response (${res.statusCode}): ${res.statusMessage}`)
                        console.error('error', `Kiuwan call error reading response (${res.statusCode}): ${res.statusMessage}`)
                        reject(new Error(`Kiuwan call error (${res.statusCode}): ${res.statusMessage}`));
                    }
                    res.on('data', chunk => chunks.push(chunk))
                    res.on('end', () => {
                        console.log('DONE', Buffer.concat(chunks).toString('utf8'))
                        resolve(Buffer.concat(chunks).toString('utf8'))
                    })
                })
            } else {
                tl.debug(`[KW] [callKiuwanApiHttpsProxy] Kiuwan call error connecting to proxy server (${res.statusCode}): ${res.statusMessage}`)
                console.error('error', `Kiuwan call error connecting with proxy server (${res.statusCode}): ${res.statusMessage}`)
                reject(new Error(`Kiuwan call error (${res.statusCode}): ${res.statusMessage}`));
            }
        }).on('error', (err) => {
            tl.debug(`[KW] [callKiuwanApiHttpsProxy] Response error: ${err}`)
            console.error('error', err)
            reject(new Error(`Response error: ${err}`))
        }).end()

    });

}

//Luis Sanchez: this function calls to the Kiuwan API using
//a proxy server with no auth, the only difference with previous function is the
//headers part
async function callKiuwanApiHttpsProxyNoAuth(options: https.RequestOptions, proxy_host, proxy_port) {
    
    tl.debug("[KW] Calling Kiuwan https API with proxy with no auth");

    let k_host = options.host;  tl.debug(`[KW_LS] [callKiuwanApiHttpsProxyNoAuth] kiuwan.host: ${k_host}`);
    let k_path = options.path;  tl.debug(`[KW_LS] [callKiuwanApiHttpsProxyNoAuth] kiuwan.path: ${k_path}`);
    let k_auth = options.auth;  
    let p_host = proxy_host;    tl.debug(`[KW_LS] [callKiuwanApiHttpsProxyNoAuth] proxy.host: ${p_host}`);
    let p_port = proxy_port;    tl.debug(`[KW_LS] [callKiuwanApiHttpsProxyNoAuth] proxy.port: ${p_port}`);
    
    return new Promise((resolve, reject) => {
        //Luis sanchez comment: why these new instances¿?
        const http = require('http')
        const https = require('https')

        http.request({
            host: p_host, // IP address of proxy server
            port: p_port, // port of proxy server
            method: 'CONNECT',
            path: k_host, //destination, add 443 port for https!
        }).on('connect', (res, socket) => {
            if (res.statusCode === 200) { // connected to proxy server
                tl.debug ('[KW_LS] Connected to proxy server, doing the https call...');
                https.get({
                    host: k_host, 
                    path: k_path, 
                    auth: k_auth,
                    socket: socket, // using a tunnel
                    agent: false    // cannot use a default agent
                }, (res) => {
                    tl.debug ('[KW_LS] ...reading response ...');
                    let chunks = []
                    if (res.statusCode != 200) {
                        tl.debug(`[KW_LS] [callKiuwanApiHttpsProxyNoAuth] Kiuwan call error reading response (${res.statusCode}): ${res.statusMessage}`)
                        console.error('error', `Kiuwan call error reading response (${res.statusCode}): ${res.statusMessage}`)
                        reject(new Error(`Kiuwan call error (${res.statusCode}): ${res.statusMessage}`));
                    }
                    res.on('data', chunk => chunks.push(chunk))
                    res.on('end', () => {
                        console.log('DONE', Buffer.concat(chunks).toString('utf8'))
                        resolve(Buffer.concat(chunks).toString('utf8'))
                    })
                })
            } else {
                tl.debug(`[KW_LS] [callKiuwanApiHttpsProxyNoAuth] Kiuwan call error connecting to proxy server (${res.statusCode}): ${res.statusMessage}`)
                console.error('error', `Kiuwan call error connecting with proxy server (${res.statusCode}): ${res.statusMessage}`)
                reject(new Error(`Kiuwan call error (${res.statusCode}): ${res.statusMessage}`));
            }
        }).on('error', (err) => {
            tl.debug(`[KW_LS] [callKiuwanApiHttpsProxyNoAuth] Response error: ${err}`)
            console.error('error', err)
            reject(new Error(`Response error: ${err}`))
        }).end()

    });

}

async function callKiuwanApiHttps(options: https.RequestOptions) {
    tl.debug("[KW] Calling Kiuwan https API");

    let responseString = '';

    return new Promise((resolve, reject) => {
        let req = https.request(options, function (res) {
            res.setEncoding('utf-8');

            res.on('data', function (data) {
                responseString += data;
            });

            res.on('end', function () {
                resolve(responseString);
            });

            if (res.statusCode != 200) {
                reject(new Error(`Kiuwan call error (${res.statusCode}): ' + ${res.statusMessage}`));
            }

            res.on('error', function (error) {
                reject(new Error(`Response error: ${error}`));
            })
        });

        req.on('error', (e) => {
            reject(new Error(`Kiuwan API request error: ${e}`));
        });

        req.end();
    });
}

async function callKiuwanApiHttp(options: http.RequestOptions) {
    tl.debug("[KW] Calling Kiuwan http API (to be deprecated)");

    let responseString = '';

    return new Promise((resolve, reject) => {
        let req = http.request(options, function (res) {
            res.setEncoding('utf-8');

            res.on('data', function (data) {
                responseString += data;
            });

            res.on('end', function () {
                resolve(responseString);
            });

            if (res.statusCode != 200) {
                reject(new Error(`Kiuwan call error (${res.statusCode}): ' + ${res.statusMessage}`));
            }

            res.on('error', function (error) {
                reject(new Error(`Response error: ${error}`));
            })
        });

        req.on('error', (e) => {
            reject(new Error(`Kiuwan API request error: ${e}`));
        });

        req.end();
    });
}

export async function getKlaAgentPropertiesPath( klaPath: string, platform: string) {
    let agentprops: string;
    let defaultKiuwanDir: string = 'KiuwanLocalAnalyzer';
    let dirExist: boolean;

    if (platform === 'linux' || platform === 'darwin') {
        // Define the KLA command if install directory exisits
        dirExist = _exist(`${klaPath}/${defaultKiuwanDir}`);
        console.log(`[KW] ${klaPath}/${defaultKiuwanDir}: ${dirExist}`);
        agentprops = dirExist ? `${klaPath}/${defaultKiuwanDir}/conf/agent.properties` : "";
    }
    else {
        dirExist = _exist(`${klaPath}\\${defaultKiuwanDir}`);
        agentprops = dirExist ? `${klaPath}\\${defaultKiuwanDir}\\conf\\agent.properties` : "";
    }

    return agentprops;
}

export async function buildKlaCommand(klaPath: string, platform: string) {
    let command: string;
    let defaultKiuwanDir: string = 'KiuwanLocalAnalyzer';
    let dirExist: boolean;

    if (platform === 'linux' || platform === 'darwin') {
        // Define the KLA command if install directory exisits
        dirExist = _exist(`${klaPath}/${defaultKiuwanDir}`);
        console.log(`[KW] ${klaPath}/${defaultKiuwanDir}: ${dirExist}`);
        command = dirExist ? `${klaPath}/${defaultKiuwanDir}/bin/agent.sh` : "";
    }
    else {
        dirExist = _exist(`${klaPath}\\${defaultKiuwanDir}`);
        command = dirExist ? `${klaPath}\\${defaultKiuwanDir}\\bin\\agent.cmd` : "";
    }

    return command;
}

export async function downloadInstallKla(endpointConnectionName: string, toolName: string, toolVersion: string, platform: string) {
    let defaultKiuwanDir: string = 'KiuwanLocalAnalyzer';

    let toolPath = ttl.findLocalTool(toolName, toolVersion);

    if (!toolPath) {
        let downloadUrl: string = tl.getEndpointUrl(endpointConnectionName, false) + '/pub/analyzer/KiuwanLocalAnalyzer.zip';
        console.log(`[KW] Downloading KLA from ${downloadUrl}`);

        let downloadPath: string = await ttl.downloadTool(downloadUrl, 'KiuwanLocalAnalyzer.zip');

        let extPath: string = await ttl.extractZip(downloadPath);

        toolPath = await ttl.cacheDir(extPath, toolName, toolVersion);
        // Setting +x permision to the kla shell script in unix based platforms
        if (platform === 'linux' || platform === 'darwin') {
            let ret = await tl.exec('chmod', `+x ${toolPath}/${defaultKiuwanDir}/bin/agent.sh`);
            tl.debug(`[KW] chmod retuned: ${ret}`);
        }
        console.log(`[KW] KLA downloaded and  installed in ${toolPath}`)
    }

    return toolPath;
}

export async function runKiuwanLocalAnalyzer(command: string, args: string) {
    let exitCode: Number = 0;

    // Run KLA with ToolRunner
    let kiuwan = tl.tool(command).line(args);

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

export function setAgentTempDir(agentHomeDir: string, platform: string) {
    let tempDir: string;
    if (platform === 'linux' || platform === 'darwin') {
        tempDir = `${agentHomeDir}/_temp`
    }
    else {
        tempDir = `${agentHomeDir}\\_temp`
    }

    // Creates the temp directory if it doesn't exists
    if (!_exist(tempDir)) {
        fs.mkdirSync(tempDir);
    }

    tl.setVariable('Agent.TempDirectory', tempDir);

    return tempDir;
}

export function setAgentToolsDir(agentHomeDir: string, platform: string) {
    let toolsDir: string;
    if (platform === 'linux' || platform === 'darwin') {
        toolsDir = `${agentHomeDir}/_tools`
    }
    else {
        toolsDir = `${agentHomeDir}\\_tools`
    }

    tl.setVariable('Agent.ToolsDirectory', toolsDir);

    return toolsDir;
}

export function getKiuwanRetMsg(kiuwanRetCode: Number): string {
    var kiuwanErrorMsg = '';
    switch (kiuwanRetCode) {
        case 1: {
            kiuwanErrorMsg = `KLA Error ${kiuwanRetCode}: Analyzer execution error .Run-time execution error (out of memory, etc.). Review log files to find exact cause.`;
            break;
        }
        case 10: {
            kiuwanErrorMsg = `KLA Error ${kiuwanRetCode}: Audit overall result = FAIL. Audit associated to the analyzed application did not pass. See audit report for exact reasons of non compliance (checkpoints not passed, etc.)`;
            break;
        }
        case 11: {
            kiuwanErrorMsg = `KLA Error ${kiuwanRetCode}: Invalid analysis configuration. Some configuration parameter has a wrong value. Review log files to find exact cause`;
            break;
        }
        case 12: {
            kiuwanErrorMsg = `KLA Error ${kiuwanRetCode}: The downloaded model does not support any of the discovered languages. The model specified for the application does not contains rules for the technologies being analyzed. Select an appropriate model or modify the model to include those technologies not currently supported`;
            break;
        }
        case 13: {
            kiuwanErrorMsg = `KLA Error ${kiuwanRetCode}: Timeout waiting for analysis results. After finishing the local analysis, results were uploaded to Kiuwan site but the second phase (index calculation) timed out. A very common reason for this problem is when your account has reached the maximun number of analyzed locs per 24h. In this case, your analysis is enqueued and local analyzer times out. This does not mean that the analysis has failed. Indeed, the analysis is only enqueued and it will be processed as soon as the limit is over. In this situation you don't need to execute again the analysis, just wait, it will be run automatically.`;
            break;
        }
        case 14: {
            kiuwanErrorMsg = `KLA Error ${kiuwanRetCode}: Analysis finished with error in Kiuwan. Although local analysis finished successfully, there was some error during analysis processing in the cloud. Visit the log page associated to the analysis.`;
            break;
        }
        case 15: {
            kiuwanErrorMsg = `KLA Error ${kiuwanRetCode}: Timeout: killed the subprocess. Local analysis timed out. Increase timeout value to a higher value.`;
            break;
        }
        case 16: {
            kiuwanErrorMsg = `KLA Error ${kiuwanRetCode}: Account limits exceeded. Some limit in the Kiuwan account is reached (max number of account’s analysis is reached, etc.). Contact Kiuwan Technical Support if you have any question on your acccount’s limits.`;
            break;
        }
        case 17: {
            kiuwanErrorMsg = `KLA Error ${kiuwanRetCode}: Delivery analysis not permitted for current user. User does not have permission to run delivery analysis for the current application.	Check the user has “Execute deliveries” privilege on the application.`;
            break;
        }
        case 18: {
            kiuwanErrorMsg = `KLA Error ${kiuwanRetCode}: No analyzable extensions found. Kiuwan recognizes the technology of a source file by its extension. But source files to analyze do not match any of the recognized extensions.`;
            break;
        }
        case 19: {
            kiuwanErrorMsg = `KLA Error ${kiuwanRetCode}: Error checking license. Error while getting or checking Kiuwan license	Contact Kiuwan Technical Support`;
            break;
        }
        case 22: {
            kiuwanErrorMsg = `KLA Error ${kiuwanRetCode}: Access denied. Lack of permissions to access some Kiuwan entity (application analyses, deliveries, etc). Review log files to find exact cause and contact your Kiuwan administrator.`;
            break;
        }
        case 23: {
            kiuwanErrorMsg = `KLA Error ${kiuwanRetCode}: Bad Credentials. User-supplied credentials are not valid. Contact your Kiuwan administrator.`;
            break;
        }
        case 24: {
            kiuwanErrorMsg = `KLA Error ${kiuwanRetCode}: Application Not Found. The invoked action cannot be completed because the associated application does not exist. Review log files to find exact cause and contact your Kiuwan administrator.`;
            break;
        }
        case 25: {
            kiuwanErrorMsg = `KLA Error ${kiuwanRetCode}: Limit Exceeded for Calls to Kiuwan API. Limit of max Kiuwan API calls per hour has been exceeded.	Contact Kiuwan Technical Support if you have any question on your acccount’s limits.`;
            break;
        }
        case 26: {
            kiuwanErrorMsg = `KLA Error ${kiuwanRetCode}: Quota Limit Reached. Some limit in the Kiuwan account is reached (max number of account’s analysis is reached, etc.). Contact Kiuwan Technical Support if you have any question on your acccount’s limits.`;
            break;
        }
        case 27: {
            kiuwanErrorMsg = `KLA Error ${kiuwanRetCode}: Analysis Not Found. The invoked action cannot be completed because the associated analysis does not exist. Review log files to find exact cause. Contact Kiuwan Technical Support`;
            break;
        }
        case 28: {
            kiuwanErrorMsg = `KLA Error ${kiuwanRetCode}: Application already exists`;
            break;
        }
        case 30: {
            kiuwanErrorMsg = `KLA Error ${kiuwanRetCode}: Delivery analysis not permitted: baseline analysis not found. A delivery analysis is being executed but there's not any baseline analysis for that application.`;
            break;
        }
        case 31: {
            kiuwanErrorMsg = `KLA Error ${kiuwanRetCode}: No engine available. The analysis fails because there's no any available engine to process the source files. This situation is very unusual but could be produced because the upgrade failed due to some blocking situation.`;
            break;
        }
        case 32: {
            kiuwanErrorMsg = `KLA Error ${kiuwanRetCode}: 	Unexpected error. Contact Kiuwan Technical Support.`;
            break;
        }
        case 33: {
            kiuwanErrorMsg = `KLA Error ${kiuwanRetCode}: Out of Memory. The analysis fails because the configured max memory is not enough to finish the analysis.`;
            break;
        }
        case 34: {
            kiuwanErrorMsg = `KLA Error ${kiuwanRetCode}: JVM Error. Error at JVM level. Contact Kiuwan Technical Support.`;
            break;
        }
        default: {
            kiuwanErrorMsg = `KLA returned ${kiuwanRetCode} Analysis finished successfully!`;
        }
    }

    return kiuwanErrorMsg;

}

export function auditFailed(retCode: Number): boolean {
    return (retCode === 10);
}

export function noFilesToAnalyze(retCode: Number): boolean {
    return (retCode === 18);
}

//Luis Sanchez adding: function to change the agent.properties file with values taken from the
//service connection of the plugion. Needed because the plugin calls a shell that call the kiuwan
//agent and this agent will use the proxy configuration to do the analysis.
//The plugin then will take those values from the agent.properties file and use them in the ulter
//connections to the kiuwan api
export async function processAgentProperties(agent_properties_file: string, proxyUrl: string, proxyUser: string, proxyPassword: string){

    //Debug, showing the existing properties in the agent.properties file
    tl.debug(`[LS] Proxy values from agent_properties_file: ${agent_properties_file}`);
    let properties = PropertiesReader(agent_properties_file);
    let property_proxy_host = properties.get('proxy.host');
    let property_proxy_port = properties.get('proxy.port');
    let property_proxy_auth = properties.get('proxy.authentication');
    let property_proxy_un = properties.get('proxy.username');
    let property_proxy_pw = properties.get('proxy.password');
    let property_proxy_protocol = properties.get('proxy.protocol');
    tl.debug(`[LS] property_proxy_host: [${property_proxy_host}]`);
    tl.debug(`[LS] property_proxy_port: ${property_proxy_port}`);
    tl.debug(`[LS] property_proxy_auth: ${property_proxy_auth}`);
    tl.debug(`[LS] property_proxy_un: ${property_proxy_un}`);
    tl.debug(`[LS] property_proxy_pw: ${property_proxy_pw}`);
    tl.debug(`[LS] property_proxy_protocol: ${property_proxy_protocol}`);

    //Debug, to show the proxy data comming from the Service connection
    tl.debug(`[LS] Proxy information get from the plugin agent (if any):`);
    tl.debug(`[LS] Proxy URL: ${proxyUrl}`);
    tl.debug(`[LS] Proxy User: ${proxyUser}`);
    tl.debug(`[LS] Proxy Password: ${proxyPassword}`);
    
    
    //Step1: see if proxy host is okey. The proxy value has to be in a good format to continue
    // taking this information into consideration
    if (proxyUrl.length > 0 && (proxyUrl.startsWith("socks") || proxyUrl.startsWith("http"))){
        property_proxy_host =  proxyUrl.slice(proxyUrl.indexOf("://")+3, proxyUrl.lastIndexOf(":"));
        property_proxy_port =  proxyUrl.slice(proxyUrl.lastIndexOf(":")+1);
        property_proxy_protocol = proxyUrl.slice(0,proxyUrl.indexOf("://"));
        tl.debug(`[LS] sever taken from agent: ${property_proxy_host}`);
        tl.debug(`[LS] port taken from agent: ${property_proxy_port}`);
        tl.debug(`[LS] protocol taken from agent: ${property_proxy_protocol}`);
        tl.debug(`[LS] username from agent: ${proxyUser}`);
        tl.debug(`[LS] password from agent: ${proxyPassword}`);
      //step 2: take user and password
        if (proxyUser != null && proxyUser.length > 0){ //if there is user, then auth is basic and we need to put all in the file
            property_proxy_auth = "Basic";
            //set the rest of the properties properties parameters to the new ones:
            property_proxy_un = proxyUser;
            property_proxy_pw = proxyPassword;
        }else{//if user.length=0 then no username, no authentication, so auth is going to be None
            property_proxy_auth = "None";
        }
    }else{//If the proxy is not ok, or is empty, the user does not want to use a proxy server, so 
          // the default values are used.
          //Useful when the user change his mind and modifies the service connection.
        tl.debug(`[LS] proxy info not good or empty. Resetting the values to default...`);
        property_proxy_host = "";
        property_proxy_port = "3128";
        property_proxy_un = "";
        property_proxy_pw = "";
        property_proxy_protocol = "http";
        property_proxy_auth = "None";
    }

    //Read the agent.properties file, replace values and write it again
    //NOTE: I do not use PropertiesReader(prop.file) because this library uses the "ini" format and when
    // I write the file back to disk everything is messed up. But if the properties file follows the "ini"
    // format, the correct way of processing the file is by using the properties-reader library
    tl.debug(`[LS] Replacing values in file ` + agent_properties_file);
    let propString = fs.readFileSync(agent_properties_file);
    propString = replaceProperty(propString, "proxy.host", property_proxy_host);
    propString = replaceProperty(propString, "proxy.port", property_proxy_port);
    propString = replaceProperty(propString, "proxy.authentication", property_proxy_auth);
    propString = replaceProperty(propString, "proxy.username", property_proxy_un);
    propString = replaceProperty(propString, "proxy.password", property_proxy_pw);
    propString = replaceProperty(propString, "proxy.protocol", property_proxy_protocol);
    fs.writeFileSync(agent_properties_file,propString);
    tl.debug(`[LS] New proxy values written in file `+agent_properties_file);

    return;
} 

//This is a helper function to look for a property name in string "inString". The property comes from
// a properties file, so it takes the line break into consideration.
// input: string taken from file with <property>=<value> or <property>= lines
// output: new string with the same lines but the one with the replacement of <property>=<value> 
function replaceProperty (inString: string, propertyName: string, propertyNewValue: string) : string {
    let out = "";
    let firstPositon = 0;
    let lastPosition = 0;

    firstPositon = inString.indexOf(propertyName);
    lastPosition = inString.indexOf("\n", firstPositon);

    out = inString.slice(0,firstPositon) + propertyName + "=" 
    + propertyNewValue +  inString.slice(lastPosition, inString.length);

    return out;
}



//--- end changes Luis Sanchez ----