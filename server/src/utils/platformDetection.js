export const detectPlatform = (url) => {
  if (!url) return 'website';
  
  const lower = url.toLowerCase();

  if (lower.includes('twitter.com') || lower.includes('x.com')) {
    return 'twitter';
  }
  if (lower.includes('youtube.com') || lower.includes('youtu.be')) {
    return 'youtube';
  }
  if (lower.includes('linkedin.com')) {
    return 'linkedin';
  }
  if (lower.includes('pinterest.com')) {
    return 'pinterest';
  }
  if (lower.includes('instagram.com')) {
    return 'instagram';
  }
  if (lower.includes('reddit.com')) {
    return 'reddit';
  }
  if (lower.includes('medium.com')) {
    return 'medium';
  }

  return 'website';
};

