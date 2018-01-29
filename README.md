# Kiuwan extension for Microsoft TFS and VSTS
This repo has our first implemetation of the Kiuwan extension for Microsoft TFS and VSTS.
It is based on Powershell and will work on private and hosted agents (only Windows).

Every release in this repo is published in the [Microsoft Visual Studio Marketplace] (https://marketplace.visualstudio.com/items?itemName=kiuwan-publisher.kiuwan-analysis-extension)

## Introduction
This extension only works if you have a [Kiuwan subscription] (http://www.kiuwan.com)

The extension, so far, adds 2 new build tasks to run Kiuwan analyses:
- Baseline analysis. It is an analysis of your complete application to set a reference of the security and quality of an application. Typically run as part of a release or release candidate build
- Delivery analysis. It is an analysis of your change in an application, it runs an automatic audit (user defined with several checkpoints) comparing the results to the latest baseline. The audit result (OK or NOK) is returned by the task failing in case of NOK.

