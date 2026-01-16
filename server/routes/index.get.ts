import { readFileSync } from "fs";
import { resolve } from "path";

const html = readFileSync(resolve("public/index.html"), "utf-8");

export default defineEventHandler(() => {
  return new Response(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
    },
  });
});
