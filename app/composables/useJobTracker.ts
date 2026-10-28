type TrackedJobStatus = "pending" | "processing" | "completed" | "failed";

interface TrackedJob {
  id: string;
  label: string;
  status: TrackedJobStatus;
  progress: number;
  total: number | null;
  message: string;
}

// Module-level state so every component sharing this composable sees the same jobs.
const jobs = ref<TrackedJob[]>([]);
const timers: Record<string, ReturnType<typeof setTimeout>> = {};

export const useJobTracker = () => {
  const api = useApi();
  const toast = useToast();
  const org = useCookie<{ id?: number } | null>("kollel_sys_org");

  const clearTimer = (jobId: string) => {
    if (timers[jobId]) {
      clearTimeout(timers[jobId]);
      delete timers[jobId];
    }
  };

  const poll = async (jobId: string) => {
    const job = jobs.value.find((j) => j.id === jobId);
    if (!job) return;

    try {
      const response = await api("/api/jobs/status", {
        method: "GET",
        params: { job_id: jobId, org_id: org.value?.id },
      });

      if (response?.status) {
        job.status = response.status;
        if (typeof response.progress === "number") job.progress = response.progress;
        if (typeof response.total === "number") job.total = response.total;
        if (response.message) job.message = response.message;
      }
    } catch (error) {
      console.error("Error polling job status", error);
    }

    if (["pending", "processing"].includes(job.status)) {
      timers[jobId] = setTimeout(() => poll(jobId), 2000);
      return;
    }

    if (job.status === "failed") {
      toast.add({
        title: `${job.label} failed`,
        description: job.message || "The job encountered an error.",
        color: "error",
        duration: 6000,
      });
    } else if (job.status === "completed") {
      toast.add({
        title: `${job.label} complete`,
        description: job.message || "Finished successfully.",
        color: "success",
        duration: 3000,
      });
    }

    timers[jobId] = setTimeout(() => {
      jobs.value = jobs.value.filter((j) => j.id !== jobId);
    }, 4000);
  };

  const track = (jobId: string | undefined | null, label: string) => {
    if (!jobId) return;

    clearTimer(jobId);

    const existing = jobs.value.find((j) => j.id === jobId);
    if (existing) {
      existing.label = label;
      existing.status = "processing";
      existing.progress = 0;
      existing.total = null;
      existing.message = "Starting...";
    } else {
      jobs.value.push({
        id: jobId,
        label,
        status: "processing",
        progress: 0,
        total: null,
        message: "Starting...",
      });
    }

    poll(jobId);
  };

  return { jobs, track };
};
