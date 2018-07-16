class TwitchResponse
{
    constructor(requestOptions, httpResponse, json)
    {
        this.app = app;
        this.requestOptions = requestOptions;
        this.data = json.data;

        if (json.pagination)
        {
            this.pagination = json.pagination;
        }

        if (httpResponse)
        {
            this.app.rateLimit = {
                limit: httpResponse.headers['Ratelimit-Limit'],
                remaining: httpResponse.headers['Ratelimit-Remaining'],
                reset: httpResponse.headers['Ratelimit-Reset']
            };

        }
    }

    repeat (updateOpts)
    {
        this.app.send(this.requestOptions.uri, Object.assign({}, this.requestOptions, {auth: this.auth}, updateOpts));
    }

    after (updateOpts)
    {
        if (!this.pagination) throw new Error ("This response has no pagination cursor");
        return this.app.send(this.requestOptions.uri, Object.assign({after: this.pagination.cursor}, this.requestOptions, {auth: this.auth}, updateOpts));
    }

    before (updateOpts)
    {
        if (!this.pagination) throw new Error ("This response has no pagination cursor");
        return this.app.send(this.requestOptions.uri, Object.assign({before: this.pagination.cursor}, this.requestOptions, {auth: this.auth}, updateOpts));
    }

    hasPagination ()
    {
        return !!this.pagination;
    }
}

module.exports = TwitchResponse;