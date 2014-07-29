var fs = require("fs");

var REPORT_DATA="./report-data.json";
var ACTIVITY_FILE="./activity.csv";
var USERS_FILE="./users.csv";
var TRENDS_FILE="./trends.csv";
var IGNORE_USERNAMES_FILE="./ignore-usernames.txt";

var dataFilenames = process.argv.slice(2);

if (dataFilenames.length === 0) {
    console.log("Usage: build-report <data-filename>+");
    process.exit();
}

buildReport(dataFilenames);

function buildReport(newDataFilenames) {
    var report = getReport();

    newDataFilenames.forEach(function(newDataFilename) {
        updateReportWithData(report, newDataFilename);
    });

    fs.writeFileSync(REPORT_DATA, JSON.stringify(report));
    createCSVs(report);
}

function updateReportWithData(report, dataFilename) {
    var data = JSON.parse(fs.readFileSync(dataFilename));

    processData(data, report);
}

function getReport() {
    try {
        var contents = fs.readFileSync(REPORT_DATA);
        return JSON.parse(contents);
    } catch(ex) {
        return {
            days: {},
            users: {}
        };
    }
}

function processData(users, report) {
    var ignoreUsernames = getIgnoreUsernames();

    for (username in users) {
        if (users.hasOwnProperty(username) &&
            ignoreUsernames.indexOf(username) === -1) {
            processUser(username, users[username], report);
        }
    }

    return report;
}

function getIgnoreUsernames() {
    var contents = fs.readFileSync(IGNORE_USERNAMES_FILE);
    return contents.toString().split("\n");
}

function createCSVs(report) {
    createUsersCSV(report.days);
    createActivityCSV(report.users);
    createTrendsCSV(report.users);
}

function createUsersCSV(users) {
    var days = Object.keys(users);
    var knownUsers = {};
    var usersCSV = [];

    days.sort(function(a, b) {
        return getTime(a) - getTime(b);
    });

    days.forEach(function(day) {
        var activeUsers = users[day].length;
        var newUsers = 0;

        users[day].forEach(function(username) {
            if (!(username in knownUsers)) {
                knownUsers[username] = true;
                newUsers++;
            }
        });

        usersCSV.push([day, activeUsers, newUsers]);
    });

    usersCSV.sort(function(a, b) {
        return Date.parse(b[0]) - Date.parse(a[0]);
    });

    var fd = fs.openSync(USERS_FILE, "w");
    fs.writeSync(fd, "date,active_users,new_users\n");
    usersCSV.forEach(function(userCSV) {
        fs.writeSync(fd, userCSV.join(",") + "\n");
    });
    fs.closeSync(fd);
}

function createActivityCSV(days) {
    var activityCSV = [];

    Object.keys(days).forEach(function(username) {
        var usageDaysStats = getUsageDaysStats(days[username]);

        var activeDays = usageDaysStats.totalActiveDays;
        var lastActiveDay = formatDate(usageDaysStats.lastActiveDate);
        var firstActiveDay = formatDate(usageDaysStats.firstActiveDate);
        var activeRangeRatio = usageDaysStats.daysBetweenFirstAndLastActiveDay / usageDaysStats.daysSinceFirstActiveDay;
        var activeDaysRatio = usageDaysStats.totalActiveDays / usageDaysStats.daysSinceFirstActiveDay;

        activityCSV.push([username, activeDays, lastActiveDay, firstActiveDay, activeRangeRatio, activeDaysRatio]);
    });

    activityCSV.sort(function(a, b) {
        return ((b[4] + b[5])/2) - ((a[4] + a[5])/2);
    });

    var fd = fs.openSync(ACTIVITY_FILE, "w");
    fs.writeSync(fd, "username,active_days,last_active_day,first_active_day,active_range_ratio,active_days_ratio\n");
    activityCSV.forEach(function(line) {
        fs.writeSync(fd, line.join(",") + "\n");
    });

    fs.closeSync(fd);
}

