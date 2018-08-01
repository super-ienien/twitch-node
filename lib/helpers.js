const constants = require('./constants');

const camelCasePattern = /([A-Z])/m;

module.exports = {
    deferred() {
        const deferred = {
            retryCount: 0
        };
        deferred.promise = new Promise(function (resolve, reject) {deferred.resolve = resolve; deferred.reject = reject});
        return deferred;
    },

    makeWebhookTopicUrl (options)
    {
        if (typeof options === 'string')
        {
            if (options.startsWith(constants.HELIX_URI)) return options;
            return constants.HELIX_URI + '/' + options;
        }
        else if (typeof options === 'object' && options !== null)
        {
            let url = constants.HELIX_URI + '/' + options.endpoint;
            let qs = [];
            for (let i in options)
            {
                if (i === 'endpoint') continue;
                i = i.replace(camelCasePattern, '_$1');
                qs.push(i + '=' + encodeURIComponent(options[i]));
            }

            if (qs.length)
            {
                url += '?' + qs.join('&');
            }

            return url;
        }
        else
        {
            throw new Error ('topic must be a string or an object');
        }
    }
};