# How to generate stats

## Activity and Users
First fetch the user data from rollbar:

`node ./rollbar-stats.js <start date yyyy-mm-dd> [<end date yyyy-mm-dd>]`

Examples:

`node ./rollbar-stats.js 2014-07-27` - Gets data for the 2014-07-27 day.

`node ./rollbar-stats.js 2014-07-25 2014-07-27` - Gets data for the 2014-07-25 - 2014-07-27 time period.

This command will create the `users_<start date yyyy-mm-dd>_<end date yyyy-mm-dd>.json` file and it will create or update the `report-data.json` file.

The format of the `users_*.json` file is:
```
{
    "username": [array of all rollbar instances timestamps],
    ...
}
```

The format of the `report-data.json` file is:
```
{
    "days": {
        "yyyy/mm/dd"
    }
    ...
}
```

Usernames in the `ignore-usernames.txt` file are ignored and will not be part of the json file created.

Then, execute the command that sill process the data and create the CSV files with the stats:

`node ./build_report.js <users data json file>`

Example:

`node ./build_report.js users_2014-07-27.json`

This will create or update the `users.csv` and `activity.csv` files.

## Github

First fetch the user data from github:

`node ./github-stats.js`

This command will create or update the `github-stats.json` file.

The format of this file is:
```
{
    "users": {
        "username": {
            "avatar_url",
            "name",
            "company",
            "location",
            "email",
            "bio",
            "created_at",
            "public_repos",
            "repos": {
                "repo-name": {
                    "isTodoFork": <boolean>,
                    "isPopcornFork": <boolean>,
                    "masterNumberCommits": <number>,
                    "shadowNumberCommits": <number>
                },
                ...
            }
        },
        ...
    }
}
```

Then, execute the command that sill process the data and create the CSV files with the github stats:

`node ./build-github-report.js github-stats.json`

This command will create the `github.csv` file.


## Content of the CSV files
### users.csv

`date` - the date of the data, this is an entire day (12:00am to 11:59pm PST).

`active_users` - the number of unique users that used montage studio.

`new_users` - the number of users that used montage studio for the very first time.

### activity.csv

This report uses the concept of active day. An active day is a day (a time period between 12:00am - 11:59pm PST) where the user opened montage studio at least once. It does not imply that the user actually spent time using montage studio.

`username` - the github username.

`active_days` - the total number of active days since account creation.

`last_active_day` - the last active day.

`first_active_day` - the first active day, this is the first time the user opened montage studio.

`active_range_ratio` - days\_between(first\_active\_day, last\_active\_day) / days\_between(first\_active\_day, today) - this is a tentative number for knowing when the person stopped using the website but by giving a bigger score to people who have used the site longer. If user A and B haven't used the website for the past 5 days but user A has used it for a total of 30 days while user B only used it for 10 days, user A will have a better score.

`active_days_ratio` - active\_days / days\_between(first\_active\_day, today) - the percentage of time the user has used the tool, since its first usage.

### github.csv

`user` - the github username.

`montage_repo` - montage repository name.

`new_commits` - number of commits after master, trying to understand how many commits were made in montage studio.

`new_github_user` - if this user created a github account just to use montage studio. This is an heuristic, this is true when the github account creation matches the day of first usage of montage studio.


