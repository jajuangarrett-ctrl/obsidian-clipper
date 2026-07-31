// Mock for webextension-polyfill in test environment
type StorageData = Record<string, unknown>;

function createStorageArea() {
	const data: StorageData = {};

	return {
		get: async (keys?: string | string[] | StorageData | null) => {
			if (keys === undefined || keys === null) return { ...data };
			if (typeof keys === 'string') return { [keys]: data[keys] };
			if (Array.isArray(keys)) {
				return Object.fromEntries(keys.map((key) => [key, data[key]]));
			}
			return Object.fromEntries(
				Object.entries(keys).map(([key, fallback]) => [
					key,
					data[key] === undefined ? fallback : data[key],
				]),
			);
		},
		set: async (items: StorageData) => {
			Object.assign(data, items);
		},
		remove: async (keys: string | string[]) => {
			for (const key of Array.isArray(keys) ? keys : [keys]) delete data[key];
		},
		clear: async () => {
			for (const key of Object.keys(data)) delete data[key];
		},
	};
}

export const runtime = {
	getURL: (path: string) => `chrome-extension://mock-id/${path}`,
	sendMessage: async () => ({}),
	onMessage: {
		addListener: () => {},
		removeListener: () => {},
	},
};

export const storage = {
	local: createStorageArea(),
	sync: createStorageArea(),
	onChanged: {
		addListener: () => {},
		removeListener: () => {},
	},
};

export const tabs = {
	query: async () => [],
	sendMessage: async () => ({}),
};

export const i18n = {
	getMessage: (key: string) => key,
};

export default {
	runtime,
	storage,
	tabs,
	i18n,
};
