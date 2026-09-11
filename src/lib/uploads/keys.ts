const uploadKeyPattern = /^avatars\/[A-Za-z0-9][A-Za-z0-9._/-]*$/;
const urlLikePattern = /^[A-Za-z][A-Za-z0-9+.-]*:|^\/\//;

function isUploadKey(value: string) {
  const key = value.trim();

  return (
    uploadKeyPattern.test(key) &&
    !urlLikePattern.test(key) &&
    !key.includes("..") &&
    !key.includes("//") &&
    !key.includes("\\")
  );
}

export { isUploadKey };
