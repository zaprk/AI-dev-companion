import { localize } from '../../../../nls.js';
import { Registry } from '../../../../platform/registry/common/platform.js';
import { SyncDescriptor } from '../../../../platform/instantiation/common/descriptors.js';
import { ViewPaneContainer } from '../../../browser/parts/views/viewPaneContainer.js';
import { IViewContainersRegistry, ViewContainer, ViewContainerLocation, Extensions as ViewContainerExtensions } from '../../../common/views.js';
import { AICompanionViewIds } from '../common/aiCompanionServiceTokens.js';

import { Codicon } from '../../../../base/common/codicons.js';

export class AICompanionViewPaneContainer extends ViewPaneContainer {
	static readonly ID = AICompanionViewIds.VIEWLET_ID;

	constructor(
		layoutService: any,
		telemetryService: any,
		contextService: any,
		storageService: any,
		configurationService: any,
		instantiationService: any,
		themeService: any,
		contextMenuService: any,
		extensionService: any,
		contextKeyService: any,
		viewDescriptorService: any,
		logService: any
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

Registry.as<IViewContainersRegistry>(ViewContainerExtensions.ViewContainersRegistry)
	.registerViewContainer(AI_COMPANION_CONTAINER, ViewContainerLocation.AuxiliaryBar, {
		isDefault: false
	});