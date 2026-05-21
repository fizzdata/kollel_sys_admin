<script setup>
definePageMeta({
	layout: "sidebar",
	middleware: ["auth"],
});

const api = useApi();
const toast = useToast();
const org = useCookie("kollel_sys_org");

const orgId = computed(() => org.value?.id || null);

const loading = ref(false);
const devices = ref([]);
const selectedDeviceId = ref(null);
const search = ref("");
const selectedCommand = ref("restart_app");
const payloadText = ref("");
const commandLoadingDeviceId = ref(null);
const commandLoadingName = ref("");

const commandOptions = [
	{
		label: "Restart App",
		value: "restart_app",
		description: "Restart the kiosk application on the device.",
	},
	{
		label: "Allow Minimize (2 min)",
		value: "allow_minimize",
		description: "Temporarily let the kiosk be minimized or switched away from for 2 minutes.",
		defaultPayload: {
			duration_minutes: 2,
		},
	},
	{
		label: "Restore Kiosk Lock",
		value: "restore_kiosk_lock",
		description: "Restore the kiosk lock immediately and prevent minimizing again.",
	},
	{
		label: "Install Update",
		value: "install_update",
		description: "Ask the device to install an available update using an installer_url payload.",
	},
];

const commandLabels = commandOptions.reduce((labels, option) => {
	labels[option.value] = option.label;
	return labels;
}, {});

const syncSelectedDevice = () => {
	if (!devices.value.length) {
		selectedDeviceId.value = null;
		return;
	}

	const selectedExists = devices.value.some(
		(device) => device.id === selectedDeviceId.value,
	);

	if (!selectedExists) {
		selectedDeviceId.value = devices.value[0].id;
	}
};

const responseMessage = (response, fallback) => {
	return response?.message || response?._data?.message || fallback;
};

const formatDateTime = (value) => {
	if (!value) {
		return "Never";
	}

	try {
		return new Intl.DateTimeFormat("en-US", {
			dateStyle: "medium",
			timeStyle: "short",
		}).format(new Date(value));
	} catch {
		return value;
	}
};

const formatCommandName = (value) => {
	if (!value) {
		return "No command";
	}

	return commandLabels[value] || value.replaceAll("_", " ");
};

const commandStatusColor = (status) => {
	if (status === "success") {
		return "success";
	}

	if (status === "failed" || status === "error") {
		return "error";
	}

	return "primary";
};

const filteredDevices = computed(() => {
	const query = search.value.trim().toLowerCase();

	if (!query) {
		return devices.value;
	}

	return devices.value.filter((device) => {
		return [
			device.machine_name,
			device.device_unique_id,
			device.anydesk_id,
			device.last_ip,
			device.app_name,
			device.app_version,
		].some((value) => String(value || "").toLowerCase().includes(query));
	});
});

const selectedDevice = computed(() => {
	return (
		devices.value.find((device) => device.id === selectedDeviceId.value) || null
	);
});

const onlineCount = computed(
	() => devices.value.filter((device) => device.is_online).length,
);

const pendingCount = computed(
	() => devices.value.filter((device) => !!device.pending_command).length,
);

const fetchDevices = async () => {
	if (!orgId.value) {
		devices.value = [];
		selectedDeviceId.value = null;
		toast.add({
			description: "Organization is missing from the current session.",
			color: "error",
			timeout: 3000,
		});
		return;
	}

	loading.value = true;

	try {
		const response = await api("/api/devices", {
			method: "GET",
			query: {
				org_id: orgId.value,
			},
		});

		if (response.success) {
			devices.value = response.devices || [];
			syncSelectedDevice();
			return;
		}

		toast.add({
			description: responseMessage(response, "Failed to load devices."),
			color: "error",
			timeout: 3000,
		});
	} catch (error) {
		console.error("Error loading devices", error);
		toast.add({
			description: "Failed to load devices.",
			color: "error",
			timeout: 3000,
		});
	} finally {
		loading.value = false;
	}
};

