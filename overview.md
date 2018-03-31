The Kiuwan extension for FTS and VSTS includes 2 new build tasks to run Kiuwan analyses as part of your application builds.

With the latest version, you can now define a Kiuwan service endpoint. This will allow you store you Kiuwan credenyial at the project level. At the same time this service endpoint allows the extension to get information from your Kiuwan account to provide new exciting features and more to come.

## What you need to know before installing it ##

This extension works with the Kiuwan Application Security platform in the cloud. So you need a Kiuwan account to use it.

The included build tasks will work on TFS Windows, Linux or MacOS agents and VSTS private or hosted Windows, Linux and MacOS agents.

For private agents, you can download the Kiuwan Local Analyzer (KLA) from your Kiuwan account and pre-install it in the agent machines you want to use. Make sure you define the KIUWAN_HOME evironment variable pointing to the directory where you installed the KLA (i.e. C:\KiuwanLocalAnalyzer). If you don't pre-install the KLA, the first time you run a Kiuwan task the KLA will be downloaded and installed in the agent tools directory that ran the Kiuwan build task. Next time the same agent runs a Kiuwan task it will use that installation.

If the Agent.TempDirectory and the the Agent.ToolsDirectory variables are not set in your private agents they are set by the build tasks to ${Agent.HomeDirectory}/_temp and ${Agent.ToolsDirectpry}/_tools respectively for the tasks to work properly.

For hosted agents (that are spawned dynamicaly), the KLA is downloaded and installed every time a Kiuwan task runs.

<img src="https://www.kiuwan.com/wp-content/uploads/2018/01/kiuwan-kla-download.png">

## What you get with the extension ##

A service endpoint type and 2 build tasks. One to run Kiuwan baseline analyses to analyse your realeases. And one to run Kiuwan delivery analyses for your change or pull requests.

- **New Service Endpoint type.** To connect to the Kiuwan platform form TFS/VSTS. Now you can define a new service endpoint to the Kiuwan platform. You just need to select the Kiuwan Platform service connection type from the "New Service Endpoint" pulldown in the TFS/VSTS Services configuration tab.

<img src="https://www.kiuwan.com/wp-content/uploads/2018/03/vsts-services.png">

<img src="https://www.kiuwan.com/wp-content/uploads/2018/03/new-service-endpoint.png">

Then you just configure a name for the Kiuwan connection and your Kiuwan account credentials to use to connect to Kiuwan.

<img src="https://www.kiuwan.com/wp-content/uploads/2018/03/kiuwan-endpoint-config.png">

### **NOTE**: Kiuwan credentials for your build tasks
You can now configure the Kiuwan connection in your existing tasks. The credentials configured the selected Kiuwan connection will be used to run the analysis. For backward compatibility, if you don't configure the Kiuwan connection in the task, the build definition variables: KiuwanUser and KiuwanPasswd, will be use for credentials. These variables can be used as well to override the Kiuwan connection credentials. This can be useful if you want a particular build definition to run analyses with a different user.

<img src="https://www.kiuwan.com/wp-content/uploads/2018/01/kiuwan-tasks.png">

- **Kiuwan Baseline Analysis.** This task will run a Kiuwan baseline analysis as part of your build definition. The results are automatically uploaded to your Kiuwan account in the cloud where you can see the results and browse through the security vulnerabilities and other relevant defects  found in your applications.

<img src="https://www.kiuwan.com/wp-content/uploads/2018/01/analysis-results.png">

- **Kiuwan Delivery Analysis.** To use this task you need to have the Life Cycle module in your Kiuwan account. It allows you to audit the deliveries of you application's chenge requests. The task runs a Kiuwan delivery analysis as part of your build definition. The results are automatically uploaded to your Kiuwan account and the defined audit is ran comparing the reults with the latest existing application baseline. The OK or Not OK (OK/NOK) audit result is what the task will return, failing or not failing your build definition execution.

<img src="https://www.kiuwan.com/wp-content/uploads/2018/01/kiuwan-audit-results.png">

### **NOTE**: Kiuwan application selection
By default, we use the project name as the application name in Kiuwan the results are uploaded to. However, you can override this behavior in a task, picking the application from a list with the existing applications in your Kiuwan account (bear in mind than the application list in the combo depend on the permisions the Kiuwan user defined in the Kiuwan connection), or entering a new application name.
