import browser from '../utils/browser-polyfill';
import { buildTaskLines, BuiltTask } from './format';
import {
	TaskClipperSettings,
	cleanProjectName,
	cleanStatusId,
	loadTaskClipperSettings,
	loadTaskboardPassword,
	saveTaskClipperSettings,
} from './storage';

const PENDING_CONTEXT_KEY = 'fjgTaskClipperPendingContext';
const PENDING_MAX_AGE_MS = 5 * 60 * 1000;
const TASKBOARD_STATUSES = new Set(['Inbox', 'DoFirst', 'DoSoon', 'Delegate', 'Waiting', 'On-Hold']);

type PageContext = {
	selection: string;
	title: string;
	url: string;
};

let settings: TaskClipperSettings;
let pageContext: PageContext = { selection: '', title: '', url: '' };

const taskText = document.getElementById('task-text') as HTMLTextAreaElement;
const statusSelect = document.getElementById('status-select') as HTMLSelectElement;
const projectSelect = document.getElementById('project-select') as HTMLSelectElement;
const preview = document.getElementById('task-preview') as HTMLElement;
const taskCount = document.getElementById('task-count') as HTMLElement;
const notice = document.getElementById('notice') as HTMLElement;

document.addEventListener('DOMContentLoaded', init);

async function init(): Promise<void> {
	settings = await loadTaskClipperSettings();
	pageContext = await getInitialPageContext();

	renderSelectors();
	taskText.value = pageContext.selection || pageContext.title || '';
	statusSelect.value = settings.defaultStatus;
	projectSelect.value = settings.defaultProject;

	taskText.addEventListener('input', renderPreview);
	statusSelect.addEventListener('change', () => {
		settings.defaultStatus = statusSelect.value;
		saveTaskClipperSettings(settings).catch(console.error);
		renderPreview();
	});
	projectSelect.addEventListener('change', () => {
		settings.defaultProject = projectSelect.value;
		saveTaskClipperSettings(settings).catch(console.error);
		renderPreview();
	});

	document.getElementById('open-settings')?.addEventListener('click', () => {
		browser.runtime.openOptionsPage();
	});
	document.getElementById('add-project')?.addEventListener('click', addProjectFromPopup);
	document.getElementById('add-status')?.addEventListener('click', addStatusFromPopup);
	document.getElementById('copy-task')?.addEventListener('click', copyTasks);
	document.getElementById('save-task')?.addEventListener('click', saveTasks);

	renderPreview();
	taskText.focus();
}

function renderSelectors(): void {
	statusSelect.textContent = '';
	for (const status of settings.statuses) {
		const option = document.createElement('option');
		option.value = status.id;
		option.textContent = `${status.label} (#${status.id})`;
		statusSelect.appendChild(option);
	}

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
}

function getBuiltTasks(): BuiltTask[] {
	return buildTaskLines(
		taskText.value,
		statusSelect.value,
		projectSelect.value,
		settings.statuses,
	);
}

function renderPreview(): void {
	const tasks = getBuiltTasks();
	preview.textContent = tasks.length ? tasks.map((task) => task.line).join('\n') : 'No task text yet.';
	taskCount.textContent = `${tasks.length} ${tasks.length === 1 ? 'task' : 'tasks'}`;
}

async function addProjectFromPopup(): Promise<void> {
	const input = document.getElementById('new-project') as HTMLInputElement;
	const project = cleanProjectName(input.value);
	if (!project) return setNotice('Enter a project name.', true);
	settings.projects = [...new Set([...settings.projects, project])].sort((a, b) => a.localeCompare(b));
	settings.defaultProject = project;
	settings = await saveTaskClipperSettings(settings);
	input.value = '';
	renderSelectors();
	projectSelect.value = project;
	renderPreview();
	setNotice('Project added.');
}

async function addStatusFromPopup(): Promise<void> {
	const labelInput = document.getElementById('new-status-label') as HTMLInputElement;
	const idInput = document.getElementById('new-status-id') as HTMLInputElement;
	const label = labelInput.value.trim();
	const id = cleanStatusId(idInput.value || label);
	if (!label || !id) return setNotice('Enter a status label and hashtag.', true);
	if (settings.statuses.some((status) => status.id === id)) return setNotice('That status already exists.', true);
	settings.statuses = [...settings.statuses, { id, label }];
	settings.defaultStatus = id;
	settings = await saveTaskClipperSettings(settings);
	labelInput.value = '';
	idInput.value = '';
	renderSelectors();
	statusSelect.value = id;
	renderPreview();
	setNotice('Status added.');
}

async function copyTasks(): Promise<void> {
	const tasks = getBuiltTasks();
	if (!tasks.length) return setNotice('Nothing to copy.', true);
	await navigator.clipboard.writeText(tasks.map((task) => task.line).join('\n'));
	setNotice('Copied.');
}

async function saveTasks(): Promise<void> {
	const tasks = getBuiltTasks();
	if (!tasks.length) return setNotice('Add task text first.', true);

	setNotice('Saving...');
	try {
		if (settings.addToTaskboard) {
			await saveToTaskboard(tasks);
		}
		await appendToObsidian(tasks.map((task) => task.line).join('\n'));
		setNotice(`${tasks.length} ${tasks.length === 1 ? 'task' : 'tasks'} sent to Obsidian.`);
		setTimeout(() => window.close(), 700);
	} catch (error) {
		setNotice(error instanceof Error ? error.message : String(error), true);
	}
}

async function appendToObsidian(content: string): Promise<void> {
	const body = `\n${content}\n`;
	await navigator.clipboard.writeText(body);

	const params = new URLSearchParams({
		file: settings.destinationFile,
		append: 'true',
		clipboard: 'true',
		content: body,
	});
	if (settings.vaultName) params.set('vault', settings.vaultName);
	if (settings.silentOpen) params.set('silent', 'true');

	const response = await browser.runtime.sendMessage({
		action: 'openObsidianUrl',
		url: `obsidian://new?${params.toString()}`,
	}) as { success?: boolean; error?: string };

	if (!response?.success) {
		throw new Error(response?.error || 'Could not open Obsidian.');
	}
}

async function saveToTaskboard(tasks: BuiltTask[]): Promise<void> {
	const password = await loadTaskboardPassword();
	if (!password) throw new Error('Taskboard password is not configured.');

	const apiTasks = tasks.map((task) => ({
		title: task.title,
		bucket: TASKBOARD_STATUSES.has(task.status) ? task.status : 'Inbox',
		project: task.project || null,
	}));

	const response = await fetch(`${settings.taskboardBaseUrl}/api/mutate`, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			'X-Dashboard-Password': password,
		},
		body: JSON.stringify({ action: 'addMany', tasks: apiTasks }),
	});

	if (!response.ok) {
		const text = await response.text();
		throw new Error(text || `Taskboard save failed with HTTP ${response.status}.`);
	}
}

async function getInitialPageContext(): Promise<PageContext> {
	const pending = await takePendingContext();
	const active = await readActivePageContext();
	return {
		selection: pending.selection || active.selection,
		title: pending.title || active.title,
		url: pending.url || active.url,
	};
}

async function takePendingContext(): Promise<PageContext> {
	const result = await browser.storage.local.get(PENDING_CONTEXT_KEY) as Record<string, (PageContext & { createdAt?: number }) | undefined>;
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

async function readActivePageContext(): Promise<PageContext> {
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
		const result = results[0]?.result as PageContext | undefined;
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
