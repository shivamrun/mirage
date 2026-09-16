export function formatProviderName(providerId: string) {
  if (providerId === "credential") {
    return "Email and password";
  }

  return providerId
    .replace(/[-_]/g, " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}
