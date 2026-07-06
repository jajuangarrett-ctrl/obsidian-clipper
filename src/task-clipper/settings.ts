import {
	DEFAULT_STATUSES,
	TaskClipperSettings,
	cleanProjectName,
	cleanStatusId,
	loadTaskClipperSettings,
	loadTaskboardPassword,
	saveTaskClipperSettings,
	saveTaskboardPassword,
} from './storage';

let settings: TaskClipperSettings;

const notice = document.getElementById('settings-notice') as HTMLElement;

document.addEventListener('DOMContentLoaded', init);

async function init(): Promise<void> {
	settings = await loadTaskClipperSettings();
	await populateForm();
	bindEvents();
}

async function populateForm(): Promise<void> {
	(document.getElementById('vault-name') as HTMLInputElement).value = settings.vaultName;
	(document.getElementById('destination-file') as HTMLInputElement).value = settings.destinationFile;
	(document.getElementById('silent-open') as HTMLInputElement).checked = settings.silentOpen;
	(document.getElementById('taskboard-url') as HTMLInputElement).value = settings.taskboardBaseUrl;
	(document.getElementById('taskboard-password') as HTMLInputElement).value = await loadTaskboardPassword();
	(document.getElementById('add-to-taskboard') as HTMLInputElement).checked = settings.addToTaskboard;
	renderProjects();
	renderStatuses();
}

function bindEvents(): void {
	document.getElementById('save-settings')?.addEventListener('click', saveForm);
	document.getElementById('project-form')?.addEventListener('submit', addProject);
	document.getElementById('status-form')?.addEventListener('submit', addStatus);
	document.getElementById('reset-statuses')?.addEventListener('click', resetStatuses);
	document.getElementById('sync-projects')?.addEventListener('click', syncProjects);
	document.getElementById('test-taskboard')?.addEventListener('click', testTaskboard);
}

async function saveForm(): Promise<void> {
	settings.vaultName = (document.getElementById('vault-name') as HTMLInputElement).value;
	settings.destinationFile = (document.getElementById('destination-file') as HTMLInputElement).value;
	settings.silentOpen = (document.getElementById('silent-open') as HTMLInputElement).checked;
	settings.taskboardBaseUrl = (document.getElementById('taskboard-url') as HTMLInputElement).value;
	settings.addToTaskboard = (document.getElementById('add-to-taskboard') as HTMLInputElement).checked;
	settings = await saveTaskClipperSettings(settings);
	await saveTaskboardPassword((document.getElementById('taskboard-password') as HTMLInputElement).value);
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
	if (!label || !id) return setNotice('Enter a status label and hashtag.', true);
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
		label.textContent = `${status.label} (#${status.id})`;
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

async function syncProjects(): Promise<void> {
	try {
		const board = await fetchTaskboard();
		const projects = Array.isArray(board.projects) ? board.projects : [];
		settings.projects = [...new Set([...settings.projects, ...projects.map((project) => cleanProjectName(String(project)))])]
			.filter(Boolean)
			.sort((a, b) => a.localeCompare(b));
		settings = await saveTaskClipperSettings(settings);
		renderProjects();
		setNotice(`Synced ${projects.length} projects.`);
	} catch (error) {
		setNotice(error instanceof Error ? error.message : String(error), true);
	}
}

async function testTaskboard(): Promise<void> {
	try {
		const board = await fetchTaskboard();
		const projectCount = Array.isArray(board.projects) ? board.projects.length : 0;
		setNotice(`Connected. ${projectCount} projects available.`);
	} catch (error) {
		setNotice(error instanceof Error ? error.message : String(error), true);
	}
}

async function fetchTaskboard(): Promise<{ projects?: string[] }> {
	await saveFormSilently();
	const password = await loadTaskboardPassword();
	if (!password) throw new Error('Dashboard password is required.');

	const response = await fetch(`${settings.taskboardBaseUrl}/api/tasks`, {
		headers: { 'X-Dashboard-Password': password },
	});
	if (!response.ok) {
		const text = await response.text();
		throw new Error(text || `Taskboard request failed with HTTP ${response.status}.`);
	}
	return response.json() as Promise<{ projects?: string[] }>;
}

async function saveFormSilently(): Promise<void> {
	settings.vaultName = (document.getElementById('vault-name') as HTMLInputElement).value;
	settings.destinationFile = (document.getElementById('destination-file') as HTMLInputElement).value;
	settings.silentOpen = (document.getElementById('silent-open') as HTMLInputElement).checked;
	settings.taskboardBaseUrl = (document.getElementById('taskboard-url') as HTMLInputElement).value;
	settings.addToTaskboard = (document.getElementById('add-to-taskboard') as HTMLInputElement).checked;
	settings = await saveTaskClipperSettings(settings);
	await saveTaskboardPassword((document.getElementById('taskboard-password') as HTMLInputElement).value);
}

function setNotice(message: string, isError = false): void {
	notice.textContent = message;
	notice.classList.toggle('is-error', isError);
}
