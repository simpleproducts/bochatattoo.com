import { S3Client, DeleteObjectsCommand, ListObjectsV2Command } from "@aws-sdk/client-s3";
import { readFileSync, existsSync } from "fs";

const raw = [".env", ".env.local"]
	.filter((f) => existsSync(f))
	.map((f) => readFileSync(f, "utf8"))
	.join("\n");
const env = raw.split("\n").reduce((a, l) => {
	const m = l.match(/^([A-Z0-9_]+)=(.*)/);
	if (m) a[m[1]] = m[2].replace(/^['"]|['"]$/g, "");
	return a;
}, {});

const client = new S3Client({
	region: "auto",
	endpoint: `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
	credentials: { accessKeyId: env.R2_ACCESS_KEY_ID, secretAccessKey: env.R2_SECRET_ACCESS_KEY },
});

const prefixes = ["cuerpos-mockups", "posteos-semanales"];

for (const p of prefixes) {
	const list = await client.send(new ListObjectsV2Command({ Bucket: env.R2_BUCKET, Prefix: p }));
	if (!list.Contents?.length) { console.log("Nothing found for", p); continue; }
	await client.send(new DeleteObjectsCommand({ Bucket: env.R2_BUCKET, Delete: { Objects: list.Contents.map((o) => ({ Key: o.Key })) } }));
	console.log("Deleted", list.Contents.length, "objects with prefix", p);
}
