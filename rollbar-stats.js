var HTTP = require("q-io/http");
var Params = require('query-params');
var fs = require("fs");
var Q = require("q");

var ROLLBAR_HOST="https://api.rollbar.com/api/1";
var ACCESS_TOKEN="2c502b32ece24c249989fb40e7e42047";
var OUTPUT_FILE="./users.json";

var startDay = process.argv[2];
var endDay = process.argv[3];
var startDate;
var endDate;

if (!startDay) {
    console.log("Usage: rollbar-stats <start date yyyy-mm-dd> [<end date yyyy-mm-dd>]");
    process.exit();
}

startDate = parseDate(startDay, "00:00");
endDate = parseDate(endDay ? endDay : startDay, "23:59:59");

buildStats(startDate, endDate);

function parseDate(stringDate, stringHour) {
    var time = Date.parse(stringDate.replace("-", "/") + " " + stringHour + " GMT-0700 (PDT)");

    return new Date(time);
}

function buildStats(startDate, endDate) {
    var options = {
        startTimestamp: startDate.getTime() / 1000,
        endTimestamp: endDate.getTime() / 1000
    };

    getAllItems()
    .then(function(items) {
        var users = {};

        console.log("Processing " + items.length + " items.");
        return Q.all(items.filter(function(item) {
                return item.environment === "production";
            })
            .map(function(item, ix) {
                //console.log("item ", item.id, item.title, item.counter);
                return processAllInstances(item.id, options, function(instance) {
                    if (instance.data.person) {
                        var username = instance.data.person.username;
                        if (!users[username]) {
                            users[username] = [];
                        }
                        users[username].push(instance.data.timestamp);
                    }
                });
            })).thenResolve(users);
    })
    .then(function(users) {
        var filename = "./users_" + startDay + (endDay ? "_" + endDay : "") + ".json";
        fs.writeFileSync(filename, JSON.stringify(users));
    })
    .done();
}

function getAllItems() {
    var allItems = [];

    function fetchItems(page) {
        page = page || 1;
        console.log("Items page " + page);
        return getItems(page).then(function(items) {
            if (items.length > 0) {
                allItems.push.apply(allItems, items);
                return fetchItems(page + 1);
            }
        });
    }

    return fetchItems().thenResolve(allItems);
}

function processAllInstances(itemId, options, callback) {
    var allInstances = [];

    options = options || {};

    var startTimestamp = options.startTimestamp || Date.now() / 1000;
    var endTimestamp = options.endTimestamp || Number.POSITIVE_INFINITY;

    function fetchInstances(page) {
        page = page || 1;
        return getItemInstances(itemId, page).then(function(instances) {
            if (instances.length > 0) {
                var fetchNextPage = true;
                console.log("Processing instances page " + page + " of item " + itemId + ".");

                for (var i = 0, instance; instance = instances[i]; i++) {
                    if (instance.timestamp > endTimestamp) {
                        continue;
                    }
                    if (instance.timestamp < startTimestamp) {
                        fetchNextPage = false;
                        break;
                    }
                    callback(instance);
                }
                if (fetchNextPage) {
                    return fetchInstances(page + 1);
                }
            }
        });
    }

    return fetchInstances();
}

function getAllInstances(itemId) {
    var allInstances = [];

    function fetchAllInstances(page) {
        page = page || 1;
        return getItemInstances(itemId, page).then(function(instances) {
            if (instances.length > 0) {
                allInstances.push.apply(allInstances, instances);
                return fetchAllInstances(page + 1);
            }
        });
    }

    return fetchAllInstances().thenResolve(allInstances);
}

function getItems(page) {
    var options = {};

    if (page) {
        options.page = page;
    }

    return makeRequest("/items/", options)
    .then(function(response) {
        return JSON.parse(response).result.items;
    });
}

function getItemInstances(itemId, page) {
    var options = {};

    if (page) {
        options.page = page;
    }

    return makeRequest("/item/" + itemId + "/instances/", options)
    .then(function(response) {
        return JSON.parse(response).result.instances;
    });
}

function getInstances(page) {
    var options = {};

    if (page) {
        options.page = page;
    }

    return makeRequest("/instances/", options)
    .then(function(response) {
        return JSON.parse(response).result;
    });
}

function makeRequest(path, options) {
    var url;

    options = options || {};
    options.access_token = ACCESS_TOKEN;
    url = ROLLBAR_HOST + path + "?" + Params.encode(options);

    return HTTP.request(url).then(function(response) {
        return response.body.read().then(function(body) {
            return body.toString();
        });
    });
}