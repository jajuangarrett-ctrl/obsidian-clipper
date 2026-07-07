import browser from '../utils/browser-polyfill';

export type StatusOption = {
	id: string;
	label: string;
};

export type TaskClipperSettings = {
	vaultName: string;
	destinationFile: string;
	projects: string[];
	statuses: StatusOption[];
	defaultStatus: string;
	defaultProject: string;
	silentOpen: boolean;
	taskboardBaseUrl: string;
	addToTaskboard: boolean;
	taskNotesBaseUrl: string;
};

const SETTINGS_KEY = 'fjgTaskClipperSettings';
const TASKBOARD_PASSWORD_KEY = 'fjgTaskClipperTaskboardPassword';
const TASKNOTES_TOKEN_KEY = 'fjgTaskClipperTaskNotesToken';

export const DEFAULT_STATUSES: StatusOption[] = [
	{ id: 'Inbox', label: 'Inbox' },
	{ id: 'DoFirst', label: 'Do First' },
	{ id: 'DoSoon', label: 'Do Soon' },
	{ id: 'Delegate', label: 'Delegate' },
	{ id: 'Waiting', label: 'Waiting' },
	{ id: 'On-Hold', label: 'On Hold' },
];

export const DEFAULT_SETTINGS: TaskClipperSettings = {
	vaultName: 'FJG Vault',
	destinationFile: '08 Tasks/Tasks',
	projects: [],
	statuses: DEFAULT_STATUSES,
	defaultStatus: 'Inbox',
	defaultProject: '',
	silentOpen: true,
	taskboardBaseUrl: 'https://fjg-taskboard.netlify.app',
	addToTaskboard: false,
	taskNotesBaseUrl: 'http://localhost:8080',
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
	const merged = { ...DEFAULT_SETTINGS, ...(raw || {}) };
	const statuses = normalizeStatuses(merged.statuses);
	const projects = normalizeProjects(merged.projects);
	const defaultStatus = statuses.some((status) => status.id === merged.defaultStatus)
		? merged.defaultStatus
		: statuses[0].id;
	const defaultProject = projects.includes(merged.defaultProject) ? merged.defaultProject : '';

	return {
		vaultName: String(merged.vaultName || DEFAULT_SETTINGS.vaultName).trim(),
		destinationFile: normalizeDestinationFile(merged.destinationFile),
		projects,
		statuses,
		defaultStatus,
		defaultProject,
		silentOpen: Boolean(merged.silentOpen),
		taskboardBaseUrl: normalizeBaseUrl(merged.taskboardBaseUrl),
		addToTaskboard: Boolean(merged.addToTaskboard),
		taskNotesBaseUrl: normalizeBaseUrl(merged.taskNotesBaseUrl),
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

export async function loadTaskboardPassword(): Promise<string> {
	const result = await browser.storage.local.get(TASKBOARD_PASSWORD_KEY) as Record<string, string | undefined>;
	return result[TASKBOARD_PASSWORD_KEY] || '';
}

export async function saveTaskboardPassword(password: string): Promise<void> {
	await browser.storage.local.set({ [TASKBOARD_PASSWORD_KEY]: password });
}

export async function loadTaskNotesToken(): Promise<string> {
	const result = await browser.storage.local.get(TASKNOTES_TOKEN_KEY) as Record<string, string | undefined>;
	return result[TASKNOTES_TOKEN_KEY] || '';
}

export async function saveTaskNotesToken(token: string): Promise<void> {
	await browser.storage.local.set({ [TASKNOTES_TOKEN_KEY]: token.trim() });
}

function normalizeStatuses(statuses: StatusOption[] | undefined): StatusOption[] {
	const source = Array.isArray(statuses) && statuses.length ? statuses : DEFAULT_STATUSES;
	const seen = new Set<string>();
	const out: StatusOption[] = [];

	for (const item of source) {
		const id = cleanStatusId(String(item?.id || item?.label || ''));
		const label = String(item?.label || id).replace(/\s+/g, ' ').trim();
		if (!id || seen.has(id)) continue;
		seen.add(id);
		out.push({ id, label: label || id });
	}

	for (const item of DEFAULT_STATUSES) {
		if (!seen.has(item.id)) {
			out.push(item);
			seen.add(item.id);
		}
	}

	return out;
}

function normalizeProjects(projects: string[] | undefined): string[] {
	const source = Array.isArray(projects) ? projects : [];
	const clean = source
		.map((project) => cleanProjectName(String(project || '')))
		.filter(Boolean);
	return [...new Set(clean)].sort((a, b) => a.localeCompare(b));
}

function normalizeDestinationFile(value: string): string {
	return String(value || DEFAULT_SETTINGS.destinationFile)
		.trim()
		.replace(/\\/g, '/')
		.replace(/^\/+/, '')
		.replace(/\.md$/i, '');
}

function normalizeBaseUrl(value: string): string {
	return String(value || DEFAULT_SETTINGS.taskboardBaseUrl).trim().replace(/\/+$/, '');
}
