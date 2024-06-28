import { promisify } from "node:util";
import { exec } from "node:child_process";
import { blue, green, red, yellow } from "kolorist";

const execPromise = promisify(exec);

type Worktree = Record<"worktree" | "branch" | "head", string>;

async function getMergedBranches() {
	const { stdout } = await execPromise("git branch --merged");

	const branches: string[] = stdout.split("\n");

	const mergedBranches = branches.filter(branch => branch && !branch.includes("*")); // Remove empty strings and the current branch

	if (mergedBranches.length === 0)
		throw new Error("There are no branches to delete");

	const formattedBranches = mergedBranches.map((branch: string) => branch.replace(/^[\s\+]*/, ''));
	return formattedBranches;
}

async function getWorktrees(): Promise<Worktree[]> {
	const { stdout } = await execPromise("git worktree list --porcelain");


	const formattedWorktrees = stdout.split("\n").map((line: string) => {
		const words = line.split(" ");

		if (words.length === 2) {
			return {
				[words[0]]: words[1]
			}
		} else {
			return false;
		}
	}).filter((line): line is Worktree => line !== false).reduce((acc, curr) => {
		if (acc.length === 0) {
			acc.push(curr);
			return acc;
		}

		const key = Object.keys(curr)[0];
		if (key === "branch") {
			curr.branch = curr.branch.replace("refs/heads/", "");
		}

		const lastIndex = acc.length - 1;


		if (key in acc[lastIndex]) {
			acc.push(curr);
		} else {
			acc[lastIndex] = {
				...acc[lastIndex],
				...curr
			}
		}

		return acc;
	}, [] as Worktree[]);


	return formattedWorktrees as any as Worktree[]
}

async function getCurrentBranch() {
	const { stdout } = await execPromise('git branch');
	const branches = stdout.split('\n');
	const currentBranch = branches.find(branch => branch.includes('*'));
	if (!currentBranch) throw new Error("This directory is not a valid GIT directory");

	return currentBranch.replace(/^\*\s+/, '');
}

async function fetchBranch(branchName: string) {
	await execPromise(`git fetch origin ${branchName}:${branchName}`);
}

async function init() {

	const param = process.argv[2];

	if (param !== 'fetch') {
		const mergedBranches = await getMergedBranches();
		const worktrees = await getWorktrees();

		async function deleteWorktrees(branch: string) {
			const worktree = worktrees.find(worktree => worktree.branch === branch);
			if (!worktree) return;
			await execPromise(`git worktree remove ${worktree.worktree}`);
			console.log(yellow("Remove worktree at: ") + blue(worktree.worktree));
		}

		async function deleteBranch(branch: string) {
			await execPromise(`git branch -d ${branch}`);
			console.log(yellow("Remove branch: ") + blue(branch));
		}

		await Promise.all(mergedBranches.map(deleteWorktrees));

		await Promise.all(mergedBranches.map(deleteBranch));
	} else {
		const currentBranch = await getCurrentBranch();
		await fetchBranch(currentBranch);
		console.log(green(`Your branch has been updated: ${currentBranch}`));
	}


}

init().catch(err => console.error(red(err.message)));
