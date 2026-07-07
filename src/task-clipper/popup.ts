import browser from '../utils/browser-polyfill';
import {
	appendUpdateLog,
	buildTaskLines,
	buildTaskNotePayload,
	BuiltTask,
	PageContext,
} from './format';
import {
	DEFAULT_STATUSES,
	TaskClipperSettings,
	loadTaskClipperSettings,
	loadTaskNotesToken,
	saveTaskClipperSettings,
} from './storage';
import {
	TaskNotesClient,
	TaskNotesTask,
	normalizeFilterStatuses,
} from './tasknotes-api';

const PENDING_CONTEXT_KEY = 'fjgTaskClipperPendingContext';
const PENDING_MAX_AGE_MS = 5 * 60 * 1000;

type Mode = 'create' | 'update';

let settings: TaskClipperSettings;
let client: TaskNotesClient;
let pageContext: PageContext = { title: '', url: '' };
let activeTasks: TaskNotesTask[] = [];
let taskNotesAvailable = false;
let mode: Mode = 'create';

const modeCreate = document.getElementById('mode-create') as HTMLButtonElement;
const modeUpdate = document.getElementById('mode-update') as HTMLButtonElement;
const createPanel = document.getElementById('create-panel') as HTMLElement;
const updatePanel = document.getElementById('update-panel') as HTMLElement;
const apiStatus = document.getElementById('api-status') as HTMLElement;
const taskTitle = document.getElementById('task-title') as HTMLInputElement;
const taskDetails = document.getElementById('task-details') as HTMLTextAreaElement;
const statusSelect = document.getElementById('status-select') as HTMLSelectElement;
const projectSelect = document.getElementById('project-select') as HTMLSelectElement;
const tagsField = document.getElementById('tags-field') as HTMLInputElement;
const taskSearch = document.getElementById('task-search') as HTMLInputElement;
const taskSelect = document.getElementById('task-select') as HTMLSelectElement;
const updateText = document.getElementById('update-text') as HTMLTextAreaElement;
const includeSource = document.getElementById('include-source') as HTMLInputElement;
const preview = document.getElementById('task-preview') as HTMLElement;
const taskCount = document.getElementById('task-count') as HTMLElement;
const notice = document.getElementById('notice') as HTMLElement;
const saveButton = document.getElementById('save-task') as HTMLButtonElement;

document.addEventListener('DOMContentLoaded', init);

async function init(): Promise<void> {
	settings = await loadTaskClipperSettings();
	client = new TaskNotesClient(settings, await loadTaskNotesToken());
	const initial = await getInitialPageContext();
	pageContext = { title: initial.title, url: initial.url };

	taskDetails.value = initial.selection || initial.title || '';
	updateText.value = initial.selection || '';
	taskTitle.value = firstLine(initial.selection) || initial.title || '';
	tagsField.value = 'task';

	renderSelectors();
	bindEvents();
	renderMode();
	renderPreview();
	await refreshTaskNotesData();
	taskTitle.focus();
}

function bindEvents(): void {
	modeCreate.addEventListener('click', () => setMode('create'));
	modeUpdate.addEventListener('click', () => setMode('update'));
	document.getElementById('open-settings')?.addEventListener('click', () => {
		browser.runtime.openOptionsPage();
	});
	document.getElementById('refresh-tasks')?.addEventListener('click', () => refreshTaskNotesData());
	document.getElementById('copy-task')?.addEventListener('click', copyFallbackTasks);
	saveButton.addEventListener('click', saveCurrentMode);

	for (const element of [taskTitle, taskDetails, statusSelect, projectSelect, tagsField, taskSearch, taskSelect, updateText, includeSource]) {
		element.addEventListener('input', () => {
			if (element === taskSearch) renderTaskOptions();
			renderPreview();
		});
		element.addEventListener('change', renderPreview);
	}
}

async function refreshTaskNotesData(): Promise<void> {
	apiStatus.textContent = 'Checking TaskNotes API...';
	apiStatus.classList.remove('is-error');
	try {
		await client.health();
		const [options, tasks] = await Promise.all([
			client.filterOptions().catch(() => ({})),
			client.queryActiveTasks(),
		]);
		const projects = Array.isArray(options.projects) ? options.projects : [];
		settings.projects = mergeStrings(settings.projects, projects.map(String));
		settings.statuses = normalizeFilterStatuses(options, DEFAULT_STATUSES);
		settings = await saveTaskClipperSettings(settings);
		activeTasks = tasks;
		taskNotesAvailable = true;
		renderSelectors();
		renderTaskOptions();
		apiStatus.textContent = `Connected to TaskNotes. ${tasks.length} active tasks loaded.`;
	} catch (error) {
		taskNotesAvailable = false;
		apiStatus.textContent = error instanceof Error ? error.message : String(error);
		apiStatus.classList.add('is-error');
		renderTaskOptions();
	}
	renderPreview();
}

function setMode(nextMode: Mode): void {
	mode = nextMode;
	renderMode();
	renderPreview();
}

function renderMode(): void {
	modeCreate.classList.toggle('active', mode === 'create');
	modeUpdate.classList.toggle('active', mode === 'update');
	createPanel.classList.toggle('is-hidden', mode !== 'create');
	updatePanel.classList.toggle('is-hidden', mode !== 'update');
	saveButton.textContent = mode === 'create' ? 'Create Task' : 'Add Update';
}

