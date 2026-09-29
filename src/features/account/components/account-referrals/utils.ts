function formatDate(value: Date | string | null) {
  if (!value) {
    return "Not completed";
  }

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
  }).format(new Date(value));
}

function getReferralLink(code: string) {
  if (typeof window === "undefined") {
    return `/register?ref=${code}`;
  }

  return `${window.location.origin}/register?ref=${code}`;
}

function fallbackCopyText(value: string) {
  const textarea = document.createElement("textarea");
  textarea.value = value;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.left = "-9999px";
  document.body.appendChild(textarea);
  textarea.select();

  try {
    return document.execCommand("copy");
  } finally {
    document.body.removeChild(textarea);
  }
}

async function copyText(value: string) {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(value);
      return true;
    }
  } catch {
    // Fall back to a selectable textarea below.
  }

  return fallbackCopyText(value);
}

export { copyText, formatDate, getReferralLink };
