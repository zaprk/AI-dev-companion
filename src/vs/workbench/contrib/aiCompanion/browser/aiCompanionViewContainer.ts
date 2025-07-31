import { localize } from '../../../../nls.js';
import { Registry } from '../../../../platform/registry/common/platform.js';
import { SyncDescriptor } from '../../../../platform/instantiation/common/descriptors.js';
import { ViewPaneContainer } from '../../../browser/parts/views/viewPaneContainer.js';
import { IViewContainersRegistry, ViewContainer, ViewContainerLocation, Extensions as ViewContainerExtensions } from '../../../common/views.js';
import { AICompanionViewIds } from '../common/aiCompanionServiceTokens.js';
import { Codicon } from '../../../../base/common/codicons.js';

// Import required services with proper types
import { IWorkbenchLayoutService } from '../../../services/layout/browser/layoutService.js';
import { ITelemetryService } from '../../../../platform/telemetry/common/telemetry.js';
import { IWorkspaceContextService } from '../../../../platform/workspace/common/workspace.js';
import { IStorageService } from '../../../../platform/storage/common/storage.js';
import { IConfigurationService } from '../../../../platform/configuration/common/configuration.js';
import { IInstantiationService } from '../../../../platform/instantiation/common/instantiation.js';
import { IThemeService } from '../../../../platform/theme/common/themeService.js';
import { IContextMenuService } from '../../../../platform/contextview/browser/contextView.js';
import { IExtensionService } from '../../../services/extensions/common/extensions.js';
import { IContextKeyService } from '../../../../platform/contextkey/common/contextkey.js';
import { IViewDescriptorService } from '../../../common/views.js';
import { ILogService } from '../../../../platform/log/common/log.js';

export class AICompanionViewPaneContainer extends ViewPaneContainer {
	static readonly ID = AICompanionViewIds.VIEWLET_ID;

	constructor(
		@IWorkbenchLayoutService layoutService: IWorkbenchLayoutService,
		@ITelemetryService telemetryService: ITelemetryService,
		@IWorkspaceContextService contextService: IWorkspaceContextService,
		@IStorageService storageService: IStorageService,
		@IConfigurationService configurationService: IConfigurationService,
		@IInstantiationService instantiationService: IInstantiationService,
		@IThemeService themeService: IThemeService,
		@IContextMenuService contextMenuService: IContextMenuService,
		@IExtensionService extensionService: IExtensionService,
		@IContextKeyService contextKeyService: IContextKeyService,
		@IViewDescriptorService viewDescriptorService: IViewDescriptorService,
		@ILogService logService: ILogService
	) {
		super(
			AICompanionViewIds.VIEWLET_ID,
			{
				mergeViewWithContainerWhenSingleView: false,
			},
			instantiationService,
			configurationService,
			layoutService,
			contextMenuService,
			telemetryService,
			extensionService,
			themeService,
			storageService,
			contextService,
			viewDescriptorService,
			logService
		);
	}

	override getTitle(): string {
		return localize('aiCompanion', 'AI Companion');
	}

	override getOptimalWidth(): number {
		return 400;
	}
}

export const AI_COMPANION_CONTAINER: ViewContainer = {
	id: AICompanionViewIds.VIEWLET_ID,
	title: { value: localize('aiCompanion', 'AI Companion'), original: 'AI Companion' },
	ctorDescriptor: new SyncDescriptor(AICompanionViewPaneContainer),
	icon: Codicon.robot,
	order: 100,
	requestedIndex: 100,
	hideIfEmpty: false,
	storageId: 'workbench.view.aiCompanion.state'
};

// Register the view container in the AUXILIARY BAR (secondary side panel)
Registry.as<IViewContainersRegistry>(ViewContainerExtensions.ViewContainersRegistry)
	.registerViewContainer(AI_COMPANION_CONTAINER, ViewContainerLocation.AuxiliaryBar, {
		isDefault: false
	});