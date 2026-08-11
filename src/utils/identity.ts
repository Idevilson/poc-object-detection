export function slugify(name: string): string {
  const normalized = name.trim().toLowerCase();
  const slug = normalized.replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  return slug.length > 0 ? slug : normalized.replace(/\s+/g, '-');
}
