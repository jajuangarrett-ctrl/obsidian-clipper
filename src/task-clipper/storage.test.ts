import { describe, expect, test } from 'vitest';
import { DEFAULT_SETTINGS, normalizeSettings } from './storage';

describe('task clipper settings', () => {
	test('uses the default vault name when no setting is stored', () => {
		expect(DEFAULT_SETTINGS.vaultName).toBe('');
		expect(normalizeSettings(undefined).vaultName).toBe('');
	});

	test('allows a blank vault name so fallback can use the active Obsidian vault', () => {
		expect(normalizeSettings({ vaultName: '' }).vaultName).toBe('');
		expect(normalizeSettings({ vaultName: '   ' }).vaultName).toBe('');
	});

	test('migrates the legacy default vault name to blank', () => {
		expect(normalizeSettings({ vaultName: 'FJG Vault' }).vaultName).toBe('');
	});

	test('trims configured vault names', () => {
		expect(normalizeSettings({ vaultName: '  Work Vault  ' }).vaultName).toBe('Work Vault');
	});

	test('keeps the TaskNotes base URL fallback separate from the taskboard URL', () => {
		expect(normalizeSettings({ taskNotesBaseUrl: '' }).taskNotesBaseUrl).toBe(DEFAULT_SETTINGS.taskNotesBaseUrl);
	});
});
