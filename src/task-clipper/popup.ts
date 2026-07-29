import browser from '../utils/browser-polyfill';
import {
	PageContext,
	buildObsidianTaskContent,
	buildTaskLines,
	buildUpdateBlock,
} from './format';
import {
	TaskClipperSettings,
	loadOpenAiApiKey,
	loadTaskClipperSettings,
	saveTaskClipperSettings,
} from './storage';

const PENDING_CONTEXT_KEY = 'fjgTaskClipperPendingContext';
const PENDING_MAX_AGE_MS = 5 * 60 * 1000;
const MAX_OBSIDIAN_URL_LENGTH = 60000;

type PopupMode = 'create' | 'update';

type CreateTaskPayload = {
	version: 2;
	action: 'create-task-note';
	taskFolder: string;
	indexFile: string;
	title: string;
	details: string;
	status: string;
	project: string;
	tags: string[];
	source: PageContext;
	createdAt: string;
};

type AppendUpdatePayload = {
	version: 2;
	action: 'append-update';
	taskFolder: string;
	taskQuery: string;
	updateText: string;
	source: PageContext;
	createdAt: string;
};

type ProtocolPayload = CreateTaskPayload | AppendUpdatePayload;

let settings: TaskClipperSettings;
let mode: PopupMode = 'create';
let pageContext: PageContext = { title: '', url: '', sourceKind: 'web' };

const createTab = document.getElementById('create-tab') as HTMLButtonElement;
const updateTab = document.getElementById('update-tab') as HTMLButtonElement;
const createPanel = document.getElementById('create-panel') as HTMLElement;
const updatePanel = document.getElementById('update-panel') as HTMLElement;
const taskTitle = document.getElementById('task-title') as HTMLInputElement;
const generateTitleButton = document.getElementById('generate-title') as HTMLButtonElement;
const taskDetails = document.getElementById('task-details') as HTMLTextAreaElement;
const updateTaskQuery = document.getElementById('update-task-query') as HTMLInputElement;
const updateText = document.getElementById('update-text') as HTMLTextAreaElement;
const statusSelect = document.getElementById('status-select') as HTMLSelectElement;
const projectSelect = document.getElementById('project-select') as HTMLSelectElement;
const tagsField = document.getElementById('tags-field') as HTMLInputElement;
const tagOptions = document.getElementById('tag-options') as HTMLDataListElement;
const includeSource = document.getElementById('include-source') as HTMLInputElement;
const emailSourceGroup = document.getElementById('email-source-group') as HTMLElement;
const emailSubject = document.getElementById('email-subject') as HTMLInputElement;
const preview = document.getElementById('task-preview') as HTMLElement;
const taskCount = document.getElementById('task-count') as HTMLElement;
const notice = document.getElementById('notice') as HTMLElement;
const saveButton = document.getElementById('save-task') as HTMLButtonElement;

document.addEventListener('DOMContentLoaded', init);

async function init(): Promise<void> {
	settings = await loadTaskClipperSettings();
	const initial = await getInitialPageContext();
	pageContext = { title: initial.title, url: initial.url, sourceKind: initial.sourceKind };
	mode = initial.mode || 'create';

	const initialText = initial.selection || initial.title || '';
	taskDetails.value = initialText;
	taskTitle.value = firstLine(initialText) || initial.title || '';
	updateText.value = initial.selection || '';
	emailSubject.value = pageContext.sourceKind === 'email' ? cleanEmailSubject(pageContext.title) : '';
	tagsField.value = 'task';

	renderSelectors();
	bindEvents();
	setMode(mode);
	(mode === 'update' ? updateTaskQuery : taskTitle).focus();
}

function bindEvents(): void {
	document.getElementById('open-settings')?.addEventListener('click', () => {
		browser.runtime.openOptionsPage();
	});
	createTab.addEventListener('click', () => setMode('create'));
	updateTab.addEventListener('click', () => setMode('update'));
	saveButton.addEventListener('click', submit);
	generateTitleButton.addEventListener('click', generateTitle);

	for (const element of [
		taskTitle,
		taskDetails,
		updateTaskQuery,
		updateText,
		statusSelect,
		projectSelect,
		tagsField,
		includeSource,
		emailSubject,
	]) {
		element.addEventListener('input', renderPreview);
		element.addEventListener('change', renderPreview);
	}
}

