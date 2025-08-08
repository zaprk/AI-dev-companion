import { append, $ } from '../../../../../base/browser/dom.js';
	import { safeSetInnerHtml } from '../../../../../base/browser/domSanitize.js';

// Enhanced Progress Animation System for Ultra-Smooth Circular Progress
interface ProgressElement {
	circle: HTMLElement;
	progress: HTMLElement;
	label: HTMLElement;
}

class AnimationController {
	private currentProgress: number = 0;
	private targetProgress: number = 0;
	private progressHint: number = 0;
	private isRunning: boolean = false;
	private isCompleting: boolean = false;
	private startTime: number = 0;
	private estimatedDuration: number;
	private animationId: number | null = null;
	private velocitySmoothing: number = 0.08; // Lower = smoother, higher = more responsive
	
	constructor(
		private element: ProgressElement,
		estimatedDurationMs: number
	) {
		this.estimatedDuration = estimatedDurationMs;
		this.reset();
	}
	
	start(): void {
		this.isRunning = true;
		this.startTime = Date.now();
		this.activateElement();
		this.animate();
	}
	
	updateProgressHint(hint: number): void {
		// Update the hint, but don't let it go backwards significantly
		this.progressHint = Math.max(hint, this.progressHint - 5);
		
		// Use hint to influence target progress with smart logic
		const elapsed = Date.now() - this.startTime;
		const timeBasedProgress = this.calculateTimeBasedProgress(elapsed);
		
		// Blend time-based and hint-based progress intelligently
		this.targetProgress = this.blendProgress(timeBasedProgress, this.progressHint);
	}
	
	complete(): Promise<void> {
		return new Promise((resolve) => {
			this.isCompleting = true;
			this.targetProgress = 100;
			
			// Smooth completion animation
			const completeAnimation = () => {
				if (this.currentProgress >= 99.5) {
					this.currentProgress = 100;
					this.updateVisualProgress(100);
					this.markAsCompleted();
					this.stop();
					resolve();
				} else {
					this.animate();
					requestAnimationFrame(completeAnimation);
				}
			};
			
			completeAnimation();
		});
	}
	
	private calculateTimeBasedProgress(elapsed: number): number {
		const normalizedTime = elapsed / this.estimatedDuration;
		
		// Use easing function for natural feel
		// Starts fast, slows down as it approaches the end
		const easedProgress = this.easeOutQuart(Math.min(normalizedTime, 1)) * 85; // Cap at 85%
		
		return easedProgress;
	}
	
	private blendProgress(timeProgress: number, hintProgress: number): number {
		// Smart blending logic
		if (this.isCompleting) {
			return 100; // Always target 100% when completing
		}
		
		// If hint is significantly ahead of time-based, use time + small boost
		if (hintProgress > timeProgress + 10) {
			return timeProgress + Math.min(10, (hintProgress - timeProgress) * 0.3);
		}
		
		// If hint is behind time-based, trust time-based more
		if (hintProgress < timeProgress - 5) {
			return timeProgress * 0.8 + hintProgress * 0.2;
		}
		
		// If they're close, blend them smoothly
		return timeProgress * 0.6 + hintProgress * 0.4;
	}
	
	private animate(): void {
		if (!this.isRunning) return;
		
		// Update target progress based on time if no recent hints
		if (!this.isCompleting) {
			const elapsed = Date.now() - this.startTime;
			const timeBasedProgress = this.calculateTimeBasedProgress(elapsed);
			
			// Only update target if we haven't received hints recently
			if (this.progressHint === 0 || Math.abs(timeBasedProgress - this.progressHint) < 10) {
				this.targetProgress = timeBasedProgress;
			}
		}
		
		// Smooth interpolation to target
		const diff = this.targetProgress - this.currentProgress;
		if (Math.abs(diff) > 0.1) {
			this.currentProgress += diff * this.velocitySmoothing;
		} else {
			this.currentProgress = this.targetProgress;
		}
		
		// Update visual
		this.updateVisualProgress(this.currentProgress);
		
		// Continue animation
		if (this.isRunning && (!this.isCompleting || this.currentProgress < 99.5)) {
			this.animationId = requestAnimationFrame(() => this.animate());
		}
	}
	
	private updateVisualProgress(progress: number): void {
		const angle = (progress / 100) * 360;
		
		// Update CSS custom property
		this.element.progress.style.setProperty('--progress-angle', `${angle}deg`);
		
		// Update conic gradient
		this.element.progress.style.background = 
			`conic-gradient(#007acc ${angle}deg, rgba(0, 122, 204, 0.1) ${angle}deg)`;
		
		// Update opacity for smooth appearance
		this.element.progress.style.opacity = progress > 0 ? '1' : '0';
	}
	
	private activateElement(): void {
		this.element.circle.classList.add('active');
		this.element.label.classList.add('active');
		this.element.progress.style.opacity = '1';
	}
	
	private markAsCompleted(): void {
		// Smooth transition to completed state
		setTimeout(() => {
			this.element.circle.classList.remove('active');
			this.element.circle.classList.add('completed');
			this.element.label.classList.remove('active');
			this.element.label.classList.add('completed');
			
			// Mark connector as completed if it exists
			const stepElement = this.element.circle.closest('.workflow-step');
			const connector = stepElement?.querySelector('.step-connector') as HTMLElement;
			if (connector) {
				connector.classList.add('completed');
			}
		}, 200);
	}
	
	private reset(): void {
		this.currentProgress = 0;
		this.targetProgress = 0;
		this.progressHint = 0;
		this.updateVisualProgress(0);
	}
	
