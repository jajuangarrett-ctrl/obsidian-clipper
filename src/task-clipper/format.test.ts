import { describe, expect, test } from 'vitest';
import { buildObsidianTaskContent, buildSourceLine, buildUpdateBlock } from './format';

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

	test('builds a dated update block with source', () => {
		const result = buildUpdateBlock(
			'Fresh update',
			{ title: 'Agenda', url: 'https://example.com/agenda' },
			new Date('2026-07-07T09:05:00'),
		);

		expect(result).toBe('### 2026-07-07 09:05\n\nFresh update\n\nSource: [Agenda](https://example.com/agenda)');
	});

	test('uses a plain email subject instead of an email link', () => {
		const result = buildSourceLine({
			title: 'Pedro Beltran Garcia is cleared to work - Franklin Garrett - Outlook',
			url: 'https://outlook.cloud.microsoft/mail/inbox/id/abc',
			sourceKind: 'email',
		});

		expect(result).toBe('Email subject: Pedro Beltran Garcia is cleared to work');
	});

	test('does not save Outlook mailbox chrome as an email subject', () => {
		const result = buildSourceLine({
			title: 'Inbox - Franklin Garrett - Outlook',
			url: 'https://outlook.cloud.microsoft/mail/inbox/id/abc',
			sourceKind: 'email',
		});

		expect(result).toBe('Email source: subject unavailable');
	});
});
