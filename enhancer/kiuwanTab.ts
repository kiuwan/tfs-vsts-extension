
import Controls = require("VSS/Controls");
import TFS_Build_Contracts = require("TFS/Build/Contracts");
import TFS_Build_Extension_Contracts = require("TFS/Build/ExtensionContracts");
import DT_Client = require("TFS/DistributedTask/TaskRestClient");

export class KiuwanTab extends Controls.BaseControl {
    constructor() {
        super();
    }

    public initialize(): void {
        super.initialize();
        // Get configuration that's shared between extension and the extension host
        var sharedConfig: TFS_Build_Extension_Contracts.IBuildResultsViewExtensionConfig = VSS.getConfiguration();
        var vsoContext = VSS.getWebContext();
        if (sharedConfig) {
            // register your extension with host through callback
            sharedConfig.onBuildChanged((build: TFS_Build_Contracts.Build) => {
                this._initBuildInfo(build);

                // Get Kiuwan analysis results from the server stored there as build attachment inthe artifacts directory
                var taskClient = DT_Client.getClient();
                taskClient.getPlanAttachments(vsoContext.project.id, "build", build.orchestrationPlan.planId, "Kiuwantask.Baseline.Results").then((taskAttachments) => {
                    if (taskAttachments.length == 0) {
                         this._element.find("#disclaimer").show();
                    }
                    else {
                        this._element.find("#kiuwan-info-tab").show();
                    }
                    $.each(taskAttachments, (index, taskAttachment) => {
                        taskClient.getAttachmentContent(vsoContext.project.id,
                            "build",
                            build.orchestrationPlan.planId,
                            taskAttachment.timelineId,
                            taskAttachment.recordId,
                            taskAttachment.type,
                            taskAttachment.name).then((kiuwanResults) => {
                                let kiuwanJsonStr = String.fromCharCode.apply(null, new Uint8Array(kiuwanResults));
                                let kiuwanJson = JSON.parse(kiuwanJsonStr);
                                this.setKiuwanResultsLink(kiuwanJson.analysisURL);
                                this.populateSecurityInfo(kiuwanJson);
                                this.populateDefectsInfo(kiuwanJson);
                                this.populateRiskInfo(kiuwanJson);
                                this.populateQaInfo(kiuwanJson);
                                this.populateEffortInfo(kiuwanJson);
                                this.populateQaDisttInfo(kiuwanJson);
                            }
                        );
                    });
                });

            });
        }
    }

    private _initBuildInfo(build: TFS_Build_Contracts.Build) {
    }
    private setKiuwanResultsLink(url) {
        this._element.find("#kiuwan-link").attr("href", url);
    }

    private populateSecurityInfo(kiuwanJson): void {
        // Only if Kiuwan returned security info
        if (kiuwanJson.Security !== undefined) {
            // Get the data from the JSON returned by Kiuwan
            let totalVulns = kiuwanJson.Security.Vulnerabilities.Total.toFixed(0);
            let totalLoc = kiuwanJson["Main metrics"][5].value.toFixed(0);

            this._element.find("#sec-vulns-num").text(totalVulns);
            this._element.find("#sec-loc-num").text(totalLoc);

            // Get security rating and display the stars accordingly
            let starYes = `<img src="images/star-yes.png" />`;
            let secRating = kiuwanJson.Security.Rating;
            switch (secRating) {
                case 1:
                    this._element.find("#sec-star-1").html(starYes);
                    break;
                case 2:
                    this._element.find("#sec-star-1").html(starYes);
                    this._element.find("#sec-star-2").html(starYes);
                    break;
                case 3:
                    this._element.find("#sec-star-1").html(starYes);
                    this._element.find("#sec-star-2").html(starYes);
                    this._element.find("#sec-star-3").html(starYes);
                    break;
                case 4:
                    this._element.find("#sec-star-1").html(starYes);
                    this._element.find("#sec-star-2").html(starYes);
                    this._element.find("#sec-star-3").html(starYes);
                    this._element.find("#sec-star-4").html(starYes);
                    break;
                case 5:
                    this._element.find("#sec-star-1").html(starYes);
                    this._element.find("#sec-star-2").html(starYes);
                    this._element.find("#sec-star-3").html(starYes);
                    this._element.find("#sec-star-4").html(starYes);
                    this._element.find("#sec-star-5").html(starYes);
                    break;
                default:
            }

            // Get the vulnerabilities by priority and display the numbers
            let vhVulns = kiuwanJson.Security.Vulnerabilities.VeryHigh.toFixed(0);
            let hVulns = kiuwanJson.Security.Vulnerabilities.High.toFixed(0);
            let nVulns = kiuwanJson.Security.Vulnerabilities.Normal.toFixed(0);
            let lVulns = kiuwanJson.Security.Vulnerabilities.Low.toFixed(0);
            
            this._element.find("#vh-vulns-num").text(vhVulns);
            this._element.find("#h-vulns-num").text(hVulns);
            this._element.find("#n-vulns-num").text(nVulns);
            this._element.find("#l-vulns-num").text(lVulns);
        }
        else {
            let secEmpty = `There is no security info to display from Kiuwan<br />`;
            this._element.find("#sec-empty").html(secEmpty);
            this._element.find("#sec-summary").hide();
        }
    }

