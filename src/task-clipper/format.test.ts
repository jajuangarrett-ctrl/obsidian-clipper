import { describe, expect, test } from 'vitest';
import { appendUpdateLog, buildTaskNotePayload } from './format';

const STATUSES = [
	{ id: 'Inbox', label: 'Inbox' },
	{ id: 'DoSoon', label: 'Do Soon' },
];

describe('task clipper formatting', () => {
	test('builds a TaskNotes payload from selected text', () => {
		const payload = buildTaskNotePayload(
			'Review the budget packet #task #DoSoon',
			'DoSoon',
			'Budget',
			STATUSES,
			{ title: 'Budget page', url: 'https://example.com/budget' },
		);

		expect(payload.title).toBe('Review the budget packet');
		expect(payload.status).toBe('DoSoon');
		expect(payload.project).toBe('Budget');
		expect(payload.details).toContain('Review the budget packet #task #DoSoon');
		expect(payload.details).toContain('Source: [Budget page](https://example.com/budget)');
	});

	test('creates an updates section when missing', () => {
		const result = appendUpdateLog(
			'Initial task details',
			'New update',
			{ title: 'Agenda', url: 'https://example.com/agenda' },
			new Date('2026-07-07T16:30:00'),
		);

		expect(result).toContain('Initial task details');
		expect(result).toContain('## Updates');
		expect(result).toContain('### 2026-07-07 16:30');
		expect(result).toContain('New update');
		expect(result).toContain('Source: [Agenda](https://example.com/agenda)');
	});

	test('reuses an existing updates section', () => {
		const result = appendUpdateLog(
			'Body\n\n## Updates\n\n### 2026-07-01 08:00\nOld update\n',
			'Fresh update',
			{ title: '', url: '' },
			new Date('2026-07-07T09:05:00'),
		);

		expect(result.match(/## Updates/g)).toHaveLength(1);
		expect(result).toContain('### 2026-07-07 09:05');
		expect(result).toContain('Fresh update');
		expect(result).toContain('Old update');
	});

	test('omits source when source context is disabled', () => {
		const result = appendUpdateLog(
			'',
			'No source update',
			{ title: '', url: '' },
			new Date('2026-07-07T09:05:00'),
		);

		expect(result).not.toContain('Source:');
	});
});
