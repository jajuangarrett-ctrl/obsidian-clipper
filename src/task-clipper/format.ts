import { StatusOption, cleanProjectName } from './storage';

export type BuiltTask = {
	title: string;
	details: string;
	line: string;
	status: string;
	project: string;
};

export type PageContext = {
	title: string;
	url: string;
};

export function splitTaskText(input: string): string[] {
	return input
		.replace(/\r\n/g, '\n')
		.replace(/\r/g, '\n')
		.split('\n')
		.map(cleanTaskTitle)
		.filter(Boolean);
}

export function buildTaskLines(
	input: string,
	statusId: string,
	projectName: string,
	statuses: StatusOption[],
	tags: string[] = ['task'],
): BuiltTask[] {
	const project = cleanProjectName(projectName);
	const tagText = normalizeTags(tags).map((tag) => `#${tag}`).join(' ');
	return splitTaskText(input).map((title) => {
		const titleWithoutStatuses = stripStatusTags(title, statuses);
		const parts = ['- [ ]', titleWithoutStatuses];
		if (project) parts.push(`PJ: ${project}`);
		parts.push(tagText);
		if (statusId) parts.push(`#${statusId}`);
		return {
			title: titleWithoutStatuses,
			details: '',
			line: parts.join(' '),
			status: statusId,
			project,
		};
	});
}

export function buildObsidianTaskContent(
	input: string,
	statusId: string,
	projectName: string,
	statuses: StatusOption[],
	tags: string[],
	context: PageContext,
): string {
	const source = buildSourceLine(context);
	const tasks = buildTaskLines(input, statusId, projectName, statuses, tags);
	return tasks
		.map((task) => source ? `${task.line}\n  - ${source}` : task.line)
		.join('\n');
}

export function buildUpdateBlock(
	updateText: string,
	context: PageContext,
	now: Date = new Date(),
): string {
	const cleanUpdate = updateText.trim();
	const source = buildSourceLine(context);
	return [
		`### ${formatLocalDateTime(now)}`,
		cleanUpdate,
		source,
	].filter(Boolean).join('\n\n');
}

export function buildSourceLine(context: PageContext): string {
	const title = context.title.trim();
	const url = context.url.trim();
	if (title && url) return `Source: [${escapeMarkdownLinkText(title)}](${url})`;
	if (url) return `Source: ${url}`;
	if (title) return `Source: ${title}`;
	return '';
}

function formatLocalDateTime(date: Date): string {
	const year = date.getFullYear();
	const month = String(date.getMonth() + 1).padStart(2, '0');
	const day = String(date.getDate()).padStart(2, '0');
	const hours = String(date.getHours()).padStart(2, '0');
	const minutes = String(date.getMinutes()).padStart(2, '0');
	return `${year}-${month}-${day} ${hours}:${minutes}`;
}

function escapeMarkdownLinkText(value: string): string {
	return value.replace(/[[\]\\]/g, '\\$&');
}

function normalizeTags(tags: string[]): string[] {
	const clean = tags
		.map((tag) => String(tag || '').trim().replace(/^#/, ''))
		.filter(Boolean);
	if (!clean.includes('task')) clean.unshift('task');
	return [...new Set(clean)];
}

function cleanTaskTitle(value: string): string {
	return value
		.trim()
		.replace(/^[-*]\s+\[[ xX]\]\s+/, '')
		.replace(/^[-*]\s+/, '')
		.replace(/\s+/g, ' ')
		.trim();
}

function stripStatusTags(value: string, statuses: StatusOption[]): string {
	let next = value.replace(/(^|\s)#task(\s|$)/g, ' ').trim();
	for (const status of statuses) {
		next = next.replace(new RegExp(`(^|\\s)#${escapeRegExp(status.id)}(?=\\s|$)`, 'g'), ' ');
	}
	return next.replace(/\s+/g, ' ').trim();
}

function escapeRegExp(value: string): string {
	return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
