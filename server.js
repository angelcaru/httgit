
const path = require("path");
const chp = require("child_process");
const express = require("express");

const { argv } = process;
const interp_name = argv.shift();
const program_name = argv.shift();
if (argv.length < 1) {
    console.error(`Usage: ${interp_name} ${program_name} <repo>`);
    process.exit(1);
}
const repoDir = argv.shift();
const repoDirAbs = path.resolve(repoDir);
const repo = path.basename(repoDirAbs);

const app = express();
app.use(express.json());

function git(...args) {
    return chp.spawnSync("git", args, {
        cwd: repoDir,
        encoding: "utf8",
        stdio: "pipe",
    }).stdout;
}

app.get("/", (req, res) => {
    res.sendFile(`${process.cwd()}/client/index.html`);
});

app.get("/index.js", (req, res) => {
    res.sendFile(`${process.cwd()}/client/index.js`);
});

app.get("/dyn.js", (req, res) => {
    const rawBranches = git("branch", "-a").split("\n");
    const branches = rawBranches.map(raw => raw.slice(2)).filter(raw => raw.length > 0);
    const currentBranch = rawBranches.find(raw => raw.startsWith("*")).slice(2);

    const commits = git("log", "--pretty=format:%h %H %s").split("\n").map(raw => {
        const split = raw.split(" ");
        return {
            shortHash: split[0],
            hash: split[1],
            message: split.slice(2).join(" "),
            body: git("log", "-1", split[1], "--format=%B"),
        };
    });

    const status = git("status", "--porcelain").split("\n").map(line => {
        const fileStatus = line.slice(0, 2).toUpperCase();
        const fileName = line.slice(3);
        // TODO: parse this properly
        const staged = !(fileStatus === "??" || fileStatus[0] === " ");
        return {
            status: fileStatus,
            name: fileName,
            staged,
        };
    }).filter(({ name }) => name.length > 0);

    res.header("Content-Type", "application/javascript");
    res.send(`
        export const repo = ${JSON.stringify(repo)};
        export const branches = ${JSON.stringify(branches)};
        export const currentBranch = ${JSON.stringify(currentBranch)};
        export const commits = ${JSON.stringify(commits)};
        export const status = ${JSON.stringify(status)};
    `);
});

app.get("/api/diff/:hash", (req, res) => {
    const diff = git("show", req.params.hash, "--format=");
    res.send(diff);
});

app.post("/api/make_commit", (req, res) => {
    console.log(req.body);
    const { message, body, toStage, toUnstage } = req.body;

    for (const fileName of toStage) {
        git("add", fileName);
    }
    for (const fileName of toUnstage) {
        git("rm", "--cached", fileName);
    }

    git("commit", "-m", message + "\n\n" + body + "\n");
    res.send();
});


const port = 6969;
app.listen(port, "127.0.0.1", () => {
    console.log(`Listening on port ${port}`);
});
