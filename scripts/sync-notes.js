/**
 * This is a little script I use to sync Obsidian notes between Google Docs and
 * iCloud. On my Mac/iPhone I sync my main notes vault to iCloud, but I also
 * occasionally use a PC and sync that vault to Google Cloud. This was a quick
 * hack to sync those directories on my Mac. I run this via Automator every
 * morning and it does a decent job of creating a cross-platform syncronized
 * notes experience.
 */

import path from "path";
import fs from "fs";
import os from "os";
import { exec } from "child_process";

const homeDir = os.homedir();

// Obsidian vault name
// Both directories need to use the same folder name for this to work!
const vaultName = "Notes";

const googleDir = path.join(homeDir, "Google Drive");
const iCloudDir = path.join(
	homeDir,
	"Library",
	"Mobile Documents",
	"iCloud~md~obsidian",
	"Documents"
);

main();

function main() {
	exec(buildSyncCommand(), { env: process.env }, (error, stdout, stderr) => {
		if (stdout) console.log(stdout);
		if (stderr) console.error(stderr);
		if (error) throw error;
		console.log(`Success!`);
	});
}

/**
 * Walks through the specified directories and sorts based on the most recent
 * update time.
 * @param {string[]} dirs - directories to sort
 * @returns {string[]}
 */
function sortByLastModified(...dirs) {
	return dirs.sort((a, b) => getLastModifiedTime(b) - getLastModifiedTime(a));
}

/**
 * @param {string} candidate - file or directory to check
 * @returns {number} - unix timestamp in milliseconds
 */
function getLastModifiedTime(candidate) {
	try {
		/** @type {fs.Stats} */
		let stats;
		try {
			stats = fs.statSync(candidate);
		} catch (err) {
			throw Error(
				`The argument ${candidate} is not a valid file or folder directory.`
			);
		}

		let times = [stats.mtimeMs, stats.ctimeMs, stats.birthtimeMs];
		if (stats.isDirectory()) {
			let files = fs
				.readdirSync(candidate)
				.filter(
					(file) =>
						!(
							path.basename(file).startsWith(".DS_Store") ||
							path.basename(file).startsWith("~")
						)
				);
			times = [
				...times,
				...files.map((f) => getLastModifiedTime(path.join(candidate, f))),
			];
		}
		return Math.max(...times);
	} catch (err) {
		throw err; // TODO, maybe
	}
}

/**
 * @returns {string}
 */
function buildSyncCommand() {
	// We want to run rsync with the most recently updated Notes directory as the
	// source, then run it in the other direction. This ensures that we capture
	// all updates from the source that may have overridden updates from the
	// destination first, but the destination directory may also have changes that
	// our source does not.
	//
	// TODO: This is an imperfect strategy at the moment. Ideally we would sync
	// each file based on its modified date. But this is faster and works well
	// enough for now.
	let cmd = `rsync -aE -delete --exclude '**/*.DS_Store*'`;
	let first = sortByLastModified(
		path.join(googleDir, vaultName) + path.sep,
		path.join(iCloudDir, vaultName) + path.sep
	);
	let second = [...first].reverse();

	return [
		`${cmd} ${first.map(quoteString).join(" ")}`,
		`${cmd} ${second.map(quoteString).join(" ")}`,
	].join(" && ");
}

/**
 * @param {string} str
 * @returns {string}
 */
function quoteString(str) {
	return `'${str}'`;
}
