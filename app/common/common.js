export function sec_to_time(totalSeconds, am = true) {
  if (totalSeconds > 0) {
    let Bighours = Math.floor(totalSeconds / 3600);
    totalSeconds %= 3600;
    let minutes = Math.floor(totalSeconds / 60);
    let seconds = totalSeconds % 60;
    let am_pm = Bighours < 12 ? "AM" : "PM";
    let hours = Bighours % 12 || 12;

    // If you want strings with leading zeroes:
    minutes = String(minutes).padStart(2, "0");
    Bighours = String(Bighours).padStart(2, "0");
    seconds = String(seconds).padStart(2, "0");

    if (am === true) {
      return hours + ":" + minutes + ":" + seconds + " " + am_pm;
    } else {
      return Bighours + ":" + minutes + ":" + seconds;
    }
  } else {
    return "-";
  }
}

// Parsha (or yom tov) of the week's Shabbos, in Hebrew — see parsha.js
export { parsha as getHebrewParasha } from "./parsha.js";

export const secondsToAmPm = (seconds) => {
  if (seconds == null) return "-";

  let hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  const ampm = hours >= 12 ? "PM" : "AM";
  hours = hours % 12 || 12;

  return `${hours.toString().padStart(2, "0")}:${minutes
    .toString()
    .padStart(2, "0")}:${secs.toString().padStart(2, "0")} ${ampm}`;
};

export const secondsToPercent = (workedSeconds, scheduledSeconds) => {
  if (!workedSeconds || !scheduledSeconds) return "-";

  const percent = (workedSeconds / scheduledSeconds) * 100;
  return `${Math.round(percent)}%`;
};

export const convertTo24Hour = (time12h) => {
  if (!time12h) return "";
  const [time, modifier] = time12h.split(" ");
  let [hours, minutes, seconds] = time.split(":").map(Number);

  if (modifier === "PM" && hours !== 12) hours += 12;
  if (modifier === "AM" && hours === 12) hours = 0;

  return `${hours.toString().padStart(2, "0")}:${minutes
    .toString()
    .padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
};

export const formatFileSize = (size) => {
  if (size < 1024) {
    return `${size} bytes`;
  } else if (size < 1024 * 1024) {
    return `${(size / 1024).toFixed(2)} KB`;
  } else if (size < 1024 * 1024 * 1024) {
    return `${(size / (1024 * 1024)).toFixed(2)} MB`;
  } else {
    return `${(size / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  }
};

export const getFileIcon = (mimeType) => {
  const icons = {
    "application/pdf": "i-heroicons-document-text",
    "application/msword": "i-heroicons-document-text",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
      "i-heroicons-document-text",
    "application/vnd.ms-excel": "i-heroicons-table-cells",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet":
      "i-heroicons-table-cells",
    "image/": "i-heroicons-photo",
    "text/": "i-heroicons-document-text",
    "application/zip": "i-heroicons-archive-box",
    "application/x-rar-compressed": "i-heroicons-archive-box",
  };

  // Check for specific types first
  if (icons[mimeType]) {
    return icons[mimeType];
  }

  // Check by main type
  for (const [key, icon] of Object.entries(icons)) {
    if (mimeType?.startsWith(key?.split("/")[0] + "/")) {
      return icon;
    }
  }

  // Default icon
  return "i-heroicons-document";
};

export function base64ToPdfUrl(base64) {
  const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
  const blob = new Blob([bytes], { type: "application/pdf" });
  return URL.createObjectURL(blob);
}