const queueCommand = async (commandName = selectedCommand.value) => {
	if (!selectedDevice.value) {
		return;
	}

	const selectedOption = commandOptions.find((option) => option.value === commandName);
	let payload = selectedOption?.defaultPayload
		? { ...selectedOption.defaultPayload }
		: undefined;
	const rawPayload = payloadText.value.trim();

	if (rawPayload) {
		try {
			payload = JSON.parse(rawPayload);
		} catch {
			toast.add({
				description: "Payload must be valid JSON.",
				color: "error",
				timeout: 3000,
			});
			return;
		}
	}

	commandLoadingDeviceId.value = selectedDevice.value.id;
	commandLoadingName.value = commandName;
	selectedCommand.value = commandName;

	try {
		const response = await api(
			`/api/devices/${selectedDevice.value.id}/command`,
			{
				method: "POST",
				body: {
					org_id: orgId.value,
					command_name: commandName,
					...(payload ? { payload } : {}),
				},
			},
		);

		if (response.success) {
			toast.add({
				description: responseMessage(response, "Command queued successfully."),
				color: "success",
				timeout: 2500,
			});
			payloadText.value = "";
			await fetchDevices();
			return;
		}

		toast.add({
			description: responseMessage(response, "Failed to queue command."),
			color: "error",
			timeout: 3000,
		});
	} catch (error) {
		console.error("Error queueing device command", error);
		toast.add({
			description: "Failed to queue command.",
			color: "error",
			timeout: 3000,
		});
	} finally {
		commandLoadingDeviceId.value = null;
		commandLoadingName.value = "";
	}
};

const isCommandLoading = (deviceId, commandName) => {
	return (
		commandLoadingDeviceId.value === deviceId &&
		commandLoadingName.value === commandName
	);
};

const copyValue = async (value, label) => {
	if (!value || !navigator?.clipboard) {
		return;
	}

	try {
		await navigator.clipboard.writeText(value);
		toast.add({
			description: `${label} copied to clipboard.`,
			color: "success",
			timeout: 2000,
		});
	} catch (error) {
		console.error(`Failed to copy ${label}`, error);
	}
};

onMounted(fetchDevices);
</script>

