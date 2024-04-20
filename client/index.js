
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

for (const tagName of ["a", "div", "h1", "h2", "h3", "pre", "br"]) {
    window[tagName] = tagFn(tagName);
}


console.log(dyn);
function mainPage() {
    return [
        h1(`Repository ${dyn.repo}`),
        h2("Branches"),
        ...dyn.branches.map(branch =>
            div(`${branch}`)
                .styled("color", branch === dyn.currentBranch ? "blue" : "black")
        ),
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

const params = Object.fromEntries(new URLSearchParams(window.location.search));
const page =
    params.commit ?
      commitPage(params.commit)
    : mainPage();
document.body.append(...page);

