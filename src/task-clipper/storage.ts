import browser from '../utils/browser-polyfill';

export type StatusOption = {
	id: string;
	label: string;
};

export type TaskClipperSettings = {
	vaultName: string;
	destinationFile: string;
	taskFolder: string;
	projects: string[];
	tags: string[];
	statuses: StatusOption[];
	defaultStatus: string;
	defaultProject: string;
	taskManagerDefaultsVersion: number;
	silentOpen: boolean;
	openAiModel: string;
};

export type TaskCatalogSettings = {
	catalogPort: number;
	catalogToken: string;
};

const SETTINGS_KEY = 'fjgTaskClipperSettings';
const CATALOG_SETTINGS_KEY = 'fjgTaskClipperCatalogSettings';
const OPENAI_API_KEY = 'fjgTaskClipperOpenAiApiKey';

export const DEFAULT_STATUSES: StatusOption[] = [
	{ id: 'Inbox', label: 'Inbox' },
	{ id: 'DoFirst', label: 'Do First' },
	{ id: 'DoSoon', label: 'Do Soon' },
	{ id: 'Ongoing', label: 'Ongoing' },
	{ id: 'Delegate', label: 'Delegate' },
	{ id: 'Waiting', label: 'Waiting' },
	{ id: 'On-Hold', label: 'On Hold' },
	{ id: 'Completed', label: 'Completed' },
];

export const DEFAULT_SETTINGS: TaskClipperSettings = {
	vaultName: '',
	destinationFile: '08 Tasks/Tasks',
	taskFolder: 'TaskNotes/Tasks',
	projects: [],
	tags: ['task'],
	statuses: DEFAULT_STATUSES,
	defaultStatus: 'DoFirst',
	defaultProject: '',
	taskManagerDefaultsVersion: 1,
	silentOpen: true,
	openAiModel: 'gpt-4.1-mini',
};

export const DEFAULT_CATALOG_SETTINGS: TaskCatalogSettings = {
	catalogPort: 27124,
	catalogToken: '',
};