function setMode(nextMode: PopupMode): void {
	mode = nextMode;
	createTab.classList.toggle('active', mode === 'create');
	updateTab.classList.toggle('active', mode === 'update');
	createPanel.classList.toggle('is-hidden', mode !== 'create');
	updatePanel.classList.toggle('is-hidden', mode !== 'update');
	saveButton.textContent = mode === 'create' ? 'Create Task' : 'Add Update';
	generateTitleButton.disabled = mode !== 'create';
	renderPreview();
}

function renderSelectors(): void {
	statusSelect.textContent = '';
	for (const status of settings.statuses) {
		const option = document.createElement('option');
		option.value = status.id;
		option.textContent = status.label;
		statusSelect.appendChild(option);
	}
	statusSelect.value = settings.defaultStatus;

	projectSelect.textContent = '';
	const empty = document.createElement('option');
	empty.value = '';
	empty.textContent = 'No project';
	projectSelect.appendChild(empty);
	for (const project of settings.projects) {
		const option = document.createElement('option');
		option.value = project;
		option.textContent = project;
		projectSelect.appendChild(option);
	}
	projectSelect.value = '';

	tagOptions.textContent = '';
	for (const tag of settings.tags) {
		const option = document.createElement('option');
		option.value = tag;
		tagOptions.appendChild(option);
	}
}

function renderPreview(): void {
	renderSourceControls();

	if (mode === 'update') {
		const block = buildUpdateBlock(updateText.value, sourceContext());
		preview.textContent = block || '(no update text yet)';
		taskCount.textContent = updateTaskQuery.value.trim() ? '1 update' : 'Choose task';
		return;
	}

	const content = getCreateTaskContent();
	preview.textContent = content || '(no task text yet)';
	const count = buildTaskLines(
		taskDetails.value || taskTitle.value,
		statusSelect.value,
		projectSelect.value,
		settings.statuses,
		normalizeTags(tagsField.value),
	).length;
	taskCount.textContent = `${count || 0} task${count === 1 ? '' : 's'}`;
}

function renderSourceControls(): void {
	const showEmailSubject = includeSource.checked && pageContext.sourceKind === 'email';
	emailSourceGroup.classList.toggle('is-hidden', !showEmailSubject);
}

async function submit(): Promise<void> {
	if (mode === 'update') return appendUpdate();
	return createTask();
}

async function createTask(): Promise<void> {
	const title = taskTitle.value.trim() || firstLine(taskDetails.value);
	const details = taskDetails.value.trim();
	if (!title && !details) return setNotice('Add task text first.', true);

	settings.defaultStatus = statusSelect.value || settings.defaultStatus;
	settings = await saveTaskClipperSettings(settings);

	const payload: CreateTaskPayload = {
		version: 2,
		action: 'create-task-note',
		taskFolder: settings.taskFolder,
		indexFile: settings.destinationFile,
		title: title || 'Clipped task',
		details,
		status: statusSelect.value,
		project: projectSelect.value,
		tags: normalizeTags(tagsField.value),
		source: sourceContext(),
		createdAt: new Date().toISOString(),
	};

	await sendPayload(payload, 'Task note sent to Obsidian.');
}

async function generateTitle(): Promise<void> {
	const sourceText = taskDetails.value.trim() || taskTitle.value.trim();
	if (!sourceText) return setNotice('Add task text first.', true);

	const apiKey = await loadOpenAiApiKey();
	if (!apiKey) {
		setNotice('Add an OpenAI API key in Options first.', true);
		browser.runtime.openOptionsPage();
		return;
	}

	const originalText = generateTitleButton.textContent;
	generateTitleButton.disabled = true;
	generateTitleButton.textContent = 'Generating...';
	setNotice('Generating title...');

	try {
		const suggested = await requestAiTitle({
			apiKey,
			model: settings.openAiModel,
			taskText: sourceText,
			sourceTitle: sourceContext().title,
			project: projectSelect.value,
			status: statusSelect.value,
		});
		taskTitle.value = suggested;
		renderPreview();
		setNotice('Title generated.');
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		setNotice(`Title generation failed: ${message}`, true);
	} finally {
		generateTitleButton.disabled = mode !== 'create';
		generateTitleButton.textContent = originalText || 'Generate';
	}
}

async function appendUpdate(): Promise<void> {
	const taskQuery = updateTaskQuery.value.trim();
	const text = updateText.value.trim();
	if (!taskQuery) return setNotice('Enter the task title or filename to update.', true);
	if (!text) return setNotice('Add update text first.', true);

	const payload: AppendUpdatePayload = {
		version: 2,
		action: 'append-update',
		taskFolder: settings.taskFolder,
		taskQuery,
		updateText: text,
		source: sourceContext(),
		createdAt: new Date().toISOString(),
	};

	await sendPayload(payload, 'Update sent to Obsidian.');
}