<template>
	<div class="space-y-6">
		<UCard class="rounded-2xl shadow-sm">
			<div class="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
				<div>
					<h1 class="text-xl font-bold text-gray-900">Devices</h1>
					<p class="mt-1 text-sm text-gray-600">
						Monitor registered devices and queue basic commands that are
						delivered on the next sync.
					</p>
				</div>

				<div class="flex flex-wrap items-center gap-2">
					<UBadge color="primary" variant="soft" size="lg">
						{{ devices.length }} Registered
					</UBadge>
					<UBadge color="success" variant="soft" size="lg">
						{{ onlineCount }} Online
					</UBadge>
					<UBadge color="primary" variant="soft" size="lg">
						{{ pendingCount }} Pending
					</UBadge>
					<UButton
						icon="i-heroicons-arrow-path"
						label="Refresh"
						:loading="loading"
						:disabled="loading"
						@click="fetchDevices"
					/>
				</div>
			</div>

			<div class="mt-4">
				<UInput
					v-model="search"
					placeholder="Search by machine, device ID, AnyDesk, IP, or app version"
					icon="i-heroicons-magnifying-glass"
					size="lg"
				/>
			</div>
		</UCard>

		<div class="grid gap-6 xl:grid-cols-[minmax(0,1.8fr)_minmax(340px,1fr)]">
			<UCard class="rounded-2xl shadow-sm">
				<div class="mb-4 flex items-center justify-between gap-3">
					<div>
						<h2 class="text-base font-semibold text-gray-900">Registered Devices</h2>
						<p class="text-sm text-gray-500">
							Select a device to inspect details and queue a command.
						</p>
					</div>
					<UBadge color="primary" variant="outline">
						{{ filteredDevices.length }} Visible
					</UBadge>
				</div>

				<div v-if="loading" class="space-y-3">
					<USkeleton class="h-16 w-full rounded-xl" />
					<USkeleton class="h-16 w-full rounded-xl" />
					<USkeleton class="h-16 w-full rounded-xl" />
				</div>

				<div
					v-else-if="!devices.length"
					class="rounded-2xl border border-dashed border-gray-300 bg-gray-50 px-6 py-10 text-center"
				>
					<UIcon
						name="i-heroicons-computer-desktop"
						class="mx-auto mb-3 size-10 text-gray-400"
					/>
					<h3 class="text-sm font-semibold text-gray-900">No devices registered yet</h3>
					<p class="mt-1 text-sm text-gray-500">
						Devices will appear here after they register and begin syncing.
					</p>
				</div>

				<div
					v-else-if="!filteredDevices.length"
					class="rounded-2xl border border-dashed border-gray-300 bg-gray-50 px-6 py-10 text-center"
				>
					<UIcon
						name="i-heroicons-funnel"
						class="mx-auto mb-3 size-10 text-gray-400"
					/>
					<h3 class="text-sm font-semibold text-gray-900">No matching devices</h3>
					<p class="mt-1 text-sm text-gray-500">
						Adjust the filter to see the full device list again.
					</p>
				</div>

				<div v-else class="overflow-hidden rounded-2xl border border-gray-200">
					<div class="overflow-x-auto">
						<table class="min-w-full divide-y divide-gray-200 text-sm">
							<thead class="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
								<tr>
									<th class="px-4 py-3 font-semibold">Device</th>
									<th class="px-4 py-3 font-semibold">Application</th>
									<th class="px-4 py-3 font-semibold">Connection</th>
									<th class="px-4 py-3 font-semibold">Last Seen</th>
									<th class="px-4 py-3 font-semibold">Command State</th>
								</tr>
							</thead>
							<tbody class="divide-y divide-gray-200 bg-white">
								<tr
									v-for="device in filteredDevices"
									:key="device.id"
									class="cursor-pointer transition-colors"
									:class="
										device.id === selectedDeviceId
											? 'bg-primary-50'
											: 'hover:bg-gray-50'
									"
									@click="selectedDeviceId = device.id"
								>
									<td class="px-4 py-4 align-top">
										<div class="flex items-start justify-between gap-3">
											<div>
												<div class="font-semibold text-gray-900">
													{{ device.machine_name || "Unnamed device" }}
												</div>
												<div class="mt-1 break-all text-xs text-gray-500">
													{{ device.device_unique_id }}
												</div>
											</div>
											<UBadge
												:color="device.is_online ? 'success' : 'error'"
												variant="soft"
											>
												{{ device.is_online ? "Online" : "Offline" }}
											</UBadge>
										</div>
									</td>
									<td class="px-4 py-4 align-top text-gray-600">
										<div class="font-medium text-gray-900">
											{{ device.app_name || "Unknown app" }}
										</div>
										<div class="mt-1 text-xs text-gray-500">
											Version {{ device.app_version || "n/a" }}
										</div>
									</td>
									<td class="px-4 py-4 align-top text-gray-600">
										<div>{{ device.last_ip || "No IP" }}</div>
										<div class="mt-1 text-xs text-gray-500">
											AnyDesk: {{ device.anydesk_id || "Not reported" }}
										</div>
									</td>
									<td class="px-4 py-4 align-top text-gray-600">
										<div>{{ formatDateTime(device.last_seen_at) }}</div>
										<div class="mt-1 text-xs text-gray-500">
											Registered {{ formatDateTime(device.registered_at) }}
										</div>
									</td>
									<td class="px-4 py-4 align-top">
										<div v-if="device.pending_command" class="space-y-1">
											<UBadge color="primary" variant="soft">
												Queued: {{ formatCommandName(device.pending_command.name) }}
											</UBadge>
											<div class="text-xs text-gray-500">
												{{ formatDateTime(device.pending_command.requested_at) }}
											</div>
										</div>
										<div v-else-if="device.last_command" class="space-y-1">
											<UBadge
												:color="commandStatusColor(device.last_command.status)"
												variant="soft"
											>
												{{ formatCommandName(device.last_command.name) }}
											</UBadge>
											<div class="text-xs text-gray-500">
												{{ device.last_command.status || "Reported" }}
											</div>
										</div>
										<span v-else class="text-xs text-gray-500">
											No commands yet
										</span>
									</td>
								</tr>
							</tbody>
						</table>
					</div>
				</div>
			</UCard>

			<UCard class="rounded-2xl shadow-sm xl:sticky xl:top-6 xl:self-start">
				<div v-if="selectedDevice" class="space-y-6">
					<div class="flex items-start justify-between gap-4">
						<div>
							<h2 class="text-base font-semibold text-gray-900">
								{{ selectedDevice.machine_name || "Unnamed device" }}
							</h2>
							<p class="mt-1 break-all text-xs text-gray-500">
								{{ selectedDevice.device_unique_id }}
							</p>
						</div>
						<UBadge
							:color="selectedDevice.is_online ? 'success' : 'error'"
							variant="soft"
						>
							{{ selectedDevice.is_online ? "Online" : "Offline" }}
						</UBadge>
					</div>

					<div class="grid gap-3 sm:grid-cols-2">
						<div class="rounded-xl border border-gray-200 p-3">
							<div class="text-xs font-semibold uppercase tracking-wide text-gray-500">
								Application
							</div>
							<div class="mt-1 text-sm font-medium text-gray-900">
								{{ selectedDevice.app_name || "Unknown app" }}
							</div>
							<div class="text-xs text-gray-500">
								Version {{ selectedDevice.app_version || "n/a" }}
							</div>
						</div>

						<div class="rounded-xl border border-gray-200 p-3">
							<div class="text-xs font-semibold uppercase tracking-wide text-gray-500">
								Last Connection
							</div>
							<div class="mt-1 text-sm font-medium text-gray-900">
								{{ selectedDevice.last_ip || "No IP reported" }}
							</div>
							<div class="text-xs text-gray-500">
								Seen {{ formatDateTime(selectedDevice.last_seen_at) }}
							</div>
						</div>

						<div class="rounded-xl border border-gray-200 p-3 sm:col-span-2">
							<div class="flex items-start justify-between gap-3">
								<div>
									<div class="text-xs font-semibold uppercase tracking-wide text-gray-500">
										AnyDesk ID
									</div>
									<div class="mt-1 text-sm font-medium text-gray-900">
										{{ selectedDevice.anydesk_id || "Not reported" }}
									</div>
								</div>
								<UButton
									v-if="selectedDevice.anydesk_id"
									color="primary"
									variant="outline"
									size="xs"
									@click="copyValue(selectedDevice.anydesk_id, 'AnyDesk ID')"
								>
									Copy
								</UButton>
							</div>
						</div>
					</div>

					<div
						v-if="selectedDevice.pending_command"
						class="rounded-xl border border-primary-200 bg-primary-50 p-4"
					>
						<div class="flex items-center justify-between gap-3">
							<div>
								<div class="text-xs font-semibold uppercase tracking-wide text-primary-700">
									Pending Command
								</div>
								<div class="mt-1 text-sm font-semibold text-primary-900">
									{{ formatCommandName(selectedDevice.pending_command.name) }}
								</div>
							</div>
							<UBadge color="primary" variant="soft">Queued</UBadge>
						</div>
						<p class="mt-2 text-xs text-primary-800">
							Requested {{ formatDateTime(selectedDevice.pending_command.requested_at) }}
						</p>
						<p
							v-if="selectedDevice.pending_command.sent_at"
							class="mt-1 text-xs text-primary-800"
						>
							Delivered {{ formatDateTime(selectedDevice.pending_command.sent_at) }}
						</p>
					</div>

					<div
						v-if="selectedDevice.last_command"
						class="rounded-xl border border-gray-200 bg-gray-50 p-4"
					>
						<div class="flex items-center justify-between gap-3">
							<div>
								<div class="text-xs font-semibold uppercase tracking-wide text-gray-500">
									Last Command Result
								</div>
								<div class="mt-1 text-sm font-semibold text-gray-900">
									{{ formatCommandName(selectedDevice.last_command.name) }}
								</div>
							</div>
							<UBadge
								:color="commandStatusColor(selectedDevice.last_command.status)"
								variant="soft"
							>
								{{ selectedDevice.last_command.status || "reported" }}
							</UBadge>
						</div>
						<p class="mt-2 text-xs text-gray-600">
							Completed {{ formatDateTime(selectedDevice.last_command.completed_at) }}
						</p>
						<p
							v-if="selectedDevice.last_command.message"
							class="mt-2 rounded-lg bg-white px-3 py-2 text-sm text-gray-700"
						>
							{{ selectedDevice.last_command.message }}
						</p>
					</div>

					<div>
						<div class="flex items-center justify-between gap-3">
							<div>
								<h3 class="text-sm font-semibold text-gray-900">Quick Commands</h3>
								<p class="text-xs text-gray-500">
									Queue one of the supported commands for the next sync.
								</p>
							</div>
						</div>

						<div class="mt-3 grid gap-2 sm:grid-cols-2">
							<UButton
								v-for="option in commandOptions"
								:key="option.value"
								color="primary"
								variant="outline"
								class="justify-center"
								:loading="isCommandLoading(selectedDevice.id, option.value)"
								:disabled="commandLoadingDeviceId === selectedDevice.id"
								@click="queueCommand(option.value)"
							>
								{{ option.label }}
							</UButton>
						</div>
					</div>

					<div class="rounded-xl border border-gray-200 p-4">
						<div>
							<h3 class="text-sm font-semibold text-gray-900">Command Payload</h3>
							<p class="mt-1 text-xs text-gray-500">
								Optional JSON payload for commands like app updates or custom minimize duration.
							</p>
						</div>

						<div class="mt-3 space-y-3">
							<label class="block text-xs font-semibold uppercase tracking-wide text-gray-500">
								Command
							</label>
							<select
								v-model="selectedCommand"
								class="w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none transition focus:border-primary-500 focus:ring-2 focus:ring-primary-100"
							>
								<option
									v-for="option in commandOptions"
									:key="option.value"
									:value="option.value"
								>
									{{ option.label }}
								</option>
							</select>

							<div class="rounded-lg bg-gray-50 px-3 py-2 text-xs text-gray-500">
								{{
									commandOptions.find((option) => option.value === selectedCommand)
										?.description
								}}
							</div>

							<UTextarea
								v-model="payloadText"
								:rows="5"
								placeholder='Optional JSON payload, for example {"installer_url":"https://example.com/kollel-sys-installer.exe"}'
							/>

							<UButton
								color="primary"
								block
								:loading="isCommandLoading(selectedDevice.id, selectedCommand)"
								:disabled="commandLoadingDeviceId === selectedDevice.id"
								@click="queueCommand()"
							>
								Queue Selected Command
							</UButton>
						</div>
					</div>
				</div>

				<div v-else class="rounded-2xl border border-dashed border-gray-300 bg-gray-50 px-6 py-10 text-center">
					<UIcon
						name="i-heroicons-cursor-arrow-rays"
						class="mx-auto mb-3 size-10 text-gray-400"
					/>
					<h3 class="text-sm font-semibold text-gray-900">Select a device</h3>
					<p class="mt-1 text-sm text-gray-500">
						Choose a device from the list to inspect it and queue commands.
					</p>
				</div>
			</UCard>
		</div>
	</div>
</template>
