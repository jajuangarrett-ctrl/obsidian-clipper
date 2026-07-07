import { describe, expect, test } from 'vitest';
import { DEFAULT_SETTINGS, normalizeSettings } from './storage';

describe('task clipper settings', () => {
	test('uses the default vault name when no setting is stored', () => {
		expect(normalizeSettings(undefined).vaultName).toBe(DEFAULT_SETTINGS.vaultName);
	});

	test('allows a blank vault name so fallback can use the active Obsidian vault', () => {
		expect(normalizeSettings({ vaultName: '' }).vaultName).toBe('');
		expect(normalizeSettings({ vaultName: '   ' }).vaultName).toBe('');
	});

	test('trims configured vault names', () => {
		expect(normalizeSettings({ vaultName: '  FJG Vault  ' }).vaultName).toBe('FJG Vault');
	});
});