	stop(): void {
		this.isRunning = false;
		if (this.animationId !== null) {
			cancelAnimationFrame(this.animationId);
			this.animationId = null;
		}
	}
	
	// Easing functions for natural animation
	private easeOutQuart(t: number): number {
		return 1 - Math.pow(1 - t, 4);
	}
	
	
}

export class SmoothProgressController {
	private activeAnimations: Map<number, AnimationController> = new Map();
	
	startProgress(stepIndex: number, estimatedDurationMs: number = 25000): void {
		const element = this.getProgressElement(stepIndex);
		if (!element) return;
		
		// Create animation controller
		const controller = new AnimationController(element, estimatedDurationMs);
		this.activeAnimations.set(stepIndex, controller);
		
		// Start smooth animation
		controller.start();
		
		console.log(`🔄 Started smooth progress for step ${stepIndex}`);
	}
	
	// Call this when you receive streaming chunks (for progress hints)
	updateStreamingHint(stepIndex: number, contentLength: number): void {
		const controller = this.activeAnimations.get(stepIndex);
		if (!controller) return;
		
		// Provide a hint to the controller about progress
		// This doesn't directly set progress but influences the speed
		const estimatedProgress = Math.min((contentLength / 2000) * 85, 85); // Cap at 85%
		controller.updateProgressHint(estimatedProgress);
	}
	
	// Call this when streaming is complete
	completeProgress(stepIndex: number): Promise<void> {
		const controller = this.activeAnimations.get(stepIndex);
		if (!controller) return Promise.resolve();
		
		// Smoothly animate to 100%
		return controller.complete().then(() => {
			this.activeAnimations.delete(stepIndex);
			console.log(`✅ Completed progress for step ${stepIndex}`);
		});
	}
	
	private getProgressElement(stepIndex: number): ProgressElement | null {
		// Get the DOM element for this step
		const stepElement = document.querySelector(`.workflow-step:nth-child(${stepIndex + 1})`);
		if (!stepElement) return null;
		
		const circle = stepElement.querySelector('.step-circle') as HTMLElement;
		const progress = stepElement.querySelector('.step-progress') as HTMLElement;
		const label = stepElement.querySelector('.step-label') as HTMLElement;
		
		if (!circle || !progress || !label) return null;
		
		return { circle, progress, label };
	}
}

export class UIService {
		private thinkingIndicator!: HTMLElement;
		private workflowProgress!: HTMLElement;
		private workflowSteps: Array<{ name: string; completed: boolean; progress: number }> = [];
		private progressAnimations: Map<number, any> = new Map();
		private progressController: SmoothProgressController = new SmoothProgressController();

	createLayout(container: HTMLElement): { 
		messageList: HTMLElement; 
		inputContainer: HTMLElement; 
	} {
			// Create main chat container
			const chatContainer = append(container, $('.chat-container'));

			// Message list with scrolling (like the HTML version)
			const messageList = append(chatContainer, $('.chat-messages'));
			messageList.id = 'messages';

			// Create thinking indicator
			this.createThinkingIndicator(messageList);

			// Create floating input container at bottom (like Cursor/Claude)
			const inputContainer = append(chatContainer, $('.chat-input-container'));

		return { messageList, inputContainer };
	}

	createInputContainer(container: HTMLElement, onSend: () => void, onInputChange: (value: string) => void): { 
			inputBox: HTMLTextAreaElement; 
		sendButton: HTMLButtonElement; 
	} {
			// Create input wrapper
			const inputWrapper = append(container, $('.input-wrapper'));

			// Model selector section (like the HTML)
			const modelSelector = append(inputWrapper, $('.model-selector'));
			
			// Model section
			const modelSection = append(modelSelector, $('.model-section'));
			const modelLabel = append(modelSection, $('span.model-label'));
			modelLabel.textContent = 'Model';
			
			const modelDropdown = append(modelSection, $('select.model-dropdown')) as HTMLSelectElement;
			modelDropdown.id = 'modelSelect';
			
			// Add model options
			const models = [
				{ value: 'gpt-4', label: 'GPT-4' },
				{ value: 'gpt-4-turbo', label: 'GPT-4 Turbo' },
				{ value: 'claude-3-sonnet', label: 'Claude 3 Sonnet' },
				{ value: 'claude-3-haiku', label: 'Claude 3 Haiku' },
				{ value: 'gpt-3.5-turbo', label: 'GPT-3.5 Turbo' }
			];
			
			models.forEach(model => {
				const option = document.createElement('option');
				option.value = model.value;
				option.textContent = model.label;
				modelDropdown.appendChild(option);
			});

			// Mode section
			const modeSection = append(modelSelector, $('.mode-section'));
			const modeToggle = append(modeSection, $('.mode-toggle'));
			
			const helperBtn = append(modeToggle, $('button.mode-btn')) as HTMLButtonElement;
			helperBtn.textContent = 'Helper';
			helperBtn.setAttribute('data-mode', 'helper');
			
			const builderBtn = append(modeToggle, $('button.mode-btn.active')) as HTMLButtonElement;
			builderBtn.textContent = 'Builder';
			builderBtn.setAttribute('data-mode', 'builder');

			// Input row
			const inputRow = append(inputWrapper, $('.input-row'));
			
			// Auto-resizing textarea (like the HTML)
			const inputBox = append(inputRow, $('textarea.chat-input')) as HTMLTextAreaElement;
			inputBox.id = 'chatInput';
			inputBox.placeholder = 'Ask me to build something...';
			inputBox.rows = 1;

		// Send button
			const sendButton = append(inputRow, $('button.send-button')) as HTMLButtonElement;
			sendButton.id = 'sendButton';
			sendButton.disabled = true;
			
			// Add send icon with safeSetInnerHtml
			const sendIcon = document.createElement('div');
			safeSetInnerHtml(sendIcon, `
				<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
					<path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>
				</svg>
			`);
			sendButton.appendChild(sendIcon);

			// Handle input changes (without auto-resize)
		inputBox.addEventListener('input', () => {
				// Update send button state
				const hasContent = inputBox.value.trim().length > 0;
				sendButton.disabled = !hasContent;
				sendButton.classList.toggle('active', hasContent);
				
			onInputChange(inputBox.value);
		});

			// Event listeners
			inputBox.addEventListener('keydown', (e) => {
			if (e.key === 'Enter' && !e.shiftKey) {
				e.preventDefault();
				onSend();
			}
		});

		sendButton.addEventListener('click', onSend);

			// Mode toggle handlers
			helperBtn.addEventListener('click', () => {
				helperBtn.classList.add('active');
				builderBtn.classList.remove('active');
			});

			builderBtn.addEventListener('click', () => {
				builderBtn.classList.add('active');
				helperBtn.classList.remove('active');
			});

		return { inputBox, sendButton };
	}

