import { describe, expect, test, vi } from 'vitest';
import { TaskNotesClient, activeTasksQuery, normalizeFilterStatuses } from './tasknotes-api';

type FetchMock = ReturnType<typeof vi.fn> & typeof fetch;

function jsonResponse(body: unknown, status = 200): Response {
	return new Response(JSON.stringify(body), {
		status,
		headers: { 'Content-Type': 'application/json' },
	});
}

describe('TaskNotes API client', () => {
	test('adds bearer auth only when token is configured', async () => {
		const fetcher = vi.fn(async () => jsonResponse({ success: true, data: { ok: true } })) as FetchMock;
		const client = new TaskNotesClient({ taskNotesBaseUrl: 'http://localhost:8080/' }, 'secret', fetcher);

		await client.health();

		expect(fetcher).toHaveBeenCalledWith('http://localhost:8080/api/health', expect.objectContaining({
			headers: expect.objectContaining({ Authorization: 'Bearer secret' }),
		}));
	});

	test('omits bearer auth when token is blank', async () => {
		const fetcher = vi.fn(async () => jsonResponse({ success: true, data: { ok: true } })) as FetchMock;
		const client = new TaskNotesClient({ taskNotesBaseUrl: 'http://localhost:8080' }, '', fetcher);

		await client.health();

		const [, options] = fetcher.mock.calls[0];
		expect((options?.headers as Record<string, string>).Authorization).toBeUndefined();
	});

	test('queries active unarchived tasks with documented query shape', async () => {
		const fetcher = vi.fn(async () => jsonResponse({ success: true, data: { tasks: [] } })) as FetchMock;
		const client = new TaskNotesClient({ taskNotesBaseUrl: 'http://localhost:8080' }, '', fetcher);

		await client.queryActiveTasks();

		const [, options] = fetcher.mock.calls[0];
		expect(fetcher).toHaveBeenCalledWith('http://localhost:8080/api/tasks/query', expect.anything());
		expect(JSON.parse(String(options?.body))).toEqual(activeTasksQuery());
	});

	test('creates task payload through POST /api/tasks', async () => {
		const fetcher = vi.fn(async () => jsonResponse({ success: true, data: { id: 'Task.md', title: 'Review' } })) as FetchMock;
		const client = new TaskNotesClient({ taskNotesBaseUrl: 'http://localhost:8080' }, '', fetcher);

		await client.createTask({
			title: 'Review',
			details: 'Details',
			status: 'DoSoon',
			projects: ['Budget'],
			tags: ['task'],
		});

		const [, options] = fetcher.mock.calls[0];
		expect(fetcher).toHaveBeenCalledWith('http://localhost:8080/api/tasks', expect.anything());
		expect(JSON.parse(String(options?.body))).toMatchObject({
			title: 'Review',
			details: 'Details',
			status: 'DoSoon',
			projects: ['Budget'],
			tags: ['task'],
		});
	});

	test('includes the local API URL when TaskNotes cannot be reached', async () => {
		const fetcher = vi.fn(async () => {
			throw new TypeError('Failed to fetch');
		}) as FetchMock;
		const client = new TaskNotesClient({ taskNotesBaseUrl: 'http://localhost:8080' }, '', fetcher);

		await expect(client.health()).rejects.toThrow('TaskNotes API is unavailable at http://localhost:8080');
	});

	test('normalizes filter statuses while preserving defaults', () => {
		const statuses = normalizeFilterStatuses(
			{ statuses: ['open', { value: 'waiting', label: 'Waiting' }] },
			[{ id: 'Inbox', label: 'Inbox' }],
		);

		expect(statuses).toEqual([
			{ id: 'Inbox', label: 'Inbox' },
			{ id: 'open', label: 'open' },
			{ id: 'waiting', label: 'Waiting' },
		]);
	});
});
