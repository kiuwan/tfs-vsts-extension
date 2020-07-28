The Kiuwan extension for Azure DevOps and Azure DevOps Server includes 2 build tasks to run Kiuwan analyses as part of your application builds. In this latest version, we have added visual extensions to show results in the build's summary tab. We have also added specific Kiuwan tabs with more result details of baseline and delivery analyses, including links to see the full reports in Kiuwan directly from the build screens.

You can also define a Kiuwan service endpoint. This will allow you to store your Kiuwan credentials at the project level. At the same time, this service endpoint enables the extension to get information from your Kiuwan account to provide new exciting features and more to come.

## Installation requirements ##

Because this extension works with the Kiuwan Application Security platform, you need a Kiuwan account in our cloud service or an on-premise installation of the Kiuwan platform to use it.

Read more detailed information in our tech doc page: [Microsoft TFS Azure DevOps Extension](https://www.kiuwan.com/docs/display/K5/Microsoft+TFS-Azure+DevOps+Extension#MicrosoftTFS-AzureDevOpsExtension-Whatyouneedtoknowbeforeinstallingit)

## What you get with the extension ##

You get a service endpoint type and two build tasks: one to run Kiuwan baseline analyses to analyze your releases, and one to run Kiuwan delivery analyses for your change or pull requests.

- **New Service Endpoint type.** This endpoint connects to the Kiuwan platform from Azure DevOps and Azure DevOps Server. It allows you to define a new service endpoint to the Kiuwan platform.

- **Kiuwan Baseline Analysis.** This task runs a Kiuwan baseline analysis as part of your build definition. The results are automatically uploaded to your Kiuwan account in the cloud where you can see the results and browse through the security vulnerabilities and other relevant defects found in your applications.

- **Kiuwan Delivery Analysis.** To use this task, you must have the Life Cycle module in your Kiuwan account. This task allows you to audit the deliveries of your application's change requests. The task runs a Kiuwan delivery analysis as part of your build definition. The results are automatically uploaded to your Kiuwan account and the defined audit is run comparing the results with the latest existing application baseline. The OK or Not OK (OK/NOK) audit result is what the task will return, failing or not failing your build definition execution.