function createTrendsCSV(days) {
    var trendNumberDays = 3;
    var fd = fs.openSync(TRENDS_FILE, "w");
    var endTrendDay = getTodaysDate();
    var trends = [];
    fs.writeSync(fd, "username,usage_trend\n");

    var startTrendDay = getDateDaysAgoFromDate(trendNumberDays, endTrendDay);
    var pastStartTrendDay = getDateDaysAgoFromDate(trendNumberDays, startTrendDay);
    var startDate = getDateDaysAgoFromDate(1, pastStartTrendDay);

    Object.keys(days).forEach(function(username) {
        var usageDaysStats = getUsageDaysStats(days[username]);
        var upTrendRangeCount = 0;
        var downTrendRangeCount = 0;

        if (usageDaysStats.lastActiveDate.getTime() < startDate.getTime()) {
            return;
        }

        days[username].forEach(function(day) {
            var date = new Date(day);
            if (isDateInRange(date, startTrendDay, endTrendDay)) {
                upTrendRangeCount++;
            } else if (isDateInRange(date, pastStartTrendDay, startTrendDay)) {
                downTrendRangeCount++;
            }
        });

        trends.push([username, upTrendRangeCount || downTrendRangeCount - trendNumberDays]);
    });

    trends.sort(function(a, b) {
        return b[1] - a[1];
    });

    trends.forEach(function(trend) {
        fs.writeSync(fd, trend.join(",") + "\n");
    });

    fs.closeSync(fd);
}

function getUsageDaysStats(days) {
    var today = getTodaysDate();
    var dates = days.map(function(day) {
        return new Date(day);
    });
    dates.sort(function(a, b) {
        return a.getTime() - b.getTime();
    });

    var lastActiveDate = dates[dates.length - 1];
    var firstActiveDate = dates[0];

    return {
        totalActiveDays: dates.length,
        daysSinceFirstActiveDay: getDateRangeInDays(firstActiveDate, today),
        daysBetweenFirstAndLastActiveDay: getDateRangeInDays(firstActiveDate, lastActiveDate) + 1,
        firstActiveDate: firstActiveDate,
        lastActiveDate: lastActiveDate
    };
}

function isDateInRange(date, startDateRange, endDateRange) {
    var timestamp = date.getTime();

    return timestamp >= startDateRange.getTime() &&
           timestamp <= endDateRange.getTime();
}

function getDateDaysAgoFromDate(days, referenceDate) {
    var time = days * 24/*h*/ * 60/*m*/ * 60/*s*/ * 1000/*ms*/;

    return new Date(referenceDate.getTime() - time);
}

function getDateRangeInDays(startDate, endDate) {
    var diff = endDate.getTime() - startDate.getTime();

    return Math.round(diff / 1000/*ms*/ / 60/*s*/ / 60/*m*/ / 24/*h*/);
}

function getTime(stringDate) {
    var parsedDate = stringDate.split("/");
    var date = new Date(parsedDate[0], parsedDate[1], parsedDate[2]);

    return date.getTime();
}

function processUser(username, dates, report) {
    dates.forEach(function(timestamp) {
        var date = formatDate(timestamp);
        var usernames = report.days[date];
        var days = report.users[username];

        if (!usernames) {
            report.days[date] = usernames = [];
        }
        if (usernames.indexOf(username) === -1) {
            usernames.push(username);
        }

        if (!days) {
            report.users[username] = days = [];
        }
        if (days.indexOf(date) === -1) {
            days.push(date);
        }
    });
}

function formatDate(timestamp) {
    var date;

    if (timestamp instanceof Date) {
        date = timestamp;
    } else {
        date = new Date(timestamp * 1000);
    }

    return date.getFullYear() + "/" + (date.getMonth()+1) + "/" + date.getDate();
}

function getTodaysDate() {
    var date = new Date(Date.now());

    date.setHours(0);
    date.setMinutes(0);
    date.setSeconds(0);
    date.setMilliseconds(0);

    return date;
}