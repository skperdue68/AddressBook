// Keep the query offset and rendered controls on the same available page.
export function pageWindow(requested, total, pageSize = 25) {
  const count = Math.max(0, Math.floor(Number(total) || 0));
  const size = Math.max(1, Math.floor(Number(pageSize) || 25));
  const pages = Math.max(1, Math.ceil(count / size));
  const value = Number(requested);
  const page = Math.min(pages, Number.isFinite(value) ? Math.max(1, Math.floor(value)) : 1);
  return { page, pages, pageSize: size, total: count, offset: (page - 1) * size };
}