function renderSelectors(): void {
	statusSelect.textContent = '';
	for (const status of settings.statuses) {
		const option = document.createElement('option');
		option.value = status.id;
		option.textContent = `${status.label} (${status.id})`;
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
}

function renderTaskOptions(): void {
	const query = taskSearch.value.trim().toLowerCase();
	const filtered = activeTasks.filter((task) => {
		const text = `${task.title || ''} ${task.status || ''} ${(task.projects || []).join(' ')}`.toLowerCase();
		return !query || text.includes(query);
	});
	const current = taskSelect.value;
	taskSelect.textContent = '';
	if (!filtered.length) {
		const option = document.createElement('option');
		option.value = '';
		option.textContent = taskNotesAvailable ? 'No matching active tasks' : 'TaskNotes unavailable';
		taskSelect.appendChild(option);
		return;
	}
	for (const task of filtered) {
		const option = document.createElement('option');
		option.value = task.id || task.path || task.title;
		option.textContent = taskLabel(task);
		taskSelect.appendChild(option);
	}
	if (filtered.some((task) => (task.id || task.path || task.title) === current)) {
		taskSelect.value = current;
	}
}

function renderPreview(): void {
	if (mode === 'create') {
		const payload = getCreatePayload();
		preview.textContent = [
			`Title: ${payload.title}`,
			`Status: ${payload.status || 'Inbox'}`,
			payload.projects?.length ? `Project: ${payload.projects.join(', ')}` : 'Project: none',
			`Tags: ${(payload.tags || []).join(', ')}`,
			'',
			payload.details || '(no details)',
		].join('\n');
		taskCount.textContent = taskNotesAvailable ? 'TaskNotes create' : 'Fallback task line';
		return;
	}

	const target = activeTasks.find((task) => (task.id || task.path || task.title) === taskSelect.value);
	preview.textContent = [
		target ? `Task: ${target.title}` : 'Task: none selected',
		'',
		appendUpdateLog('', updateText.value, sourceContext(), new Date()),
	].join('\n');
	taskCount.textContent = 'TaskNotes update';
}

async function saveCurrentMode(): Promise<void> {
	if (mode === 'create') {
		await createTask();
	} else {
		await addUpdate();
	}
}

async function createTask(): Promise<void> {
	const payload = getCreatePayload();
	if (!payload.title.trim()) return setNotice('Add a task title first.', true);

	setNotice('Saving...');
	try {
		if (!taskNotesAvailable) {
			await appendFallbackToObsidian(getFallbackTasks().map((task) => task.line).join('\n'));
			setNotice('TaskNotes unavailable. Fallback task line sent to Obsidian.');
			return;
		}
		await client.createTask(payload);
		setNotice('Task created in TaskNotes.');
		await refreshTaskNotesData();
		setTimeout(() => window.close(), 700);
	} catch (error) {
		setNotice(error instanceof Error ? error.message : String(error), true);
	}
}

async function addUpdate(): Promise<void> {
	const taskId = taskSelect.value;
	const text = updateText.value.trim();
	if (!taskId) return setNotice('Choose an active task first.', true);
	if (!text) return setNotice('Add update text first.', true);
	if (!taskNotesAvailable) return setNotice('TaskNotes API is required to add updates.', true);

	setNotice('Saving update...');
	try {
		const task = await client.getTask(taskId);
		const details = appendUpdateLog(task.details, text, sourceContext());
		await client.updateTask(taskId, { details });
		setNotice('Update added to TaskNotes task.');
		setTimeout(() => window.close(), 700);
	} catch (error) {
		setNotice(error instanceof Error ? error.message : String(error), true);
	}
}

function getCreatePayload(): {
	title: string;
	details: string;
	status: string;
	projects: string[];
	tags: string[];
} {
	const built = buildTaskNotePayload(
		taskDetails.value || taskTitle.value,
		statusSelect.value,
		projectSelect.value,
		settings.statuses,
		sourceContext(),
	);
	return {
		title: taskTitle.value.trim() || built.title,
		details: built.details,
		status: statusSelect.value || 'Inbox',
		projects: projectSelect.value ? [projectSelect.value] : [],
		tags: normalizeTags(tagsField.value),
	};
}

function getFallbackTasks(): BuiltTask[] {
	return buildTaskLines(
		taskTitle.value || taskDetails.value,
		statusSelect.value,
		projectSelect.value,
		settings.statuses,
	);
}

async function copyFallbackTasks(): Promise<void> {
	const tasks = getFallbackTasks();
	if (!tasks.length) return setNotice('Nothing to copy.', true);
	await navigator.clipboard.writeText(tasks.map((task) => task.line).join('\n'));
	setNotice('Fallback task line copied.');
}

async function appendFallbackToObsidian(content: string): Promise<void> {
	if (!content.trim()) throw new Error('Nothing to save.');
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

function taskLabel(task: TaskNotesTask): string {
	const parts = [
		task.title || task.id || task.path || 'Untitled task',
		task.status ? `[${task.status}]` : '',
		task.projects?.length ? `- ${task.projects.join(', ')}` : '',
	].filter(Boolean);
	return parts.join(' ');
}

function firstLine(value: string): string {
	return value
		.replace(/\r\n/g, '\n')
		.split('\n')
		.map((line) => line.trim())
		.find(Boolean) || '';
}

function mergeStrings(a: string[], b: string[]): string[] {
	return [...new Set([...a, ...b].map((item) => item.trim()).filter(Boolean))]
		.sort((left, right) => left.localeCompare(right));
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
