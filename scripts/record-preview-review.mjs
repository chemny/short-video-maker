import fs from'node:fs';import path from'node:path';import{bindPreviewReview}from'./lib/preview-review.mjs';
const[job,draft]=process.argv.slice(2);if(!job||!draft)throw Error('Usage: record-preview-review.mjs JOB ACTUAL_REVIEW.json');console.log(JSON.stringify(bindPreviewReview(path.resolve(job),JSON.parse(fs.readFileSync(draft))),null,2));
