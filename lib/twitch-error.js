class TwitchError extends Error
{
    constructor(app, requestOptions, auth, httpResponse, error)
    {
        super(error.message);
        this.app = app;
        this.httpResponse = httpResponse;
        this.requestOptions = requestOptions;
        this.requestOptions = requestOptions;
        this.error = error;

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

    retry (updateOpts)
    {
        this.app.send(this.requestOptions.uri, Object.assign({}, this.requestOptions, {auth: this.auth}, updateOpts));
    }
}

module.exports = TwitchResponse;