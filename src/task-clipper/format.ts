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
): BuiltTask[] {
	const project = cleanProjectName(projectName);
	return splitTaskText(input).map((title) => {
		const titleWithoutStatuses = stripStatusTags(title, statuses);
		const parts = ['- [ ]', titleWithoutStatuses];
		if (project) parts.push(`PJ: ${project}`);
		parts.push(`#task #${statusId}`);
		return {
			title: titleWithoutStatuses,
			details: '',
			line: parts.join(' '),
			status: statusId,
			project,
		};
	});
}

export function buildTaskNotePayload(
	input: string,
	statusId: string,
	projectName: string,
	statuses: StatusOption[],
	context: PageContext,
): BuiltTask {
	const tasks = buildTaskLines(input, statusId, projectName, statuses);
	const first = tasks[0] || {
		title: cleanTaskTitle(input) || context.title || 'Clipped task',
		details: '',
		line: '',
		status: statusId,
		project: cleanProjectName(projectName),
	};
	const details = buildDetails(input, context);
	return {
		...first,
		title: first.title || context.title || 'Clipped task',
		details,
	};
}

export function appendUpdateLog(
	existingDetails: string | undefined,
	updateText: string,
	context: PageContext,
	now: Date = new Date(),
): string {
	const cleanUpdate = updateText.trim();
	if (!cleanUpdate) return existingDetails || '';

	const source = buildSourceLine(context);
	const entryParts = [
		`### ${formatLocalDateTime(now)}`,
		cleanUpdate,
		source,
	].filter(Boolean);
	const entry = entryParts.join('\n\n');
	const details = (existingDetails || '').trimEnd();
	const updatesHeading = /^## Updates\s*$/im;

	if (!details) {
		return `## Updates\n\n${entry}\n`;
	}
	if (updatesHeading.test(details)) {
		return details.replace(updatesHeading, (match) => `${match}\n\n${entry}`) + '\n';
	}
	return `${details}\n\n## Updates\n\n${entry}\n`;
}

function buildDetails(input: string, context: PageContext): string {
	const text = input.trim();
	const source = buildSourceLine(context);
	if (!source) return text;
	return text ? `${text}\n\n${source}` : source;
}

function buildSourceLine(context: PageContext): string {
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
