export type InitialCaptureContext = {
	selection: string;
	title: string;
	sourceKind?: 'web' | 'email';
};

export type ProjectSelectionDraft = {
	project: string;
	url: string;
	savedAt: number;
};

export function initialTaskTitle(context: InitialCaptureContext): string {
	if (context.sourceKind === 'email') {
		const subject = cleanEmailSubject(context.title);
		if (subject) return subject;
	}
	return firstMeaningfulLine(context.selection || context.title) || context.title.trim();
}

export function firstMeaningfulLine(value: string): string {
	return String(value || '')
		.replace(/\r\n/g, '\n')
		.split('\n')
		.map((line) => line.trim())
		.find(Boolean) || '';
}

export function cleanEmailSubject(value: string): string {
	const clean = String(value || '')
		.replace(/^subject\s*:?\s*/i, '')
		.replace(/\s*Summarize this email\s*$/i, '')
		.replace(/\s+-\s+[^-]+?\s+-\s+Outlook$/i, '')
		.replace(/\s+-\s+(Outlook|Microsoft Outlook|Microsoft Outlook Web App|Mail)$/i, '')
		.replace(/\s+/g, ' ')
		.trim();
	return looksLikeEmailSubject(clean) ? clean : '';
}

export function restorableProject(
	draft: ProjectSelectionDraft | undefined,
	contextUrl: string,
	availableProjects: string[],
	now: number,
	maxAgeMs: number,
): string {
	if (
		!draft ||
		!draft.project ||
		!draft.url ||
		draft.url !== contextUrl ||
		!Number.isFinite(draft.savedAt) ||
		now - draft.savedAt > maxAgeMs ||
		now < draft.savedAt
	) {
		return '';
	}
	return availableProjects.includes(draft.project) ? draft.project : '';
}

function looksLikeEmailSubject(value: string): boolean {
	if (!value || value.length < 3 || value.length > 240) return false;
	return !/^(Inbox|Mail|Outlook|Microsoft Outlook|Message|Reading Pane|Navigation pane|Navigation)$/i.test(value);
}
