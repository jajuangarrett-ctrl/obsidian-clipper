import browser from '../utils/browser-polyfill';
import {
	PageContext,
	buildObsidianTaskContent,
	buildTaskLines,
	buildUpdateBlock,
} from './format';
import {
	TaskClipperSettings,
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
let pageContext: PageContext = { title: '', url: '' };

const createTab = document.getElementById('create-tab') as HTMLButtonElement;
const updateTab = document.getElementById('update-tab') as HTMLButtonElement;
const createPanel = document.getElementById('create-panel') as HTMLElement;
const updatePanel = document.getElementById('update-panel') as HTMLElement;
const taskTitle = document.getElementById('task-title') as HTMLInputElement;
const taskDetails = document.getElementById('task-details') as HTMLTextAreaElement;
const updateTaskQuery = document.getElementById('update-task-query') as HTMLInputElement;
const updateText = document.getElementById('update-text') as HTMLTextAreaElement;
const statusSelect = document.getElementById('status-select') as HTMLSelectElement;
const projectSelect = document.getElementById('project-select') as HTMLSelectElement;
const tagsField = document.getElementById('tags-field') as HTMLInputElement;
const tagOptions = document.getElementById('tag-options') as HTMLDataListElement;
const includeSource = document.getElementById('include-source') as HTMLInputElement;
const preview = document.getElementById('task-preview') as HTMLElement;
const taskCount = document.getElementById('task-count') as HTMLElement;
const notice = document.getElementById('notice') as HTMLElement;
const saveButton = document.getElementById('save-task') as HTMLButtonElement;

document.addEventListener('DOMContentLoaded', init);

async function init(): Promise<void> {
	settings = await loadTaskClipperSettings();
	const initial = await getInitialPageContext();
	pageContext = { title: initial.title, url: initial.url };
	mode = initial.mode || 'create';

	const initialText = initial.selection || initial.title || '';
	taskDetails.value = initialText;
	taskTitle.value = firstLine(initialText) || initial.title || '';
	updateText.value = initial.selection || '';
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

	for (const element of [
		taskTitle,
		taskDetails,
		updateTaskQuery,
		updateText,
		statusSelect,
		projectSelect,
		tagsField,
		includeSource,
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
	projectSelect.value = settings.defaultProject;

	tagOptions.textContent = '';
	for (const tag of settings.tags) {
		const option = document.createElement('option');
		option.value = tag;
		tagOptions.appendChild(option);
	}
}

function renderPreview(): void {
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

async function submit(): Promise<void> {
	if (mode === 'update') return appendUpdate();
	return createTask();
}

async function createTask(): Promise<void> {
	const title = taskTitle.value.trim() || firstLine(taskDetails.value);
	const details = taskDetails.value.trim();
	if (!title && !details) return setNotice('Add task text first.', true);

	settings.defaultStatus = statusSelect.value || settings.defaultStatus;
	settings.defaultProject = projectSelect.value || '';
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
	return includeSource.checked ? pageContext : { title: '', url: '' };
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
		mode: pending.mode || 'create',
	};
}

async function takePendingContext(): Promise<InitialPageContext> {
	const result = await browser.storage.local.get(PENDING_CONTEXT_KEY) as Record<string, (InitialPageContext & { createdAt?: number }) | undefined>;
	await browser.storage.local.remove(PENDING_CONTEXT_KEY);
	const pending = result[PENDING_CONTEXT_KEY];
	if (!pending || !pending.createdAt || Date.now() - pending.createdAt > PENDING_MAX_AGE_MS) {
		return { selection: '', title: '', url: '', mode: 'create' };
	}
	return {
		selection: pending.selection || '',
		title: pending.title || '',
		url: pending.url || '',
		mode: pending.mode || 'create',
	};
}

async function readActivePageContext(): Promise<InitialPageContext> {
	const tabs = await browser.tabs.query({ active: true, currentWindow: true });
	const tab = tabs[0];
	if (!tab?.id) return { selection: '', title: '', url: '', mode: 'create' };

	try {
		const results = await browser.scripting.executeScript({
			target: { tabId: tab.id },
			func: () => ({
				selection: String(window.getSelection?.()?.toString() || ''),
				title: document.title || '',
				url: location.href || '',
			}),
		});
		const result = results[0]?.result as InitialPageContext | undefined;
		return {
			selection: result?.selection || '',
			title: result?.title || tab.title || '',
			url: result?.url || tab.url || '',
			mode: 'create',
		};
	} catch {
		return {
			selection: '',
			title: tab.title || '',
			url: tab.url || '',
			mode: 'create',
		};
	}
}

function setNotice(message: string, isError = false): void {
	notice.textContent = message;
	notice.classList.toggle('is-error', isError);
}
