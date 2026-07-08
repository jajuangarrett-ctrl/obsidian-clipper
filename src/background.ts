import browser from 'webextension-polyfill';

const PENDING_CONTEXT_KEY = 'fjgTaskClipperPendingContext';

type PendingContext = {
	selection: string;
	title: string;
	url: string;
	createdAt: number;
	mode?: 'create' | 'update';
	sourceKind?: 'web' | 'email';
};

async function setupContextMenus(): Promise<void> {
	await browser.contextMenus.removeAll();
	await browser.contextMenus.create({
		id: 'fjg-create-task-selection',
		title: 'Create Obsidian task from selection',
		contexts: ['selection'],
	});
	await browser.contextMenus.create({
		id: 'fjg-update-task-selection',
		title: 'Add selection as task update',
		contexts: ['selection'],
	});
	await browser.contextMenus.create({
		id: 'fjg-create-task-page',
		title: 'Create Obsidian task from page',
		contexts: ['page'],
	});
}

async function openPopup(): Promise<void> {
	const action = typeof chrome !== 'undefined' ? chrome.action : undefined;
	if (action && typeof action.openPopup === 'function') {
		try {
			await (action.openPopup() as Promise<void> | void);
			return;
		} catch {
			// Chrome only allows openPopup in some user-gesture paths.
		}
	}
	await browser.tabs.create({ url: browser.runtime.getURL('popup.html') });
}

async function savePendingContext(context: PendingContext): Promise<void> {
	await browser.storage.local.set({ [PENDING_CONTEXT_KEY]: context });
}

browser.runtime.onInstalled.addListener(() => {
	setupContextMenus().catch((error) => console.error('Failed to set task clipper menu:', error));
});

browser.runtime.onStartup.addListener(() => {
	setupContextMenus().catch((error) => console.error('Failed to set task clipper menu:', error));
});

browser.contextMenus.onClicked.addListener(async (info, tab) => {
	if (
		info.menuItemId !== 'fjg-create-task-selection' &&
		info.menuItemId !== 'fjg-update-task-selection' &&
		info.menuItemId !== 'fjg-create-task-page'
	) {
		return;
	}

	const page = await readPageContext(tab, info.pageUrl || tab?.url || '');
	await savePendingContext({
		selection: info.selectionText || '',
		title: page.title || tab?.title || '',
		url: page.url || info.pageUrl || tab?.url || '',
		createdAt: Date.now(),
		mode: info.menuItemId === 'fjg-update-task-selection' ? 'update' : 'create',
		sourceKind: page.sourceKind,
	});
	await openPopup();
});

async function readPageContext(tab: browser.Tabs.Tab | undefined, fallbackUrl: string): Promise<Pick<PendingContext, 'title' | 'url' | 'sourceKind'>> {
	if (!tab?.id) {
		return {
			title: tab?.title || '',
			url: fallbackUrl,
			sourceKind: isEmailUrl(fallbackUrl) ? 'email' : 'web',
		};
	}

	try {
		const results = await browser.scripting.executeScript({
			target: { tabId: tab.id },
			func: () => {
				const url = location.href || '';
				const email = isEmailPage(url);
				return {
					title: email ? extractEmailSubject() || document.title || '' : document.title || '',
					url,
					sourceKind: email ? 'email' : 'web',
				};

				function isEmailPage(value: string): boolean {
					try {
						const parsed = new URL(value);
						const host = parsed.hostname.toLowerCase();
						return (
							host.includes('outlook.') ||
							host.includes('office.com') ||
							host.includes('office365.com') ||
							host.includes('mail.google.com') ||
							(host.includes('cloud.microsoft') && parsed.pathname.includes('/mail'))
						);
					} catch {
						return false;
					}
				}

				function extractEmailSubject(): string {
					const titleSubject = cleanSubject(document.title || '');
					if (looksLikeSubject(titleSubject)) return titleSubject;

					const selectors = [
						'[data-testid="message-subject"]',
						'[data-testid="conversation-subject"]',
						'[aria-label^="Subject"]',
						'[aria-label^="subject"]',
						'[role="heading"][aria-level="1"]',
						'[role="heading"][aria-level="2"]',
						'h1',
						'h2',
					];
					for (const selector of selectors) {
						const nodes = Array.from(document.querySelectorAll(selector));
						for (const node of nodes) {
							const text = cleanSubject(
								(node.textContent || '') ||
								(node.getAttribute('aria-label') || ''),
							);
							if (looksLikeSubject(text)) return text;
						}
					}
					return cleanSubject(document.title || '');
				}

				function cleanSubject(value: string): string {
					return String(value || '')
						.replace(/^subject\s*:?\s*/i, '')
						.replace(/\s*Summarize this email\s*$/i, '')
						.replace(/\s+-\s+[^-]+?\s+-\s+Outlook$/i, '')
						.replace(/\s+-\s+(Outlook|Microsoft Outlook|Microsoft Outlook Web App|Mail)$/i, '')
						.replace(/\s+/g, ' ')
						.trim();
				}

				function looksLikeSubject(value: string): boolean {
					if (!value || value.length < 3 || value.length > 240) return false;
					return !/^(Inbox|Mail|Outlook|Microsoft Outlook|Message|Reading Pane|Navigation pane|Navigation)$/i.test(value);
				}
			},
		});
		const result = results[0]?.result as Pick<PendingContext, 'title' | 'url' | 'sourceKind'> | undefined;
		return {
			title: result?.title || tab.title || '',
			url: result?.url || fallbackUrl,
			sourceKind: result?.sourceKind || (isEmailUrl(result?.url || fallbackUrl) ? 'email' : 'web'),
		};
	} catch {
		return {
			title: tab.title || '',
			url: fallbackUrl,
			sourceKind: isEmailUrl(fallbackUrl) ? 'email' : 'web',
		};
	}
}

function isEmailUrl(url: string): boolean {
	try {
		const parsed = new URL(url);
		const host = parsed.hostname.toLowerCase();
		return (
			host.includes('outlook.') ||
			host.includes('office.com') ||
			host.includes('office365.com') ||
			host.includes('mail.google.com') ||
			(host.includes('cloud.microsoft') && parsed.pathname.includes('/mail'))
		);
	} catch {
		return false;
	}
}

browser.runtime.onMessage.addListener((request: unknown) => {
	if (typeof request !== 'object' || request === null) return undefined;
	const message = request as { action?: string; url?: string };

	if (message.action === 'openObsidianUrl' && message.url) {
		return browser.tabs.create({ url: message.url, active: true })
			.then(() => {
				return { success: true };
			})
			.catch((error) => ({
				success: false,
				error: error instanceof Error ? error.message : String(error),
			}));
	}

	return undefined;
});
