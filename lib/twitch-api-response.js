const helpers = require('./helpers');

class TwitchApiResponse
{
    constructor(app, requestOptions, credentials, httpResponse, json)
    {
        this.app = app;
        this.requestOptions = requestOptions;

        for (let i in json)
        {
            this[i] = json[i];
        }

        if (httpResponse && httpResponse.headers['ratelimit-limit'])
        {
            this.app.rateLimit = {
                limit: httpResponse.headers['ratelimit-limit'],
                remaining: httpResponse.headers['ratelimit-remaining'],
                reset: httpResponse.headers['ratelimit-reset']
            };
        }
    }

    repeat ()
    {
        this.app._send(this.requestOptions, this.credentials, helpers.deferred());
    }

    after ()
    {
        if (!this.pagination) throw new Error ("This response has no pagination cursor");
        this.requestOptions.qs.after = this.pagination.cursor;
        this.app._send(this.requestOptions, this.credentials, helpers.deferred());
    }

    before (updateOpts)
    {
        if (!this.pagination) throw new Error ("This response has no pagination cursor");
        this.requestOptions.qs.before = this.pagination.cursor;
        this.app._send(this.requestOptions, this.credentials, helpers.deferred());
    }

    hasPagination ()
    {
        return !!this.pagination;
    }
}

module.exports = TwitchApiResponse;