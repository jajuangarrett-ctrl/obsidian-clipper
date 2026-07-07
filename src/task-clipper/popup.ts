import browser from '../utils/browser-polyfill';
import {
	buildObsidianTaskContent,
	buildTaskLines,
	PageContext,
} from './format';
import {
	TaskClipperSettings,
	loadTaskClipperSettings,
	saveTaskClipperSettings,
} from './storage';

const PENDING_CONTEXT_KEY = 'fjgTaskClipperPendingContext';
const PENDING_MAX_AGE_MS = 5 * 60 * 1000;
const MAX_OBSIDIAN_URL_LENGTH = 60000;

type ProtocolPayload = {
	version: 2;
	destinationFile: string;
	content: string;
	source: PageContext;
	createdAt: string;
};

let settings: TaskClipperSettings;
let pageContext: PageContext = { title: '', url: '' };

const taskTitle = document.getElementById('task-title') as HTMLInputElement;
const taskDetails = document.getElementById('task-details') as HTMLTextAreaElement;
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

	taskDetails.value = initial.selection || initial.title || '';
	taskTitle.value = firstLine(initial.selection) || initial.title || '';
	tagsField.value = 'task';

	renderSelectors();
	bindEvents();
	renderPreview();
	taskTitle.focus();
}

function bindEvents(): void {
	document.getElementById('open-settings')?.addEventListener('click', () => {
		browser.runtime.openOptionsPage();
	});
	saveButton.addEventListener('click', createTask);

	for (const element of [taskTitle, taskDetails, statusSelect, projectSelect, tagsField, includeSource]) {
		element.addEventListener('input', renderPreview);
		element.addEventListener('change', renderPreview);
	}
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
	const content = getTaskContent();
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

async function createTask(): Promise<void> {
	const content = getTaskContent();
	if (!content.trim()) return setNotice('Add task text first.', true);

	settings.defaultStatus = statusSelect.value || settings.defaultStatus;
	settings.defaultProject = projectSelect.value || '';
	settings = await saveTaskClipperSettings(settings);

	const payload: ProtocolPayload = {
		version: 2,
		destinationFile: settings.destinationFile,
		content,
		source: sourceContext(),
		createdAt: new Date().toISOString(),
	};

	const url = buildObsidianUrl(payload, settings.vaultName);
	if (url.length > MAX_OBSIDIAN_URL_LENGTH) {
		await navigator.clipboard.writeText(content);
		return setNotice('Selection is too long for an Obsidian URL. Task lines copied instead.', true);
	}

	setNotice('Opening Obsidian...');
	const response = await browser.runtime.sendMessage({
		action: 'openObsidianUrl',
		url,
	}) as { success?: boolean; error?: string };

	if (!response?.success) {
		throw new Error(response?.error || 'Could not open Obsidian.');
	}

	setNotice('Sent to Obsidian.');
	setTimeout(() => window.close(), 700);
}

function getTaskContent(): string {
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

type InitialPageContext = PageContext & { selection: string };

async function getInitialPageContext(): Promise<InitialPageContext> {
	const pending = await takePendingContext();
	const active = await readActivePageContext();
	return {
		selection: pending.selection || active.selection,
		title: pending.title || active.title,
		url: pending.url || active.url,
	};
}

async function takePendingContext(): Promise<InitialPageContext> {
	const result = await browser.storage.local.get(PENDING_CONTEXT_KEY) as Record<string, (InitialPageContext & { createdAt?: number }) | undefined>;
	await browser.storage.local.remove(PENDING_CONTEXT_KEY);
	const pending = result[PENDING_CONTEXT_KEY];
	if (!pending || !pending.createdAt || Date.now() - pending.createdAt > PENDING_MAX_AGE_MS) {
		return { selection: '', title: '', url: '' };
	}
	return {
		selection: pending.selection || '',
		title: pending.title || '',
		url: pending.url || '',
	};
}

async function readActivePageContext(): Promise<InitialPageContext> {
	const tabs = await browser.tabs.query({ active: true, currentWindow: true });
	const tab = tabs[0];
	if (!tab?.id) return { selection: '', title: '', url: '' };

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
		};
	} catch {
		return {
			selection: '',
			title: tab.title || '',
			url: tab.url || '',
		};
	}
}

function setNotice(message: string, isError = false): void {
	notice.textContent = message;
	notice.classList.toggle('is-error', isError);
}
