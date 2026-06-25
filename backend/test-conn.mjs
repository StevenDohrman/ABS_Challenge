import { PrismaClient } from "@prisma/client";
import { readFileSync } from "fs";

const env = Object.fromEntries(
  readFileSync(new URL(".env", import.meta.url), "utf8")
    .split("\n").filter(Boolean)
    .map((l) => { const [k, ...v] = l.split("="); return [k.trim(), v.join("=").trim().replace(/^"|"$/g, "")]; })
);

const projectRef = "qhwnztjnlbepejnszkbh";
const pwd = encodeURIComponent(env.DATABASE_URL?.match(/:([^@]+)@/)?.[1] ?? "");

const regions = [
  "us-east-1", "us-east-2", "us-west-1", "us-west-2",
  "eu-west-1", "eu-west-2", "eu-central-1",
  "ap-southeast-1", "ap-southeast-2", "ap-northeast-1",
  "ca-central-1", "sa-east-1",
];

console.log("Testing pooler regions for project", projectRef, "\n");

for (const region of regions) {
  const host = `aws-0-${region}.pooler.supabase.com`;
  const url = `postgresql://postgres.${projectRef}:${pwd}@${host}:6543/postgres?pgbouncer=true`;
  const p = new PrismaClient({ datasources: { db: { url } } });
  try {
    await p.$queryRaw`SELECT 1`;
    console.log("✅ FOUND IT:", region);
  } catch (e) {
    const fatal = e.message.split("\n").find((l) => l.includes("FATAL") || l.includes("error"));
    const short = (fatal ?? "").replace(/\n.*/s, "").trim().slice(0, 80);
    console.log(`   ${region.padEnd(20)} ${short}`);
  } finally {
    await p.$disconnect();
  }
}