async function sendPayload(payload: ProtocolPayload, successMessage: string): Promise<void> {
	const url = buildObsidianUrl(payload, settings.vaultName);
	if (url.length > MAX_OBSIDIAN_URL_LENGTH) {
		const fallbackText = payload.action === 'append-update'
			? buildUpdateBlock(payload.updateText, payload.source, new Date(payload.createdAt))
			: getCreateTaskContent();
		await navigator.clipboard.writeText(fallbackText);
		return setNotice('Selection is too long for an Obsidian URL. Content copied instead.', true);
	}

	setNotice('Opening Obsidian...');
	const response = await browser.runtime.sendMessage({
		action: 'openObsidianUrl',
		url,
	}) as { success?: boolean; error?: string };

	if (!response?.success) {
		throw new Error(response?.error || 'Could not open Obsidian.');
	}

	setNotice(successMessage);
	setTimeout(() => window.close(), 700);
}

function getCreateTaskContent(): string {
	return buildObsidianTaskContent(
		taskDetails.value || taskTitle.value,
		statusSelect.value,
		projectSelect.value,
		settings.statuses,
		normalizeTags(tagsField.value),
		sourceContext(),
	);
}

function sourceContext(): PageContext {
	if (!includeSource.checked) return { title: '', url: '' };
	if (pageContext.sourceKind === 'email') {
		return {
			...pageContext,
			title: cleanEmailSubject(emailSubject.value || pageContext.title),
			sourceKind: 'email',
		};
	}
	return pageContext;
}

async function requestAiTitle(input: {
	apiKey: string;
	model: string;
	taskText: string;
	sourceTitle: string;
	project: string;
	status: string;
}): Promise<string> {
	const prompt = [
		'Create one concise action-oriented task title.',
		'Rules:',
		'- 6 to 12 words when possible.',
		'- Use sentence case.',
		'- No trailing period.',
		'- Do not include hashtags, status labels, or project prefixes.',
		'- Preserve important names, programs, and dates.',
		'- Return only the title text.',
		'',
		`Status: ${input.status || 'none'}`,
		`Project: ${input.project || 'none'}`,
		`Source title or email subject: ${input.sourceTitle || 'none'}`,
		'Task text:',
		input.taskText.slice(0, 4000),
	].join('\n');

	const response = await fetch('https://api.openai.com/v1/responses', {
		method: 'POST',
		headers: {
			'Authorization': `Bearer ${input.apiKey}`,
			'Content-Type': 'application/json',
		},
		body: JSON.stringify({
			model: input.model || 'gpt-4.1-mini',
			input: prompt,
			max_output_tokens: 40,
		}),
	});

	const data = await response.json().catch(() => ({}));
	if (!response.ok) {
		const errorMessage = typeof data?.error?.message === 'string'
			? data.error.message
			: `OpenAI request failed with HTTP ${response.status}`;
		throw new Error(errorMessage);
	}

	const title = cleanGeneratedTitle(extractResponseText(data));
	if (!title) throw new Error('OpenAI returned an empty title.');
	return title;
}

function extractResponseText(data: unknown): string {
	const record = data as {
		output_text?: string;
		output?: Array<{ content?: Array<{ text?: string; type?: string }> }>;
	};
	if (typeof record.output_text === 'string') return record.output_text;
	for (const item of record.output || []) {
		for (const content of item.content || []) {
			if (typeof content.text === 'string') return content.text;
		}
	}
	return '';
}

