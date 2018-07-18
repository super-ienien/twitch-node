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

        if (httpResponse && httpResponse.headers['Ratelimit-Limit'])
        {
            this.app.rateLimit = {
                limit: httpResponse.headers['Ratelimit-Limit'],
                remaining: httpResponse.headers['Ratelimit-Remaining'],
                reset: httpResponse.headers['Ratelimit-Reset']
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