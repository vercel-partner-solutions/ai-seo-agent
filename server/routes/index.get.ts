export default defineEventHandler(async () => {
  const html = await useStorage("assets:templates").getItem("index.html");

  return new Response(html as string, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
    },
  });
});