    private populateDefectsInfo(kiuwanJson) {
        let defects = kiuwanJson["Main metrics"][1].value.toFixed(0);
        this._element.find("#qa-defects-num").text(defects);
        let loc = kiuwanJson["Main metrics"][5].value.toFixed(0);
        this._element.find("#qa-loc-num").text(loc);
    }

    private populateRiskInfo(kiuwanJson): void {
        var color = "";
        // Only if Kiuwan returns risk info
        if (kiuwanJson["Risk index"] !== undefined) {
            // Get the risk value and decide the color to display
            let risk = parseFloat(kiuwanJson["Risk index"].value);
            if (risk < 25) {
                color = "risk-l";
            }
            else if (risk < 50) {
                color = "risk-n";
            }
            else if (risk < 75) {
                color = "risk-h";
            }
            else if (risk <= 100) {
                color = "risk-vh";
            }

            // Set the risk value and the corresponding color
            this._element.find("#qa-risk-num").addClass(color);
            this._element.find("#qa-risk-num").text(risk.toFixed(2));
        }
        else {
            let riskEmpty = `There is no QA risk info to display from Kiuwan<br />`;
            this._element.find("#risk-empty").html(riskEmpty);
            this._element.find("#qa-risk").hide();
        }
    }

    private populateQaInfo(kiuwanJson): void {
        var color = "";
        // Only if Kiuwan returns QA info
        if (kiuwanJson["Quality indicator"] !== undefined) {
            // Get the QA indicator value and decide the color to display
            let qaIndicator = parseFloat(kiuwanJson["Quality indicator"].value);
            if (qaIndicator < 25) {
                color = "qa-l";
            }
            else if (qaIndicator < 50) {
                color = "qa-n";
            }
            else if (qaIndicator < 75) {
                color = "qa-h";
            }
            else if (qaIndicator <= 100) {
                color = "qa-vh";
            }

            // Set the QA indicator value and the corresponding color
            this._element.find("#qa-indicator-num").addClass(color);
            this._element.find("#qa-indicator-num").text(qaIndicator.toFixed(2));
        }
        else {
            let qaEmpty = `There is no QA indicator info to display from Kiuwan<br />`;
            this._element.find("#qa-empty").html(qaEmpty);
            this._element.find("#qa-qa-indicator").hide();
        }
    }

    private populateEffortInfo(kiuwanJson): void {
        // Only if Kiuwan returns Effort info
        if (kiuwanJson["Effort to target"] !== undefined) {
            let effort = kiuwanJson["Effort to target"].value.toFixed(2);

            // Set the effort value
            this._element.find("#qa-effort-num").text(effort);
        }
        else {
            let effortEmpty = `There is no Eefort to target info to display from Kiuwan<br />`;
            this._element.find("#effort-empty").html(effortEmpty);
            this._element.find("#qa-effort-target").hide();
        }
    }

    private populateQaDisttInfo(kiuwanJson): void {
        // Only if Kiuwan returns QA info
        if (kiuwanJson["Quality indicator"] !== undefined) {
            // Get and display every partial indicator
            let efficiency = kiuwanJson["Quality indicator"].children[0].value.toFixed(2);
            this._element.find("#efficiency-num").text(efficiency);
            let maintainability = kiuwanJson["Quality indicator"].children[1].value.toFixed(2);
            this._element.find("#maintainabilty-num").text(maintainability);
            let portability = kiuwanJson["Quality indicator"].children[2].value.toFixed(2);
            this._element.find("#portability-num").text(portability);
            let reliability = kiuwanJson["Quality indicator"].children[3].value.toFixed(2);
            this._element.find("#reliability-num").text(reliability);
            let security = kiuwanJson["Quality indicator"].children[4].value.toFixed(2);
            this._element.find("#security-num").text(security);
        }
        else {
            this._element.find("#qa-dist").hide();
        }
    }
}

KiuwanTab.enhance(KiuwanTab, $(".kiuwan-info"), {});

// Notify the parent frame that the host has been loaded
VSS.notifyLoadSucceeded();


