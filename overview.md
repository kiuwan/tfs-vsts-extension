The Kiuwan extension for FTS and VSTS includes 2 new build tasks to run Kiuwan analyses as part of your application builds.

## What you need to know before installing it ##

This extension works with the Kiuwan Application Security platform in the cloud. So you need a Kiuwan account to use it.

For the moment, the included build tasks will work on TFS windows agents and VSTS private windows agents, since the tasks are based on PowerShell for the moment.

Another requirement is that you download the Kiuwan Local Analyzer (KLA) from your Kiuwan account and install it in the agent machines you want to use. Make sure you define the KIUWAN_HOME evironment variable pointing to the directory where you installed the KLA (i.e. C:\KiuwanLocalAnalyzer) and add it to the Path as well.

<img src="https://www.kiuwan.com/wp-content/uploads/2018/01/kiuwan-kla-download.png">

## What you get with the extension ##

2 new build tasks. Stay tuned for more amazing stuff to come!

<img src="https://www.kiuwan.com/wp-content/uploads/2018/01/kiuwan-tasks.png">

- **Kiuwan Baseline Anlysis.** This task will run a Kiuwan baseline analysis as part of your build definition. The results are automatically uploaded to your Kiuwan account in the cloud where you can see the results and browse through the security vulnerabilities and other relevant defects  found in your applications.

<img src="https://www.kiuwan.com/wp-content/uploads/2018/01/analysis-results.png">

- **Kiuwan Delivery Analysis.** To use this task you need to have the Life Cycle module in your Kiuwan account. It allows you to audit the deliveries of you application's chenge requests. The task runs a Kiuwan delivery analysis as part of your build definition. The results are automatically uploaded to your Kiuwan account and the defined audit is ran comparing the reults with the latest existing application baseline. The OK or Not OK (OK/NOK) audit result is what the task will return, failing or not failing your build definition execution.

<img src="https://www.kiuwan.com/wp-content/uploads/2018/01/kiuwan-audit-results.png">



