import browser from '../utils/browser-polyfill';

export type StatusOption = {
	id: string;
	label: string;
};

export type TaskClipperSettings = {
	vaultName: string;
	destinationFile: string;
	projects: string[];
	tags: string[];
	statuses: StatusOption[];
	defaultStatus: string;
	defaultProject: string;
	silentOpen: boolean;
};

const SETTINGS_KEY = 'fjgTaskClipperSettings';

export const DEFAULT_STATUSES: StatusOption[] = [
	{ id: 'Inbox', label: 'Inbox' },
	{ id: 'DoFirst', label: 'Do First' },
	{ id: 'DoSoon', label: 'Do Soon' },
	{ id: 'Delegate', label: 'Delegate' },
	{ id: 'Waiting', label: 'Waiting' },
	{ id: 'On-Hold', label: 'On Hold' },
];

export const DEFAULT_SETTINGS: TaskClipperSettings = {
	vaultName: '',
	destinationFile: '08 Tasks/Tasks',
	projects: [],
	tags: ['task'],
	statuses: DEFAULT_STATUSES,
	defaultStatus: 'Inbox',
	defaultProject: '',
	silentOpen: true,
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
	const defaultStatus = statuses.some((status) => status.id === merged.defaultStatus)
		? merged.defaultStatus
		: statuses[0].id;
	const defaultProject = projects.includes(merged.defaultProject) ? merged.defaultProject : '';

	return {
		vaultName: normalizeVaultName(source.vaultName, hasVaultName),
		destinationFile: normalizeDestinationFile(merged.destinationFile),
		projects,
		tags,
		statuses,
		defaultStatus,
		defaultProject,
		silentOpen: Boolean(merged.silentOpen),
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

function normalizeVaultName(value: string | undefined, hasValue: boolean): string {
	if (!hasValue || value === undefined) return DEFAULT_SETTINGS.vaultName;
	const trimmed = String(value).trim();
	return trimmed === 'FJG Vault' ? '' : trimmed;
}
