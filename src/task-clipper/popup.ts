import browser from '../utils/browser-polyfill';
import { requestAiTitle } from './ai-title';
import {
	CatalogTask,
	fetchTaskManagerPeople,
	searchTaskManagerTasks,
} from './catalog-client';
import {
	cleanEmailSubject,
	firstMeaningfulLine,
	initialTaskTitle,
} from './capture';
import {
	PageContext,
	buildObsidianTaskContent,
	buildTaskLines,
	buildUpdateBlock,
} from './format';
import {
	TaskCatalogSettings,
	TaskClipperSettings,
	loadCatalogSettings,
	loadOpenAiApiKey,
	loadTaskClipperSettings,
	saveTaskClipperSettings,
	normalizePeople,
} from './storage';

const PENDING_CONTEXT_KEY = 'fjgTaskClipperPendingContext';
const PENDING_MAX_AGE_MS = 5 * 60 * 1000;
const MAX_OBSIDIAN_URL_LENGTH = 60000;
const TASK_SEARCH_DELAY_MS = 220;

type PopupMode = 'create' | 'update';

type CreateTaskPayload = {
	version: 2;
	action: 'create-task-note';
	taskFolder: string;
	indexFile: string;
	title: string;
	details: string;
	status: string;
	people: string[];
	tags: string[];
	source: PageContext;
	createdAt: string;
};

type AppendUpdatePayload = {
	version: 2;
	action: 'append-update';
	taskFolder: string;
	taskId?: string;
	taskQuery: string;
	updateText: string;
	source: PageContext;
	createdAt: string;
};

type ProtocolPayload = CreateTaskPayload | AppendUpdatePayload;

let settings: TaskClipperSettings;
let catalogSettings: TaskCatalogSettings;
let mode: PopupMode = 'create';
let pageContext: PageContext = { title: '', url: '', sourceKind: 'web' };
let selectedUpdateTask: CatalogTask | null = null;
let taskSearchTimer: number | null = null;
let taskSearchAbort: AbortController | null = null;

