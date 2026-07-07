import { describe, expect, test } from 'vitest';
import { buildObsidianTaskContent } from './format';

const STATUSES = [
	{ id: 'Inbox', label: 'Inbox' },
	{ id: 'DoSoon', label: 'Do Soon' },
];

describe('task clipper formatting', () => {
	test('builds plain Obsidian task lines with project, tags, status, and source', () => {
		const result = buildObsidianTaskContent(
			'Review student support memo #DoSoon',
			'DoSoon',
			'Basic Needs',
			STATUSES,
			['task', 'followup'],
			{ title: 'Memo page', url: 'https://example.com/memo' },
		);

		expect(result).toBe('- [ ] Review student support memo PJ: Basic Needs #task #followup #DoSoon\n  - Source: [Memo page](https://example.com/memo)');
	});

	test('strips old task and status tags before writing the new status tag', () => {
		const result = buildObsidianTaskContent(
			'Review the budget packet #task #DoSoon',
			'Inbox',
			'Budget',
			STATUSES,
			['task'],
			{ title: '', url: '' },
		);

		expect(result).toBe('- [ ] Review the budget packet PJ: Budget #task #Inbox');
	});

	test('supports multiple selected lines as multiple tasks', () => {
		const result = buildObsidianTaskContent(
			'First task\nSecond task',
			'Waiting',
			'',
			STATUSES,
			['task'],
			{ title: '', url: '' },
		);

		expect(result).toBe('- [ ] First task #task #Waiting\n- [ ] Second task #task #Waiting');
	});
});
