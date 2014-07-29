/* global XMLHttpRequest, console */
var Q = require("q");

var XHR;
if (typeof XMLHttpRequest === "undefined") {
    XHR = require/**/("xmlhttprequest").XMLHttpRequest;
} else {
    XHR = XMLHttpRequest;
}

module.exports = GithubApi;

/**
 * GitHub API v3
 */
function GithubApi(clientId, clientSecret) {
    this._clientId = clientId;
    this._clientSecret = clientSecret;
}

GithubApi.prototype.API_URL = "https://api.github.com";

/**
 * Users
 */

// https://developer.github.com/v3/users/#get-a-single-user
GithubApi.prototype.getUser = function(username) {
    return this._request({
        method: "GET",
        url: "/users/" + username
    });
};

/**
 * Git Data
 */

// http://developer.github.com/v3/git/blobs/#get-a-blob
GithubApi.prototype.getBlob = function(username, repository, sha, param) {
    return this._request({
        method: "GET",
        url: "/repos/" + username + "/" + repository + "/git/blobs/" + sha,
        param: param
    });
};

// http://developer.github.com/v3/git/blobs/#create-a-blob
GithubApi.prototype.createBlob = function(username, repository, content, encoding) {
    return this._request({
        method: "POST",
        url: "/repos/" + username + "/" + repository + "/git/blobs",
        data: {
            content: content,
            encoding: encoding
        }
    });
};

// https://developer.github.com/v3/repos/commits/#list-commits-on-a-repository
GithubApi.prototype.listCommits = function(username, repository, options) {
    return this._request({
        method: "GET",
        url: "/repos/" + username + "/" + repository + "/commits",
        query: options
    });
};


// http://developer.github.com/v3/git/commits/#get-a-commit
GithubApi.prototype.getCommit = function(username, repository, sha) {
    return this._request({
        method: "GET",
        url: "/repos/" + username + "/" + repository + "/git/commits/" + sha
    });
};

// http://developer.github.com/v3/git/trees/#get-a-tree
GithubApi.prototype.getTree = function(username, repository, sha, recursive) {
    var query = {};

    if (recursive) {
        query.recursive = 1;
    }

    return this._request({
        method: "GET",
        url: "/repos/" + username + "/" + repository + "/git/trees/" + sha,
        query: query
    });
};

/**
 * Repositories
 */

// http://developer.github.com/v3/repos/#list-user-repositories
GithubApi.prototype.listUserRepositories = function(username) {
    return this._request({
        method: "GET",
        url: "/users/" + username + "/repos",
        allPages: true
    });
};

// http://developer.github.com/v3/repos/#get
GithubApi.prototype.getRepository = function(username, repository) {
    return this._request({
        method: "GET",
        url: "/repos/" + username + "/" + repository
    });
};

// http://developer.github.com/v3/repos/#list-branches
GithubApi.prototype.listBranches = function(username, repository) {
    return this._request({
        method: "GET",
        url: "/repos/" + username + "/" + repository + "/branches"
    });
};

// http://developer.github.com/v3/repos/#get-branch
GithubApi.prototype.getBranch = function(username, repository, branch) {
    return this._request({
        method: "GET",
        url: "/repos/" + username + "/" + repository + "/branches/" + branch
    });
};

// https://developer.github.com/v3/activity/events/#list-repository-events
GithubApi.prototype.getRepositoryEvents = function(username, repository, lastETag) {
    lastETag = lastETag || 0;

    return this._request({
        method: "GET",
        url: "/repos/" + username + "/" + repository + "/events",
        headers: {"If-None-Match": lastETag},
        responseHeaders: ["etag", "x-poll-interval"]
    });
};

/**
 * Gists
 */
// http://developer.github.com/v3/gists/#create-a-gist
GithubApi.prototype.createGist = function(description, files, public) {
    return this._request({
        method: "POST",
        url: "/gists",
        data: {
            description: description,
            public: this._accessToken ? !!public : true,
            files: files
        }
    });
};

GithubApi.prototype._createQueryString = function(query) {
    return Object.keys(query).map(function(name) {
        return encodeURIComponent(name) + "=" + encodeURIComponent(query[name]);
    }).join("&");
};

/**
 * Not part of Github API but they are helper functions
 */

/**
 * An empty repository doesn't have branches.
 */
GithubApi.prototype.isRepositoryEmpty = function(username, repository) {
    return this.listBranches(username, repository)
    .then(function(branches) {
        return branches.length === 0;
    });
};

GithubApi.prototype.repositoryExists = function(username, repository) {
    return this.getRepository(username, repository)
        .then(function (repo) {
            return !!repo;
        }, function (err) {
            if ("Not Found" === err.message) {
                return false;
            } else {
                throw err;
            }
        });
};

GithubApi.prototype.checkError = function(method, username, thisp) {
    var self = this;
    return function wrapped(error) {
        var args = Array.prototype.slice.call(arguments);
        return method.apply(thisp, args).catch(function(error) {
            console.log("Git Error", error.stack);
            return self.checkCredentials(username).then(function(success) {
                if (success) {
                    // Nothing wrong with github, let returns the original error
                    throw error;
                } else {
                    throw new Error("Unauthorized access");
                }
            }, function(error) {
                throw new Error("Network error");
            });
        });
    };
};

