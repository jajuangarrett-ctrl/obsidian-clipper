import { TaskCatalogSettings } from './storage';

export async function fetchTaskManagerProjects(settings: TaskCatalogSettings): Promise<string[]> {
	if (!settings.catalogToken) return [];
	const response = await fetch(`http://127.0.0.1:${settings.catalogPort}/projects`, {
		headers: { Authorization: `Bearer ${settings.catalogToken}` },
		cache: 'no-store',
	});
	if (!response.ok) return [];
	const body = await response.json() as { projects?: string[] };
	return Array.isArray(body.projects)
		? [...new Set(body.projects.map((project) => String(project || '').trim()).filter(Boolean))]
			.sort((left, right) => left.localeCompare(right))
		: [];
}

export type CatalogTask = {
	task_id: string;
	title: string;
	status: string;
	project: string;
	delegated_to: string;
	path: string;
	archived: boolean;
};

export async function searchTaskManagerTasks(
	settings: TaskCatalogSettings,
	query: string,
	signal?: AbortSignal,
): Promise<CatalogTask[]> {
	if (!settings.catalogToken) throw new Error('Add the FJG Task Manager pairing token in Settings.');
	const url = new URL(`http://127.0.0.1:${settings.catalogPort}/tasks`);
	url.searchParams.set('q', query.trim());
	url.searchParams.set('limit', '20');
	const response = await fetch(url, {
		headers: { Authorization: `Bearer ${settings.catalogToken}` },
		signal,
		cache: 'no-store',
	});
	const body = await response.json() as { tasks?: CatalogTask[]; error?: string };
	if (!response.ok) throw new Error(body.error || `Catalog HTTP ${response.status}`);
	return Array.isArray(body.tasks) ? body.tasks : [];
}

export async function testTaskManagerCatalog(settings: TaskCatalogSettings): Promise<void> {
	if (!settings.catalogToken) throw new Error('Paste the FJG Task Manager pairing token first.');
	const response = await fetch(`http://127.0.0.1:${settings.catalogPort}/health`, {
		headers: { Authorization: `Bearer ${settings.catalogToken}` },
		cache: 'no-store',
	});
	if (!response.ok) throw new Error(`Catalog HTTP ${response.status}`);
}
