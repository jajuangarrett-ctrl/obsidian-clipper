import { afterEach, describe, expect, test, vi } from 'vitest';
import {
	AiTitleInput,
	cleanGeneratedTitle,
	extractResponseText,
	requestAiTitle,
} from './ai-title';

const input: AiTitleInput = {
	apiKey: 'test-key',
	model: 'gpt-5',
	taskText: 'Review the final budget with Alex before Friday.',
	sourceTitle: 'Budget review',
	project: 'Operations',
	status: 'DoSoon',
};

afterEach(() => {
	vi.unstubAllGlobals();
});

describe('AI task title generation', () => {
	test('does not cap output tokens needed by reasoning-capable models', async () => {
		const fetchMock = vi.fn().mockResolvedValue({
			ok: true,
			status: 200,
			json: async () => ({
				output: [{ content: [{ type: 'output_text', text: 'Review final budget with Alex' }] }],
			}),
		});
		vi.stubGlobal('fetch', fetchMock);

		await expect(requestAiTitle(input)).resolves.toBe('Review final budget with Alex');
		const [, init] = fetchMock.mock.calls[0];
		const body = JSON.parse(String(init?.body));
		expect(body).toMatchObject({ model: 'gpt-5' });
		expect(body.input).toContain('Review the final budget with Alex before Friday.');
		expect(body).not.toHaveProperty('max_output_tokens');
	});

	test('reads direct and nested Responses API text', () => {
		expect(extractResponseText({ output_text: 'Direct title' })).toBe('Direct title');
		expect(extractResponseText({
			output: [{ content: [{ type: 'output_text', text: 'Nested title' }] }],
		})).toBe('Nested title');
	});

	test('cleans formatting from a generated title', () => {
		expect(cleanGeneratedTitle('  "- Review   final budget."  ')).toBe('Review final budget');
	});

	test('surfaces the OpenAI API error message', async () => {
		vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
			ok: false,
			status: 401,
			json: async () => ({ error: { message: 'Incorrect API key provided' } }),
		}));

		await expect(requestAiTitle(input)).rejects.toThrow('Incorrect API key provided');
	});
});