function cleanGeneratedTitle(value: string): string {
	return value
		.replace(/^["'`]+|["'`]+$/g, '')
		.replace(/^[-*]\s+/, '')
		.replace(/\s+/g, ' ')
		.trim()
		.replace(/[.。]+$/g, '')
		.slice(0, 120);
}

function normalizeTags(value: string): string[] {
	const tags = value
		.split(/[,\s]+/)
		.map((tag) => tag.trim().replace(/^#/, ''))
		.filter(Boolean);
	if (!tags.includes('task')) tags.unshift('task');
	return [...new Set(tags)];
}

function buildObsidianUrl(payload: ProtocolPayload, vaultName: string): string {
	const params = new URLSearchParams({
		payload: encodePayload(payload),
	});
	if (vaultName) params.set('vault', vaultName);
	return `obsidian://fjg-task-clipper?${params.toString()}`;
}

function encodePayload(payload: ProtocolPayload): string {
	const json = JSON.stringify(payload);
	const bytes = new TextEncoder().encode(json);
	let binary = '';
	for (const byte of bytes) binary += String.fromCharCode(byte);
	return btoa(binary)
		.replace(/\+/g, '-')
		.replace(/\//g, '_')
		.replace(/=+$/g, '');
}

function firstLine(value: string): string {
	return value
		.replace(/\r\n/g, '\n')
		.split('\n')
		.map((line) => line.trim())
		.find(Boolean) || '';
}

type InitialPageContext = PageContext & {
	selection: string;
	mode?: PopupMode;
};

async function getInitialPageContext(): Promise<InitialPageContext> {
	const pending = await takePendingContext();
	const active = await readActivePageContext();
	return {
		selection: pending.selection || active.selection,
		title: pending.title || active.title,
		url: pending.url || active.url,
		sourceKind: pending.sourceKind || active.sourceKind || 'web',
		mode: pending.mode || 'create',
	};
}

async function takePendingContext(): Promise<InitialPageContext> {
	const result = await browser.storage.local.get(PENDING_CONTEXT_KEY) as Record<string, (InitialPageContext & { createdAt?: number }) | undefined>;
	await browser.storage.local.remove(PENDING_CONTEXT_KEY);
	const pending = result[PENDING_CONTEXT_KEY];
	if (!pending || !pending.createdAt || Date.now() - pending.createdAt > PENDING_MAX_AGE_MS) {
		return { selection: '', title: '', url: '', sourceKind: 'web', mode: 'create' };
	}
	return {
		selection: pending.selection || '',
		title: pending.title || '',
		url: pending.url || '',
		sourceKind: pending.sourceKind || 'web',
		mode: pending.mode || 'create',
	};
}

async function readActivePageContext(): Promise<InitialPageContext> {
	const tabs = await browser.tabs.query({ active: true, currentWindow: true });
	const tab = tabs[0];
	if (!tab?.id) return { selection: '', title: '', url: '', sourceKind: 'web', mode: 'create' };

	try {
		const results = await browser.scripting.executeScript({
			target: { tabId: tab.id },
			func: () => {
				const url = location.href || '';
				const isEmail = isEmailPage(url);
				return {
					selection: String(window.getSelection?.()?.toString() || ''),
					title: isEmail ? extractEmailSubject() || document.title || '' : document.title || '',
					url,
					sourceKind: isEmail ? 'email' : 'web',
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
						.replace(/^subject\\s*:?\\s*/i, '')
						.replace(/\\s*Summarize this email\\s*$/i, '')
						.replace(/\\s+-\\s+[^-]+?\\s+-\\s+Outlook$/i, '')
						.replace(/\\s+-\\s+(Outlook|Microsoft Outlook|Microsoft Outlook Web App|Mail)$/i, '')
						.replace(/\\s+/g, ' ')
						.trim();
				}

				function looksLikeSubject(value: string): boolean {
					if (!value || value.length < 3 || value.length > 240) return false;
					return !/^(Inbox|Mail|Outlook|Microsoft Outlook|Message|Reading Pane|Navigation pane|Navigation)$/i.test(value);
				}
			},
		});
		const result = results[0]?.result as InitialPageContext | undefined;
		return {
			selection: result?.selection || '',
			title: result?.title || tab.title || '',
			url: result?.url || tab.url || '',
			sourceKind: result?.sourceKind || 'web',
			mode: 'create',
		};
	} catch {
		return {
			selection: '',
			title: tab.title || '',
			url: tab.url || '',
			sourceKind: isEmailUrl(tab.url || '') ? 'email' : 'web',
			mode: 'create',
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

function cleanEmailSubject(value: string): string {
	const clean = String(value || '')
		.replace(/^subject\s*:?\s*/i, '')
		.replace(/\s*Summarize this email\s*$/i, '')
		.replace(/\s+-\s+[^-]+?\s+-\s+Outlook$/i, '')
		.replace(/\s+-\s+(Outlook|Microsoft Outlook|Microsoft Outlook Web App|Mail)$/i, '')
		.replace(/\s+/g, ' ')
		.trim();
	return looksLikeEmailSubject(clean) ? clean : '';
}

function looksLikeEmailSubject(value: string): boolean {
	if (!value || value.length < 3 || value.length > 240) return false;
	return !/^(Inbox|Mail|Outlook|Microsoft Outlook|Message|Reading Pane|Navigation pane|Navigation)$/i.test(value);
}

function setNotice(message: string, isError = false): void {
	notice.textContent = message;
	notice.classList.toggle('is-error', isError);
}
