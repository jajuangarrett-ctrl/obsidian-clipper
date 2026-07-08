import { describe, expect, test } from 'vitest';
import { DEFAULT_SETTINGS, normalizeSettings } from './storage';

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
});
