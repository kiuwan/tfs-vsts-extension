import Controls = require("VSS/Controls");
// import VSS_Service = require("VSS/Service");
import TFS_Build_Contracts = require("TFS/Build/Contracts");
import TFS_Build_Extension_Contracts = require("TFS/Build/ExtensionContracts");

import DT_Client = require("TFS/DistributedTask/TaskRestClient");

export class KiuwanAuditTab extends Controls.BaseControl {
    private K_OK = "OK";
    private K_FAIL = "FAIL";

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
                this._initKiuwanAuditTab(build);
                // Get Kiuwan analysis results from the server stored there as build attachment inthe artifacts directory
                var taskClient = DT_Client.getClient();
                taskClient.getPlanAttachments(vsoContext.project.id, "build", build.orchestrationPlan.planId, "Kiuwantask.Delivery.Results").then((taskAttachments) => {
                    if (taskAttachments.length == 0) {
                        this._element.find("#disclaimer").show();
                    }
                    else {
                        this._element.find("#kiuwan-audit-tab").show();
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
                                let kiuwanAuditResult = kiuwanJson.auditResult.overallResult;
                                this.setKiuwanAuditLink(kiuwanJson.auditResultURL);
                                this.setAuditResult(kiuwanAuditResult);
                                this.setAuditScore(kiuwanAuditResult, kiuwanJson.auditResult.score);
                                this.setCheckpointSummary(kiuwanJson.auditResult.checkpointResults);
                                let fixStats = this.getFixStats(kiuwanJson.auditResult.checkpointResults);
                                this.setCheckpointList(kiuwanJson.auditResult.checkpointResults);
                                this.setEffortSummary(fixStats);
                            }
                        );
                    });
                });
            });
        }
    }

    private setEffortSummary(fixStats) {
        this._element.find("#effort-summary").html(`You have ${fixStats.defects} defects in ${fixStats.files} files to fix<br />Total effort to fix the failed checkpoints: <strong>${fixStats.effort}</strong>`);
    }

    private _initKiuwanAuditTab(build: TFS_Build_Contracts.Build) {
    }
    private setKiuwanAuditLink(url) {
        this._element.find("#kiuwan-link").attr("href", url);
    }

    private setAuditResult(auditResult) {
        let displayIcon = "";
        let resultTextElement = this._element.find("#result-text");
        if (auditResult === this.K_FAIL) {
            displayIcon = "images/ball-red.png";
            resultTextElement.addClass("fail");
        }
        else if (auditResult === this.K_OK) {
            displayIcon = "images/ball-green.png";
            resultTextElement.addClass("success");
        }

        this._element.find("#result-icon").attr("src", displayIcon);
        resultTextElement.text(auditResult);
    }

    private setAuditScore(auditResult, score) {
        let scoreNumElement = this._element.find("#score-num");

        if (auditResult === this.K_FAIL) {
            scoreNumElement.addClass("fail");
        }
        else if (auditResult === this.K_OK) {
            scoreNumElement.addClass("success");
        }

        scoreNumElement.text(score.toFixed(2));
    }

    private setCheckpointSummary(checkpointResults: Array<Object>) {
        let totalCheckpoints = checkpointResults.length;

        let failedCheckpoints = 0;
        for (let i = 0; i < totalCheckpoints; i++) {
            let cpr: any = checkpointResults[i];
            if (cpr.result === this.K_FAIL) {
                ++failedCheckpoints;
            }
        }
        this._element.find("#checkpoints-summary").html(`${failedCheckpoints} out of ${totalCheckpoints} total checkpoints failed`)
    }

    private setCheckpointList(checkpointResults: Array<Object>) {
        while (checkpointResults.length != 0) {
            let resultColor = "";
            let resultText = "";
            let cpr: any = checkpointResults.pop();
            let divElement = $("<div />");
            divElement.addClass("checkpoint");
            if (cpr.result === this.K_OK) {
                resultColor = "success";
                resultText = "Passed";
            }
            else if (cpr.result === this.K_FAIL) {
                resultColor = "fail";
                resultText = "Failed";
            }
            divElement.html(`${cpr.checkpoint}: ${cpr.name} <span class="${resultColor}">${resultText}</span>`);
            this._element.find("#checkpoints-list").append(divElement);
        }
    }

    private getFixStats(checkpointResults): any {
        let totalHours: number = 0;
        let totalMins: number = 0;
        let totalEffort = "";
        let totalDefects = 0;
        let totalFiles = 0;
        let totalCheckpoints = checkpointResults.length;

        for (let i = 0; i < totalCheckpoints; i++) {
            let checkpoint: any = checkpointResults[i];
            if (checkpoint.result === this.K_FAIL) {
                let violatedRules = checkpoint.violatedRules;
                let totalViolatedRules = violatedRules.length;
                for (let j = 0; j < totalViolatedRules; j++) {
                    totalDefects += violatedRules[j].defectsCount;
                    totalFiles += violatedRules[j].filesCount;
                    let effort: string = violatedRules[j].effort;
                    if (effort.lastIndexOf("h") != -1) {
                        totalHours += +effort.substring(0, effort.lastIndexOf("h"));
                        totalMins += +effort.substring(effort.lastIndexOf("h") + 1, effort.length);
                    }
                    else {
                        totalMins += +effort.substring(0,effort.lastIndexOf("m"));
                    }
                }
            }
        }
        totalEffort = `${totalHours} hours ${totalMins} minutes`;

        return { effort: totalEffort, defects: totalDefects, files: totalFiles };
    }
}

KiuwanAuditTab.enhance(KiuwanAuditTab, $(".kiuwan-audit"), {});

// Notify the parent frame that the host has been loaded
VSS.notifyLoadSucceeded();