export function cleanStatusId(value: string): string {
	return value
		.trim()
		.replace(/^#/, '')
		.replace(/\s+/g, '-')
		.replace(/[^A-Za-z0-9-]/g, '');
}

export function cleanProjectName(value: string): string {
	return value.replace(/\s+/g, ' ').trim();
}

export function normalizeSettings(raw: Partial<TaskClipperSettings> | undefined): TaskClipperSettings {
	const source = raw || {};
	const hasVaultName = Object.prototype.hasOwnProperty.call(source, 'vaultName');
	const merged = { ...DEFAULT_SETTINGS, ...(raw || {}) };
	const statuses = normalizeStatuses(merged.statuses);
	const projects = normalizeProjects(merged.projects);
	const tags = normalizeTags(merged.tags);
	const defaultStatusCandidate = defaultStatusForTaskManager(source, merged.defaultStatus);
	const defaultStatus = statuses.some((status) => status.id === defaultStatusCandidate)
		? defaultStatusCandidate
		: statuses[0].id;
	return {
		vaultName: normalizeVaultName(source.vaultName, hasVaultName),
		destinationFile: normalizeDestinationFile(merged.destinationFile),
		taskFolder: normalizeDestinationFile(merged.taskFolder || DEFAULT_SETTINGS.taskFolder),
		projects,
		tags,
		statuses,
		defaultStatus,
		defaultProject: '',
		taskManagerDefaultsVersion: DEFAULT_SETTINGS.taskManagerDefaultsVersion,
		silentOpen: Boolean(merged.silentOpen),
		openAiModel: normalizeOpenAiModel(merged.openAiModel),
	};
}

export async function loadTaskClipperSettings(): Promise<TaskClipperSettings> {
	const result = await browser.storage.sync.get(SETTINGS_KEY) as Record<string, Partial<TaskClipperSettings> | undefined>;
	return normalizeSettings(result[SETTINGS_KEY]);
}

export async function saveTaskClipperSettings(settings: TaskClipperSettings): Promise<TaskClipperSettings> {
	const normalized = normalizeSettings(settings);
	await browser.storage.sync.set({ [SETTINGS_KEY]: normalized });
	return normalized;
}

export async function loadCatalogSettings(): Promise<TaskCatalogSettings> {
	const result = await browser.storage.local.get(CATALOG_SETTINGS_KEY) as Record<string, Partial<TaskCatalogSettings> | undefined>;
	return normalizeCatalogSettings(result[CATALOG_SETTINGS_KEY]);
}

export async function saveCatalogSettings(settings: TaskCatalogSettings): Promise<TaskCatalogSettings> {
	const normalized = normalizeCatalogSettings(settings);
	await browser.storage.local.set({ [CATALOG_SETTINGS_KEY]: normalized });
	return normalized;
}

export async function loadOpenAiApiKey(): Promise<string> {
	const result = await browser.storage.local.get(OPENAI_API_KEY) as Record<string, string | undefined>;
	return result[OPENAI_API_KEY] || '';
}

export async function saveOpenAiApiKey(apiKey: string): Promise<void> {
	const clean = apiKey.trim();
	if (clean) {
		await browser.storage.local.set({ [OPENAI_API_KEY]: clean });
		return;
	}
	await browser.storage.local.remove(OPENAI_API_KEY);
}

function normalizeStatuses(statuses: StatusOption[] | undefined): StatusOption[] {
	const source = Array.isArray(statuses) && statuses.length ? statuses : DEFAULT_STATUSES;
	const byId = new Map<string, StatusOption>();
	const custom: StatusOption[] = [];

	for (const item of source) {
		const id = cleanStatusId(String(item?.id || item?.label || ''));
		const label = String(item?.label || id).replace(/\s+/g, ' ').trim();
		if (!id || byId.has(id)) continue;
		byId.set(id, { id, label: label || id });
	}

	const seen = new Set<string>();
	const out: StatusOption[] = [];
	for (const item of DEFAULT_STATUSES) {
		const status = byId.get(item.id) || item;
		out.push(status);
		seen.add(item.id);
	}

	for (const item of byId.values()) {
		if (seen.has(item.id)) continue;
		custom.push(item);
	}

	return [...out, ...custom];
}

function normalizeProjects(projects: string[] | undefined): string[] {
	const source = Array.isArray(projects) ? projects : [];
	const clean = source
		.map((project) => cleanProjectName(String(project || '')))
		.filter(Boolean);
	return [...new Set(clean)].sort((a, b) => a.localeCompare(b));
}

function normalizeTags(tags: string[] | undefined): string[] {
	const source = Array.isArray(tags) ? tags : ['task'];
	const clean = source
		.map((tag) => String(tag || '').trim().replace(/^#/, ''))
		.filter(Boolean);
	if (!clean.includes('task')) clean.unshift('task');
	return [...new Set(clean)].sort((a, b) => a.localeCompare(b));
}

function normalizeDestinationFile(value: string): string {
	return String(value || DEFAULT_SETTINGS.destinationFile)
		.trim()
		.replace(/\\/g, '/')
		.replace(/^\/+/, '')
		.replace(/\.md$/i, '');
}

function normalizeCatalogSettings(value: Partial<TaskCatalogSettings> | undefined): TaskCatalogSettings {
	return {
		catalogPort: normalizePort(value?.catalogPort),
		catalogToken: String(value?.catalogToken || '').trim(),
	};
}

function normalizePort(value: unknown): number {
	const port = Number(value);
	return Number.isInteger(port) && port >= 1024 && port <= 65535
		? port
		: DEFAULT_CATALOG_SETTINGS.catalogPort;
}

function normalizeOpenAiModel(value: string | undefined): string {
	return String(value || DEFAULT_SETTINGS.openAiModel).trim() || DEFAULT_SETTINGS.openAiModel;
}

function normalizeVaultName(value: string | undefined, hasValue: boolean): string {
	if (!hasValue || value === undefined) return DEFAULT_SETTINGS.vaultName;
	const trimmed = String(value).trim();
	return trimmed === 'FJG Vault' ? '' : trimmed;
}

function defaultStatusForTaskManager(
	source: Partial<TaskClipperSettings>,
	defaultStatus: string,
): string {
	const alreadyMigrated = Number(source.taskManagerDefaultsVersion || 0) >= DEFAULT_SETTINGS.taskManagerDefaultsVersion;
	if (!alreadyMigrated && defaultStatus === 'Inbox') return DEFAULT_SETTINGS.defaultStatus;
	return defaultStatus || DEFAULT_SETTINGS.defaultStatus;
}
