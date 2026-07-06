import browser from 'webextension-polyfill';

const PENDING_CONTEXT_KEY = 'fjgTaskClipperPendingContext';

type PendingContext = {
	selection: string;
	title: string;
	url: string;
	createdAt: number;
};

async function setupContextMenus(): Promise<void> {
	await browser.contextMenus.removeAll();
	await browser.contextMenus.create({
		id: 'fjg-create-task-selection',
		title: 'Create Obsidian task from selection',
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
		info.menuItemId !== 'fjg-create-task-page'
	) {
		return;
	}

	await savePendingContext({
		selection: info.selectionText || '',
		title: tab?.title || '',
		url: info.pageUrl || tab?.url || '',
		createdAt: Date.now(),
	});
	await openPopup();
});

browser.runtime.onMessage.addListener((request: unknown) => {
	if (typeof request !== 'object' || request === null) return undefined;
	const message = request as { action?: string; url?: string };

	if (message.action === 'openObsidianUrl' && message.url) {
		return browser.tabs.query({ active: true, currentWindow: true })
			.then(async (tabs) => {
				const currentTab = tabs[0];
				if (currentTab?.id) {
					await browser.tabs.update(currentTab.id, { url: message.url });
					return { success: true };
				}
				await browser.tabs.create({ url: message.url });
				return { success: true };
			})
			.catch((error) => ({
				success: false,
				error: error instanceof Error ? error.message : String(error),
			}));
	}

	return undefined;
});
