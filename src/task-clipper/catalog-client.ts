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

export async function testTaskManagerCatalog(settings: TaskCatalogSettings): Promise<void> {
	if (!settings.catalogToken) throw new Error('Paste the FJG Task Manager pairing token first.');
	const response = await fetch(`http://127.0.0.1:${settings.catalogPort}/health`, {
		headers: { Authorization: `Bearer ${settings.catalogToken}` },
		cache: 'no-store',
	});
	if (!response.ok) throw new Error(`Catalog HTTP ${response.status}`);
}
