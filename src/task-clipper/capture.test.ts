import { describe, expect, test } from 'vitest';
import {
	cleanEmailSubject,
	initialTaskTitle,
	restorableProject,
} from './capture';

describe('task clipper capture', () => {
	test('uses an Outlook email subject instead of the first selected body line', () => {
		expect(initialTaskTitle({
			selection: 'Dear SDICCCA Campus Coordinators,\n\nPlease review the proposed timeline.',
			title: 'SDICCCA Fellowship – Proposed Timeline & Process Updates (Feedback Requested by Friday)',
			sourceKind: 'email',
		})).toBe('SDICCCA Fellowship – Proposed Timeline & Process Updates (Feedback Requested by Friday)');
	});

	test('uses the first selected line for an ordinary web clip', () => {
		expect(initialTaskTitle({
			selection: 'Review the proposal\nSend feedback',
			title: 'Planning page',
			sourceKind: 'web',
		})).toBe('Review the proposal');
	});

	test('rejects generic Outlook mailbox chrome as an email subject', () => {
		expect(cleanEmailSubject('Mail - Franklin Garrett - Outlook')).toBe('');
	});

	test('restores a recent project only for the same page', () => {
		const now = Date.parse('2026-07-31T04:00:00Z');
		const draft = {
			project: '26-27 SDICCCA Interns',
			url: 'https://outlook.cloud.microsoft/mail/inbox/id/message-1',
			savedAt: now - 1_000,
		};
		expect(restorableProject(
			draft,
			draft.url,
			['26-27 SDICCCA Interns'],
			now,
			5 * 60 * 1_000,
		)).toBe('26-27 SDICCCA Interns');
		expect(restorableProject(
			draft,
			'https://outlook.cloud.microsoft/mail/inbox/id/message-2',
			['26-27 SDICCCA Interns'],
			now,
			5 * 60 * 1_000,
		)).toBe('');
	});

	test('does not restore a stale or unavailable project', () => {
		const now = Date.parse('2026-07-31T04:00:00Z');
		const draft = {
			project: '26-27 SDICCCA Interns',
			url: 'https://outlook.cloud.microsoft/mail/inbox/id/message-1',
			savedAt: now - 10 * 60 * 1_000,
		};
		expect(restorableProject(draft, draft.url, [draft.project], now, 5 * 60 * 1_000)).toBe('');
		expect(restorableProject({ ...draft, savedAt: now }, draft.url, [], now, 5 * 60 * 1_000)).toBe('');
	});
});
