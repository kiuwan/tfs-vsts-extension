import Controls = require("VSS/Controls");
// import VSS_Service = require("VSS/Service");
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
					$.each(taskAttachments, (index, taskAttachment) => {
						taskClient.getAttachmentContent(vsoContext.project.id,
							"build",
							build.orchestrationPlan.planId,
							taskAttachment.timelineId,
							taskAttachment.recordId,
							taskAttachment.type,
							taskAttachment.name).then((kiuwanResults) => {
								var element = $("<h3 />");
								element.text(taskAttachment.name);
								this._element.append(element);
								var result = $("<div />");
								let kiuwanJsonStr = String.fromCharCode.apply(null, new Uint8Array(kiuwanResults));
								let kiuwanJson =JSON.parse(kiuwanJsonStr);
								result.html(`<a target='_blank' href='${kiuwanJson.analysisURL}'>Go to Kiuwan</a>`);
								this._element.append(result);
							});
					});
				});

			});
		}
	}

	private _initBuildInfo(build: TFS_Build_Contracts.Build) {
		var element = $("<h2 />");
		element.text("These are the Kiuwan results");
		this._element.append(element);
	}
}

KiuwanTab.enhance(KiuwanTab, $(".kiuwan-info"), {});

// Notify the parent frame that the host has been loaded
VSS.notifyLoadSucceeded();


