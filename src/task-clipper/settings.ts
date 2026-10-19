import {
	TaskCatalogSettings,
	DEFAULT_STATUSES,
	TaskClipperSettings,
	normalizePeople,
	cleanStatusId,
	loadCatalogSettings,
	loadOpenAiApiKey,
	loadTaskClipperSettings,
	saveCatalogSettings,
	saveOpenAiApiKey,
	saveTaskClipperSettings,
} from './storage';
import { testTaskManagerCatalog } from './catalog-client';

let settings: TaskClipperSettings;
let catalogSettings: TaskCatalogSettings;

const notice = document.getElementById('settings-notice') as HTMLElement;

document.addEventListener('DOMContentLoaded', init);

async function init(): Promise<void> {
	settings = await loadTaskClipperSettings();
	catalogSettings = await loadCatalogSettings();
	await populateForm();
	bindEvents();
}

async function populateForm(): Promise<void> {
	(document.getElementById('vault-name') as HTMLInputElement).value = settings.vaultName;
	(document.getElementById('destination-file') as HTMLInputElement).value = settings.destinationFile;
	(document.getElementById('task-folder') as HTMLInputElement).value = settings.taskFolder;
	(document.getElementById('catalog-port') as HTMLInputElement).value = String(catalogSettings.catalogPort);
	(document.getElementById('catalog-token') as HTMLInputElement).value = catalogSettings.catalogToken;
	(document.getElementById('openai-model') as HTMLInputElement).value = settings.openAiModel;
	(document.getElementById('openai-api-key') as HTMLInputElement).value = await loadOpenAiApiKey();
	renderPeople();
	renderTags();
	renderStatuses();
}

function bindEvents(): void {
	document.getElementById('save-settings')?.addEventListener('click', saveForm);
	document.getElementById('person-form')?.addEventListener('submit', addPerson);
	document.getElementById('test-catalog')?.addEventListener('click', testCatalogConnection);
	document.getElementById('tag-form')?.addEventListener('submit', addTag);
	document.getElementById('status-form')?.addEventListener('submit', addStatus);
	document.getElementById('reset-statuses')?.addEventListener('click', resetStatuses);
}

async function saveForm(): Promise<void> {
	settings.vaultName = (document.getElementById('vault-name') as HTMLInputElement).value;
	settings.destinationFile = (document.getElementById('destination-file') as HTMLInputElement).value;
	settings.taskFolder = (document.getElementById('task-folder') as HTMLInputElement).value;
	settings.openAiModel = (document.getElementById('openai-model') as HTMLInputElement).value;
	catalogSettings.catalogPort = Number((document.getElementById('catalog-port') as HTMLInputElement).value);
	catalogSettings.catalogToken = (document.getElementById('catalog-token') as HTMLInputElement).value;
	settings = await saveTaskClipperSettings(settings);
	catalogSettings = await saveCatalogSettings(catalogSettings);
	await saveOpenAiApiKey((document.getElementById('openai-api-key') as HTMLInputElement).value);
	await populateForm();
	setNotice('Settings saved.');
}

async function testCatalogConnection(): Promise<void> {
	const button = document.getElementById('test-catalog') as HTMLButtonElement;
	button.disabled = true;
	try {
		const candidate = await saveCatalogSettings({
			catalogPort: Number((document.getElementById('catalog-port') as HTMLInputElement).value),
			catalogToken: (document.getElementById('catalog-token') as HTMLInputElement).value,
		});
		catalogSettings = candidate;
		await testTaskManagerCatalog(candidate);
		await populateForm();
		setNotice('Connected to FJG Task Manager catalog.');
	} catch (error) {
		setNotice(error instanceof Error ? error.message : String(error), true);
	} finally {
		button.disabled = false;
	}
}

async function addPerson(event: Event): Promise<void> {
	event.preventDefault();
	const input = document.getElementById('person-name') as HTMLInputElement;
	const person = normalizePeople([input.value])[0];
	if (!person) return setNotice('Enter a person’s name.', true);
	settings.people = normalizePeople([...settings.people, person]);
	settings = await saveTaskClipperSettings(settings);
	input.value = '';
	renderPeople();
	setNotice('Person added.');
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
	settings.defaultStatus = 'DoFirst';
	settings = await saveTaskClipperSettings(settings);
	renderStatuses();
	setNotice('Default statuses restored.');
}

function renderPeople(): void {
	const list = document.getElementById('people-list') as HTMLElement;
	list.textContent = '';
	if (!settings.people.length) {
		list.textContent = 'No manual people saved yet.';
		return;
	}

	for (const person of settings.people) {
		const item = document.createElement('div');
		item.className = 'manage-item';
		const label = document.createElement('span');
		label.textContent = person;
		const button = document.createElement('button');
		button.type = 'button';
		button.textContent = 'Delete';
		button.addEventListener('click', async () => {
			settings.people = settings.people.filter((name) => name !== person);
			settings = await saveTaskClipperSettings(settings);
			renderPeople();
			setNotice('Person removed.');
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
			if (settings.defaultStatus === status.id) settings.defaultStatus = 'DoFirst';
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