GithubApi.prototype.checkCredentials = function(username) {
    return this.getUser().then(function(user) {
        return (user.login === username);
    }, function(error) {
        if (error.message.indexOf("credential") !== -1) {
            // return false rather than an error for credential issue
            return false;
        }
        throw error;
    });
};

GithubApi.prototype.getInfo = function(username, repository) {
    return this.getRepository(username, repository)
    .then(function(repository) {
        return {
            //jshint -W106
            gitUrl: repository.clone_url,
            gitBranch: repository.default_branch
            //jshint +W106
        };
    });
};

/**
 * @typeof RequestOptions
 * @type {object}
 * @property {string} url The URL to request.
 * @property {string} method The method to use: "GET", "POST", "PATCH", etc.
 * @property {object=} data The data as a JSON structure to send with the
 *           request. Usually used with creating / modifying requests.
 * @property {object=} query A dictionary with the names and values to pass in
 *           the request as a query string.
 * @property {object=} headers A dictionary with the name of the headers and
 *           value to send in the request.
 * @property {string=""} param The github param modifier for media types:
 *           http://developer.github.com/v3/media/.
 * @property {array=} responseHeaders The list of headers to return with response.
 */

/**
 * param {RequestOptions} request
 */
GithubApi.prototype._request = function(request) {
    var self = this,
        xhr = new XHR(),
        param = request.param ? "." + request.param : "",
        queryString = "",
        responseHeaders = request.responseHeaders,
        allPages = request.allPages,
        deferred,
        url;

    if (request.continueRequest) {
        url = request.continueRequest.url;
        deferred = request.continueRequest.deferred;
    } else {
        queryString = "?client_id=" + this._clientId +
                      "&client_secret=" + this._clientSecret;
        if (request.query) {
            queryString += "&" + this._createQueryString(request.query);
        }
        url = this.API_URL + request.url + queryString;
        deferred = Q.defer();
    }

    xhr.open(request.method, url);
    xhr.addEventListener("load", function() {
        var message,
            response;

        if (xhr.status >= 200 && xhr.status < 300) {
            if (xhr.responseText) {
                if (request.param === "raw") {
                    message = xhr.responseText;
                } else {
                    message = JSON.parse(xhr.responseText);
                    if (request.continueRequest) {
                        message = request.continueRequest.message.concat(message);
                    }
                }
            }
            if (allPages) {
                var links = self._parseLinkHeader(
                    xhr.getResponseHeader("link") || "");
                if (links.next) {
                    request.continueRequest = {
                        url: links.next,
                        deferred: deferred,
                        message: message
                    };
                    self._request(request);
                    return;
                }
            }
            if (responseHeaders && responseHeaders.length) {
                response = {response: message};

                responseHeaders.forEach(function(header) {
                    response[header] = xhr.getResponseHeader(header);
                });
                deferred.resolve(response);
            }
            else {
                deferred.resolve(message);
            }
        } else {
            var error;
            // Try and give a friendly error from Github
            if (xhr.responseText) {
                var errors;
                try {
                    response = JSON.parse(xhr.responseText);
                    errors = response.errors;
                    message = response.message;
                } catch (e) {
                    // ignore
                }
                if (errors && errors[0] && errors[0].message) {
                    error = new Error(errors[0].message);
                } else if (message && message.length) {
                    //console.log(request.url + queryString);
                    error = new Error(message);
                }
            }

            if (!error) {
                error = new Error("Cannot " + request.method + " " + JSON.stringify(self.API_URL + request.url + queryString));
            }

            error.xhr = xhr;
            deferred.reject(error);
        }
    }, false);
    xhr.addEventListener("error", function() {
        var error = new Error("Cannot " + request.method + " " + JSON.stringify(self.API_URL + request.url + queryString));
        error.xhr = xhr;
        deferred.reject(error);
    }, false);

    xhr.setRequestHeader("Accept", "application/vnd.github.v3" + param + "+json");
    if (this._accessToken) {
        xhr.setRequestHeader("Authorization", "token " + this._accessToken);
    }
    if (request.headers) {
        Object.keys(request.headers).forEach(function(header) {
            xhr.setRequestHeader(header, request.headers[header]);
        });
    }

    if (request.data) {
        xhr.setRequestHeader("Content-Type", "application/x-www-form-urlencoded");
        xhr.send(JSON.stringify(request.data));
    } else {
        xhr.send();
    }

    return deferred.promise;
};

GithubApi.prototype._parseLinkHeader = function(linkHeader) {
    var links = {};

    linkHeader.split(",")
    .forEach(function(linkItem) {
        var matches = linkItem.match(/\s*<(.*)>\s*;\s*rel="([^"]+)"/);
        if (matches) {
            var link = matches[1];
            var rel = matches[2];
            links[rel] = link;
        }
    });

    return links;
}