		createThinkingIndicator(messageList: HTMLElement): void {
			this.thinkingIndicator = append(messageList, $('.typing-indicator'));
			this.thinkingIndicator.id = 'typingIndicator';
			this.thinkingIndicator.style.display = 'none';
			
			// Create typing dots (like the HTML)
			const dotsContainer = append(this.thinkingIndicator, $('.typing-dots'));
		for (let i = 0; i < 3; i++) {
				append(dotsContainer, $('.typing-dot'));
		}
		
			const textSpan = append(this.thinkingIndicator, $('span'));
			textSpan.textContent = 'Thinking...';
	}

	showWelcomeMessage(messageList: HTMLElement): void {
			const welcomeScreen = append(messageList, $('.welcome-screen'));
			welcomeScreen.id = 'welcomeScreen';
			
			const title = append(welcomeScreen, $('.welcome-title'));
			title.textContent = 'Welcome to Rune';
			
			const subtitle = append(welcomeScreen, $('.welcome-subtitle'));
			subtitle.textContent = "I'm your AI development companion. I think before I code—generating requirements, design, and tasks before building.";
			
			const suggestions = append(welcomeScreen, $('.welcome-suggestions'));
			
			const suggestionCards = [
				{ title: 'Build Auth System', desc: 'Create a complete user authentication flow with JWT tokens', prompt: 'Build a user authentication system' },
				{ title: 'REST API Design', desc: 'Design and implement a RESTful API with CRUD operations', prompt: 'Create a REST API for a blog' },
				{ title: 'React Dashboard', desc: 'Create a modern dashboard with charts and data visualization', prompt: 'Build a React dashboard' },
				{ title: 'DevOps Setup', desc: 'Configure automated testing and deployment pipeline', prompt: 'Set up CI/CD pipeline' }
			];
			
			suggestionCards.forEach(card => {
				const cardElement = append(suggestions, $('.suggestion-card'));
				cardElement.addEventListener('click', () => this.sendSuggestion(card.prompt));
				
				const cardTitle = append(cardElement, $('.suggestion-title'));
				cardTitle.textContent = card.title;
				
				const cardDesc = append(cardElement, $('.suggestion-desc'));
				cardDesc.textContent = card.desc;
			});
		}

		// Smooth workflow progress updates with proper animations
		updateWorkflowStepProgress(stepIndex: number, progressPercent: number): void {
			if (!this.workflowProgress || stepIndex >= this.workflowSteps.length) return;
			
			const steps = this.workflowProgress.querySelectorAll('.workflow-step');
			const step = steps[stepIndex] as HTMLElement;
			if (!step) return;
			
			const circle = step.querySelector('.step-circle') as HTMLElement;
			const progress = step.querySelector('.step-progress') as HTMLElement;
			const label = step.querySelector('.step-label') as HTMLElement;
			
			// Cancel any existing animation for this step
			if (this.progressAnimations.has(stepIndex)) {
				this.progressAnimations.get(stepIndex)?.cancel();
			}
			
			// Mark as active if not already
			if (!circle.classList.contains('active')) {
				circle.classList.add('active');
				label.classList.add('active');
			}
			
			// Update internal progress tracking
			this.workflowSteps[stepIndex].progress = progressPercent;
			
			// Create smooth progress animation using Web Animations API
			const targetAngle = (progressPercent / 100) * 360;
			const currentAngle = parseFloat(progress.style.getPropertyValue('--progress-angle') || '0');
			
			const animation = progress.animate([
				{ '--progress-angle': `${currentAngle}deg` },
				{ '--progress-angle': `${targetAngle}deg` }
			], {
				duration: 300,
				easing: 'cubic-bezier(0.4, 0, 0.2, 1)',
				fill: 'forwards'
			});
			
			this.progressAnimations.set(stepIndex, animation);
			
			// Update CSS custom property for compatibility
			progress.style.setProperty('--progress-angle', `${targetAngle}deg`);
			
			// If progress is complete, mark as completed with smooth transition
			if (progressPercent >= 100) {
				animation.finished.then(() => {
					setTimeout(() => {
						circle.classList.remove('active');
						circle.classList.add('completed');
						label.classList.remove('active');
						label.classList.add('completed');
						
						const connector = step.querySelector('.step-connector') as HTMLElement;
						if (connector) {
							connector.classList.add('completed');
						}
						
						this.workflowSteps[stepIndex].completed = true;
					}, 200);
				});
			}
		}