const createTab = document.getElementById('create-tab') as HTMLButtonElement;
const updateTab = document.getElementById('update-tab') as HTMLButtonElement;
const createPanel = document.getElementById('create-panel') as HTMLElement;
const updatePanel = document.getElementById('update-panel') as HTMLElement;
const taskTitle = document.getElementById('task-title') as HTMLInputElement;
const generateTitleButton = document.getElementById('generate-title') as HTMLButtonElement;
const taskDetails = document.getElementById('task-details') as HTMLTextAreaElement;
const updateTaskQuery = document.getElementById('update-task-query') as HTMLInputElement;
const updateTaskResults = document.getElementById('update-task-results') as HTMLElement;
const updateText = document.getElementById('update-text') as HTMLTextAreaElement;
const statusSelect = document.getElementById('status-select') as HTMLSelectElement;
const peopleList = document.getElementById('people-list') as HTMLElement;
const peopleSearch = document.getElementById('people-search') as HTMLInputElement;
const tagsField = document.getElementById('tags-field') as HTMLInputElement;
const tagOptions = document.getElementById('tag-options') as HTMLDataListElement;
const includeSourceRow = document.getElementById('include-source-row') as HTMLLabelElement;
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
	catalogSettings = await loadCatalogSettings();
	const initial = await getInitialPageContext();
	pageContext = { title: initial.title, url: initial.url, sourceKind: initial.sourceKind };
	mode = initial.mode || 'create';

	const initialText = initial.selection || initial.title || '';
	taskDetails.value = initialText;
	taskTitle.value = initialTaskTitle(initial);
	updateText.value = initial.selection || '';
	emailSubject.value = pageContext.sourceKind === 'email' ? cleanEmailSubject(pageContext.title) : '';
	tagsField.value = 'task';

	await renderSelectors();
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
	peopleList.addEventListener('change', renderPreview);
	peopleSearch.addEventListener('input', () => {
		for (const row of Array.from(peopleList.querySelectorAll<HTMLElement>('label'))) {
			row.hidden = !row.textContent?.toLocaleLowerCase().includes(peopleSearch.value.toLocaleLowerCase().trim());
		}
	});
	updateTaskQuery.addEventListener('input', scheduleTaskSearch);

	for (const element of [
		taskTitle,
		taskDetails,
		updateTaskQuery,
		updateText,
		statusSelect,
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
	if (mode === 'update') updateTaskQuery.focus();
}

async function renderSelectors(): Promise<void> {
	statusSelect.textContent = '';
	for (const status of settings.statuses) {
		const option = document.createElement('option');
		option.value = status.id;
		option.textContent = status.label;
		statusSelect.appendChild(option);
	}
	statusSelect.value = settings.defaultStatus;

	peopleList.textContent = '';
	let livePeople: string[] = [];
	const help = document.getElementById('people-help') as HTMLElement;
	try {
		livePeople = await fetchTaskManagerPeople(catalogSettings);
		help.textContent = 'Choose one or more people, or leave unassigned.';
	} catch (error) {
		help.textContent = `${error instanceof Error ? error.message : String(error)} You can use names saved in Settings.`;
	}
	const people = normalizePeople([...livePeople, ...settings.people]);
	for (const person of people) {
		const row = document.createElement('label');
		row.className = 'checkbox-row';
		const checkbox = document.createElement('input');
		checkbox.type = 'checkbox';
		checkbox.value = person;
		const label = document.createElement('span');
		label.textContent = person;
		row.append(checkbox, label);
		peopleList.appendChild(row);
	}
	if (!people.length) peopleList.textContent = 'No people available. Add a person in Settings or Objective Manager.';

	tagOptions.textContent = '';
	for (const tag of settings.tags) {
		const option = document.createElement('option');
		option.value = tag;
		tagOptions.appendChild(option);
	}
}

function renderPreview(): void {
	const people = selectedPeople();
	(document.getElementById('people-summary') as HTMLElement).textContent = people.length ? `People (${people.length})` : 'People — Unassigned';
	renderSourceControls();

	if (mode === 'update') {
		const block = buildUpdateBlock(updateText.value, emptySourceContext());
		preview.textContent = block || '(no update text yet)';
		const taskId = resolvedUpdateTaskId();
		taskCount.textContent = taskId ? '1 update' : 'Choose task';
		saveButton.disabled = !taskId || !updateText.value.trim();
		return;
	}
	saveButton.disabled = false;

	const content = getCreateTaskContent();
	preview.textContent = content || '(no task text yet)';
	const count = buildTaskLines(
		taskDetails.value || taskTitle.value,
		statusSelect.value,
		'',
		settings.statuses,
		normalizeTags(tagsField.value),
	).length;
	taskCount.textContent = `${count || 0} task${count === 1 ? '' : 's'}`;
}

function renderSourceControls(): void {
	const isUpdate = mode === 'update';
	includeSourceRow.classList.toggle('is-hidden', isUpdate);
	const showEmailSubject = !isUpdate && includeSource.checked && pageContext.sourceKind === 'email';
	emailSourceGroup.classList.toggle('is-hidden', !showEmailSubject);
}

async function submit(): Promise<void> {
	if (mode === 'update') return appendUpdate();
	return createTask();
}

async function createTask(): Promise<void> {
	const title = taskTitle.value.trim() || firstMeaningfulLine(taskDetails.value);
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
		people: selectedPeople(),
		tags: normalizeTags(tagsField.value),
		source: sourceContext(),
		createdAt: new Date().toISOString(),
	};

	await sendPayload(payload, 'Task workspace sent to Obsidian.');
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
			project: '',
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
	const taskId = resolvedUpdateTaskId();
	if (!taskId) return setNotice('Select the exact task from the search results first.', true);

	const payload: AppendUpdatePayload = {
		version: 2,
		action: 'append-update',
		taskFolder: settings.taskFolder,
		taskId,
		taskQuery,
		updateText: text,
		source: emptySourceContext(),
		createdAt: new Date().toISOString(),
	};

	await sendPayload(payload, 'Update sent to Obsidian.');
}

function scheduleTaskSearch(): void {
	selectedUpdateTask = null;
	if (taskSearchTimer !== null) window.clearTimeout(taskSearchTimer);
	taskSearchAbort?.abort();
	const query = updateTaskQuery.value.trim();
	if (!query) {
		renderTaskSearchResults([], 'Type to search your Obsidian tasks.');
		renderPreview();
		return;
	}
	if (isStableTaskId(query)) {
		renderTaskSearchResults([], 'Stable task ID entered.');
		renderPreview();
		return;
	}
	renderTaskSearchResults([], 'Searching Task Manager...');
	renderPreview();
	taskSearchTimer = window.setTimeout(() => {
		void runTaskSearch(query);
	}, TASK_SEARCH_DELAY_MS);
}

