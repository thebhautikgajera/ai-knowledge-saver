export const detectPlatform = (url) => {
  const lower = (url || '').toLowerCase();

  if (lower.includes('twitter.com') || lower.includes('x.com')) {
    return 'twitter';
  }
  if (lower.includes('youtube.com') || lower.includes('youtu.be')) {
    return 'youtube';
  }
  if (lower.includes('linkedin.com')) {
    return 'linkedin';
  }

  return 'website';
};