		// Enhanced progress animation with streaming integration
		updateWorkflowProgressStreaming(stepIndex: number, contentLength: number, isComplete: boolean = false): void {
			if (isComplete) {
				// Complete the progress smoothly
				this.completeProgress(stepIndex);
			} else {
				// Update progress hint based on streaming content
				this.progressController.updateStreamingHint(stepIndex, contentLength);
			}
		}

		completeWorkflowStep(stepIndex: number): void {
			this.updateWorkflowStepProgress(stepIndex, 100);
		}

		// New method for independent time-based progress
		startIndependentProgress(stepIndex: number, durationMs: number = 25000): void {
			// Use the new smooth progress controller
			this.progressController.startProgress(stepIndex, durationMs);
			console.log(`🎯 Started ultra-smooth progress for step ${stepIndex}, duration: ${durationMs}ms`);
		}

		// Method to complete the progress when streaming ends
		async completeProgress(stepIndex: number): Promise<void> {
			try {
				await this.progressController.completeProgress(stepIndex);
				console.log(`✅ Smoothly completed progress for step ${stepIndex}`);
			} catch (error) {
				console.error(`❌ Error completing progress for step ${stepIndex}:`, error);
			}
		}

		resetWorkflowProgress(): void {
			if (!this.workflowProgress) return;
			
			// Stop all active animations in the progress controller
			this.workflowSteps.forEach((_, index) => {
				const controller = this.progressController as any;
				if (controller.activeAnimations && controller.activeAnimations.has(index)) {
					controller.activeAnimations.get(index).stop();
					controller.activeAnimations.delete(index);
				}
			});
			
			const steps = this.workflowProgress.querySelectorAll('.workflow-step');
			steps.forEach((step) => {
				const circle = step.querySelector('.step-circle') as HTMLElement;
				const progress = step.querySelector('.step-progress') as HTMLElement;
				const label = step.querySelector('.step-label') as HTMLElement;
				const connector = step.querySelector('.step-connector') as HTMLElement;
				
				circle.classList.remove('active', 'completed');
				label.classList.remove('active', 'completed');
				if (progress) {
					progress.style.setProperty('--progress-angle', '0deg');
					progress.style.opacity = '0';
				}
				connector?.classList.remove('completed');
			});
			
			this.workflowSteps.forEach(step => {
				step.completed = false;
				step.progress = 0;
			});
		}

		hideWorkflowProgress(): void {
			if (this.workflowProgress) {
				this.workflowProgress.style.display = 'none';
			}
		}

		showWorkflowProgress(messageList: HTMLElement): void {
			if (this.workflowProgress) {
				this.workflowProgress.style.display = 'flex';
				this.resetWorkflowProgress(); // Reset when showing
			} else {
				this.workflowSteps = [
					{ name: 'Requirements', completed: false, progress: 0 },
					{ name: 'Design', completed: false, progress: 0 },
					{ name: 'Tasks', completed: false, progress: 0 },
					{ name: 'Code', completed: false, progress: 0 }
				];
				
				this.workflowProgress = append(messageList, $('.workflow-progress'));
				this.workflowProgress.id = 'workflowProgress';
				
				this.workflowSteps.forEach((step, index) => {
					const stepDiv = append(this.workflowProgress, $('.workflow-step'));
					
					const stepCircle = append(stepDiv, $('.step-circle'));
					stepCircle.textContent = (index + 1).toString();
					
					const stepProgress = append(stepCircle, $('.step-progress'));
					stepProgress.style.setProperty('--progress-angle', '0deg');
					
					const stepLabel = append(stepDiv, $('.step-label'));
					stepLabel.textContent = step.name;
					
					if (index < this.workflowSteps.length - 1) {
						append(stepDiv, $('.step-connector'));
					}
				});
				
				// Animate steps appearing with stagger
				setTimeout(() => {
					const steps = this.workflowProgress.querySelectorAll('.workflow-step');
					steps.forEach((step, index) => {
						setTimeout(() => {
							step.classList.add('visible');
							if (index > 0) {
								const prevConnector = steps[index - 1].querySelector('.step-connector');
								if (prevConnector) {
									prevConnector.classList.add('visible');
								}
							}
						}, index * 150); // Reduced delay for smoother appearance
					});
				}, 100);
			}
		}

		// Remove the old simulateWorkflowExecution method since we're using real-time updates

		showThinkingIndicator(): void {
			if (this.thinkingIndicator) {
				this.thinkingIndicator.style.display = 'flex';
			}
		}

		hideThinkingIndicator(): void {
			if (this.thinkingIndicator) {
				this.thinkingIndicator.style.display = 'none';
			}
		}

		updateConnectionStatus(connected: boolean, message: string): void {
			console.log(`🔗 Connection status: ${connected ? 'Connected' : 'Disconnected'} - ${message}`);
		}

		updateSendButton(sendButton: HTMLButtonElement, hasContent: boolean, isConnected: boolean, isGenerating: boolean = false): void {
			const isEnabled = hasContent && isConnected;
			
			sendButton.disabled = !isEnabled;
			sendButton.classList.toggle('active', hasContent);
			
			// Update button state based on generation status
			if (isGenerating) {
				sendButton.classList.add('stop-mode');
				sendButton.innerHTML = '';
				const stopIcon = document.createElement('div');
				safeSetInnerHtml(stopIcon, `
					<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
						<rect x="3" y="3" width="18" height="18" rx="2"/>
					</svg>
				`);
				sendButton.appendChild(stopIcon);
			} else {
				sendButton.classList.remove('stop-mode');
				sendButton.innerHTML = '';
				const sendIcon = document.createElement('div');
				safeSetInnerHtml(sendIcon, `
					<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
						<path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>
					</svg>
				`);
				sendButton.appendChild(sendIcon);
			}
	}

