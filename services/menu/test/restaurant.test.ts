import { beforeAll, expect, test } from "bun:test";

import { auth, json, jsonPatch, seedRestaurant, useHarness } from "./harness";

// Restaurant-identity slice: theme, slug rename, and delete — the
// per-restaurant settings, asserted through the public read model.
const h = useHarness("menu_restaurant");

const RID = "eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee";

beforeAll(async () => {
  await seedRestaurant(h, { id: RID, slug: "casa", name: "Casa", defaultLanguage: "en" });
});

test("PATCH a theme → colours + layout surface on the public payload", async () => {
  const res = await h.app.request(
    "/api/restaurants/casa",
    await jsonPatch(h, { theme: { layout: "cards", primaryColor: "#1E8A52", secondaryColor: "#6b7280", font: "inter" } }),
  );
  expect(res.status).toBe(200);
  const pub = (await (await h.app.request("/public/r/casa")).json()) as {
    restaurant: { theme?: { primaryColor?: string; layout?: string } };
  };
  expect(pub.restaurant.theme?.primaryColor).toBe("#1E8A52");
  expect(pub.restaurant.theme?.layout).toBe("cards");
});

test("rename the slug → the new slug resolves, the old one 404s", async () => {
  const res = await h.app.request("/api/restaurants/casa/slug", await json(h, { slug: "nova-casa" }));
  expect(res.status).toBe(200);
  expect((await h.app.request("/public/r/nova-casa")).status).toBe(200);
  expect((await h.app.request("/public/r/casa")).status).toBe(404);
});

test("DELETE the restaurant → its slug stops resolving", async () => {
  const res = await h.app.request("/api/restaurants/nova-casa", { method: "DELETE", headers: await auth(h) });
  expect(res.status).toBe(200);
  expect((await h.app.request("/public/r/nova-casa")).status).toBe(404);
});
