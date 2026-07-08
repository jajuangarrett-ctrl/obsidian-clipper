import {
	DEFAULT_STATUSES,
	TaskClipperSettings,
	cleanProjectName,
	cleanStatusId,
	loadOpenAiApiKey,
	loadTaskClipperSettings,
	saveOpenAiApiKey,
	saveTaskClipperSettings,
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
	(document.getElementById('task-folder') as HTMLInputElement).value = settings.taskFolder;
	(document.getElementById('openai-model') as HTMLInputElement).value = settings.openAiModel;
	(document.getElementById('openai-api-key') as HTMLInputElement).value = await loadOpenAiApiKey();
	renderProjects();
	renderTags();
	renderStatuses();
}

function bindEvents(): void {
	document.getElementById('save-settings')?.addEventListener('click', saveForm);
	document.getElementById('project-form')?.addEventListener('submit', addProject);
	document.getElementById('tag-form')?.addEventListener('submit', addTag);
	document.getElementById('status-form')?.addEventListener('submit', addStatus);
	document.getElementById('reset-statuses')?.addEventListener('click', resetStatuses);
}

async function saveForm(): Promise<void> {
	settings.vaultName = (document.getElementById('vault-name') as HTMLInputElement).value;
	settings.destinationFile = (document.getElementById('destination-file') as HTMLInputElement).value;
	settings.taskFolder = (document.getElementById('task-folder') as HTMLInputElement).value;
	settings.openAiModel = (document.getElementById('openai-model') as HTMLInputElement).value;
	settings = await saveTaskClipperSettings(settings);
	await saveOpenAiApiKey((document.getElementById('openai-api-key') as HTMLInputElement).value);
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

async function addTag(event: Event): Promise<void> {
	event.preventDefault();
	const input = document.getElementById('tag-name') as HTMLInputElement;
	const tag = input.value.trim().replace(/^#/, '');
	if (!tag) return setNotice('Enter a tag name.', true);
	settings.tags = [...new Set([...settings.tags, tag])].sort((a, b) => a.localeCompare(b));
	settings = await saveTaskClipperSettings(settings);
	input.value = '';
	renderTags();
	setNotice('Tag added.');
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

function renderTags(): void {
	const list = document.getElementById('tag-list') as HTMLElement;
	list.textContent = '';
	if (!settings.tags.length) {
		list.textContent = 'No tags saved yet.';
		return;
	}

	for (const tag of settings.tags) {
		const item = document.createElement('div');
		item.className = 'manage-item';
		const label = document.createElement('span');
		label.textContent = `#${tag}`;
		const button = document.createElement('button');
		button.type = 'button';
		button.textContent = tag === 'task' ? 'Default' : 'Delete';
		button.disabled = tag === 'task';
		button.addEventListener('click', async () => {
			settings.tags = settings.tags.filter((itemTag) => itemTag !== tag);
			settings = await saveTaskClipperSettings(settings);
			renderTags();
			setNotice('Tag deleted.');
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

function setNotice(message: string, isError = false): void {
	notice.textContent = message;
	notice.classList.toggle('is-error', isError);
}
