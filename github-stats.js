var GithubApi = require("./github-api");
var fs = require("fs");
var Q = require("q");
var HTTP = require("q-io/http");
var cheerio = require("cheerio");

var CLIENT_ID="CLIENT_ID";
var CLIENT_SECRET="CLIENT_SECRET";
var REPORT_FILE="./report-data.json";
var OUTPUT_FILE="./github-stats.json";

var github = new GithubApi(CLIENT_ID, CLIENT_SECRET);
var usernames = getUsernames();

buildStats();

function buildStats() {
    var stats = getStats();//{users: {}};

    Q.all(usernames.map(function(username, ix) {
        return getGithubStats(username, ix)
        .then(function(githubStats) {
            mergeGithubStats(stats.users, username, githubStats);
        });
    }))
    .then(function() {
        fs.writeFileSync(OUTPUT_FILE, JSON.stringify(stats));
    }).done();
}

function getStats() {
    try {
        var contents = fs.readFileSync(OUTPUT_FILE);
        return JSON.parse(contents);
    } catch(ex) {
        return {
            users: {}
        };
    }
}

function mergeGithubStats(users, username, newStats) {
    var stats = users[username];

    function updateObject(object, newObject) {
        for (var key in newObject) {
            if (newObject.hasOwnProperty(key)) {
                if (!object[key]) {
                    object[key] = newObject[key];
                }
            }
        }
    }

    if (stats) {
        updateObject(stats, newStats);
        updateObject(stats.repos, newStats.repos);
    } else {
        users[username] = newStats;
    }
}

function getGithubStats(username, ix) {
    var user = {repos: {}};
    var userProperties = ["avatar_url", "name", "company", "location", "email",
                          "bio", "created_at", "public_repos"];

    return github.getUser(username)
    .then(function(githubUser) {
        console.log("processing " + username + " (" + (ix+1) + ").");
        userProperties.forEach(function(propertyName) {
            if (githubUser[propertyName]) {
                user[propertyName] = githubUser[propertyName];
            }
        });
        return github.listUserRepositories(username);
    })
    .then(function(repositories) {
        return Q.all(repositories.map(function(repository) {
            //console.log("processing " + repository.full_name + ".");
            return processRepository(repository)
            .then(function(stats) {
                if (stats) {
                    user.repos[repository.name] = stats;
                }
            });
        }));
    }, function() {
        console.log(username + " doesn't exist.");
    })
    .thenResolve(user);
}

function processRepository(repository) {
    var username = repository.owner.login;

    return isMontageRepository(repository)
    .then(function(isMontage) {
        if (isMontage) {
            return getRepositoryStats(repository);
        }
    });
}

function isMontageRepository(repository) {
    var user = repository.owner.login;
    var repo = repository.name;

    var url = "https://github.com/" + user + "/" + repo + "/blob/master/ui/main.reel";

    return HTTPrequest(url).then(function(response) {
        return response.status !== 404;
    });
}

function getRepositoryStats(repository) {
    var stats = {};
    var user = repository.owner.login;
    var repo = repository.name;

    var masterUrl = "https://github.com/" + user + "/" + repo + "/tree/master";
    var shadowUrl = "https://github.com/" + user + "/" + repo + "/tree/__mb__" + user + "__master";

    console.log("Getting stats for " + repository.full_name);
    return getPageSelector(masterUrl)
    .then(function(querySelector) {
        console.log("Got stats for " + repository.full_name);
        var forkName = getForkName(querySelector);

        stats.isTodoFork = forkName === "montagejs/studio-todo";
        stats.isPopcornFork = forkName === "montagejs/popcorn";

        stats.masterNumberCommits = getNumberCommits(querySelector);

        return getPageSelector(shadowUrl);
    })
    .then(function(querySelector) {
        stats.shadowNumberCommits = getNumberCommits(querySelector);
    }).thenResolve(stats);
}

function getNumberCommits(querySelector) {
    return Number(querySelector(".commits .num").text());
}

function getForkName(querySelector) {
    return querySelector(".fork-flag a").text();
}

function getPageSelector(url) {
    return HTTPrequest(url).then(function(response) {
        return response.body.read().then(function(body) {
            return body.toString();
        });
    }, function(reason) {
        console.log("fail " , reason);
    })
    .then(function(html) {
        return cheerio.load(html);
    });
}

function getUsernames() {
    var contents = fs.readFileSync(REPORT_FILE);
    return Object.keys(JSON.parse(contents).users);
}

var maxSimultaneousRequests = 4;
var simultaneousRequests = 0;
var requestsQueue = [];
function HTTPrequest(url) {
    function makeRequestFunction(url, deferred) {
        return function() {
            HTTP.request(url)
            .then(function(result) {
                deferred.resolve(result);
                var nextRequest = requestsQueue.shift();
                if (nextRequest) {
                    nextRequest();
                } else {
                    simultaneousRequests--;
                }
            }, deferred.reject)
            .done();
        }
    }

    var deferred = Q.defer();

    if (simultaneousRequests < maxSimultaneousRequests) {
        simultaneousRequests++;
        makeRequestFunction(url, deferred)();
    } else {
        requestsQueue.push(makeRequestFunction(url, deferred));
    }

    return deferred.promise;
}