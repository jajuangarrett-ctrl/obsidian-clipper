import { afterEach, describe, expect, test, vi } from 'vitest';
import { searchTaskManagerTasks, fetchTaskManagerPeople } from './catalog-client';

afterEach(() => {
	vi.unstubAllGlobals();
});

describe('Task Manager catalog task search', () => {
	test('requires the pairing token before searching', async () => {
		await expect(searchTaskManagerTasks({ catalogPort: 27124, catalogToken: '' }, 'MIS'))
			.rejects.toThrow('pairing token');
	});

	test('returns stable task IDs from the live catalog response', async () => {
		const fetchMock = vi.fn().mockResolvedValue({
			ok: true,
			status: 200,
			json: async () => ({
				tasks: [{
					task_id: 'tsk_123',
					title: 'Finish MIS reconciliation',
					status: 'do-soon',
					project: 'Summer MIS 2026',
					delegated_to: '',
					path: '08 Tasks/Workspaces/Finish MIS reconciliation',
					archived: false,
				}],
			}),
		});
		vi.stubGlobal('fetch', fetchMock);

		await expect(searchTaskManagerTasks(
			{ catalogPort: 27124, catalogToken: 'catalog-token' },
			'MIS reconciliation',
		)).resolves.toMatchObject([{ task_id: 'tsk_123', title: 'Finish MIS reconciliation' }]);

		const [url, init] = fetchMock.mock.calls[0];
		expect(String(url)).toContain('/tasks?');
		expect(String(url)).toContain('q=MIS+reconciliation');
		expect(init.headers.Authorization).toBe('Bearer catalog-token');
	});

	test('surfaces catalog errors', async () => {
		vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
			ok: false,
			status: 401,
			json: async () => ({ error: 'Invalid catalog token.' }),
		}));

		await expect(searchTaskManagerTasks(
			{ catalogPort: 27124, catalogToken: 'bad-token' },
			'MIS',
		)).rejects.toThrow('Invalid catalog token.');
	});
});

describe('People catalog', () => {
 test('normalizes names and does not request projects', async () => {
  const fetchMock = vi.fn().mockResolvedValue({ok: true, json: async () => ({people: [' Alex  Rivera ', 'alex rivera', 'Sam Lee']})});
  vi.stubGlobal('fetch', fetchMock);
  expect(await fetchTaskManagerPeople({catalogPort:27124,catalogToken:'test'})).toEqual(['Alex Rivera','Sam Lee']);
  expect(fetchMock.mock.calls[0][0]).toBe('http://127.0.0.1:27124/people');
 });
 test('explains missing pairing and unsupported plugins', async () => {
  await expect(fetchTaskManagerPeople({catalogPort:27124,catalogToken:''})).rejects.toThrow('Settings');
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ok:false,status:404}));
  await expect(fetchTaskManagerPeople({catalogPort:27124,catalogToken:'test'})).rejects.toThrow('0.23.2');
 });
});
