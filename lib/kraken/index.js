const constants = require ('../constants');
const TwitchApiError = require ('../twitch-api-error');
const TwitchApiResponse = require ('../twitch-api-response');
const helpers = require ('../helpers');
const request = require ('request');

class Kraken
{
    constructor(app)
    {
        this.app = app;
        this.rateLimit = {
            limit: 120,
            remaining: 120,
            reset: -1
        };
    }

    get (endpoint, params, requestOptions)
    {
        return this.send(endpoint, params, {...requestOptions, method: 'GET'});
    }

    post (endpoint, params, requestOptions)
    {
        return this.send(endpoint, params, {...requestOptions, method: 'POST'});
    }

    put (endpoint, params, requestOptions)
    {
        return this.send(endpoint, params, {...requestOptions, method: 'PUT'});
    }

    send (endpoint, params = {}, requestOptions)
    {
        const options = {
            uri: constants.KRAKEN_URI + '/' + endpoint,
            json: true,
            qs: Object.assign({}, params),
            //qs: Object.assign({client_id: this.app.clientId}, params),
            ...requestOptions
        };

        const deferred = helpers.deferred();

        let credentials;
        if (params.credentials  && typeof params.credentials === 'object')
        {
            credentials = Object.assign({}, params.credentials);
            delete options.qs.credentials;
        }

        return this._send(options, credentials, deferred);
    }

    _send (requestOptions, credentials, deferred)
    {
        if (credentials)
        {
            requestOptions.headers = Object.assign({}, requestOptions.headers, {
                Authorization: 'OAuth ' + credentials.access_token,
                'Client-ID': this.app.clientId
            });
        }

        request(requestOptions, (error, response, json) => {
            if (error)
            {
                return deferred.reject(new TwitchApiError (this, requestOptions, credentials, null, error))
            }

            switch (response.statusCode)
            {
                case 401:
                    if (credentials && credentials.refresh_token && deferred.retryCount === 0) //response.headers['WWW-Authenticate'] && response.headers['WWW-Authenticate'].indexOf('invalid_token') > -1 &&
                    {
                        deferred.retryCount = 1;
                        this.app.refreshToken(credentials)
                        .then((result) => {
                            this._send(requestOptions, result, deferred);
                        })
                        .catch((error) => {
                            deferred.reject(new TwitchApiError (this, requestOptions, credentials, response, error))
                        });
                    }
                    else deferred.reject(new TwitchApiError (this, requestOptions, credentials, response, new Error (response.statusMessage)));
                    break;
                case 501:
                    deferred.retryCount++;
                    if (deferred.retryCount > 3)
                    {
                        deferred.reject(new TwitchApiError (this, requestOptions, credentials, null, new Error (response.statusMessage)));
                    }
                    else
                    {
                        this._send(requestOptions, credentials, deferred);
                    }
                    break;
                case 200:
                    deferred.resolve(new TwitchApiResponse (this, requestOptions, credentials, response, json));
                    break;
                default:
                    deferred.reject(new TwitchApiError (this, requestOptions, credentials, response, new Error (response.statusMessage)));
            }
        });

        return deferred.promise;
    }
}

module.exports = Kraken;