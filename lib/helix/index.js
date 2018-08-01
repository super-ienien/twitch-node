const constants = require ('../constants');
const TwitchApiError = require ('../twitch-api-error');
const TwitchApiResponse = require ('../twitch-api-response');
const helpers = require ('../helpers');
const request = require ('request');
const EventEmitter = require('events');

class Helix extends EventEmitter
{
    constructor(app)
    {
        super();
        this.app = app;
        this.rateLimit = {
            limit: 120,
            remaining: 120,
            reset: -1
        };
    }

    rateLimitInterval (minimum = 0)
    {
        let current;
        if (this.rateLimit.reset > Date.now())
        {
            current = (this.rateLimit.reset - Date.now()) / this.rateLimit.remaining;
        }
        else
        {
            current = 500;
        }

        return current > minimum ? current:minimum;
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

    subscribe (options, requestOptions)
    {
        const params = {
            'hub.callback': options.callback,
            'hub.topic': helpers.makeWebhookTopicUrl(options.topic),
            'hub.mode': 'subscribe'
        };

        if (typeof options.leaseSeconds === 'number') params['hub.lease_seconds'] = options.leaseSeconds;
        if (typeof options.secret === 'string') params['hub.secret'] = options.secret;
        if (typeof options.credentials !== 'undefined') params.credentials = options.credentials;

        return this.send('webhooks/hub', params, {...requestOptions, method: 'POST'});
    }

    unsubscribe (options, requestOptions)
    {
        const params = {
            'hub.callback': options.callback,
            'hub.topic': helpers.makeWebhookTopicUrl(options.topic),
            'hub.mode': 'unsubscribe'
        };

        if (typeof options.leaseSeconds === 'number') params['hub.lease_seconds'] = options.leaseSeconds;
        if (typeof options.secret === 'string') params['hub.secret'] = options.secret;
        if (typeof options.credentials !== 'undefined') params.credentials = options.credentials;

        return this.send('webhooks/hub', params, {...requestOptions, method: 'POST'});
    }

    send (endpoint, params = {}, requestOptions)
    {
        const options = {
            uri: constants.HELIX_URI + '/' + endpoint,
            json: true,
            ...requestOptions
        };

        const deferred = helpers.deferred();

        const endpointParams = Object.assign({}, params);

        let credentials;
        if (params.credentials  && typeof params.credentials === 'object')
        {
            credentials = Object.assign({}, params.credentials);
            delete endpointParams.credentials;
        }

        if (requestOptions.method === 'POST')
        {
            options.body = endpointParams;
        }
        else
        {
            options.qs = endpointParams;
        }

        return this._send(options, credentials, deferred);
    }

    _send (requestOptions, credentials, deferred)
    {
        if (credentials)
        {
            requestOptions.auth = {
                bearer: credentials.access_token
            };
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
                        this.app.auth.refreshToken(credentials)
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
                default:
                    if (response.statusCode >= 200 && response.statusCode < 300)
                    {
                        deferred.resolve(new TwitchApiResponse (this, requestOptions, credentials, response, json));
                    }
                    else
                    {
                        deferred.reject(new TwitchApiError (this, requestOptions, credentials, response, new Error (response.statusMessage + ' : ' + response.body)));
                    }
            }
        });

        return deferred.promise;
    }
}

module.exports = Helix;