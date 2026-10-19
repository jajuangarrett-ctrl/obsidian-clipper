import { TaskCatalogSettings, normalizePeople } from './storage';

export async function fetchTaskManagerPeople(settings: TaskCatalogSettings): Promise<string[]> {
	if (!settings.catalogToken) throw new Error('Connect to Objective Manager in Settings to load People.');
	const response = await fetch(`http://127.0.0.1:${settings.catalogPort}/people`, {
		headers: { Authorization: `Bearer ${settings.catalogToken}` },
		cache: 'no-store',
		signal: AbortSignal.timeout(3000),
	});
	if (!response.ok) throw new Error(response.status === 404
		? 'Update Objective Manager to 0.23.2 or later to load People.'
		: 'People could not load. Check the catalog connection in Settings.');
	const body = await response.json() as { people?: string[] };
	if (!Array.isArray(body.people)) throw new Error('The catalog did not return a People list.');
	return normalizePeople(body.people);
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
