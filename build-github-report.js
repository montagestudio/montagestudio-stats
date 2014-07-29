var fs = require("fs");

var REPORT_DATA="./report-data.json";
var GITHUB_DATA="./github-stats.json";
var GITHUB_FILE="./github.csv";

buildReport();

function buildReport() {
    var githubData = getGithubData();
    var usersData = getUsersData();
    var user, repository;
    var fd = fs.openSync(GITHUB_FILE, "w");
    var commits;
    var createdDate;

    fs.writeSync(fd, "user,montage_repo,new_commits,new_github_user\n");

    for (var username in githubData.users) {
        user = githubData.users[username];
        createdDate = new Date(user.created_at);

        for (var repo in user.repos) {
            repository = user.repos[repo];

            if (repository.shadowNumberCommits) {
                commits = repository.shadowNumberCommits - repository.masterNumberCommits;
            } else {
                commits = 0;
            }
            newGithubUser = usersData[username].indexOf(formatDate(createdDate)) >= 0;

            fs.writeSync(fd, [username, repo, commits, newGithubUser].join(",") + "\n");
        }
    }

    fs.closeSync(fd);
}

function getGithubData() {
    var contents = fs.readFileSync(GITHUB_DATA);
    return JSON.parse(contents);
}

function getUsersData() {
    var contents = fs.readFileSync(REPORT_DATA);
    return JSON.parse(contents).users;
}

function formatDate(date) {
    return date.getFullYear() + "/" + (date.getMonth()+1) + "/" + date.getDate();
}