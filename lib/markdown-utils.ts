/**
 * 工具函数：处理 JSON 中的 Markdown 内容
 */

/**
 * 将 Markdown 转换为纯文本（用于摘要）
 */
export function markdownToPlainText(markdown: string): string {
  if (!markdown) return '';
  
  return markdown
    // 移除标题标记
    .replace(/^#{1,6}\s+/gm, '')
    // 移除列表标记
    .replace(/^\s*[-*+]\s+/gm, '')
    .replace(/^\s*\d+\.\s+/gm, '')
    // 移除引用标记
    .replace(/^\s*>\s+/gm, '')
    // 移除代码块
    .replace(/```[\s\S]*?```/g, '')
    // 移除行内代码
    .replace(/`[^`]*`/g, '')
    // 移除链接
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    // 移除图片
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
    // 移除加粗和斜体
    .replace(/\*\*([^*]*)\*\*/g, '$1')
    .replace(/\*([^*]*)\*/g, '$1')
    // 移除多余的换行
    .replace(/\n+/g, ' ')
    // 移除前后空格
    .trim();
}

/**
 * 为 JSON 安全转义 Markdown
 */
export function escapeMarkdownForJSON(markdown: string): string {
  if (!markdown) return '';
  
  return markdown
    // 转义反斜杠
    .replace(/\\/g, '\\\\')
    // 转义双引号
    .replace(/"/g, '\\"')
    // 转义换行符
    .replace(/\n/g, '\\n')
    // 转义制表符
    .replace(/\t/g, '\\t');
}

/**
 * 获取 Markdown 的摘要（纯文本）
 */
export function getMarkdownSummary(markdown: string, maxLength: number = 100): string {
  const plainText = markdownToPlainText(markdown);
  if (plainText.length <= maxLength) return plainText;
  
  return plainText.substring(0, maxLength) + '...';
}

/**
 * 检查内容是否包含特定元素
 */
export function hasMarkdownElements(markdown: string, elements: string[] = []): Record<string, boolean> {
  const result: Record<string, boolean> = {};
  
  if (!markdown) return result;
  
  // 检查各种 Markdown 元素
  const checks = [
    { name: 'headings', pattern: /^#{1,6}\s+/gm },
    { name: 'lists', pattern: /^\s*[-*+]\s+/gm },
    { name: 'code', pattern: /```[\s\S]*?```/g },
    { name: 'quotes', pattern: /^\s*>\s+/gm },
    { name: 'links', pattern: /\[([^\]]*)\]\([^)]*\)/g },
    { name: 'images', pattern: /!\[([^\]]*)\]\([^)]*\)/g }
  ];
  
  // 如果用户指定了特定元素，只检查这些
  const elementsToCheck = elements.length > 0 ? elements : checks.map(c => c.name);
  
  elementsToCheck.forEach(element => {
    const check = checks.find(c => c.name === element);
    if (check) {
      result[element] = check.pattern.test(markdown);
    }
  });
  
  return result;
}