export type AiTitleInput = {
	apiKey: string;
	model: string;
	taskText: string;
	sourceTitle: string;
	project: string;
	status: string;
};

export async function requestAiTitle(input: AiTitleInput): Promise<string> {
	const response = await fetch('https://api.openai.com/v1/responses', {
		method: 'POST',
		headers: {
			'Authorization': `Bearer ${input.apiKey}`,
			'Content-Type': 'application/json',
		},
		body: JSON.stringify({
			model: input.model || 'gpt-4.1-mini',
			input: buildTitlePrompt(input),
		}),
	});

	const data: unknown = await response.json().catch(() => ({}));
	if (!response.ok) {
		throw new Error(responseErrorMessage(data) || `OpenAI request failed with HTTP ${response.status}`);
	}

	const title = cleanGeneratedTitle(extractResponseText(data));
	if (!title) throw new Error(emptyResponseMessage(data));
	return title;
}

export function buildTitlePrompt(input: AiTitleInput): string {
	return [
		'Create one concise action-oriented task title.',
		'Rules:',
		'- 6 to 12 words when possible.',
		'- Use sentence case.',
		'- No trailing period.',
		'- Do not include hashtags, status labels, or project prefixes.',
		'- Preserve important names, programs, and dates.',
		'- Return only the title text.',
		'',
		`Status: ${input.status || 'none'}`,
		`Project: ${input.project || 'none'}`,
		`Source title or email subject: ${input.sourceTitle || 'none'}`,
		'Task text:',
		input.taskText.slice(0, 4000),
	].join('\n');
}

export function extractResponseText(data: unknown): string {
	if (!isRecord(data)) return '';
	if (typeof data.output_text === 'string') return data.output_text;
	if (!Array.isArray(data.output)) return '';

	for (const item of data.output) {
		if (!isRecord(item) || !Array.isArray(item.content)) continue;
		for (const content of item.content) {
			if (isRecord(content) && typeof content.text === 'string') return content.text;
		}
	}
	return '';
}

export function cleanGeneratedTitle(value: string): string {
	return value
		.trim()
		.replace(/^["'`]+|["'`]+$/g, '')
		.replace(/^[-*]\s+/, '')
		.replace(/\s+/g, ' ')
		.replace(/[.。]+$/g, '')
		.slice(0, 120);
}

function responseErrorMessage(data: unknown): string {
	if (!isRecord(data) || !isRecord(data.error)) return '';
	return typeof data.error.message === 'string' ? data.error.message : '';
}

function emptyResponseMessage(data: unknown): string {
	if (!isRecord(data)) return 'OpenAI returned an empty title.';
	if (data.status !== 'incomplete' || !isRecord(data.incomplete_details)) {
		return 'OpenAI returned an empty title.';
	}
	const reason = data.incomplete_details.reason;
	return typeof reason === 'string'
		? `OpenAI could not finish the title (${reason}).`
		: 'OpenAI could not finish the title.';
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}
