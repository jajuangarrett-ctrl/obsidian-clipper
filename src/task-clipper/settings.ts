import {
	DEFAULT_STATUSES,
	TaskClipperSettings,
	cleanProjectName,
	cleanStatusId,
	loadTaskClipperSettings,
	loadTaskNotesToken,
	saveTaskClipperSettings,
	saveTaskNotesToken,
} from './storage';
import { TaskNotesClient, normalizeFilterStatuses } from './tasknotes-api';

let settings: TaskClipperSettings;

const notice = document.getElementById('settings-notice') as HTMLElement;

document.addEventListener('DOMContentLoaded', init);

async function init(): Promise<void> {
	settings = await loadTaskClipperSettings();
	await populateForm();
	bindEvents();
}

async function populateForm(): Promise<void> {
	(document.getElementById('tasknotes-url') as HTMLInputElement).value = settings.taskNotesBaseUrl;
	(document.getElementById('tasknotes-token') as HTMLInputElement).value = await loadTaskNotesToken();
	(document.getElementById('vault-name') as HTMLInputElement).value = settings.vaultName;
	(document.getElementById('destination-file') as HTMLInputElement).value = settings.destinationFile;
	(document.getElementById('silent-open') as HTMLInputElement).checked = settings.silentOpen;
	renderProjects();
	renderStatuses();
}

function bindEvents(): void {
	document.getElementById('save-settings')?.addEventListener('click', saveForm);
	document.getElementById('project-form')?.addEventListener('submit', addProject);
	document.getElementById('status-form')?.addEventListener('submit', addStatus);
	document.getElementById('reset-statuses')?.addEventListener('click', resetStatuses);
	document.getElementById('test-tasknotes')?.addEventListener('click', testTaskNotes);
	document.getElementById('sync-tasknotes')?.addEventListener('click', syncTaskNotesOptions);
}

async function saveForm(): Promise<void> {
	await saveFormSilently();
	await populateForm();
	setNotice('Settings saved.');
}

async function addProject(event: Event): Promise<void> {
	event.preventDefault();
	const input = document.getElementById('project-name') as HTMLInputElement;
	const project = cleanProjectName(input.value);
	if (!project) return setNotice('Enter a project name.', true);
	settings.projects = [...new Set([...settings.projects, project])].sort((a, b) => a.localeCompare(b));
	settings = await saveTaskClipperSettings(settings);
	input.value = '';
	renderProjects();
	setNotice('Project added.');
}

async function addStatus(event: Event): Promise<void> {
	event.preventDefault();
	const labelInput = document.getElementById('status-label') as HTMLInputElement;
	const idInput = document.getElementById('status-id') as HTMLInputElement;
	const label = labelInput.value.trim();
	const id = cleanStatusId(idInput.value || label);
	if (!label || !id) return setNotice('Enter a status label and value.', true);
	if (settings.statuses.some((status) => status.id === id)) return setNotice('That status already exists.', true);

	settings.statuses = [...settings.statuses, { id, label }];
	settings = await saveTaskClipperSettings(settings);
	labelInput.value = '';
	idInput.value = '';
	renderStatuses();
	setNotice('Status added.');
}

async function resetStatuses(): Promise<void> {
	settings.statuses = DEFAULT_STATUSES;
	settings.defaultStatus = 'Inbox';
	settings = await saveTaskClipperSettings(settings);
	renderStatuses();
	setNotice('Default statuses restored.');
}

function renderProjects(): void {
	const list = document.getElementById('project-list') as HTMLElement;
	list.textContent = '';
	if (!settings.projects.length) {
		list.textContent = 'No projects saved yet.';
		return;
	}

	for (const project of settings.projects) {
		const item = document.createElement('div');
		item.className = 'manage-item';
		const label = document.createElement('span');
		label.textContent = project;
		const button = document.createElement('button');
		button.type = 'button';
		button.textContent = 'Delete';
		button.addEventListener('click', async () => {
			settings.projects = settings.projects.filter((itemProject) => itemProject !== project);
			if (settings.defaultProject === project) settings.defaultProject = '';
			settings = await saveTaskClipperSettings(settings);
			renderProjects();
			setNotice('Project deleted.');
		});
		item.append(label, button);
		list.appendChild(item);
	}
}

function renderStatuses(): void {
	const list = document.getElementById('status-list') as HTMLElement;
	const defaultIds = new Set(DEFAULT_STATUSES.map((status) => status.id));
	list.textContent = '';

	for (const status of settings.statuses) {
		const item = document.createElement('div');
		item.className = 'manage-item';
		const label = document.createElement('span');
		label.textContent = `${status.label} (${status.id})`;
		const button = document.createElement('button');
		button.type = 'button';
		button.textContent = defaultIds.has(status.id) ? 'Default' : 'Delete';
		button.disabled = defaultIds.has(status.id);
		button.addEventListener('click', async () => {
			settings.statuses = settings.statuses.filter((itemStatus) => itemStatus.id !== status.id);
			if (settings.defaultStatus === status.id) settings.defaultStatus = 'Inbox';
			settings = await saveTaskClipperSettings(settings);
			renderStatuses();
			setNotice('Status deleted.');
		});
		item.append(label, button);
		list.appendChild(item);
	}
}

async function testTaskNotes(): Promise<void> {
	try {
		const client = await taskNotesClientFromForm();
		await client.health();
		setNotice('Connected to TaskNotes.');
	} catch (error) {
		setNotice(error instanceof Error ? error.message : String(error), true);
	}
}

async function syncTaskNotesOptions(): Promise<void> {
	try {
		const client = await taskNotesClientFromForm();
		const options = await client.filterOptions();
		const projects = Array.isArray(options.projects) ? options.projects.map(String) : [];
		settings.projects = [...new Set([...settings.projects, ...projects.map(cleanProjectName)])]
			.filter(Boolean)
			.sort((a, b) => a.localeCompare(b));
		settings.statuses = normalizeFilterStatuses(options, DEFAULT_STATUSES);
		settings = await saveTaskClipperSettings(settings);
		renderProjects();
		renderStatuses();
		setNotice(`Synced ${projects.length} projects and ${settings.statuses.length} statuses.`);
	} catch (error) {
		setNotice(error instanceof Error ? error.message : String(error), true);
	}
}

async function taskNotesClientFromForm(): Promise<TaskNotesClient> {
	await saveFormSilently();
	return new TaskNotesClient(settings, await loadTaskNotesToken());
}

async function saveFormSilently(): Promise<void> {
	settings.taskNotesBaseUrl = (document.getElementById('tasknotes-url') as HTMLInputElement).value;
	settings.vaultName = (document.getElementById('vault-name') as HTMLInputElement).value;
	settings.destinationFile = (document.getElementById('destination-file') as HTMLInputElement).value;
	settings.silentOpen = (document.getElementById('silent-open') as HTMLInputElement).checked;
	settings = await saveTaskClipperSettings(settings);
	await saveTaskNotesToken((document.getElementById('tasknotes-token') as HTMLInputElement).value);
}

function setNotice(message: string, isError = false): void {
	notice.textContent = message;
	notice.classList.toggle('is-error', isError);
}