	scrollToBottom(messageList: HTMLElement): void {
		setTimeout(() => {
			messageList.scrollTop = messageList.scrollHeight;
		}, 100);
	}

	getMessageElement(messageList: HTMLElement, messageId: string): HTMLElement | null {
			const messages = messageList.querySelectorAll('.message');
		for (const message of messages) {
			if (message.getAttribute('data-message-id') === messageId) {
				return message as HTMLElement;
			}
		}
		return null;
	}

		private sendSuggestion(text: string): void {
			const inputBox = document.getElementById('chatInput') as HTMLTextAreaElement;
			const sendButton = document.getElementById('sendButton') as HTMLButtonElement;
			
			if (inputBox && sendButton) {
				inputBox.value = text;
				inputBox.style.height = 'auto';
				inputBox.style.height = Math.min(inputBox.scrollHeight, 120) + 'px';
				sendButton.disabled = false;
				sendButton.classList.add('active');
				inputBox.focus();
			}
	}

	addModernStyles(): void {
		if (document.getElementById('ai-companion-modern-styles')) return;

		const styles = document.createElement('style');
		styles.id = 'ai-companion-modern-styles';
		styles.textContent = this.getModernStylesheet();
		document.head.appendChild(styles);
	}

	applyBeautifulTheme(container: HTMLElement): void {
			container.style.background = '#0a0a0a';
		container.style.minHeight = '100%';
			container.style.color = '#e5e5e5';
	}

