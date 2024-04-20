
import * as dyn from "/dyn.js";

function tag(name, ...children) {
    const elt = document.createElement(name);
    for (const child of children) {
        elt.append(child);
    }
    return elt;
}

function tagFn(name) {
    return (...children) => tag(name, ...children);
}

Element.prototype.att = function(name, value) {
    this.setAttribute(name, value);
    return this;
};
Element.prototype.styled = function(name, value) {
    this.style.setProperty(name, value);
    return this;
};
Element.prototype.clear = function() {
    while (this.firstChild) this.removeChild(this.lastChild);
    return this;
};
const oldAppend = Element.prototype.append;
Element.prototype.append = function(...children) {
    for (const child of children) {
        oldAppend.call(this, child);
    }
    return this;
};
Element.prototype.event = function(name, handler) {
    this.addEventListener(name, handler);
    return this;
};

for (const tagName of ["a", "div", "h1", "h2", "h3", "pre", "br", "button", "form", "ul", "ol", "li", "span"]) {
    window[tagName] = tagFn(tagName);
}

function input(type, name, placeholder) {
    return tag("input")
        .att("type", type)
        .att("name", name)
        .att("placeholder", placeholder);
}

function textarea(name, placeholder) {
    return tag("textarea")
        .att("name", name)
        .att("placeholder", placeholder);
}

console.log(dyn);

function branchAddForm() {
    return form(
        input("text", "branchName", "New branch name"),
        button("Add branch"),
    ).event("submit", e => {
        e.preventDefault();
        fetch("/api/branch_add", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                name: e.target.branchName.value,
            }),
        }).then(() => window.location = "/");
    });
}

function mainPage() {
    return [
        h1(`Repository ${dyn.repo}`),
        a("Make a new commit").att("href", "/?make_commit=1"),
        h2("Branches"),
        branchAddForm(),
        ...dyn.branches.flatMap(branch =>
            branch === dyn.currentBranch ?
              [div(`${branch} (current)`)]
            : [
                a(branch).att("href", `/switch_branch/${branch}`),
                button("Delete").event("click", () => {
                    fetch("/api/branch_delete", {
                        method: "POST",
                        headers: {
                            "Content-Type": "application/json",
                        },
                        body: JSON.stringify({ name: branch }),
                    }).then(() => window.location = "/");
                }),
                br()
            ]),
        h2("Commit history"),
        ...dyn.commits.flatMap(commit => [
            a(pre(`[${commit.shortHash}] ${commit.message}`)
                .styled("display", "inline")
            ).att("href", `/?commit=${commit.hash}`),
            br(),
        ]),
    ];
}

function commitDiff(commit) {
    const ret = div("Loading diff...");
    fetch(`/api/diff/${commit.hash}`)
        .then(r => r.text())
        .then(diff => {
            ret.clear()
                .append(h3("Commit message"))
                .append(pre(commit.body))
                .append(h3("Commit diff"))
                .append(...diff.split("\n")
                    .map(line => {
                        if (line.startsWith("+")) {
                            return pre(line).styled("color", "green");
                        } else if (line.startsWith("-")) {
                            return pre(line).styled("color", "red");
                        } else {
                            return pre(line);
                        }
                    })
                    .map(pre => pre.styled("display", "inline").append(br()))
                )
                .styled("font-size", "1.5em");
        });
    return ret;
}

function commitPage(hash) {
    const commit = dyn.commits.find(commit => commit.hash === hash);
    return [
        a("Back to main page").att("href", "/"),
        h1(`Commit ${commit.shortHash} (${commit.message})`),
        commitDiff(commit),
    ];
}

function makeCommitPage() {
    let stagedList, unstagedList;
    let toStage   = [];
    let toUnstage = [];
    const ret = [
        a("Back to main page").att("href", "/"),
        h1(`Make a commit on branch "${dyn.currentBranch}"`),
        h2("Staged changes", button("Unstage all").event("click", () => dyn.status.forEach(unstageFile))),
        (stagedList = ul()),
        h2("Unstaged changes", button("Stage all").event("click", () => dyn.status.forEach(stageFile))),
        (unstagedList = ul()),
        form(
            input("text", "message", "Commit message"),
            br(), br(),
            textarea("body", "Commit message body"),
            br(),
            button("Submit")
        ).event("submit", e => {
            e.preventDefault();
            fetch("/api/make_commit", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    toStage, toUnstage,
                    message: e.target.message.value,
                    body: e.target.body.value,
                }),
            }).then(() => window.location = "/");
        }),
    ];

    function switchStaged(file) {
        if (file.staged) {
            if (toStage.includes(file.name)) {
                toStage = toStage.filter(name => name !== file.name);
            } else {
                toUnstage.push(file.name);
            }
            file.staged = false;
        } else {
            if (toUnstage.includes(file.name)) {
                toUnstage = toUnstage.filter(name => name !== file.name);
            } else {
                toStage.push(file.name);
            }
            file.staged = true;
        }
        update();
    }
    function stageFile(file) {
        if (!file.staged) {
            switchStaged(file);
        }
    }
    function unstageFile(file) {
        if (file.staged) {
            switchStaged(file);
        }
    }
    function update() {
        stagedList.clear();
        unstagedList.clear();
        dyn.status.forEach(file => {
            let btn = button().styled("display", "inline");
            if (file.staged) {
                btn.append("Unstage");
                stagedList.append(li(btn, " ", file.name));
            } else {
                btn.append("Stage");
                unstagedList.append(li(btn, " ", file.name));
            }
            btn.event("click", () => switchStaged(file));
        });
    }
    update();

    return ret;
}

const params = Object.fromEntries(new URLSearchParams(window.location.search));
const page = (function() {
    if (params.commit) {
        return commitPage(params.commit);
    } else if (params.make_commit) {
        return makeCommitPage();
    } else {
        return mainPage();
    }
})();
document.body.append(...page);

