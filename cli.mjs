import fs from "node:fs";
import { validate } from "./lib/store.mjs";
const [command, key, arg, ...flags] = process.argv.slice(2);
const base = process.env.VIEWER_URL ?? "http://127.0.0.1:4377";
const flag = (name) => {
  const i = flags.indexOf("--" + name);
  return i < 0 ? undefined : flags[i + 1];
};
try {
  if (command === "validate") {
    validate(JSON.parse(fs.readFileSync(key, "utf8")));
    console.log("Valid map");
    process.exit(0);
  }
  if (!["list", "get", "history", "put", "patch", "delete"].includes(command))
    throw new Error(
      "Usage: node cli.mjs list | get ID [REV] | history ID | validate FILE | put ID FILE --base N --author NAME --summary TEXT | patch ID FILE --base N --author NAME --summary TEXT | delete ID unused --base N --author NAME --summary TEXT",
    );
  let route = "/api/maps",
    method = "GET",
    body;
  if (key) route += "/" + encodeURIComponent(key);
  if (command === "history") route += "/history";
  if (command === "get" && arg) route += "?revision=" + Number(arg);
  if (["put", "patch", "delete"].includes(command)) {
    if (flag("base") === undefined || !flag("author") || !flag("summary"))
      throw new Error("--base, --author and --summary are required");
    body = {
      expectedRevision: Number(flag("base")),
      author: flag("author"),
      summary: flag("summary"),
    };
    if (command === "put")
      body.document = JSON.parse(fs.readFileSync(arg, "utf8"));
    if (command === "patch")
      body.operations = JSON.parse(fs.readFileSync(arg, "utf8"));
    method = { put: "PUT", patch: "PATCH", delete: "DELETE" }[command];
  }
  const { token } = await (await fetch(base + "/api/bootstrap")).json();
  const response = await fetch(base + route, {
    method,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const value = await response.json();
  if (!response.ok) throw new Error(value.error);
  console.log(JSON.stringify(value, null, 2));
} catch (e) {
  console.error(e.message);
  process.exitCode = 1;
}
