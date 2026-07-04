// Helper function to parse text and detect URLs
export const parseTextWithLinks = (text: string) => {
  // Regex to match URLs (http://, https://, or www.)
  const urlRegex = /(https?:\/\/[^\s]+|www\.[^\s]+)/gi;
  const parts: Array<{ type: 'text' | 'link'; content: string }> = [];
  let lastIndex = 0;
  let match;

  while ((match = urlRegex.exec(text)) !== null) {
    // Add text before the URL
    if (match.index > lastIndex) {
      parts.push({
        type: 'text',
        content: text.substring(lastIndex, match.index)
      });
    }

    // Add the URL
    let url = match[0];
    // Add http:// if it starts with www.
    if (url.startsWith('www.')) {
      url = 'https://' + url;
    }
    
    parts.push({
      type: 'link',
      content: url
    });

    lastIndex = match.index + match[0].length;
  }

  // Add remaining text
  if (lastIndex < text.length) {
    parts.push({
      type: 'text',
      content: text.substring(lastIndex)
    });
  }

  return parts.length > 0 ? parts : [{ type: 'text' as const, content: text }];
};