async function runTaskSearch(query: string): Promise<void> {
	taskSearchAbort?.abort();
	const abort = new AbortController();
	taskSearchAbort = abort;
	try {
		const tasks = await searchTaskManagerTasks(catalogSettings, query, abort.signal);
		if (updateTaskQuery.value.trim() !== query) return;
		renderTaskSearchResults(tasks, 'No matching tasks.');
	} catch (error) {
		if (error instanceof DOMException && error.name === 'AbortError') return;
		const message = error instanceof Error ? error.message : String(error);
		renderTaskSearchResults([], message);
		setNotice(message, true);
	}
}

function renderTaskSearchResults(tasks: CatalogTask[], emptyMessage: string): void {
	updateTaskResults.textContent = '';
	if (!tasks.length) {
		const empty = document.createElement('p');
		empty.className = 'task-result-empty';
		empty.textContent = emptyMessage;
		updateTaskResults.appendChild(empty);
		return;
	}

	for (const task of tasks) {
		const button = document.createElement('button');
		button.type = 'button';
		button.className = 'task-result';
		button.setAttribute('aria-pressed', String(selectedUpdateTask?.task_id === task.task_id));
		const title = document.createElement('strong');
		title.textContent = task.title;
		const meta = document.createElement('span');
		meta.textContent = [task.status, task.project, task.task_id].filter(Boolean).join(' • ');
		button.append(title, meta);
		button.addEventListener('click', () => {
			selectedUpdateTask = task;
			updateTaskQuery.value = task.title;
			for (const item of Array.from(updateTaskResults.querySelectorAll('.task-result'))) {
				item.classList.remove('is-selected');
				item.setAttribute('aria-pressed', 'false');
			}
			button.classList.add('is-selected');
			button.setAttribute('aria-pressed', 'true');
			setNotice(`Task selected: ${task.title}`);
			renderPreview();
		});
		updateTaskResults.appendChild(button);
	}
}

function resolvedUpdateTaskId(): string {
	if (selectedUpdateTask) return selectedUpdateTask.task_id;
	const query = updateTaskQuery.value.trim();
	return isStableTaskId(query) ? query : '';
}

function isStableTaskId(value: string): boolean {
	return /^(?:tsk_[a-z0-9]+|FJG-[A-Z0-9]+)$/i.test(value.trim());
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
	const content = buildObsidianTaskContent(
		taskDetails.value || taskTitle.value,
		statusSelect.value,
		'',
		settings.statuses,
		normalizeTags(tagsField.value),
		sourceContext(),
	);
	const people = selectedPeople();
	return people.length ? `${content}\nPeople: ${people.join('; ')}` : content;
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

function emptySourceContext(): PageContext {
	return { title: '', url: '' };
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
						'[aria-label="Reading Pane"] [role="heading"][aria-level="3"]',
						'[aria-label="Reading Pane"] h3',
						'[data-testid="message-subject"]',
						'[data-testid="conversation-subject"]',
						'[aria-label^="Subject"]',
						'[aria-label^="subject"]',
						'[role="heading"][aria-level="1"]',
						'[role="heading"][aria-level="2"]',
						'[role="heading"][aria-level="3"]',
						'h1',
						'h2',
						'h3',
					];
					for (const selector of selectors) {
						const nodes = Array.from(document.querySelectorAll(selector));
						for (const node of nodes) {
							const text = cleanSubject(textWithoutControls(node));
							if (looksLikeSubject(text)) return text;
						}
					}
					return cleanSubject(document.title || '');
				}

				function textWithoutControls(node: Element): string {
					let text = (node.textContent || '') || (node.getAttribute('aria-label') || '');
					for (const control of Array.from(node.querySelectorAll('button,[role="button"]'))) {
						const controlText = control.textContent || '';
						if (controlText) text = text.replace(controlText, '');
					}
					return text;
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

function selectedPeople(): string[] {
	return Array.from(peopleList.querySelectorAll<HTMLInputElement>('input:checked')).map(input => input.value);
}

function setNotice(message: string, isError = false): void {
	notice.textContent = message;
	notice.classList.toggle('is-error', isError);
}
