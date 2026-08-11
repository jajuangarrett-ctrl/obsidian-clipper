import { describe, expect, test } from 'vitest';
import {
	DEFAULT_CATALOG_SETTINGS,
	DEFAULT_STATUSES,
	DEFAULT_SETTINGS,
	loadCatalogSettings,
	normalizeSettings,
	saveCatalogSettings,
} from './storage';

describe('task clipper settings', () => {
	test('uses the default vault name when no setting is stored', () => {
		expect(DEFAULT_SETTINGS.vaultName).toBe('');
		expect(normalizeSettings(undefined).vaultName).toBe('');
	});

	test('allows a blank vault name so Obsidian can use the active vault', () => {
		expect(normalizeSettings({ vaultName: '' }).vaultName).toBe('');
		expect(normalizeSettings({ vaultName: '   ' }).vaultName).toBe('');
	});

	test('migrates the legacy default vault name to blank', () => {
		expect(normalizeSettings({ vaultName: 'FJG Vault' }).vaultName).toBe('');
	});

	test('trims configured vault names', () => {
		expect(normalizeSettings({ vaultName: '  Work Vault  ' }).vaultName).toBe('Work Vault');
	});

	test('normalizes the destination file without an md extension', () => {
		expect(normalizeSettings({ destinationFile: '/08 Tasks/Tasks.md' }).destinationFile).toBe('08 Tasks/Tasks');
	});

	test('defaults to the TaskNotes task folder for individual task notes', () => {
		expect(normalizeSettings(undefined).taskFolder).toBe('TaskNotes/Tasks');
		expect(normalizeSettings({ taskFolder: '/TaskNotes/Tasks.md' }).taskFolder).toBe('TaskNotes/Tasks');
	});

	test('keeps an OpenAI model setting for title generation', () => {
		expect(normalizeSettings(undefined).openAiModel).toBe(DEFAULT_SETTINGS.openAiModel);
		expect(normalizeSettings({ openAiModel: '  gpt-test-mini  ' }).openAiModel).toBe('gpt-test-mini');
	});

	test('does not carry a saved project into the next clip', () => {
		expect(normalizeSettings({
			projects: ['Basic Needs'],
			defaultProject: 'Basic Needs',
		}).defaultProject).toBe('');
	});

	test('defaults new Task Manager clips to Do First', () => {
		expect(DEFAULT_SETTINGS.defaultStatus).toBe('DoFirst');
		expect(normalizeSettings(undefined).defaultStatus).toBe('DoFirst');
	});

	test('uses the full Task Manager status list in display order', () => {
		expect(DEFAULT_STATUSES.map((status) => status.label)).toEqual([
			'Inbox',
			'Do First',
			'Do Soon',
			'Ongoing',
			'Delegate',
			'Waiting',
			'On Hold',
			'Completed',
		]);
	});

	test('adds missing default statuses into their canonical order for older saved settings', () => {
		expect(normalizeSettings({
			statuses: [
				{ id: 'Inbox', label: 'Inbox' },
				{ id: 'DoFirst', label: 'Do First' },
				{ id: 'DoSoon', label: 'Do Soon' },
				{ id: 'Delegate', label: 'Delegate' },
				{ id: 'Waiting', label: 'Waiting' },
				{ id: 'On-Hold', label: 'On Hold' },
			],
		}).statuses.map((status) => status.label)).toEqual([
			'Inbox',
			'Do First',
			'Do Soon',
			'Ongoing',
			'Delegate',
			'Waiting',
			'On Hold',
			'Completed',
		]);
	});

	test('migrates the old Inbox default to Do First once', () => {
		expect(normalizeSettings({ defaultStatus: 'Inbox' }).defaultStatus).toBe('DoFirst');
		expect(normalizeSettings({
			defaultStatus: 'Inbox',
			taskManagerDefaultsVersion: 1,
		}).defaultStatus).toBe('Inbox');
	});
});

describe('task clipper catalog settings', () => {
	test('stores catalog settings locally', async () => {
		await saveCatalogSettings({ catalogPort: 27125, catalogToken: ' token ' });
		await expect(loadCatalogSettings()).resolves.toEqual({
			catalogPort: 27125,
			catalogToken: 'token',
		});
	});

	test('normalizes invalid catalog ports to the default', async () => {
		await saveCatalogSettings({ catalogPort: 10, catalogToken: '' });
		await expect(loadCatalogSettings()).resolves.toEqual(DEFAULT_CATALOG_SETTINGS);
	});
});
