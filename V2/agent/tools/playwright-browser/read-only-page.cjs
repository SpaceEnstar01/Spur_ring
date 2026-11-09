exports.default = async ({page}) => {
  const context = page.context();
  if (context.__spurReadOnly) return;
  context.__spurReadOnly = true;
  await context.route('**/*',route => {
    const request = route.request();
    if (!['GET','HEAD'].includes(request.method()) || !/^https?:\/\//i.test(request.url())) return route.abort('blockedbyclient');
    return route.continue();
  });
  await context.routeWebSocket('**/*',socket => socket.close());
};
