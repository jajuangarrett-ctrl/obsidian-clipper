import { StatusOption, cleanProjectName } from './storage';

export type BuiltTask = {
	title: string;
	line: string;
	status: string;
	project: string;
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
			line: parts.join(' '),
			status: statusId,
			project,
		};
	});
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