	private getModernStylesheet(): string {
		return `
				/* Rune AI Chat Styles - Smooth & Polished */
			.ai-companion-chat-view {
					font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'SF Pro Display', Roboto, sans-serif;
					background: #0a0a0a;
					color: #e5e5e5;
					height: 100%;
					overflow: hidden;
					font-size: 14px;
					line-height: 1.5;
				}

				.chat-container {
				display: flex;
				flex-direction: column;
					height: 100%;
					max-width: 800px;
					margin: 0 auto;
					background: #0a0a0a;
				}

				.chat-messages {
					flex: 1;
					overflow-y: auto;
					padding: 16px 24px 80px 24px;
					scroll-behavior: smooth;
					min-height: 0;
				}

				.chat-messages::-webkit-scrollbar {
					width: 6px;
				}

				.chat-messages::-webkit-scrollbar-track {
					background: transparent;
				}

				.chat-messages::-webkit-scrollbar-thumb {
					background: #2a2a2a;
					border-radius: 3px;
				}

				.message {
					margin-bottom: 20px;
					position: relative;
					max-width: 100%;
				}

				.message.user {
					background: #1a1a1a;
					border: 1px solid #2d2d30;
					border-radius: 8px;
					padding: 12px 16px;
					margin-bottom: 12px;
					position: relative;
				cursor: pointer;
				transition: all 0.2s ease;
				}

				.message.user:hover {
					background: #1e1e1e;
					border-color: #333;
				}

				.message.user .message-content {
					color: #ffffff;
					font-weight: 400;
					max-height: 60px;
				overflow: hidden;
					transition: max-height 0.3s ease;
				}

				.message.user.expanded .message-content {
					max-height: none;
				}

				.message.assistant::before {
					content: '';
					position: absolute;
					left: -12px;
					top: 2px;
					width: 2px;
					height: 16px;
					background: #007acc;
					border-radius: 1px;
					opacity: 0.8;
				}

				.message-content {
					font-size: 13px;
					line-height: 1.5;
					color: #d4d4d4;
					white-space: pre-wrap;
					font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
				}

				.message.assistant .message-content {
					color: #cccccc;
				}

				.typing-indicator {
					display: none;
				align-items: center;
					gap: 8px;
					padding: 16px 0;
					color: #666;
					font-size: 13px;
				}

				.typing-dots {
					display: flex;
					gap: 4px;
				}

				.typing-dot {
					width: 4px;
					height: 4px;
					background: #666;
				border-radius: 50%;
					animation: typing 1.4s infinite;
				}

				.typing-dot:nth-child(2) { animation-delay: 0.2s; }
				.typing-dot:nth-child(3) { animation-delay: 0.4s; }

				@keyframes typing {
					0%, 60%, 100% { opacity: 0.3; }
					30% { opacity: 1; }
				}

				.chat-input-container {
					padding: 12px 16px 16px;
					border-top: 1px solid #1a1a1a;
					background: rgba(10, 10, 10, 0.8);
					backdrop-filter: blur(20px);
				flex-shrink: 0;
					min-height: 60px;
			}

				.input-wrapper {
					position: relative;
				display: flex;
				flex-direction: column;
					background: #111;
					border: 1px solid #2a2a2a;
					border-radius: 8px;
					transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
					overflow: hidden;
					select: none;
					outline: none;
				}

				/* Remove focus outline and improve focus state */
				.input-wrapper:focus-within {
					border-color: transparent;
					box-shadow: none;
					outline: none;
					select: none;
				}
				
				/* Remove outline from textarea itself */
				.chat-input:focus {
					outline: none;
					border: none;
					box-shadow: none;
					select: none;
				}
				
				/* Prevent textarea from growing */
				.chat-input {
					resize: none;
				overflow-y: auto;
					select: none;
					outline: none;
				}

				/* Modern, minimal model selector */
				.model-selector {
					padding: 6px 8px;
					display: flex;
					align-items: center;
					justify-content: space-between;
					background: transparent;
					border-bottom: 1px solid rgba(255, 255, 255, 0.05);
				}

				.model-section {
				display: flex;
				align-items: center;
				gap: 6px;
				}

				.mode-section {
					display: flex;
					align-items: center;
					gap: 4px;
				}

				/* Ultra-minimal mode toggle */
				.mode-toggle {
					display: flex;
					background: rgba(255, 255, 255, 0.03);
					border-radius: 4px;
					border: 1px solid rgba(255, 255, 255, 0.08);
					overflow: hidden;
					transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
				}

				.mode-toggle:hover {
					background: rgba(255, 255, 255, 0.05);
					border-color: rgba(255, 255, 255, 0.12);
				}

				.mode-btn {
					background: transparent;
					border: none;
					color: rgba(255, 255, 255, 0.5);
					font-size: 9px;
				font-weight: 500;
					padding: 3px 6px;
					cursor: pointer;
					transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
					text-transform: uppercase;
					letter-spacing: 0.4px;
					outline: none;
					position: relative;
				}

				.mode-btn:hover {
					color: rgba(255, 255, 255, 0.7);
				}

				.mode-btn.active {
					background: rgba(255, 255, 255, 0.08);
					color: rgba(255, 255, 255, 0.9);
				}

				/* Sleek model dropdown */
				.model-dropdown {
					background: rgba(255, 255, 255, 0.03);
					border: 1px solid rgba(255, 255, 255, 0.08);
					color: rgba(255, 255, 255, 0.8);
					font-size: 10px;
					font-weight: 400;
					cursor: pointer;
					padding: 3px 6px;
					border-radius: 3px;
					transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
					min-width: 100px;
					outline: none;
					appearance: none;
					background-image: url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='m6 8 4 4 4-4'/%3e%3c/svg%3e");
					background-position: right 4px center;
					background-repeat: no-repeat;
					background-size: 12px;
					padding-right: 20px;
				}

				.model-dropdown:hover {
				background: rgba(255, 255, 255, 0.05);
					border-color: rgba(255, 255, 255, 0.12);
					color: rgba(255, 255, 255, 0.9);
				}

				.model-dropdown:focus {
					background: rgba(255, 255, 255, 0.05);
					border-color: rgba(255, 255, 255, 0.15);
					color: rgba(255, 255, 255, 0.9);
					box-shadow: 0 0 0 1px rgba(255, 255, 255, 0.1);
				}

				.model-dropdown option {
					background: #1a1a1a;
					color: rgba(255, 255, 255, 0.8);
					padding: 4px 8px;
				}

				/* Minimal model label */
				.model-label {
					font-size: 9px;
					color: rgba(255, 255, 255, 0.4);
					text-transform: uppercase;
					letter-spacing: 0.5px;
					font-weight: 500;
				}

				.input-row {
				display: flex;
					align-items: flex-end;
			}

				.chat-input {
				flex: 1;
					padding: 8px 12px;
					background: transparent;
					border: none;
					color: #e5e5e5;
					font-size: 14px;
					font-family: inherit;
					resize: none;
					outline: none;
					min-height: 32px;
					max-height: 80px;
					line-height: 1.4;
					select: none;
					outline: none;
				}

				.chat-input:focus {
					outline: none;
					border: none;
					box-shadow: none;
				}

				.chat-input::placeholder {
					color: #666;
				}

				.send-button {
					padding: 10px 12px;
					background: transparent;
					border: none;
					color: #666;
					cursor: pointer;
				display: flex;
				align-items: center;
				justify-content: center;
					transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
					margin: 2px;
					border-radius: 8px;
					outline: none;
					select: none;
				}

				.send-button:hover:not(:disabled) {
					background: #1a1a1a;
					color: #3b82f6;
					transform: scale(1.05);
				}

				.send-button:disabled {
					opacity: 0.4;
					cursor: not-allowed;
				}

				.send-button.active {
					color: #3b82f6;
				}

				.send-button.stop-mode {
					color: #ef4444;
				}

				.send-button.stop-mode:hover:not(:disabled) {
					background: rgba(239, 68, 68, 0.1);
					color: #ef4444;
				}

				.welcome-screen {
				display: flex;
					flex-direction: column;
					align-items: center;
					justify-content: center;
					height: 100%;
					text-align: center;
					padding: 40px;
				}

				.welcome-title {
					font-size: 24px;
				font-weight: 600;
					color: #f5f5f5;
					margin-bottom: 8px;
					letter-spacing: -0.02em;
				}

				.welcome-subtitle {
					font-size: 14px;
					color: #888;
					margin-bottom: 32px;
					max-width: 400px;
					line-height: 1.5;
				}

				.welcome-suggestions {
					display: grid;
					grid-template-columns: 1fr 1fr;
				gap: 12px;
					max-width: 500px;
					width: 100%;
				}

				.suggestion-card {
				padding: 16px;
					background: #111;
					border: 1px solid #1a1a1a;
					border-radius: 8px;
					cursor: pointer;
					transition: all 0.2s ease;
					text-align: left;
				}

				.suggestion-card:hover {
					background: #151515;
					border-color: #2a2a2a;
					transform: translateY(-1px);
				}

				.suggestion-title {
				font-size: 13px;
					font-weight: 500;
					color: #e5e5e5;
					margin-bottom: 4px;
				}

				.suggestion-desc {
					font-size: 12px;
					color: #888;
					line-height: 1.4;
				}

				/* SMOOTH WORKFLOW PROGRESS */
				.workflow-progress {
					display: flex;
					flex-direction: column;
					align-items: flex-start;
					margin: 8px 0;
				padding: 0;
					background: transparent;
					border: none;
					box-shadow: none;
					max-width: none;
					width: auto;
				}

				.workflow-step {
				display: flex;
				align-items: center;
					position: relative;
					opacity: 0;
					transform: translateY(-8px);
					transition: all 0.6s cubic-bezier(0.4, 0, 0.2, 1);
					margin-bottom: 14px;
					width: auto;
				}

				.workflow-step.visible {
					opacity: 1;
					transform: translateY(0);
				}

				.step-circle {
					width: 24px;
					height: 24px;
				border-radius: 50%;
					background: #0a0a0a;
					border: 2px solid #333;
				display: flex;
				align-items: center;
				justify-content: center;
					font-size: 10px;
					font-weight: 700;
					color: #666;
					position: relative;
					z-index: 10;
					transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
					box-shadow: none;
				}

				.step-circle.active {
					border-color:rgb(83, 83, 83);
					color: #007acc;
					background: #0a0a0a;
					transform: scale(1.05);
					box-shadow: 0 0 0 3px rgba(0, 122, 204, 0.08);
				}

				.step-circle.completed {
					background: linear-gradient(135deg, #16a34a, #22c55e);
					border-color: #16a34a;
					color: white;
					transform: scale(1.02);
					box-shadow: 0 0 0 2px rgba(22, 163, 74, 0.2);
				}

				.step-progress {
					position: absolute;
					top: -2px;
					left: -2px;
					width: calc(100% + 4px);
					height: calc(100% + 4px);
				border-radius: 50%;
					background: conic-gradient(#007acc var(--progress-angle, 0deg), rgba(0, 122, 204, 0.1) var(--progress-angle, 0deg));
					transition: all 0.1s ease;
					opacity: 0;
					transform: rotate(-90deg);
					z-index: 5;
				}

				.step-circle.active .step-progress {
					opacity: 1;
				}

				.step-label {
					margin-left: 12px;
					font-size: 12px;
					color: #666;
					text-transform: uppercase;
					letter-spacing: 0.3px;
					font-weight: 600;
					transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
					opacity: 0.7;
					white-space: nowrap;
				}

				.step-label.active {
					color: #007acc;
					opacity: 1;
				}

				.step-label.completed {
					color: #16a34a;
					opacity: 0.8;
				}

				.step-connector {
					position: absolute;
					left: 11px;
					top: 24px;
					width: 2px;
					height: 0;
					background: linear-gradient(180deg, #333, #2a2a2a);
					transition: all 0.5s cubic-bezier(0.4, 0, 0.2, 1);
					transform-origin: top;
					opacity: 0;
					z-index: 0;
				}

				.step-connector.visible {
					opacity: 1;
					height: 14px;
				}

				.step-connector.completed {
					background: linear-gradient(180deg, #16a34a, #22c55e);
					box-shadow: 0 0 4px rgba(22, 163, 74, 0.3);
				}

				/* Markdown styling */
				.message-content pre {
					background: #1e1e1e;
					border: 1px solid #333;
					border-radius: 6px;
					padding: 12px 16px;
					margin: 12px 0;
					overflow-x: auto;
					font-family: 'SF Mono', 'Monaco', 'Menlo', 'Consolas', 'Courier New', monospace;
				font-size: 13px;
					line-height: 1.4;
					color: #d4d4d4;
				}

				.message-content code {
					background: #2d2d30;
					color: #ce9178;
					padding: 2px 6px;
					border-radius: 4px;
					font-family: 'SF Mono', 'Monaco', 'Menlo', 'Consolas', 'Courier New', monospace;
					font-size: 12px;
				}

				.message-content pre code {
				background: transparent;
				padding: 0;
					color: #d4d4d4;
				}

				.message-content h1,
				.message-content h2,
				.message-content h3 {
					color: #ffffff;
					font-weight: 600;
					margin: 16px 0 8px 0;
					font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
				}

				.message-content h1 { font-size: 18px; }
				.message-content h2 { font-size: 16px; }
				.message-content h3 { font-size: 14px; }

				.message-content ul,
				.message-content ol {
					margin: 8px 0 8px 20px;
					color: #cccccc;
				}

				.message-content li {
					margin: 4px 0;
					line-height: 1.5;
				}

				.message-content a {
					color: #4fc3f7;
					text-decoration: none;
					transition: color 0.2s ease;
				}

				.message-content a:hover {
					text-decoration: underline;
					color: #29b6f6;
				}

				.message-content strong {
					color: #ffffff;
				font-weight: 600;
			}

				.message-content em {
					color: #e0e0e0;
					font-style: italic;
				}

				.message-content blockquote {
					border-left: 3px solid #007acc;
				padding-left: 12px;
				margin: 12px 0;
					color: #aaa;
					font-style: italic;
				}

				/* Additional markdown enhancements */
				.message-content br {
					display: block;
					margin: 4px 0;
				}

				.message-content p {
					margin: 8px 0;
					line-height: 1.6;
				}

				.message-content ul ul,
				.message-content ol ol {
					margin-left: 20px;
				}

				.message-content ul li,
				.message-content ol li {
					margin: 4px 0;
					line-height: 1.5;
				}

				/* Ensure emojis display properly */
				.message-content {
					font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Segoe UI Emoji', 'Segoe UI Symbol', sans-serif;
				}

				/* Smooth transitions for all interactive elements */
				* {
					transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1);
				}

				/* Remove all focus outlines that aren't custom */
				button:focus,
				select:focus,
				textarea:focus,
				input:focus,
				.ai-input-textarea:focus,
				.ai-input-container:focus-within,
				.ai-input-textarea:focus-visible,
				.ai-input-container:focus-within .ai-input-textarea {
					outline: none !important;
					border-color: transparent !important;
					box-shadow: none !important;
					--vscode-focusBorder: transparent !important;
				}

				/* Custom focus states */
				.mode-btn:focus-visible {
					box-shadow: 0 0 0 2px rgba(0, 122, 204, 0.4);
				}

				.send-button:focus-visible {
					box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.4);
				}

				.suggestion-card:focus-visible {
					outline: 2px solid rgba(0, 122, 204, 0.4);
					outline-offset: 2px;
				}

				/* Animation for message appearance */
				.message {
					animation: messageSlideIn 0.3s cubic-bezier(0.4, 0, 0.2, 1);
				}

				@keyframes messageSlideIn {
				from {
					opacity: 0;
						transform: translateY(10px);
				}
				to {
					opacity: 1;
					transform: translateY(0);
				}
			}

				/* Hover effects */
				.message.user:hover {
					transform: translateX(2px);
				}

				.suggestion-card:hover {
					box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
				}

				/* Loading states */
				.step-circle.active::after {
					content: '';
					position: absolute;
					top: -3px;
					left: -3px;
					right: -3px;
					bottom: -3px;
					border-radius: 50%;
					border: 1px solid transparent;
					background: linear-gradient(45deg, transparent, rgba(0, 122, 204, 0.3), transparent);
					animation: borderRotate 2s linear infinite;
					z-index: -1;
				}

				@keyframes borderRotate {
					0% { transform: rotate(0deg); }
					100% { transform: rotate(360deg); }
				}

				/* Responsive design */
				@media (max-width: 768px) {
					.chat-container {
						max-width: 100%;
					}
					
					.chat-messages {
						padding: 12px 16px 80px;
					}
					
					.welcome-suggestions {
						grid-template-columns: 1fr;
					}
					
					.workflow-progress {
						transform: scale(0.9);
				margin: 4px 0;
					}

					.step-circle {
						width: 20px;
						height: 20px;
						font-size: 9px;
					}

					.step-label {
						font-size: 11px;
					}
				}

				/* High contrast mode support */
				@media (prefers-contrast: high) {
					.step-circle {
						border-width: 3px;
					}
					
					.step-progress {
						filter: contrast(1.5);
					}
				}

				/* Enhanced ultra-smooth progress animations */
				.step-progress {
					position: absolute;
					top: -2px;
					left: -2px;
					width: calc(100% + 4px);
					height: calc(100% + 4px);
					border-radius: 50%;
					background: conic-gradient(#007acc var(--progress-angle, 0deg), rgba(0, 122, 204, 0.1) var(--progress-angle, 0deg));
					transform: rotate(-90deg);
					opacity: 0;
					z-index: 5;
					transition: opacity 0.3s cubic-bezier(0.4, 0, 0.2, 1);
					--progress-angle: 0deg;
				}

				.step-circle.active .step-progress {
					opacity: 1;
					box-shadow: 
						0 0 0 1px rgba(0, 122, 204, 0.2),
						0 0 8px rgba(0, 122, 204, 0.15),
						inset 0 0 0 1px rgba(255, 255, 255, 0.1);
				}

				/* Enhanced active state with subtle pulse */
				.step-circle.active {
					border-color: #007acc;
					color: #007acc;
					background: #0a0a0a;
					transform: scale(1.05);
					transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
					animation: subtlePulse 2s ease-in-out infinite;
				}

				@keyframes subtlePulse {
					0%, 100% {
						box-shadow: 0 0 0 3px rgba(0, 122, 204, 0.08);
					}
					50% {
						box-shadow: 0 0 0 6px rgba(0, 122, 204, 0.04);
					}
				}

				/* Enhanced completion state */
				.step-circle.completed {
					background: linear-gradient(135deg, #16a34a, #22c55e);
					border-color: #16a34a;
					color: white;
					transform: scale(1.02);
					transition: all 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
					box-shadow: 
						0 0 0 2px rgba(22, 163, 74, 0.2),
						0 2px 8px rgba(22, 163, 74, 0.3);
				}

				/* Smooth label transitions */
				.step-label.active {
					color: #007acc;
					opacity: 1;
					transform: translateX(2px);
					transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
				}

				.step-label.completed {
					color: #16a34a;
					opacity: 0.9;
					transform: translateX(0);
					transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
				}

				/* Enhanced connector animations */
				.step-connector.completed {
					background: linear-gradient(180deg, #16a34a, #22c55e);
					box-shadow: 0 0 4px rgba(22, 163, 74, 0.3);
					animation: connectorGlow 1s ease-out;
				}

				@keyframes connectorGlow {
					0% {
						box-shadow: 0 0 4px rgba(22, 163, 74, 0.3);
					}
					50% {
						box-shadow: 0 0 8px rgba(22, 163, 74, 0.6);
					}
					100% {
						box-shadow: 0 0 4px rgba(22, 163, 74, 0.3);
					}
				}

				/* Reduced motion support */
				@media (prefers-reduced-motion: reduce) {
					.workflow-step,
					.step-circle,
					.step-progress,
					.message,
					.suggestion-card {
						transition-duration: 0.1s;
						animation-duration: 0.1s;
					}
					
					.step-circle.active::after {
						animation: none;
					}
					
					.step-circle.active {
						animation: none;
					}
			}
		`;
	}
}