import { TaskClipperSettings, StatusOption } from './storage';

export type TaskNotesTask = {
	id: string;
	title: string;
	details?: string;
	status?: string;
	archived?: boolean;
	projects?: string[];
	tags?: string[];
	path?: string;
	[key: string]: unknown;
};

export type TaskNotesFilterOptions = {
	projects?: string[];
	statuses?: Array<string | StatusOption | { value?: string; label?: string; name?: string; id?: string }>;
	tags?: string[];
	[key: string]: unknown;
};

type TaskNotesResponse<T> = {
	success?: boolean;
	data?: T;
	error?: string;
};

type RequestOptions = {
	method?: string;
	body?: unknown;
};

export class TaskNotesClient {
	private baseUrl: string;
	private token: string;
	private fetcher: typeof fetch;

	constructor(settings: Pick<TaskClipperSettings, 'taskNotesBaseUrl'>, token = '', fetcher: typeof fetch = fetch) {
		this.baseUrl = settings.taskNotesBaseUrl.replace(/\/+$/, '');
		this.token = token.trim();
		this.fetcher = fetcher;
	}

	async health(): Promise<unknown> {
		return this.request<unknown>('/api/health');
	}

	async filterOptions(): Promise<TaskNotesFilterOptions> {
		return this.request<TaskNotesFilterOptions>('/api/filter-options');
	}

	async queryActiveTasks(): Promise<TaskNotesTask[]> {
		const response = await this.request<{ tasks?: TaskNotesTask[] }>('/api/tasks/query', {
			method: 'POST',
			body: activeTasksQuery(),
		});
		return Array.isArray(response.tasks) ? response.tasks : [];
	}

	async createTask(payload: {
		title: string;
		details?: string;
		status?: string;
		projects?: string[];
		tags?: string[];
	}): Promise<TaskNotesTask> {
		return this.request<TaskNotesTask>('/api/tasks', {
			method: 'POST',
			body: payload,
		});
	}

	async getTask(taskId: string): Promise<TaskNotesTask> {
		return this.request<TaskNotesTask>(`/api/tasks/${encodeURIComponent(taskId)}`);
	}

	async updateTask(taskId: string, payload: Partial<TaskNotesTask>): Promise<TaskNotesTask> {
		return this.request<TaskNotesTask>(`/api/tasks/${encodeURIComponent(taskId)}`, {
			method: 'PUT',
			body: payload,
		});
	}

	private async request<T>(path: string, options: RequestOptions = {}): Promise<T> {
		const headers: Record<string, string> = {
			Accept: 'application/json',
		};
		if (options.body !== undefined) headers['Content-Type'] = 'application/json';
		if (this.token) headers.Authorization = `Bearer ${this.token}`;

		let response: Response;
		try {
			response = await this.fetcher(`${this.baseUrl}${path}`, {
				method: options.method || (options.body === undefined ? 'GET' : 'POST'),
				headers,
				body: options.body === undefined ? undefined : JSON.stringify(options.body),
			});
		} catch {
			throw new Error('TaskNotes API is unavailable. Confirm Obsidian is running and TaskNotes HTTP API is enabled.');
		}

		const text = await response.text();
		let parsed: TaskNotesResponse<T> | T | null = null;
		try {
			parsed = text ? JSON.parse(text) : null;
		} catch {
			parsed = null;
		}

		if (!response.ok) {
			const message = parsed && typeof parsed === 'object' && 'error' in parsed
				? String((parsed as TaskNotesResponse<T>).error)
				: text;
			throw new Error(message || `TaskNotes API failed with HTTP ${response.status}.`);
		}

		if (parsed && typeof parsed === 'object' && 'success' in parsed && 'data' in parsed) {
			return (parsed as TaskNotesResponse<T>).data as T;
		}
		return parsed as T;
	}
}

export function activeTasksQuery(): Record<string, unknown> {
	return {
		type: 'group',
		id: 'root',
		conjunction: 'and',
		children: [
			{
				type: 'condition',
				id: 'not-archived',
				property: 'archived',
				operator: 'is-not-checked',
			},
			{
				type: 'condition',
				id: 'not-completed',
				property: 'status.isCompleted',
				operator: 'is-not-checked',
			},
		],
		sortKey: 'dateModified',
		sortDirection: 'desc',
		groupKey: 'none',
	};
}

export function normalizeFilterStatuses(options: TaskNotesFilterOptions, defaults: StatusOption[]): StatusOption[] {
	const raw = Array.isArray(options.statuses) ? options.statuses : [];
	const next: StatusOption[] = [];
	for (const item of raw) {
		if (typeof item === 'string') {
			next.push({ id: item, label: item });
		} else if (item && typeof item === 'object') {
			const id = String(item.value || item.id || item.name || item.label || '').trim();
			const label = String(item.label || item.name || id).trim();
			if (id) next.push({ id, label: label || id });
		}
	}
	const merged = [...defaults, ...next];
	const seen = new Set<string>();
	return merged.filter((status) => {
		if (!status.id || seen.has(status.id)) return false;
		seen.add(status.id);
		return true;
	});
}
