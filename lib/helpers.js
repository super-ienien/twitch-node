module.exports = {
    deferred() {
        const deferred = {
            retryCount: 0
        };
        deferred.promise = new Promise(function (resolve, reject) {deferred.resolve = resolve; deferred.reject = reject});
        return deferred;
    }
};