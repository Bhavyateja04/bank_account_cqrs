function getPagination(page, pageSize, totalCount) {
  const sanitizedPage = Number.isInteger(page) && page > 0 ? page : 1;
  const sanitizedPageSize =
    Number.isInteger(pageSize) && pageSize > 0 ? Math.min(pageSize, 100) : 10;

  return {
    currentPage: sanitizedPage,
    pageSize: sanitizedPageSize,
    totalPages: Math.max(Math.ceil(totalCount / sanitizedPageSize), 1),
    offset: (sanitizedPage - 1) * sanitizedPageSize,
  };
}

module.exports = {
  getPagination,
};
