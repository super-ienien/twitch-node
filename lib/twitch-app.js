const oauth2 = require ('simple-oauth2');
const EventEmitter = require('events');

const TWITCH_HOST = 'https://id.twitch.tv/';
const TWITCH_VERSION = 'helix';

class TwitchApp extends EventEmitter
{
    constructor (opts)
    {
        super();
        if (typeof opts.clientId === 'string' && typeof opts.clientSecret === 'string')
        {
            this.oauth = oauth2.create({
                client: {
                    id: opts.clientId,
                    secret: opts.clientSecret
                },
                auth: {
                    tokenHost: TWITCH_HOST
                }
            });
        }

        this.appToken = opts.appToken;
        this.redirectUri = opts.redirectUri;

        this.rateLimit = {
            limit: 120,
            remaining: 120,
            reset: -1
        };
    }

    rateLimitInterval ()
    {
        if (this.rateLimit.reset > Date.now())
        {
            return (this.rateLimit.reset - Date.now()) / this.rateLimit.remaining;
        }
        else
        {
            return 500;
        }
    }

    createUser(token)
    {
        return new TwitchUser(this, token);
    }

    authenticate(scope)
    {
        if (!this.oauth) throw new Error ('You must provide clientID and clientSecret');

        return this.oauth.clientCredentials.getToken({
            scope,
        })
        .then((result) => {
            this.appToken = this.oauth.accessToken.create(result);
            return result;
        });
    }

    authenticateUser(opts)
    {
        if (!this.oauth) throw new Error('You must provide clientID and clientSecret');

        const scope = opts.scope || this.scope;
        const state = opts.state;
        const forceVerify = opts.forceVerify;
        const redirectUri = opts.redirectUri || this.redirectUri;

        // Authorization oauth2 URI
        const uri = this.oauth.authorizationCode.authorizeURL({
            redirect_uri,
            scope,
            state,
            force_verify
        });

        return {
            uri,
            getToken (code, incomingState)
            {
                if (typeof state !== 'undefined' && incomingState !== state) throw new Error ('states does not match, possible CSRF attack');

                return this.oauth.authorizationCode.getToken({
                    code,
                    redirect_uri: redirectUri,
                    scope
                });
            }
        }
    }

    get (endpoint, params)
    {
        this.send(endpoint, {
            qs, params,
            method: 'GET'
        });
    }

    post (endpoint, params)
    {
        this.send(endpoint, {
            qs: params,
            method: 'POST'
        });
    }

    put ()
    {
        this.send(endpoint, {
            qs: params,
            method: 'PUT'
        });
    }

    send (endpoint, opts, deferred)
    {
        if (!deferred)
        {
            deferred = {
                retryCount: 0
            };
            deferred.promise = new Promise(function (resolve, reject) {deferred.resolve = resolve; deferred.reject = reject});
        }

        let auth;
        if (opts && opts.auth)
        {
            auth = opts.auth;
            delete opts.auth;
        }
        const requestOptions = {uri: TWITCH_HOST + TWITCH_VERSION + '/' + endpoint, json: true, ...opts};
        if (auth)
        {
            requestOptions.auth = {
                bearer: auth.access_token
            };
        }

        request(requestOptions, (error, response, json) => {
            if (error)
            {
                return deferred.reject(new TwitchError (this, requestOptions, auth, null, error))
            }

            switch (response.statusCode)
            {
                case 401:
                    if (response.headers['WWW-Authenticate'] && response.headers['WWW-Authenticate'].indexOf('invalid_token') > -1 && auth && auth.refresh_token)
                    {
                        this.refreshToken(auth)
                        .then((result) => {
                            requestOptions.auth = result;
                            this.send(endpoint, requestOptions, deferred);
                        })
                        .catch((error) => {
                            deferred.reject(new TwitchError (this, requestOptions, auth, response, error))
                        });
                    }
                    else deferred.reject(new TwitchError (this, requestOptions, auth, response, new Error (response.statusMessage)));
                break;
                case 501:
                    deferred.retryCount++;
                    if (deferred.retryCount > 3)
                    {
                        deferred.reject(new TwitchError (this, requestOptions, auth, null, new Error (response.statusMessage)));
                    }
                    else
                    {
                        requestOptions.auth = result;
                        this.send(endpoint, requestOptions, deferred);
                    }
                break;
                case 200:
                    return new TwitchResponse (this, requestOptions, auth, response, json);
                break;
            }
        });

        return deferred.promise;
    }

    refreshToken(auth)
    {
        return this.oauth.accessToken.create(auth).refresh()
        .then(function (result)
        {
            this.emit('token-refresh', auth, result);
            return result;
        });
    }
}

module.exports = TwitchApp;