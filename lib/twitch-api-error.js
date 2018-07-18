const helpers = require ('./helpers');

class TwitchApiError extends Error
{
    constructor(app, requestOptions, credentials, httpResponse, error)
    {
        super(error.message);
        this.app = app;
        this.httpResponse = httpResponse;
        this.requestOptions = requestOptions;
        this.error = error;

        this.retry = function ()
        {
            return app._send (this.requestOptions, this.credentials, helpers.deferred());
        };

        if (httpResponse && httpResponse.headers['Ratelimit-Limit'])
        {
            this.app.rateLimit = {
                limit: httpResponse.headers['Ratelimit-Limit'],
                remaining: httpResponse.headers['Ratelimit-Remaining'],
                reset: httpResponse.headers['Ratelimit-Reset']
            };

        }
    }


}

module.exports = TwitchApiError;